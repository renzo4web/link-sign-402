import { http, createConfig } from 'wagmi'
import { baseSepolia, mainnet, sepolia, base } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'
import { getClientConfig } from '../config/env'

/**
 * Wagmi Configuration
 * 
 * IMPORTANT: This uses wagmi's createConfig() with injected() and metaMask() connectors.
 * DO NOT change this to @rainbow-me/rainbowkit's getDefaultConfig() because:
 * 
 * 1. RainbowKit's getDefaultConfig() requires a WalletConnect project ID
 * 2. It connects to cloud.reown.com which requires domain allowlist configuration
 * 3. We only need MetaMask/injected wallets - no need for WalletConnect modal
 * 
 * If you see 403 errors from pulse.walletconnect.org or cloud.reown.com,
 * it means someone switched to getDefaultConfig() - revert back to this approach.
 */

// Get configuration
const config = getClientConfig()

// Determine the target chain based on environment variables
const getTargetChain = () => {
  const networkName = config.blockchain.networkName
  
  switch (networkName.toLowerCase()) {
    case 'base-sepolia':
      return baseSepolia
    case 'base':
      return base
    case 'sepolia':
      return sepolia
    case 'mainnet':
      return mainnet
    default:
      return baseSepolia
  }
}

const targetChain = getTargetChain()

// @ts-ignore - Ignore TypeScript error for dynamic transports
export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected(), metaMask()],
  // Explicitly disable SSR since this app renders client-side only
  ssr: false,
  // @ts-ignore - Ignore TypeScript error for dynamic transports
  transports: {
    [targetChain.id]: http(),
  },
})
