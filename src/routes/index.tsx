import { createFileRoute, Link } from '@tanstack/react-router'
import { FileSignature, Shield, Wallet, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6">

        {/* Hero Section - Clean typography */}
        <section className="py-24 text-center">
          <Badge variant="outline" className="mb-8 font-normal">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse mr-2" />
            Live on Base Sepolia
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Write. Pay. Sign. <br />
            <span className="text-primary">On Chain.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Create agreements that are verified, immutable, and permanent. 
            The digital handshake for the crypto era.
          </p>

          <Link to="/create">
            <Button size="lg">
              Start a New Handshake
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </section>

        {/* Features - Standard Grid with Cards */}
        <section className="py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Wallet className="w-10 h-10 text-primary mb-2" />
              <CardTitle>No Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Just connect your wallet. No emails, no passwords, no accounts to manage. 
                Pure Web3 experience.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Pay with x402</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Seamless micropayments via the x402 protocol. 
                Create for {config.payment.price} USDC.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileSignature className="w-10 h-10 text-primary mb-2" />
              <CardTitle>Blockchain Proof</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Your agreement fingerprint is stored on-chain. 
                Immutable, verifiable, and permanent.
              </CardDescription>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="py-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <Accordion className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is LinkSign?</AccordionTrigger>
              <AccordionContent>
                LinkSign is a decentralized tool for creating immutable, verifiable agreements on the blockchain. 
                Think of it as a "digital handshake" that lives forever on-chain.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How much does it cost?</AccordionTrigger>
              <AccordionContent>
                We use the x402 protocol for micropayments. It costs exactly {config.payment.price} USDC to create an agreement.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Do I need an account?</AccordionTrigger>
              <AccordionContent>
                No. You only need a crypto wallet (like Metamask, Coinbase Wallet, or Rainbow). 
                We don't store your email, password, or personal data.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is this legally binding?</AccordionTrigger>
              <AccordionContent>
               LinkSign serves as cryptographic proof of intent and agreement. While it creates immutable evidence 
               verified by wallet signatures, legal enforceability depends on your local jurisdiction's laws regarding digital signatures.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>
    </div>
  )
}
