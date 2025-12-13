import { createFileRoute, Link } from '@tanstack/react-router'
import { FileSignature, Shield, Wallet, ArrowRight, Zap, Globe, Lock, Database, Eye, Infinity, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'
import { getClientConfig } from '../config/env'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const config = getClientConfig()

  return (
    <div className="min-h-screen text-foreground overflow-hidden relative bg-background">
      
      {/* Content Layer */}
      <div className="relative">
        {/* Hero Section */}
        <section className="relative pt-24 pb-24 px-6 text-center">
          <div className="relative z-10 max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-foreground">
              Sign Agreements with{' '}
              <span className="underline decoration-2 underline-offset-4">x402 Protocol</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The digital handshake for the crypto era.<br />
              Create immutable, verifiable agreements without the paperwork.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link to="/create">
                <Button size="lg">
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="https://github.com/turbopila/link-sign-402" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">
                  View on GitHub
                </Button>
              </a>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Live on Base Sepolia
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 px-6 bg-muted/50">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
              <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 bg-background/50 backdrop-blur-sm">
                <Wallet className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Zero Friction Setup</h3>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                No emails, no passwords, no sign-ups. Just connect your wallet and you're ready to sign.
              </p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
              <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 bg-background/50 backdrop-blur-sm">
                <Zap className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Instant Micropayments</h3>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                Powered by x402. Create binding agreements for just {config.payment.createPrice} USDC. 
                Fast, cheap, and reliable.
              </p>
            </div>

            <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
              <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 bg-background/50 backdrop-blur-sm">
                <FileSignature className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-3">Immutable Proof</h3>
              <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                Every signature is cryptographically verified and stored on-chain. 
                A permanent, tamper-proof record.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works / Details */}
        <section className="py-16 px-6 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Why LinkSign?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We're rebuilding trust for the internet age using blockchain technology.
            </p>
          </div>

          <div className="space-y-12">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="mt-1 bg-secondary p-2 rounded-full h-fit">
                   <Globe className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Global & Permissionless</h3>
                  <p className="text-muted-foreground">
                    Anyone, anywhere can create an agreement. No borders, no gatekeepers. 
                    LinkSign works for freelancers, DAOs, and digital natives.
                  </p>
                </div>
              </div>

               <div className="flex gap-4">
                <div className="mt-1 bg-secondary p-2 rounded-full h-fit">
                   <Lock className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Cryptographically Secure</h3>
                  <p className="text-muted-foreground">
                    Leveraging standard ECDSA signatures, we ensure that only the owner of a wallet can sign. 
                    Your identity is your key.
                  </p>
                </div>
              </div>

               <div className="flex gap-4">
                <div className="mt-1 bg-secondary p-2 rounded-full h-fit">
                   <Shield className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Transparent History</h3>
                  <p className="text-muted-foreground">
                    All created agreements and signatures are publicly verifiable on the Base blockchain explorer.
                    Trust, but verify.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Common Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>What exactly is LinkSign?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      LinkSign is a decentralized platform for creating and signing agreements on the blockchain. 
                      It replaces traditional PDF signing with on-chain transactions that act as permanent proof of agreement.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Is it legally binding?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      LinkSign provides cryptographic proof of intent. While it creates superior evidence compared to traditional digital signatures, 
                      legal standing depends on your specific jurisdiction. It is designed to be the "digital handshake" for the web3 world.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>What do I need to start?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Just a crypto wallet with some USDC on Base Sepolia. No account creation is needed. 
                      We value your privacy and data ownership.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>What happens if LinkSign disappears?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Your agreements are safe. Documents are stored on IPFS, and all proofs (signatures, timestamps, hashes) 
                      are permanently recorded on Ethereum. You can verify everything using only public blockchain data and 
                      standard tools - no dependency on us.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>How can I verify my agreement independently?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      Anyone can verify: (1) Read the AgreementCreated event from the blockchain, (2) Download the document 
                      from IPFS using the CID, (3) Hash the file with keccak256 and compare with the on-chain docHash, 
                      (4) Check payment transaction exists on the block explorer. All verification is public and trustless.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Built to Last - Trust Section */}
        <section className="py-16 px-6 bg-muted/50">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="max-w-2xl mx-auto">
              <Alert variant="success" className="bg-background border-foreground/20 text-foreground">
                <CheckCircle2 className="w-4 h-4" />
                <AlertTitle>Your Agreements Survive Forever</AlertTitle>
                <AlertDescription>
                  Even if LinkSign shuts down, your documents and signatures remain permanently accessible on IPFS and Ethereum.
                </AlertDescription>
              </Alert>
            </div>

            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Built to Last</h2>
              <p className="text-muted-foreground text-lg">
                True decentralization means your data outlives any single service.
              </p>
            </div>

            <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
              <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
                <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 mx-auto bg-background/50 backdrop-blur-sm">
                  <Database className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">No Database, No Risk</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  All data is stored on IPFS and the blockchain. We don't hold your documents in a 
                  private database.
                </p>
              </div>

              <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
                <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 mx-auto bg-background/50 backdrop-blur-sm">
                  <Eye className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Anyone Can Verify</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  No trust required. Any developer can independently verify signatures using only public 
                  blockchain data and IPFS.
                </p>
              </div>

              <div className="flex flex-col items-center p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
                <div className="h-14 w-14 rounded-xl border border-border/50 flex items-center justify-center mb-5 mx-auto bg-background/50 backdrop-blur-sm">
                  <Infinity className="w-7 h-7 text-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-3">Permanent Storage</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  Documents are pinned to IPFS. Cryptographic proofs are etched 
                  into Ethereum forever.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-20 px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to verify your next deal?</h2>
          <Link to="/create">
            <Button size="lg">
              Create Agreement Now
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </section>
      </div>
    </div>
  )
}
