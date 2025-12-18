import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { createCdpAuthHeaders } from "@coinbase/x402";
import handler from "@tanstack/react-start/server-entry";
import { getServerConfig } from "./config/env";
import {
  createPublicClient,
  http,
  keccak256,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import {
  AGREEMENT_CREATED_EVENT,
  AGREEMENT_SIGNED_EVENT,
  checkAgreementExists,
  checkHasSigned,
  computeAgreementId,
  networkToChainRef,
  recordSignature,
  registerAgreement,
} from "./lib/agreement-oracle";
import { buildAddressUrl, buildTxUrl, getNetworkCaip2 } from "./lib/network";
import { uploadToIPFS } from "./lib/pinata";
import {
  validateCreateBody,
  validateSignBody,
  ValidationError,
} from "./lib/validation";
import { createX402InitMiddleware } from "./lib/x402-init";
import {
  processPayment,
  handlePaymentError,
  type PaymentConfig,
} from "./lib/x402-payment";

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
  isProtectedRequest: (method, path) => {
    const m = method.toUpperCase();
    return m === "POST" && (path === "/api/create" || path === "/api/sign");
  },
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

// Payment config
const paymentConfig: PaymentConfig = {
  network: networkCaip2,
  payTo: payTo,
  usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  prices: {
    create: config.payment.createPrice,
    sign: config.payment.signPrice,
  },
};

// Hono app
const app = new Hono<{ Variables: RequestIdVariables }>();
app.use("*", requestId({ headerName: "x-request-id" }));
app.use("*", logger(customLogger));
app.use("/api/*", x402InitMiddleware);

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

app.get("/api/agreement/:id", async (c) => {
  const reqId = c.get("requestId");
  const id = c.req.param("id");

  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return c.json({ error: "Invalid agreementId", requestId: reqId }, 400);
  }

  const publicClient = createPublicClient({
    transport: http(config.blockchain.rpcUrl),
  });

  // Use max range of 99,999 blocks (under 100k limit) from current block
  const MAX_BLOCK_RANGE = 99_999n;
  const currentBlock = await publicClient.getBlockNumber();
  const startBlock = config.blockchain.contractStartBlock;
  // Never go before contract deployment, and never exceed 100k block range
  const fromBlock = currentBlock > startBlock + MAX_BLOCK_RANGE
    ? currentBlock - MAX_BLOCK_RANGE
    : startBlock;

  const createdLogs = await publicClient.getLogs({
    address: config.blockchain.contractAddress as Address,
    event: parseAbiItem(AGREEMENT_CREATED_EVENT),
    args: { agreementId: id as `0x${string}` },
    fromBlock,
    toBlock: currentBlock,
  });

  const createdLog = createdLogs[0];
  const created = createdLog?.args as any;
  if (!created) {
    return c.json({ error: "Agreement not found", requestId: reqId }, 404);
  }

  // Use creation block as starting point for signature queries
  const creationBlock = createdLog.blockNumber ?? fromBlock;

  const signedLogs = await publicClient.getLogs({
    address: config.blockchain.contractAddress as Address,
    event: parseAbiItem(AGREEMENT_SIGNED_EVENT),
    args: { agreementId: id as `0x${string}` },
    fromBlock: creationBlock,
    toBlock: currentBlock,
  });

  const ipfsUrl = `https://${config.pinata.gateway}/ipfs/${created.cid}`;
  const chainRef = created.chainRef || config.blockchain.chainRef || networkToChainRef(config.blockchain.network);
  const contractAddress = config.blockchain.contractAddress;

  return c.json({
    agreementId: created.agreementId,
    docHash: created.docHash,
    cid: created.cid,
    ipfsUrl,
    link: getAgreementLink(id),
    contract: {
      address: contractAddress,
      chainRef,
      explorerUrl: buildAddressUrl(chainRef, contractAddress),
    },
    creator: {
      address: created.creator,
      paymentRef: created.paymentRef,
      chainRef: created.chainRef,
      explorerUrl: buildTxUrl(created.chainRef, created.paymentRef),
    },
    signers: signedLogs.map((log) => {
      const args = log.args as any;
      return {
        address: args.signer,
        paymentRef: args.paymentRef,
        chainRef: args.chainRef,
        explorerUrl: buildTxUrl(args.chainRef, args.paymentRef),
      };
    }),
  });
});

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

  // Process payment - GET REAL TX HASH
  const paymentResult = await processPayment(
    c,
    resourceServer,
    paymentConfig,
    "create",
  );
  if (!paymentResult.success) {
    return handlePaymentError(c, paymentResult, reqId);
  }

  // paymentRef is now the REAL tx hash
  const paymentRef = paymentResult.txHash;
  customLogger(`[create] payment settled: ${paymentRef}`);

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

app.post("/api/sign", async (c) => {
  const reqId = c.get("requestId");

  const body = await c.req.json().catch(() => null);
  const { agreementId, signerAddress } = validateSignBody(body);

  customLogger(
    `[sign] ${agreementId.slice(0, 10)}… by ${signerAddress.slice(0, 6)}… (${reqId})`,
  );

  // Validate agreement exists BEFORE processing payment
  const exists = await checkAgreementExists({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    agreementId: agreementId as Hash,
  });

  if (!exists) {
    return c.json({ error: "Agreement not found", requestId: reqId }, 404);
  }

  // Check not already signed BEFORE processing payment
  const alreadySigned = await checkHasSigned({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    agreementId: agreementId as Hash,
    signer: signerAddress,
  });

  if (alreadySigned) {
    return c.json({ error: "Already signed", requestId: reqId }, 409);
  }

  // Process payment - GET REAL TX HASH
  const paymentResult = await processPayment(
    c,
    resourceServer,
    paymentConfig,
    "sign",
  );
  if (!paymentResult.success) {
    return handlePaymentError(c, paymentResult, reqId);
  }

  // paymentRef is now the REAL tx hash
  const paymentRef = paymentResult.txHash;
  customLogger(`[sign] payment settled: ${paymentRef}`);

  const chainRef =
    config.blockchain.chainRef || networkToChainRef(config.blockchain.network);

  customLogger(`[sign] recording signature on-chain… (${reqId})`);
  const contractTx = await recordSignature({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    serverPrivateKey: config.wallet.privateKey as `0x${string}`,
    agreementId: agreementId as Hash,
    signer: signerAddress,
    paymentRef,
    chainRef,
    waitForConfirmation: true,
  });

  customLogger(`[sign] recorded: ${contractTx.txHash} (${reqId})`);

  return c.json({
    agreementId,
    signer: signerAddress,
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
