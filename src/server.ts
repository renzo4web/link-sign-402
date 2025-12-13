import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
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

export const customLogger = (message: string, ...rest: string[]) => {
  console.log(message, ...rest);
};

const app = new Hono<{ Variables: RequestIdVariables }>()

const config = getServerConfig();
const payTo = config.blockchain.payToAddress as `0x${string}`;
const networkCaip2 = getNetworkCaip2(config.blockchain.network);

const facilitatorUrl = "https://api.cdp.coinbase.com/platform/v2/x402";

if (!config.cdp.apiKeyId || !config.cdp.apiKeySecret) {
  throw new Error("CDP_API_KEY_ID and CDP_API_KEY_SECRET required");
}

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
  createAuthHeaders: createCdpAuthHeaders(
    config.cdp.apiKeyId,
    config.cdp.apiKeySecret,
  ),
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  networkCaip2,
  new ExactEvmScheme(),
);

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

await resourceServer.initialize();
customLogger(`[x402] Init: ${networkCaip2} → ${payTo}`);

// 1. Request ID middleware
app.use("*", requestId({ headerName: "x-request-id" }));

// 2. Logger
app.use("*", logger(customLogger));

// 3. x402 payment middleware
// CRITICAL: syncFacilitatorOnStart MUST be false when using Vite dev server / TanStack Start.
// When true, the middleware attempts to sync with the facilitator during request processing,
// which hangs in Vite's async context. We initialize the resourceServer above at module level
// (await resourceServer.initialize()) before any requests are handled, so the middleware can
// safely use syncFacilitatorOnStart=false and rely on the pre-initialized state.
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
    undefined, // verifyCallback
    undefined, // settleCallback
    false, // syncFacilitatorOnStart
  ),
);

app.onError((error, c) => {
  const requestId = c.get("requestId");
  const msg = error instanceof Error ? error.message : String(error);
  customLogger(`[error] ${c.req.method} ${c.req.path} - ${msg} (${requestId})`);

  if (c.req.path.startsWith("/api/")) {
    const status = error instanceof ValidationError ? 400 : 500;
    return c.json({ error: msg, requestId }, status);
  }

  return c.text("Internal Server Error", 500);
});

const APP_DOMAIN = 'https://linksignx402.xyz'
const getAgreementLink = (id: string) => `${APP_DOMAIN}/a/${id}`

app.post('/api/create', async (c) => {
  const requestId = c.get('requestId')

  const body = await c.req.json().catch(() => null);
  const { fileName, creatorAddress, fileBytes } = validateCreateBody(body);

  customLogger(
    `[create] ${fileName} (${fileBytes.length}b) by ${creatorAddress.slice(0, 6)}… (${requestId})`,
  );

  const docHash = keccak256(fileBytes) as Hash;

  let cid: string;
  try {
    cid = await uploadToIPFS(fileBytes, fileName);
  } catch (err) {
    customLogger(
      `[create] ipfs failed: ${err instanceof Error ? err.message : err} (${requestId})`,
    );
    return c.json({ error: "IPFS upload failed", requestId }, 502);
  }
  customLogger(`[create] ipfs: ${cid}`);

  const paymentHeader = c.req.header("PAYMENT-SIGNATURE");
  if (!paymentHeader) {
    return c.json({ error: "Missing PAYMENT-SIGNATURE", requestId }, 402);
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
    customLogger(`[create] already exists (${requestId})`);
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

  customLogger(`[create] registered: ${contractTx.txHash} (${requestId})`);

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

app.all("*", (c) => handler.fetch(c.req.raw));

export default app;
