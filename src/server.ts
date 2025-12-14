import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { paymentMiddleware } from "@x402/hono";
import { createCdpAuthHeaders } from "@coinbase/x402";
import handler from "@tanstack/react-start/server-entry";
import { getServerConfig } from "./config/env";
import { keccak256, toBytes, type Address, type Hash } from "viem";
import {
  assertBytes32,
  checkAgreementExists,
  computeAgreementId,
  networkToChainRef,
  registerAgreement,
} from "./lib/agreement-oracle";
import { getNetworkCaip2 } from "./lib/network";
import { uploadToIPFS } from "./lib/pinata";
import { validateCreateBody, ValidationError } from "./lib/validation";
import { createX402InitMiddleware } from "./lib/x402-init";

// Logging
export const customLogger = (message: string, ...rest: string[]) => {
  console.log(message, ...rest);
};

// Config
const config = getServerConfig();
const payTo = config.blockchain.payToAddress as `0x${string}`;
const networkCaip2 = getNetworkCaip2(config.blockchain.network);

if (!config.cdp.apiKeyId || !config.cdp.apiKeySecret) {
  throw new Error("CDP_API_KEY_ID and CDP_API_KEY_SECRET required");
}

// x402 payment setup (lazy init for Workers, see lib/x402-init.ts)
const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
const cdpAuthHeaders = createCdpAuthHeaders(config.cdp.apiKeyId, config.cdp.apiKeySecret);

if (!cdpAuthHeaders) {
  throw new Error("Failed to create CDP auth headers");
}

const { middleware: x402InitMiddleware, resourceServer } = createX402InitMiddleware({
  facilitatorUrl: CDP_FACILITATOR_URL,
  network: networkCaip2,
  createAuthHeaders: cdpAuthHeaders,
  logger: customLogger,
  isProtectedRequest: (method, path) =>
    method.toUpperCase() === "POST" && path === "/api/create",
});

resourceServer
  .onVerifyFailure(async ({ requirements, error }) => {
    const msg = error instanceof Error ? error.message : String(error);
    customLogger(
      `[x402] verify failed: ${msg} (${requirements.scheme}@${requirements.network})`,
    );
  })
  .onSettleFailure(async ({ requirements, error }) => {
    const msg = error instanceof Error ? error.message : String(error);
    customLogger(
      `[x402] settle failed: ${msg} (${requirements.scheme}@${requirements.network})`,
    );
  })
  .onAfterVerify(async ({ result }) => {
    customLogger(`[x402] verify: ${result.isValid ? "✓" : "✗"}`);
  })
  .onAfterSettle(async ({ result }) => {
    const tx = (result as any)?.transaction || "N/A";
    customLogger(`[x402] settle: ${result.success ? "✓" : "✗"} tx=${tx}`);
  });

customLogger(`[x402] config: ${networkCaip2} → ${payTo}`);

// Hono app
const app = new Hono<{ Variables: RequestIdVariables }>();
app.use("*", requestId({ headerName: "x-request-id" }));
app.use("*", logger(customLogger));
app.use("/api/*", x402InitMiddleware);
app.use(
  paymentMiddleware(
    {
      "POST /api/create": {
        accepts: [
          {
            scheme: "exact",
            price: config.payment.createPrice,
            network: networkCaip2,
            payTo,
          },
        ],
        description: "Create agreement",
        mimeType: "application/json",
      },
    },
    resourceServer,
    undefined,
    undefined,
    false, // syncFacilitatorOnStart=false, we use x402InitMiddleware
  ),
);

// Error handler
app.onError((error, c) => {
  const reqId = c.get("requestId");
  const msg = error instanceof Error ? error.message : String(error);
  customLogger(`[error] ${c.req.method} ${c.req.path} - ${msg} (${reqId})`);

  if (c.req.path.startsWith("/api/")) {
    const status = error instanceof ValidationError ? 400 : 500;
    return c.json({ error: msg, requestId: reqId }, status);
  }

  return c.text("Internal Server Error", 500);
});

// Routes
const APP_DOMAIN = "https://linksignx402.xyz";
const getAgreementLink = (id: string) => `${APP_DOMAIN}/a/${id}`;

app.post("/api/create", async (c) => {
  const reqId = c.get("requestId");

  const body = await c.req.json().catch(() => null);
  const { fileName, creatorAddress, fileBytes } = validateCreateBody(body);

  customLogger(
    `[create] ${fileName} (${fileBytes.length}b) by ${creatorAddress.slice(0, 6)}… (${reqId})`,
  );

  const docHash = keccak256(fileBytes) as Hash;

  let cid: string;
  try {
    cid = await uploadToIPFS(fileBytes, fileName);
  } catch (err) {
    customLogger(
      `[create] ipfs failed: ${err instanceof Error ? err.message : err} (${reqId})`,
    );
    return c.json({ error: "IPFS upload failed", requestId: reqId }, 502);
  }
  customLogger(`[create] ipfs: ${cid}`);

  const paymentHeader = c.req.header("PAYMENT-SIGNATURE");
  if (!paymentHeader) {
    return c.json({ error: "Missing PAYMENT-SIGNATURE", requestId: reqId }, 402);
  }

  const paymentRef = keccak256(toBytes(paymentHeader)) as Hash;
  assertBytes32(paymentRef, "paymentRef");

  const chainRef =
    config.blockchain.chainRef || networkToChainRef(config.blockchain.network);
  const agreementId = computeAgreementId(docHash, creatorAddress, paymentRef);
  customLogger(`[create] agreementId: ${agreementId}`);

  const alreadyExists = await checkAgreementExists({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    agreementId,
  });

  if (alreadyExists) {
    customLogger(`[create] already exists (${reqId})`);
    return c.json({
      agreementId,
      docHash,
      cid,
      creator: creatorAddress,
      paymentRef,
      chainRef,
      txHash: null,
      link: getAgreementLink(agreementId),
      alreadyExisted: true,
    });
  }

  customLogger(`[create] registering on-chain…`);
  const contractTx = await registerAgreement({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    serverPrivateKey: config.wallet.privateKey as `0x${string}`,
    agreementId,
    docHash,
    cid,
    creator: creatorAddress,
    paymentRef,
    chainRef,
    waitForConfirmation: true,
  });

  customLogger(`[create] registered: ${contractTx.txHash} (${reqId})`);

  return c.json({
    agreementId,
    docHash,
    cid,
    creator: creatorAddress,
    paymentRef,
    chainRef,
    txHash: contractTx.txHash,
    confirmed: contractTx.confirmed,
    link: getAgreementLink(agreementId),
  });
});

// SSR fallback
app.all("*", (c) => handler.fetch(c.req.raw));

export default app;
