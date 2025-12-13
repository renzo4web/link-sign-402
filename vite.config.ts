import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import path from 'path'

const config = defineConfig({
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Minimal crypto shim for @faremeter/payment-evm (only needs randomBytes)
      crypto: path.resolve(__dirname, 'src/lib/crypto-shim.ts'),
    },
  },
  test: {
    // Run unit tests in a Node-compatible runtime.
    // The Cloudflare Workers runner does not support CommonJS globals like `module`.
    pool: 'threads',
    environment: 'jsdom',
  },
})

export default config
