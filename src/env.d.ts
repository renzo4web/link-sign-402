/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client-side environment variables
  readonly VITE_PAYMENT_CREATE_PRICE: string
  readonly VITE_PAYMENT_SIGN_PRICE: string
  readonly VITE_BLOCKCHAIN_NETWORK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Server-side environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly CDP_API_KEY_ID: string
      readonly CDP_API_KEY_SECRET: string
      readonly PAY_TO_ADDRESS: string
      readonly PAYMENT_CREATE_PRICE: string
      readonly PAYMENT_SIGN_PRICE: string
      readonly BLOCKCHAIN_NETWORK: string
      readonly CONTRACT_ADDRESS: string
      readonly NODE_ENV: 'development' | 'production' | 'test'
    }
  }
}

export {}