import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'

import Header from '../components/Header'
import Footer from '../components/Footer'
import { wagmiConfig } from '../lib/wagmi'

import appCss from '../styles.css?url'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        // Document title (TanStack Head supports this shape)
        title: 'LinkSignX402 — Trust‑Minimized Digital Agreements',
      },
      {
        name: 'description',
        content:
          'Upload a PDF, pay via x402, and anchor an immutable proof of existence and multi‑signatures on-chain. No accounts. Verifiable by anyone using public blockchain data and IPFS.',
      },
      // Open Graph / Social sharing
      {
        property: 'og:title',
        content: 'LinkSignX402 — Trust‑Minimized Digital Agreements',
      },
      {
        property: 'og:description',
        content:
          'Upload a PDF, pay via x402, and anchor an immutable proof of existence and multi‑signatures on-chain. No accounts. Verifiable via public blockchain data + IPFS.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'LinkSignX402',
      },
      {
        property: 'og:url',
        content: 'https://linksignx402.xyz',
      },
      {
        property: 'og:image',
        content: 'https://linksignx402.xyz/linksign402-banner.png',
      },
      {
        property: 'og:image:type',
        content: 'image/png',
      },
      {
        property: 'og:image:alt',
        content: 'LinkSignX402 banner',
      },
      // Twitter
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'LinkSignX402 — Trust‑Minimized Digital Agreements',
      },
      {
        name: 'twitter:description',
        content:
          'Upload a PDF, pay via x402, and anchor an immutable proof of existence and multi‑signatures on-chain. No accounts. Verifiable via public blockchain data + IPFS.',
      },
      {
        name: 'twitter:image',
        content: 'https://linksignx402.xyz/linksign402-banner.png',
      },
      {
        name: 'twitter:image:alt',
        content: 'LinkSignX402 banner',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'canonical',
        href: 'https://linksignx402.xyz',
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            {mounted ? (
              <RainbowKitProvider>
                <Header />
                {children}
                <Footer />
                <TanStackDevtools
                  config={{
                    position: 'bottom-right',
                  }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
              </RainbowKitProvider>
            ) : (
              <>
                <Header />
                {children}
                <Footer />
              </>
            )}
          </QueryClientProvider>
        </WagmiProvider>
        <Scripts />
      </body>
    </html>
  )
}
