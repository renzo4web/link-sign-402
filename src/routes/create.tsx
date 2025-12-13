// Polyfills must be imported first
import '../lib/polyfills'

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import {
  useAccount,
  useChainId,
  useConnections,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import { baseSepolia, base, sepolia, mainnet } from 'wagmi/chains'
import type { WalletClient, Account } from 'viem'
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import type { ClientEvmSigner } from '@x402/evm'
import { getWalletClient } from 'wagmi/actions'
import { wagmiConfig } from '../lib/wagmi'
import { getClientConfig } from '../config/env'
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  RotateCcw,
  TriangleAlert,
  HelpCircle,
  Loader2,
  Wallet,
  AlertCircle,
} from 'lucide-react'

import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip'
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '../components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { ConnectButton } from '@rainbow-me/rainbowkit'

type CreateAgreementResponse = {
  agreementId: string
  docHash: string
  cid: string
  creator: string
  paymentRef: string
  chainRef: string
  txHash: string | null
  link: string
  alreadyExisted?: boolean
}

type CreateResult =
  | { success: true; data: CreateAgreementResponse }
  | { success: false; error: string }
  | null

function truncateMiddle(value: string, start = 10, end = 8) {
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}…${value.slice(-end)}`
}

function getExplorerBaseUrl(chainRef?: string): string | null {
  switch (chainRef) {
    case 'eip155:84532':
      return 'https://sepolia.basescan.org'
    case 'eip155:8453':
      return 'https://basescan.org'
    case 'eip155:11155111':
      return 'https://sepolia.etherscan.io'
    case 'eip155:1':
      return 'https://etherscan.io'
    default:
      return null
  }
}

function buildTxUrl(chainRef: string | undefined, txHash: string | null | undefined) {
  const baseUrl = getExplorerBaseUrl(chainRef)
  if (!baseUrl || !txHash) return null
  return `${baseUrl}/tx/${txHash}`
}

function buildAddressUrl(chainRef: string | undefined, address: string | undefined) {
  const baseUrl = getExplorerBaseUrl(chainRef)
  if (!baseUrl || !address) return null
  return `${baseUrl}/address/${address}`
}

function buildIpfsHttpUrl(cid: string | undefined) {
  if (!cid) return null
  return `https://ipfs.io/ipfs/${cid}`
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={`Copy ${label}`}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 900)
                } catch {
                  // Clipboard can be blocked by browser settings.
                  setCopied(false)
                }
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          }
        />
        <TooltipContent>
          <p>{copied ? 'Copied' : `Copy ${label}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SuccessSummary({
  data,
  fileName,
}: {
  data: CreateAgreementResponse
  fileName?: string | null
}) {
  const ipfsUrl = buildIpfsHttpUrl(data.cid)
  const txUrl = buildTxUrl(data.chainRef, data.txHash)
  const creatorUrl = buildAddressUrl(data.chainRef, data.creator)

  function DetailRow(props: {
    title: string
    description: string
    value: React.ReactNode
    actions?: React.ReactNode
  }) {
    return (
      <div className="grid gap-1.5 rounded-lg border bg-background/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-xs font-medium text-muted-foreground">{props.title}</div>
            <div className="text-xs text-muted-foreground leading-snug">{props.description}</div>
          </div>
          {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
        </div>
        <div className="mt-1 rounded-md border bg-muted/20 px-2 py-1 font-mono text-xs break-all">
          {props.value}
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full border-success/30 bg-success/4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-success/12 p-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div className="grid gap-1">
              <CardTitle className="text-base">Agreement created</CardTitle>
              <CardDescription>
                Your PDF was uploaded to IPFS and the agreement metadata was registered on-chain.
              </CardDescription>
              {fileName ? (
                <div className="text-xs text-muted-foreground">
                  File: <span className="font-mono">{fileName}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {data.alreadyExisted ? (
              <Badge variant="info" size="sm">
                Already existed
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                Confirmed
              </Badge>
            )}
            <Badge variant="outline" size="sm">
              {data.chainRef}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {data.alreadyExisted ? (
          <Alert variant="warning">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>This agreement already exists</AlertTitle>
            <AlertDescription>
              Someone has already created an agreement for this same document.
              That means we reused the existing record instead of creating a new one.
              You can open the agreement above to review it.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            render={<a href={data.link} target="_blank" rel="noreferrer" />}
          >
            Open agreement
            <ArrowUpRight className="h-4 w-4" />
          </Button>

          {txUrl ? (
            <Button
              variant="outline"
              render={<a href={txUrl} target="_blank" rel="noreferrer" />}
            >
              View transaction
              <ExternalLink className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" disabled>
              View transaction
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}

          {ipfsUrl ? (
            <Button
              variant="outline"
              render={<a href={ipfsUrl} target="_blank" rel="noreferrer" />}
            >
              View on IPFS
              <FileText className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" disabled>
              View on IPFS
              <FileText className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator />

        <div className="grid gap-3">
          <DetailRow
            title="Agreement ID"
            description="The unique identifier for this agreement. You can share this or use it to look up the agreement later."
            value={data.agreementId}
            actions={<CopyButton label="agreementId" value={data.agreementId} />}
          />

          <DetailRow
            title="IPFS CID"
            description="A content-addressed pointer to your uploaded PDF on IPFS. Anyone can fetch the exact same file using this CID."
            value={data.cid}
            actions={
              <div className="flex items-center gap-2">
                <CopyButton label="cid" value={data.cid} />
                <Badge variant="outline" size="sm">
                  ipfs://{truncateMiddle(data.cid, 14, 10)}
                </Badge>
              </div>
            }
          />

          <DetailRow
            title="Document hash"
            description="A keccak256 fingerprint of the PDF. If the file changes by 1 byte, this hash changes."
            value={data.docHash}
            actions={<CopyButton label="docHash" value={data.docHash} />}
          />

          <DetailRow
            title="Payment reference"
            description="A deterministic reference derived from your payment proof. Used for idempotency and auditability (ties the payment to this agreement)."
            value={data.paymentRef}
            actions={<CopyButton label="paymentRef" value={data.paymentRef} />}
          />

          <DetailRow
            title="Creator"
            description="The wallet address that initiated the agreement creation request."
            value={data.creator}
            actions={
              <div className="flex items-center gap-2">
                <CopyButton label="creator" value={data.creator} />
                {creatorUrl ? (
                  <a
                    className="text-xs text-primary underline underline-offset-4"
                    href={creatorUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                ) : null}
              </div>
            }
          />

          <DetailRow
            title="Transaction"
            description={
              data.txHash
                ? 'The on-chain transaction that registered this agreement. Verify it on the block explorer.'
                : 'Not available. This can happen if the request was retried and the agreement already existed.'
            }
            value={
              data.txHash ?? (
                <span className="text-muted-foreground">(no transaction hash)</span>
              )
            }
            actions={data.txHash ? <CopyButton label="txHash" value={data.txHash} /> : undefined}
          />
        </div>

        <Collapsible>
          <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
            View raw response
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <div className="mt-2 rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </CollapsiblePanel>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

/**
 * Converts a wagmi/viem WalletClient to a ClientEvmSigner for x402Client
 */
function wagmiToClientSigner(walletClient: WalletClient): ClientEvmSigner {
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

export const Route = createFileRoute('/create')({
  ssr: false, // Disable SSR to avoid hydration errors with Wagmi
  component: CreatePage,
})

function CreatePage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CreateResult>(null)
  const [loading, setLoading] = useState(false)
  const [isWalletReady, setIsWalletReady] = useState(false)
  const [lastSubmittedFileName, setLastSubmittedFileName] = useState<string | null>(null)
  const walletClientRef = useRef<WalletClient | null>(null)

  const { isConnected, address } = useAccount()
  const chainId = useChainId()

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
      case 'base sepolia': return baseSepolia.id
      case 'base-sepolia': return baseSepolia.id
      case 'base mainnet': return base.id
      case 'base': return base.id
      case 'sepolia': return sepolia.id
      case 'mainnet': return mainnet.id
      default: return baseSepolia.id
    }
  }

  const expectedChainId = getExpectedChainId()
  const isCorrectChain = chainId === expectedChainId

  // Store walletClient ref when available
  useEffect(() => {
    let cancelled = false

    const setupWallet = async () => {
      if (!isCorrectChain) {
        if (!cancelled) {
          walletClientRef.current = null
          setIsWalletReady(false)
        }
        return
      }

      try {
        const client =
          walletClient ??
          (await getWalletClient(wagmiConfig).catch(() => null))

        if (!client || !client.account?.address) {
          if (!cancelled) {
            walletClientRef.current = null
            setIsWalletReady(false)
          }
          return
        }
        
        if (!cancelled) {
          walletClientRef.current = client
          setIsWalletReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          walletClientRef.current = null
          setIsWalletReady(false)
        }
      }
    }

    setupWallet()

    return () => {
      cancelled = true
    }
  }, [walletClient, isCorrectChain, chainId, expectedChainId])

  const handleCreate = async () => {
    if (!walletClientRef.current || !file) return
    if (!isCorrectChain) return

    setLoading(true)
    setResult(null)
    setLastSubmittedFileName(file.name)

    try {
      // 1) Read PDF as base64
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
      const fileBase64 = btoa(binary)

      // Create x402 client and register EVM scheme with wagmi signer
      const client = new x402Client()
      const httpClient = new x402HTTPClient(client)
      const signer = wagmiToClientSigner(walletClientRef.current)
      registerExactEvmScheme(client, { signer })

      // Wrap fetch with payment handling
      const fetchWithPayment = wrapFetchWithPayment(fetch, client)
      
      const res = await fetchWithPayment('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          fileName: file.name,
          creatorAddress: address,
        }),
      })

      if (res.ok) {
        const body = await res.json() as CreateAgreementResponse
        setResult({ success: true, data: body })
      } else if (res.status === 402) {
        // When payment was attempted and we still get 402, this is usually either:
        // - verification failed (PAYMENT-REQUIRED header with error)
        // - settlement failed (JSON body with { error, details })
        const body = await res.json().catch(() => null) as any

        let errorMessage = 'Payment required'
        if (body && typeof body === 'object' && typeof body.error === 'string') {
          errorMessage = typeof body.details === 'string' ? `${body.error}: ${body.details}` : body.error
        } else {
          try {
            const paymentRequired = httpClient.getPaymentRequiredResponse((name) => res.headers.get(name))
            if (paymentRequired.error) errorMessage = paymentRequired.error
          } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err)
          }
        }

        setResult({ success: false, error: errorMessage })
      } else {
        const body = await res.json().catch(() => ({})) as any
        setResult({ success: false, error: body?.error || `Request failed (${res.status})` })
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message || String(e) })
    } finally {
      setLoading(false)
    }
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
            <div className="flex justify-center py-4">
              <ConnectButton />
            </div>
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

        {result?.success ? (
          <div className="grid gap-3">
            <SuccessSummary data={result.data} fileName={lastSubmittedFileName} />
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setFile(null)
                setResult(null)
                setLastSubmittedFileName(null)
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Create another agreement
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Start agreement</CardTitle>
              <CardDescription>
                Upload a PDF. The server will keccak256 hash it, pin it to IPFS (Pinata), and register it on-chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pdf">Agreement PDF</Label>
                <input
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-input file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/80"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setFile(f)
                    setResult(null)
                  }}
                />
                {file && (
                  <div className="text-xs text-muted-foreground break-all">
                    Selected: <span className="font-mono">{file.name}</span> ({Math.round(file.size / 1024)} KB)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span>Cost to create</span>
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
                <span className="font-mono">{config.payment.createPrice} USDC</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                className="w-full"
                size="lg"
                disabled={loading || !isWalletReady || !file || !isCorrectChain}
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

              {result?.success === false && (
                <Alert variant="error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {result.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
