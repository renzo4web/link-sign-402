#!/usr/bin/env tsx
/**
 * Environment Validation Script
 * 
 * Validates that all required environment variables are set before starting the app.
 * Run this before `pnpm dev` or `pnpm build` to catch configuration errors early.
 * 
 * Usage:
 *   pnpm tsx scripts/validate-env.ts
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
}

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logError(message: string) {
  log('red', `❌ ${message}`)
}

function logSuccess(message: string) {
  log('green', `✅ ${message}`)
}

function logWarning(message: string) {
  log('yellow', `⚠️  ${message}`)
}

function logInfo(message: string) {
  log('blue', `ℹ️  ${message}`)
}

// Skip validation if building for Cloudflare Workers deployment
if (process.env.SKIP_ENV_VALIDATION === 'true') {
  logInfo('Skipping env validation (SKIP_ENV_VALIDATION=true)')
  logInfo('Assuming env vars are set in Cloudflare Workers')
  process.exit(0)
}

// Check if .env file exists
const envPath = join(process.cwd(), '.env')
if (!existsSync(envPath)) {
  logError('.env file not found!')
  logInfo('Copy .env.example to .env and fill in your values:')
  console.log('  cp .env.example .env')
  process.exit(1)
}

logSuccess('.env file found')

// Required server-side environment variables
const requiredServerVars = [
  'CDP_API_KEY_ID',
  'CDP_API_KEY_SECRET',
  'PAY_TO_ADDRESS',
  'PAYMENT_CREATE_PRICE',
  'PAYMENT_SIGN_PRICE',
  'BLOCKCHAIN_NETWORK',
  'CONTRACT_ADDRESS',
  'BLOCKCHAIN_RPC_URL',
  'PINATA_JWT',
  'PINATA_GATEWAY',
  'SERVER_WALLET_PRIVATE_KEY',
] as const

// Required client-side environment variables
const requiredClientVars = [
  'VITE_PAYMENT_CREATE_PRICE',
  'VITE_PAYMENT_SIGN_PRICE',
  'VITE_BLOCKCHAIN_NETWORK',
] as const

let hasErrors = false

// Validate server variables
logInfo('Validating server-side variables...')
for (const key of requiredServerVars) {
  if (!process.env[key]) {
    logError(`Missing required server variable: ${key}`)
    hasErrors = true
  } else if (process.env[key]?.includes('your-') || process.env[key]?.includes('example')) {
    logWarning(`${key} contains placeholder value - update it with real value`)
  } else {
    logSuccess(`${key} is set`)
  }
}

// Validate client variables
logInfo('Validating client-side variables (VITE_* prefix)...')
for (const key of requiredClientVars) {
  if (!process.env[key]) {
    logError(`Missing required client variable: ${key}`)
    hasErrors = true
  } else {
    logSuccess(`${key} is set`)
  }
}

// Cross-validate PAYMENT_* vs VITE_PAYMENT_*
logInfo('Cross-validating payment prices...')
const serverCreatePrice = process.env.PAYMENT_CREATE_PRICE
const clientCreatePrice = process.env.VITE_PAYMENT_CREATE_PRICE
const serverSignPrice = process.env.PAYMENT_SIGN_PRICE
const clientSignPrice = process.env.VITE_PAYMENT_SIGN_PRICE

if (serverCreatePrice && clientCreatePrice) {
  if (serverCreatePrice !== clientCreatePrice) {
    logError('Create price mismatch detected!')
    console.log(`  Server (PAYMENT_CREATE_PRICE):      ${serverCreatePrice}`)
    console.log(`  Client (VITE_PAYMENT_CREATE_PRICE): ${clientCreatePrice}`)
    logWarning('These should match to avoid confusion. Server price is the source of truth.')
    hasErrors = true
  } else {
    logSuccess('Create prices match')
  }
}

if (serverSignPrice && clientSignPrice) {
  if (serverSignPrice !== clientSignPrice) {
    logError('Sign price mismatch detected!')
    console.log(`  Server (PAYMENT_SIGN_PRICE):      ${serverSignPrice}`)
    console.log(`  Client (VITE_PAYMENT_SIGN_PRICE): ${clientSignPrice}`)
    logWarning('These should match to avoid confusion. Server price is the source of truth.')
    hasErrors = true
  } else {
    logSuccess('Sign prices match')
  }
}

// Validate blockchain network format
logInfo('Validating blockchain network...')
const validNetworks = ['base-sepolia', 'base', 'sepolia', 'mainnet']
const network = process.env.BLOCKCHAIN_NETWORK

if (network && !validNetworks.includes(network)) {
  logError(`Invalid BLOCKCHAIN_NETWORK: ${network}`)
  logInfo(`Valid options: ${validNetworks.join(', ')}`)
  hasErrors = true
} else if (network) {
  logSuccess(`BLOCKCHAIN_NETWORK is valid: ${network}`)
}

// Summary
console.log('\n' + '='.repeat(60))
if (hasErrors) {
  logError('Environment validation FAILED')
  logInfo('Fix the errors above before starting the app')
  process.exit(1)
} else {
  logSuccess('Environment validation PASSED')
  logInfo('All required variables are set and valid')
  console.log('')
}
