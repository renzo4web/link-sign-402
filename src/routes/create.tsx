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
import { ArrowRight, Loader2, Wallet, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'

export const Route = createFileRoute('/create')({
  ssr: false, // Disable SSR to avoid hydration errors with Wagmi
  component: CreatePage,
})

function CreatePage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)
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

  // Build the wallet for payment when walletClient is available
  useEffect(() => {
    let cancelled = false

    const resolveClient = async () => {
      if (!isCorrectChain) {
        if (!cancelled) setPaymentWallet(null)
        return
      }

      try {
        const client =
          walletClient ??
          (await getWalletClient(wagmiConfig).catch(() => null))

        if (!client || !client.account?.address) {
          if (!cancelled) setPaymentWallet(null)
          return
        }

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
        console.error('[Create] Failed to resolve wallet client', err)
        if (!cancelled) setPaymentWallet(null)
      }
    }

    resolveClient()

    return () => {
      cancelled = true
    }
  }, [walletClient, isCorrectChain, chainId, expectedChainId, config.blockchain.networkName])

  const handleCreate = async () => {
    if (!paymentWallet || !text.trim()) return
    if (!isCorrectChain) return

    setLoading(true)
    setResult(null)

    try {
      // 1. Hash the text content
      const encoder = new TextEncoder()
      const data = encoder.encode(text)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const docHash = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      console.log('[Create] Generated docHash:', docHash)

      const fetchWithPayer = wrapFetch(fetch, {
        handlers: [createPaymentHandler(paymentWallet)],
      })

      const res = await fetchWithPayer('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docHash }),
      })

      const body = await res.json() as any
      
      if (res.ok) {
        setResult({ success: true, data: body })
      } else {
        setResult({ success: false, error: body.error || 'Failed to create' })
      }

    } catch (e: any) {
      console.error('[Create] Error:', e)
      setResult({ success: false, error: e.message || String(e) })
    }
    setLoading(false)
  }

  // --- CONNECT SCREEN ---
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        
        <Card className="w-full max-w-md z-10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/10 p-3 rounded-full w-fit">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Connect Wallet</CardTitle>
            <CardDescription>
              To create a digital handshake, please connect your wallet first.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isCorrectChain && paymentWallet === null && isConnected ? (
              <div className="space-y-3">
                 <Skeleton className="h-12 w-full rounded-md" />
                 <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ) : (
                connectors.map((connector) => (
                <Button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    variant="outline"
                    className="w-full justify-between"
                    size="lg"
                >
                    {connector.name}
                    <ArrowRight className="w-4 h-4 ml-2 opacity-50" />
                </Button>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- CREATE SCREEN ---
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      
      <div className="max-w-2xl mx-auto pt-10">
        <div className="flex items-center justify-between mb-8">
           <h1 className="text-3xl font-bold">New Handshake</h1>
           <div className="flex items-center gap-4">
             {address && (
                <div className="flex items-center gap-2 bg-muted/50 pl-2 pr-4 py-1.5 rounded-full border">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={`https://effigy.im/a/${address}.png`} />
                    <AvatarFallback>Ox</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </div>
             )}
             <Button 
               variant="ghost" 
               size="sm"
               className="text-destructive hover:text-destructive hover:bg-destructive/10"
               onClick={() => disconnect()}
             >
               Disconnect
             </Button>
           </div>
        </div>

        {!isCorrectChain && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wrong Network</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>This app requires {config.blockchain.networkName}.</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4"
                onClick={() => switchChain({ chainId: expectedChainId })}
                disabled={isSwitchingChain}
              >
                {isSwitchingChain ? 'Switching...' : 'Switch Network'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Start Agreement</CardTitle>
            <CardDescription className="text-slate-400">
              Write your agreement text below. This will be hashed and stored on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agreement" className="text-slate-300">Agreement Text</Label>
              <Textarea
                id="agreement"
                placeholder="I, [Name], agree to..."
                className="min-h-[200px] resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <span>Cost to Create</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-default">
                      <HelpCircle className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Includes $0.25 setup fee.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="font-mono">{config.payment.price} USDC</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              className="w-full"
              size="lg"
              disabled={loading || !paymentWallet || !text.trim() || !isCorrectChain}
              onClick={handleCreate}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                'Create & Pay'
              )}
            </Button>
            
            {result?.success && (
               <Alert variant="success" className="border-green-900 text-green-300 bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                  Agreement created successfully.
                  <div className="mt-2 text-xs font-mono opacity-80 break-all">
                    Hash: {JSON.stringify(result.data)}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {result?.success === false && (
              <Alert variant="error" className="border-red-900 text-red-300 bg-red-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
