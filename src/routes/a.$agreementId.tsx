import '../lib/polyfills'

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { AlertCircle, ExternalLink, FileText, Loader2, ShieldCheck, Info, CheckCircle2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Separator } from '../components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'

import { getClientConfig } from '../config/env'
import { useAgreementSign } from '../hooks/use-agreement-sign'
import { useWalletSetup } from '../hooks/use-wallet-setup'
import { buildAddressUrl } from '../lib/network'
import { BYTES32_REGEX } from '../lib/validation'

type AgreementApiResponse = {
  agreementId: string
  docHash: string
  cid: string
  ipfsUrl: string
  link: string
  contract: {
    address: string
    chainRef: string
    explorerUrl: string | null
  }
  creator: {
    address: string
    paymentRef: string
    chainRef: string
    explorerUrl: string | null
  }
  signers: Array<{
    address: string
    paymentRef: string
    chainRef: string
    explorerUrl: string | null
  }>
}

function truncateMiddle(value: string, start = 10, end = 8) {
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}…${value.slice(-end)}`
}

export const Route = createFileRoute('/a/$agreementId')({
  ssr: false,
  component: AgreementPage,
})

function AgreementPage() {
  const { agreementId } = Route.useParams()
  const wallet = useWalletSetup()
  const sign = useAgreementSign()
  const config = getClientConfig()

  const [view, setView] = useState<AgreementApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showVerifyModal, setShowVerifyModal] = useState(false)

  const ipfsUrl = useMemo(() => view?.ipfsUrl ?? null, [view?.ipfsUrl])
  const creatorExplorerUrl = useMemo(
    () => buildAddressUrl(view?.creator.chainRef, view?.creator.address),
    [view?.creator.chainRef, view?.creator.address]
  )

  const alreadySigned = useMemo(() => {
    if (!wallet.address) return false
    const lower = wallet.address.toLowerCase()
    if (view?.creator.address.toLowerCase() === lower) return true
    return view?.signers.some((s) => s.address.toLowerCase() === lower) ?? false
  }, [wallet.address, view])

  const loadAgreement = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!BYTES32_REGEX.test(agreementId)) {
        setView(null)
        setError('Invalid agreement id')
        return
      }

      const res = await fetch(`/api/agreement/${agreementId}`)

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as any
        setView(null)
        setError(body?.error || `Request failed (${res.status})`)
        return
      }

      const data = (await res.json()) as AgreementApiResponse
      setView(data)
    } catch (err) {
      setView(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAgreement()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreementId])

  useEffect(() => {
    if (sign.result?.success) {
      loadAgreement()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign.result?.success])

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto pt-6 grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="text-2xl font-bold">Agreement</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" size="sm">
                {truncateMiddle(agreementId, 14, 10)}
              </Badge>
              <Badge variant="outline" size="sm">
                Sign: {config.payment.signPrice} USDC
              </Badge>
            </div>
          </div>
          <ConnectButton />
        </div>

        {wallet.isConnected && !wallet.isCorrectChain ? (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Wrong Network</AlertTitle>
            <AlertDescription>
              Switch to {wallet.networkName} to sign.
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading agreement…
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : view ? (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Document</CardTitle>
                    <CardDescription>
                      CID: <span className="font-mono">{truncateMiddle(view.cid, 16, 10)}</span>
                    </CardDescription>
                  </div>
                  {ipfsUrl ? (
                    <Button variant="outline" render={<a href={ipfsUrl} target="_blank" rel="noreferrer" />}>
                      Open PDF
                      <FileText className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {ipfsUrl ? (
                  <div className="rounded-lg border overflow-hidden">
                    <iframe
                      title="Agreement PDF"
                      src={ipfsUrl}
                      className="w-full"
                      style={{ height: '70vh' }}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No IPFS link available.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-base">Cryptographically Verified</CardTitle>
                    </div>
                    <CardDescription>
                      Stored immutably on Base Sepolia • Tamper-proof audit trail
                    </CardDescription>
                  </div>
                  <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Info className="h-4 w-4" />
                        How to verify
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>How to Verify Authenticity</DialogTitle>
                        <DialogDescription>
                          Anyone can independently verify this agreement using public blockchain data
                        </DialogDescription>
                      </DialogHeader>
                      <DialogPanel className="grid gap-4 text-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            1. Verify Document Immutability
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            The document has a unique <strong>Digital Fingerprint</strong> (shown below) that acts like a tamper-evident seal. If anyone modifies the file by even one pixel, this fingerprint will change completely, making any tampering immediately detectable.
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            2. Verify Creator/Signer Identity
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Click any <strong>[View Tx]</strong> link in the Audit Trail section. This opens the block explorer where the transaction is permanently recorded.
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            3. Check the Payment Transfer
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            On the explorer page, look for the <strong>"ERC-20 Tokens Transferred"</strong> section. You will see a USDC transfer coming <strong>FROM</strong> the signer's wallet address. This proves that specific wallet authorized and paid for the signature.
                          </p>
                        </div>

                        <Separator />

                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            4. Query the Smart Contract Directly
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Click <strong>[View Contract]</strong> in the Smart Contract section below. On the explorer, go to <strong>"Read Contract"</strong> tab. You can use these functions:
                          </p>
                          <ul className="text-muted-foreground text-xs leading-relaxed list-disc list-inside space-y-1 pl-2">
                            <li><strong>agreementExists</strong> — Paste the <em>Agreement ID</em> (not the Document Hash!) to confirm it exists on-chain.</li>
                            <li><strong>hasSigned</strong> — Paste the Agreement ID + a wallet address to verify if that wallet signed.</li>
                            <li><strong>paymentRefUsed</strong> — Paste any Proof of Action (tx hash) to confirm it was used for a signature.</li>
                          </ul>
                          <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">
                            <strong>Tip:</strong> The Agreement ID is highlighted in green at the top of the verification section below. Copy it from there to query the contract.
                          </p>
                        </div>

                        <Alert>
                          <AlertTitle className="text-xs">Security Note</AlertTitle>
                          <AlertDescription className="text-xs">
                            The security of this agreement does not depend on this website. It relies on the public blockchain and cryptographic signatures that cannot be forged.
                          </AlertDescription>
                        </Alert>
                      </DialogPanel>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-1 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/5 p-3">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Agreement ID</div>
                  <div className="text-[11px] text-muted-foreground italic">
                    The unique identifier for this agreement. Use this value to query the smart contract directly.
                  </div>
                  <div className="rounded-md border border-emerald-500/30 bg-background px-3 py-2 font-mono text-xs break-all">
                    {view.agreementId}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Document Integrity
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-medium text-muted-foreground">Digital Fingerprint</div>
                    <div className="text-[11px] text-muted-foreground italic">
                      A unique code generated from the file's content. If a single pixel changes, this code changes.
                    </div>
                    <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs break-all">
                      {view.docHash}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Matches the on-chain record
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-medium text-muted-foreground">Decentralized Storage</div>
                    <div className="text-[11px] text-muted-foreground italic">
                      The permanent address of this file on the IPFS network. Ensures the file cannot be censored or lost.
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                      <div className="font-mono text-xs break-all">{truncateMiddle(view.cid, 16, 10)}</div>
                      {ipfsUrl ? (
                        <a
                          className="text-xs text-primary underline underline-offset-4 shrink-0 ml-2"
                          href={ipfsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                      Audit Trail
                    </div>
                    <Badge variant="outline" size="sm">
                      {1 + view.signers.length} {1 + view.signers.length === 1 ? 'Signature' : 'Signatures'}
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    <SignatureRow
                      label="Creator"
                      address={view.creator.address}
                      paymentRef={view.creator.paymentRef}
                      explorerUrl={view.creator.explorerUrl}
                    />
                    {view.signers.map((s) => (
                      <SignatureRow
                        key={`${s.address}-${s.paymentRef}`}
                        label="Signer"
                        address={s.address}
                        paymentRef={s.paymentRef}
                        explorerUrl={s.explorerUrl}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Smart Contract
                  </div>

                  <div className="grid gap-1">
                    <div className="text-xs font-medium text-muted-foreground">AgreementOracle</div>
                    <div className="text-[11px] text-muted-foreground italic">
                      The on-chain contract that stores all agreement data. Verify the source code and all events directly on the block explorer.
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                      <div className="font-mono text-xs break-all">{truncateMiddle(view.contract.address, 10, 8)}</div>
                      {view.contract.explorerUrl ? (
                        <a
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4 ml-2"
                          href={view.contract.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Contract
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sign</CardTitle>
                <CardDescription>
                  Signing is a paid action (x402). Payment is the signature.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {sign.result?.success === false ? (
                  <Alert variant="error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{sign.result.error}</AlertDescription>
                  </Alert>
                ) : null}

                {sign.result?.success ? (
                  <Alert>
                    <AlertTitle>Signed</AlertTitle>
                    <AlertDescription>
                      Your signature was recorded on-chain.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  size="lg"
                  disabled={
                    sign.isLoading ||
                    !wallet.isWalletReady ||
                    !wallet.isCorrectChain ||
                    alreadySigned
                  }
                  onClick={() => {
                    if (!wallet.address) return
                    sign.sign(agreementId, wallet.address, wallet.getSigner)
                  }}
                >
                  {sign.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing…
                    </>
                  ) : alreadySigned ? (
                    'Already signed'
                  ) : (
                    'Sign & Pay'
                  )}
                </Button>

                {!wallet.isConnected ? (
                  <div className="text-xs text-muted-foreground">
                    Connect your wallet to sign.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SignatureRow(props: {
  label: string
  address: string
  paymentRef: string
  explorerUrl: string | null
}) {
  const txUrl = props.explorerUrl

  return (
    <div className="grid gap-2 rounded-lg border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{props.label}</div>
          <div className="font-mono text-xs break-all">{props.address}</div>
        </div>
      </div>
      <div className="grid gap-1">
        <div className="text-[11px] font-medium text-muted-foreground">Proof of Action</div>
        <div className="text-[10px] text-muted-foreground italic">
          The blockchain transaction receipt. It proves this specific wallet paid to execute this action.
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
          <div className="font-mono text-[11px] break-all">{truncateMiddle(props.paymentRef, 14, 10)}</div>
          {txUrl ? (
            <a
              className="shrink-0 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4"
              href={txUrl}
              target="_blank"
              rel="noreferrer"
            >
              View Tx
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
