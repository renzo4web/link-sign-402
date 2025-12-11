// Polyfills must be imported first
import '../lib/polyfills'

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useConnections,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { baseSepolia, base, sepolia, mainnet } from 'wagmi/chains'
import { Hex } from 'viem'
import { createPaymentHandler } from '@faremeter/payment-evm/exact'
import { wrap as wrapFetch } from '@faremeter/fetch'
import { getWalletClient } from 'wagmi/actions'
import { wagmiConfig } from '../lib/wagmi'
import { getClientConfig } from '../config/env'

export const Route = createFileRoute('/create')({
  ssr: false, // Deshabilitar SSR para evitar errores de hidratación con Wagmi
  component: CreateTest,
})

function CreateTest() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentWallet, setPaymentWallet] = useState<{
    chain: { id: number; name: string }
    address: Hex
    account: { signTypedData: (params: any) => Promise<Hex> }
  } | null>(null)

  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { connect, connectors } = useConnect()
  const connections = useConnections()
  const activeConnector = connections[0]?.connector
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ connector: activeConnector })
  // Get configuration
  const config = getClientConfig()
  
  // Determine the correct chain ID based on environment variables
  const getExpectedChainId = () => {
    const networkName = config.blockchain.networkName
    switch (networkName.toLowerCase()) {
      case 'base-sepolia': return baseSepolia.id
      case 'base': return base.id
      case 'sepolia': return sepolia.id
      case 'mainnet': return mainnet.id
      default: return baseSepolia.id
    }
  }

  const expectedChainId = getExpectedChainId()
  const isCorrectChain = chainId === expectedChainId

  // Build the wallet for payment when walletClient is available (with fallback fetch)
  // Only resolve when on the correct chain to avoid ConnectorChainMismatchError
  useEffect(() => {
    let cancelled = false

    const resolveClient = async () => {
      // Don't try to resolve if on wrong chain - will cause mismatch error
      if (!isCorrectChain) {
        if (!cancelled) setPaymentWallet(null)
        return
      }

      try {
        // Use walletClient from hook if available, otherwise fetch without forcing chainId
        const client =
          walletClient ??
          (await getWalletClient(wagmiConfig).catch(() => null))

        if (!client || !client.account?.address) {
          if (!cancelled) setPaymentWallet(null)
          return
        }

        // Determine the default chain name based on environment variables
        const getDefaultChainName = () => {
          const networkName = config.blockchain.networkName
          switch (networkName.toLowerCase()) {
            case 'base-sepolia': return 'Base Sepolia'
            case 'base': return 'Base'
            case 'sepolia': return 'Sepolia'
            case 'mainnet': return 'Ethereum Mainnet'
            default: return 'Base Sepolia'
          }
        }

        const wallet = {
          chain: {
            id: client.chain?.id ?? chainId ?? expectedChainId,
            name: client.chain?.name ?? getDefaultChainName(),
          },
          address: client.account.address as Hex,
          account: {
            signTypedData: (params: any) => client.signTypedData(params as any),
          },
        }
        if (!cancelled) setPaymentWallet(wallet)
      } catch (err) {
        console.error('[CreateTest] Failed to resolve wallet client', err)
        if (!cancelled) setPaymentWallet(null)
      }
    }

    resolveClient()

    return () => {
      cancelled = true
    }
  }, [walletClient, isCorrectChain])

  // Logs para debugging
  console.log('[CreateTest] Render:', {
    isConnected,
    address: address?.slice(0, 10),
    chainId,
    connectorsCount: connectors.length,
    activeConnector: activeConnector?.name,
    hasWalletClient: !!walletClient,
    hasPaymentWallet: !!paymentWallet,
    isCorrectChain,
    environment: typeof window !== 'undefined' ? 'client' : 'server',
  })

  const testCreate = async () => {
    if (!paymentWallet) {
      console.error('[CreateTest] testCreate error: Wallet client unavailable')
      setResult('Error: Wallet not connected')
      return
    }

    if (!isCorrectChain) {
      console.error('[CreateTest] testCreate error: Wrong network', chainId)
      setResult('Error: Wrong network. Please switch to Base Sepolia')
      return
    }

    console.log('[CreateTest] testCreate: Starting payment...')
    setLoading(true)
    try {
      const docHash =
        '0x' +
        crypto
          .getRandomValues(new Uint8Array(32))
          .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
      console.log('[CreateTest] Generated docHash:', docHash)

      const fetchWithPayer = wrapFetch(fetch, {
        handlers: [createPaymentHandler(paymentWallet)],
      })
      console.log('[CreateTest] Fetch wrapper created')

      console.log('[CreateTest] Calling /api/create...')
      const res = await fetchWithPayer('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docHash }),
      })
      console.log('[CreateTest] Response status:', res.status)

      const headers = Object.fromEntries(res.headers)
      const body = await res.text()
      console.log('[CreateTest] Response body:', body)

      setResult(
        `Status: ${res.status}\n\nHeaders:\n${JSON.stringify(headers, null, 2)}\n\nBody:\n${body}`
      )
    } catch (e) {
      console.error('[CreateTest] Error during payment:', e)
      setResult(`Error: ${e}`)
    }
    setLoading(false)
    console.log('[CreateTest] testCreate: Finished')
  }

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Test /api/create (x402)</h1>
        <p className="mb-4 text-gray-600">Precio: {config.payment.price} USDC en {config.blockchain.networkName}</p>
        <p className="mb-4 text-gray-500">Conecta tu wallet para continuar</p>
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test /api/create (x402)</h1>
      <p className="mb-4 text-gray-600">Precio: {config.payment.price} USDC en {config.blockchain.networkName}</p>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-gray-500">
          Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-sm text-red-500 hover:underline"
        >
          Disconnect
        </button>
      </div>
      {!isCorrectChain && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-amber-700 mb-2">
            Wrong network detected (chain {chainId}). This app requires {config.blockchain.networkName}.
          </p>
          <button
            onClick={() => switchChain({ chainId: expectedChainId })}
            disabled={isSwitchingChain}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {isSwitchingChain ? 'Switching...' : 'Switch to Base Sepolia'}
          </button>
        </div>
      )}
      <button
        onClick={testCreate}
        disabled={loading || !paymentWallet || !isCorrectChain}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Calling...' : 'Call /api/create'}
      </button>
      {result && (
        <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
          {result}
        </pre>
      )}
    </div>
  )
}
