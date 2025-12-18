/**
 * Environment Configuration
 * 
 * This file centralizes all environment variable access.
 * - NO FALLBACKS: If a variable is missing, it will throw an error immediately
 * - Clear separation between server secrets and client public variables
 * - Type-safe access to all environment variables
 */

import { createIsomorphicFn } from '@tanstack/react-start'

/**
 * Utility to get and validate environment variables
 * Throws if variable is missing - NO FALLBACKS
 */
function getEnvVar(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `❌ Missing required environment variable: ${key}\n` +
      `Please check your .env file and ensure ${key} is set.`
    )
  }
  return value
}

/**
 * SERVER-ONLY Configuration Factory
 * These values contain SECRETS and should NEVER be exposed to the client
 * This is a function to ensure it only runs on the server, not at module load time
 */
function createServerConfig() {
  return {
    // Coinbase CDP API Keys (OPTIONAL - for CDP facilitator)
    // If not set, falls back to x402.org/facilitator (testnet only)
    cdp: {
      apiKeyId: process.env.CDP_API_KEY_ID || '',
      apiKeySecret: process.env.CDP_API_KEY_SECRET || '',
    },
    
    // Blockchain Configuration (Server-side)
    blockchain: {
      payToAddress: getEnvVar('PAY_TO_ADDRESS', process.env.PAY_TO_ADDRESS),
      network: getEnvVar('BLOCKCHAIN_NETWORK', process.env.BLOCKCHAIN_NETWORK),
      contractAddress: getEnvVar('CONTRACT_ADDRESS', process.env.CONTRACT_ADDRESS),
      rpcUrl: getEnvVar('BLOCKCHAIN_RPC_URL', process.env.BLOCKCHAIN_RPC_URL),
      // Optional override for CAIP-2 chainRef (e.g. "eip155:84532").
      // If omitted, the server will derive it from BLOCKCHAIN_NETWORK.
      chainRef: process.env.BLOCKCHAIN_CHAIN_REF,
      // Block number when the contract was deployed (for efficient log queries).
      contractStartBlock: BigInt(
        getEnvVar('CONTRACT_START_BLOCK', process.env.CONTRACT_START_BLOCK)
      ),
    },

    // Pinata (Server-side)
    pinata: {
      jwt: getEnvVar('PINATA_JWT', process.env.PINATA_JWT),
      gateway: getEnvVar('PINATA_GATEWAY', process.env.PINATA_GATEWAY),
    },

    // Server wallet (Server-side)
    // Used to submit AgreementOracle txs. For MVP we keep this here.
    wallet: {
      privateKey: getEnvVar('SERVER_WALLET_PRIVATE_KEY', process.env.SERVER_WALLET_PRIVATE_KEY),
    },
    
    // Payment Configuration (Server-side - source of truth)
    payment: {
      createPrice: getEnvVar('PAYMENT_CREATE_PRICE', process.env.PAYMENT_CREATE_PRICE),
      signPrice: getEnvVar('PAYMENT_SIGN_PRICE', process.env.PAYMENT_SIGN_PRICE),
    },
    
    // Runtime Environment
    nodeEnv: process.env.NODE_ENV || 'development',
  } as const
}

/**
 * CLIENT-ONLY Configuration
 * These values are PUBLIC and will be bundled into the client JavaScript
 * Only use VITE_ prefixed variables here
 */
const clientConfig = {
  // Payment Display (must match server PAYMENT_* values)
  payment: {
    createPrice: getEnvVar('VITE_PAYMENT_CREATE_PRICE', import.meta.env.VITE_PAYMENT_CREATE_PRICE),
    signPrice: getEnvVar('VITE_PAYMENT_SIGN_PRICE', import.meta.env.VITE_PAYMENT_SIGN_PRICE),
  },
  
  // Blockchain Display
  blockchain: {
    networkName: getEnvVar('VITE_BLOCKCHAIN_NETWORK', import.meta.env.VITE_BLOCKCHAIN_NETWORK),
  },
} as const

/**
 * Get Server Configuration
 * ⚠️ This function can ONLY be called on the server
 * ⚠️ Throws error if called on client
 */
export const getServerConfig = createIsomorphicFn()
  .server(() => createServerConfig())
  .client(() => {
    throw new Error(
      '❌ getServerConfig() was called on the client!\n' +
      'Server configuration contains secrets and cannot be accessed from the browser.\n' +
      'Use getClientConfig() instead for client-safe values.'
    )
  })

/**
 * Get Client Configuration
 * ✅ Safe to call from anywhere (client or server)
 * Returns only public, non-sensitive configuration
 */
export const getClientConfig = createIsomorphicFn()
  .server(() => clientConfig)
  .client(() => clientConfig)

/**
 * Type exports for convenience
 */
export type ServerConfig = ReturnType<typeof createServerConfig>
export type ClientConfig = typeof clientConfig

/**
 * USAGE EXAMPLES:
 * 
 * // Server function:
 * const serverFn = createServerFn().handler(async () => {
 *   const config = getServerConfig()
 *   const apiKey = config.cdp.apiKeyId // ✅ Works - loads config only on server
 * })
 * 
 * // Client component:
 * function MyComponent() {
 *   const config = getClientConfig()
 *   const price = config.payment.createPrice // ✅ Works - uses VITE_ vars
 *   
 *   // const serverConfig = getServerConfig() // ❌ Throws error in browser!
 * }
 */
