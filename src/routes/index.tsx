import { createFileRoute, Link } from '@tanstack/react-router'
import { FileSignature, Shield, Wallet, ArrowRight, Zap, Globe, Lock } from 'lucide-react'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'
import { getClientConfig } from '../config/env'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const config = getClientConfig()

  return (
    <div className="min-h-screen text-foreground overflow-hidden relative bg-white dark:bg-black">
      {/* Grid Background */}
      <div className={cn(
          "absolute inset-0",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
        )}
      />
      {/* Radial gradient mask for faded look */}
      <div className="pointer-events-none absolute inset-0 bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black" />
      
      {/* Content Layer */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative pt-24 pb-16 md:pt-40 md:pb-24 px-6">
          <div className="relative z-10 max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-slate-900 dark:text-slate-50">
              Sign Agreements with{' '}
              <span className="text-blue-600">x402 Protocol</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              The digital handshake for the crypto era.<br />
              Create immutable, verifiable agreements without the paperwork.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-8">
              <Link to="/create">
                <Button size="lg" className="h-11 px-6 rounded-full bg-slate-900 text-white hover:bg-slate-800">
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href="https://github.com/turbopila/link-sign-402" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="h-11 px-6 rounded-full">
                  View on GitHub
                </Button>
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-500">
              Live on Base Sepolia
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Zero Friction Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  No emails, no passwords, no sign-ups. Just connect your wallet and you're ready to sign. 
                  A pure Web3 native experience.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Instant Micropayments</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Powered by the x402 protocol. Create binding agreements for just {config.payment.price} USDC. 
                  Fast, cheap, and reliable global payments.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-200">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <FileSignature className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Immutable Proof</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Every signature is cryptographically verified and stored on-chain. 
                  Create a permanent, tamper-proof record of your agreements.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How It Works / Details */}
        <section className="py-24 px-6 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Why LinkSign?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We're rebuilding trust for the internet age using blockchain technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="mt-1 bg-blue-50 p-2 rounded-full h-fit">
                   <Globe className="w-6 h-6 text-blue-600" />
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
                <div className="mt-1 bg-blue-50 p-2 rounded-full h-fit">
                   <Lock className="w-6 h-6 text-blue-600" />
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
                <div className="mt-1 bg-blue-50 p-2 rounded-full h-fit">
                   <Shield className="w-6 h-6 text-blue-600" />
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

            <Card className="border-muted/50 shadow-none bg-muted/20">
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
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-20 px-6 text-center bg-gradient-to-b from-transparent to-primary/5">
          <h2 className="text-3xl font-bold mb-6">Ready to verify your next deal?</h2>
          <Link to="/create">
            <Button size="lg" variant="default" className="text-lg px-8 rounded-full h-12 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
              Create Agreement Now
            </Button>
          </Link>
        </section>
      </div>
    </div>
  )
}
