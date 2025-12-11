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
    // Coinbase CDP API Keys (SECRETS)
    cdp: {
      apiKeyId: getEnvVar('CDP_API_KEY_ID', process.env.CDP_API_KEY_ID),
      apiKeySecret: getEnvVar('CDP_API_KEY_SECRET', process.env.CDP_API_KEY_SECRET),
    },
    
    // Blockchain Configuration (Server-side)
    blockchain: {
      payToAddress: getEnvVar('PAY_TO_ADDRESS', process.env.PAY_TO_ADDRESS),
      network: getEnvVar('BLOCKCHAIN_NETWORK', process.env.BLOCKCHAIN_NETWORK),
      contractAddress: getEnvVar('CONTRACT_ADDRESS', process.env.CONTRACT_ADDRESS),
    },
    
    // Payment Configuration (Server-side - source of truth)
    payment: {
      price: getEnvVar('PAYMENT_PRICE', process.env.PAYMENT_PRICE),
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
  // Payment Display (must match server PAYMENT_PRICE)
  payment: {
    price: getEnvVar('VITE_PAYMENT_PRICE', import.meta.env.VITE_PAYMENT_PRICE),
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
 *   const price = config.payment.price // ✅ Works - uses VITE_ vars
 *   
 *   // const serverConfig = getServerConfig() // ❌ Throws error in browser!
 * }
 */
