import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia, mainnet, sepolia, base } from 'wagmi/chains'
import { getClientConfig } from '../config/env'

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

export const wagmiConfig = getDefaultConfig({
  appName: 'LinkSignX402',
  projectId: 'YOUR_PROJECT_ID',
  chains: [targetChain],
  ssr: false, // Client-side only
})
