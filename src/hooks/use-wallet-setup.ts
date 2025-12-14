import { useEffect, useState, useMemo } from 'react'
import {
  useAccount,
  useChainId,
  useConnections,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import type { WalletClient, Account } from 'viem'
import type { ClientEvmSigner } from '@x402/evm'
import { getClientConfig } from '../config/env'
import { getChainId } from '../lib/network'

function toClientSigner(walletClient: WalletClient): ClientEvmSigner {
  if (!walletClient.account) {
    throw new Error('Wallet client must have an account')
  }

  return {
    address: walletClient.account.address,
    signTypedData: async (message) => {
      const signature = await walletClient.signTypedData({
        account: walletClient.account as Account,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      })
      return signature
    },
  }
}

export function useWalletSetup() {
  // Compute config values inside hook to avoid SSR/hydration issues
  const { expectedChainId, networkName } = useMemo(() => {
    const config = getClientConfig()
    return {
      expectedChainId: getChainId(config.blockchain.networkName),
      networkName: config.blockchain.networkName,
    }
  }, [])
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const connections = useConnections()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ connector: connections[0]?.connector })

  // Single source of truth: the wallet client state
  const [readyWalletClient, setReadyWalletClient] = useState<WalletClient | null>(null)

  const isCorrectChain = chainId === expectedChainId

  useEffect(() => {
    if (!isCorrectChain || !walletClient?.account?.address) {
      setReadyWalletClient(null)
      return
    }
    setReadyWalletClient(walletClient)
  }, [walletClient, isCorrectChain])

  return {
    // Connection state
    isConnected,
    address,

    // Chain state
    chainId,
    expectedChainId,
    networkName,
    isCorrectChain,

    // Actions
    disconnect,
    switchToExpectedChain: () => switchChain({ chainId: expectedChainId }),
    isSwitchingChain,

    // Wallet readiness
    isWalletReady: readyWalletClient !== null,
    getSigner: () => readyWalletClient ? toClientSigner(readyWalletClient) : null,
  }
}
