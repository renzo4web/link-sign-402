/**
 * x402 V2 Server Implementation
 *
 * This server implements the x402 protocol v2 for payment-gated API endpoints.
 *
 * FLOW OVERVIEW:
 * 1. Client makes POST /api/create WITHOUT payment
 * 2. Server returns 402 Payment Required + payment instructions in PAYMENT-REQUIRED header
 * 3. Client's x402 SDK detects 402, prompts user to sign payment in wallet
 * 4. Client retries request WITH PAYMENT-SIGNATURE header (signed payment proof)
 * 5. Server validates payment via facilitator, processes request, returns 200 OK
 *
 * KEY CONCEPTS:
 * - Facilitator: Third-party service that verifies and settles payments on-chain
 * - CAIP-2: Standard format for network identifiers (e.g., "eip155:84532" = Base Sepolia)
 * - agreementId: Unique identifier = hash(docHash + creator + paymentRef)
 * - paymentRef: Derived from the signed payment, links payment to this agreement
 */

import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { createCdpAuthHeaders } from '@coinbase/x402'
import handler from '@tanstack/react-start/server-entry'
import { getServerConfig } from './config/env'
import { PinataSDK } from 'pinata'
import { keccak256, toBytes, type Address, type Hash } from 'viem'
import {
  assertBytes32,
  assertEvmAddress,
  checkAgreementExists,
  computeAgreementId,
  networkToChainRef,
  registerAgreement,
} from './lib/agreement-oracle'

// ===== HONO TYPE DEFINITIONS =====
// Variables that can be stored per-request in Hono context
type AppVariables = {
  requestId: string  // Unique ID for logging/debugging each request
}

type LogFn = (message: string, ...rest: string[]) => void

// Custom logger for consistent logging across the app
export const customLogger: LogFn = (message: string, ...rest: string[]) => {
  console.log(message, ...rest)
}

const app = new Hono<{ Variables: AppVariables }>()

// ===== SERVER CONFIGURATION =====
// Load environment variables (PAY_TO_ADDRESS, BLOCKCHAIN_NETWORK, etc.)
const config = getServerConfig()
const payTo = config.blockchain.payToAddress as `0x${string}`

// ===== CAIP-2 NETWORK IDENTIFIERS =====
// CAIP-2 is a standard format for identifying blockchain networks
// Format: "namespace:chainId" (e.g., "eip155:84532" for Base Sepolia)
// This allows x402 to work across multiple chains with a unified format
type Caip2Network = `${string}:${string}`

function getNetworkCaip2(network: string): Caip2Network {
  switch (network) {
    case 'base-sepolia': return 'eip155:84532'   // Base Sepolia testnet
    case 'base': return 'eip155:8453'            // Base mainnet
    case 'sepolia': return 'eip155:11155111'     // Ethereum Sepolia testnet
    case 'mainnet': return 'eip155:1'            // Ethereum mainnet
    default: return 'eip155:84532'
  }
}
const networkCaip2 = getNetworkCaip2(config.blockchain.network)

// ===== X402 V2 FACILITATOR SETUP =====
// The facilitator is a trusted third-party that:
// 1. Verifies payment signatures are valid
// 2. Settles payments on-chain (transfers USDC from payer to payTo address)
// 3. Returns settlement confirmation to the server
//
// CDP Facilitator (supports base-sepolia and base mainnet)
const facilitatorUrl = 'https://api.cdp.coinbase.com/platform/v2/x402'

if (!config.cdp.apiKeyId || !config.cdp.apiKeySecret) {
  throw new Error('CDP_API_KEY_ID and CDP_API_KEY_SECRET are required to use the Coinbase CDP facilitator.')
}

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
  /**
   * Coinbase CDP facilitator auth (v2):
   * CDP endpoints expect `Authorization: Bearer <JWT>` (NOT legacy `X-CDP-*` headers).
   * `createCdpAuthHeaders()` generates short-lived JWTs for /supported, /verify and /settle
   * using your CDP API key pair.
   */
  createAuthHeaders: createCdpAuthHeaders(config.cdp.apiKeyId, config.cdp.apiKeySecret),
})

// ResourceServer handles payment validation for protected routes
// .register() tells it which payment scheme to use for each network
// ExactEvmScheme = exact USDC amount payment on EVM chains
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(networkCaip2, new ExactEvmScheme())

resourceServer
  .onVerifyFailure(async ({ requirements, error }) => {
    const msg = error instanceof Error ? error.message : String(error)
    customLogger(`[x402] verify failed: ${msg} (${requirements.scheme}@${requirements.network})`)
  })
  .onSettleFailure(async ({ requirements, error }) => {
    const msg = error instanceof Error ? error.message : String(error)
    customLogger(`[x402] settle failed: ${msg} (${requirements.scheme}@${requirements.network})`)
  })
  .onAfterVerify(async ({ result }) => {
    customLogger(`[x402] verify: ${result.isValid ? '✓' : '✗'}`)
  })
  .onAfterSettle(async ({ result }) => {
    const tx = (result as any)?.transaction || 'N/A'
    customLogger(`[x402] settle: ${result.success ? '✓' : '✗'} tx=${tx}`)
  })

customLogger(`[x402] Init: ${networkCaip2} → ${payTo}`)

// ===== X402 INITIALIZATION (PREVENT "HANGING" FIRST REQUEST) =====
// The official @x402/hono middleware initializes lazily on the first protected request.
// If the facilitator call to `/supported` is slow/hanging, the request can appear to "load forever".
//
// We initialize the ResourceServer ourselves with a hard timeout and reuse the same Promise
// for all requests. This makes failures explicit and keeps the server responsive.
const x402InitTimeoutMs = Number.parseInt(process.env.X402_INIT_TIMEOUT_MS ?? '15000', 10)
let x402InitPromise: Promise<void> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[x402] Timeout after ${ms}ms during ${label}`))
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

async function ensureX402Initialized(): Promise<void> {
  if (x402InitPromise) return x402InitPromise

  x402InitPromise = (async () => {
    customLogger('[x402] initializing facilitator…')

    await withTimeout(resourceServer.initialize(), x402InitTimeoutMs, 'resourceServer.initialize()')

    const supportedKind = resourceServer.getSupportedKind(2, networkCaip2, 'exact')
    if (!supportedKind) {
      throw new Error(`Facilitator does not support "exact" on "${networkCaip2}" (x402 v2).`)
    }

    customLogger(`[x402] ready: v${supportedKind.x402Version} ${supportedKind.scheme}@${supportedKind.network}`)
  })().catch((error) => {
    const msg = error instanceof Error ? error.message : String(error)
    customLogger(`[x402] init failed: ${msg}`)
    x402InitPromise = null
    throw error
  })

  return x402InitPromise
}

// ===== HELPER FUNCTIONS =====
function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(normalized)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// ===== MIDDLEWARES =====

// 1. Request ID middleware
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)
  c.set('requestId', requestId)
  c.header('x-request-id', requestId)
  await next()
})

// 2. Logger
app.use('*', logger(customLogger))

function isX402ProtectedRequest(method: string, path: string): boolean {
  return method.toUpperCase() === 'POST' && path === '/api/create'
}

// Ensure x402 is initialized before any paid API route is processed.
// This makes failures explicit (500) instead of an infinite loading spinner.
app.use('/api/*', async (c, next) => {
  if (!isX402ProtectedRequest(c.req.method, c.req.path)) return next()

  try {
    await ensureX402Initialized()
  } catch (error) {
    const requestId = c.get('requestId')
    return c.json(
      {
        error: error instanceof Error ? error.message : 'x402 initialization failed',
        requestId,
      },
      500,
    )
  }

  return next()
})

// ===== X402 PAYMENT MIDDLEWARE (OFFICIAL @x402/hono v2) =====
app.use(
  paymentMiddleware(
    {
      'POST /api/create': {
        accepts: [
          {
            scheme: 'exact',
            price: config.payment.createPrice,
            network: networkCaip2,
            payTo: payTo,
          },
        ],
        description: 'Create a new on-chain handshake',
        mimeType: 'application/json',
      },
    },
    resourceServer,
    undefined,
    undefined,
    // `syncFacilitatorOnStart=false` because we initialize explicitly with a timeout
    // (see ensureX402Initialized) to avoid "hanging" requests when `/supported` is slow.
    false,
  ),
)

// Ensure errors become responses (avoids "hanging" requests)
app.onError((error, c) => {
  const requestId = c.get('requestId')
  const msg = error instanceof Error ? error.message : String(error)
  customLogger(`[error] ${c.req.method} ${c.req.path} - ${msg} (${requestId})`)

  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: msg, requestId }, 500)
  }

  return c.text('Internal Server Error', 500)
})

// ===== API ENDPOINTS =====

/**
 * POST /api/create - Create a new agreement on-chain
 *
 * This endpoint is PROTECTED by x402 middleware - requires payment to access.
 *
 * WHAT IT DOES:
 * 1. Receives PDF file (base64) + creator wallet address
 * 2. Computes docHash = keccak256(PDF bytes) - unique fingerprint of the document
 * 3. Uploads PDF to IPFS via Pinata - gets CID (content identifier)
 * 4. Extracts paymentRef from PAYMENT-SIGNATURE header - links payment to this agreement
 * 5. Computes agreementId = hash(docHash + creator + paymentRef) - unique ID
 * 6. Registers agreement on-chain via smart contract
 * 7. Returns all the data including txHash and shareable link
 *
 * WHY agreementId IS UNIQUE:
 * - Same PDF + same creator + different payment = different agreementId (new paymentRef)
 * - Same PDF + different creator = different agreementId (different creator address)
 * - Different PDF = different agreementId (different docHash)
 */
app.post('/api/create', async (c) => {
  const requestId = c.get('requestId')

  // Parse request body
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', requestId }, 400)
  }

  // Extract and validate inputs
  const fileBase64 = typeof (body as any)?.fileBase64 === 'string' ? (body as any).fileBase64 : undefined
  const fileName = typeof (body as any)?.fileName === 'string' ? (body as any).fileName : 'agreement.pdf'
  const creatorAddress = (body as any)?.creatorAddress

  if (!fileBase64) {
    return c.json({ error: 'Missing fileBase64', requestId }, 400)
  }

  try {
    assertEvmAddress(creatorAddress, 'creatorAddress')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Invalid creatorAddress'
    return c.json({ error: msg, requestId }, 400)
  }

  const fileBytes = base64ToBytes(fileBase64)
  if (fileBytes.length === 0) {
    return c.json({ error: 'Empty file', requestId }, 400)
  }

  customLogger(`[create] start: ${fileName} (${fileBytes.length}b) by ${creatorAddress.slice(0, 6)}… (${requestId})`)

  // STEP 1: Compute document hash (unique fingerprint of the PDF content)
  const docHash = keccak256(fileBytes) as Hash

  // STEP 2: Upload PDF to IPFS via Pinata
  const pinata = new PinataSDK({
    pinataJwt: config.pinata.jwt,
    pinataGateway: config.pinata.gateway,
  })

  const pdfFile = new File([fileBytes.buffer as ArrayBuffer], fileName, { type: 'application/pdf' })

  let upload: unknown
  try {
    upload = await pinata.upload.public.file(pdfFile)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    customLogger(`[create] pinata failed: ${msg} (${requestId})`)
    return c.json({ error: 'Failed to upload file to IPFS', requestId }, 502)
  }

  const cid = (upload as any)?.cid ?? (upload as any)?.IpfsHash ?? (upload as any)?.ipfsHash
  if (!cid || typeof cid !== 'string') {
    customLogger(`[create] pinata: no CID (${requestId})`)
    return c.json({ error: 'Pinata upload did not return a CID', requestId }, 502)
  }
  customLogger(`[create] ipfs: ${cid}`)

  // STEP 3: Extract payment reference from x402 header
  // The x402 middleware has already verified the payment signature before
  // this handler runs. We only use the header value as an idempotency key.
  const paymentHeader = c.req.header('PAYMENT-SIGNATURE')
  if (!paymentHeader) {
    return c.json({ error: 'Missing PAYMENT-SIGNATURE header', requestId }, 402)
  }

  // paymentRef is a deterministic bytes32 derived from this payment attempt.
  // It allows idempotency across x402 retries without persisting server state.
  const paymentRef = keccak256(toBytes(paymentHeader)) as Hash
  assertBytes32(paymentRef, 'paymentRef')

  // chainRef = CAIP-2 identifier stored on-chain (e.g., "eip155:84532")
  const chainRef =
    (typeof config.blockchain.chainRef === 'string' && config.blockchain.chainRef.length > 0
      ? config.blockchain.chainRef
      : networkToChainRef(config.blockchain.network))

  // STEP 4: Compute unique agreementId = hash(docHash + creator + paymentRef)
  const agreementId = computeAgreementId(docHash, creatorAddress as Address, paymentRef)
  customLogger(`[create] agreementId: ${agreementId}`)

  // STEP 5: Idempotency check (x402 client retries can repeat the same payment)
  const alreadyExists = await checkAgreementExists({
    rpcUrl: config.blockchain.rpcUrl,
    network: config.blockchain.network,
    contractAddress: config.blockchain.contractAddress as Address,
    agreementId,
  })

  if (alreadyExists) {
    const link = `https://linksignx402.xyz/a/${agreementId}`
    customLogger(`[create] ✓ already exists (${requestId})`)
    return c.json({
      agreementId,
      docHash,
      cid,
      creator: creatorAddress,
      paymentRef,
      chainRef,
      txHash: null,
      link,
      alreadyExisted: true,
    })
  }

	  // STEP 6: Register agreement on-chain
	  try {
	    customLogger(`[create] registering on-chain…`)
	    const contractTx = await registerAgreement({
	      rpcUrl: config.blockchain.rpcUrl,
	      network: config.blockchain.network,
	      contractAddress: config.blockchain.contractAddress as Address,
	      serverPrivateKey: config.wallet.privateKey as `0x${string}`,
	      agreementId,
	      docHash,
	      cid,
	      creator: creatorAddress as Address,
	      paymentRef,
	      chainRef,
	      waitForConfirmation: true, // Wait for tx to be mined before responding
	    })

	    customLogger(`[create] ✓ registered: ${contractTx.txHash} confirmed=${contractTx.confirmed} (${requestId})`)

	    const link = `https://linksignx402.xyz/a/${agreementId}`
	    return c.json({
	      agreementId,
	      docHash,
	      cid,
	      creator: creatorAddress,
	      paymentRef,
	      chainRef,
	      txHash: contractTx.txHash,
	      // Now we always wait for confirmation, so confirmed should be true
	      confirmed: contractTx.confirmed,
	      link,
	    })
  } catch (contractError: any) {
    const errorMessage = contractError?.cause?.reason || contractError?.message || ''
    customLogger(`[create] register failed: ${errorMessage} (${requestId})`)
    throw contractError
  }
})

// ===== SSR HANDLER =====
app.all('*', async (c) => {
  return handler.fetch(c.req.raw)
})

export default app
