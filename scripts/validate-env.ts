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
  'PAYMENT_PRICE',
  'BLOCKCHAIN_NETWORK',
  'CONTRACT_ADDRESS',
] as const

// Required client-side environment variables
const requiredClientVars = [
  'VITE_PAYMENT_PRICE',
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

// Cross-validate PAYMENT_PRICE vs VITE_PAYMENT_PRICE
logInfo('Cross-validating payment prices...')
const serverPrice = process.env.PAYMENT_PRICE
const clientPrice = process.env.VITE_PAYMENT_PRICE

if (serverPrice && clientPrice) {
  if (serverPrice !== clientPrice) {
    logError(`Price mismatch detected!`)
    console.log(`  Server (PAYMENT_PRICE):      ${serverPrice}`)
    console.log(`  Client (VITE_PAYMENT_PRICE): ${clientPrice}`)
    logWarning('These should match to avoid confusion. Server price is the source of truth.')
    hasErrors = true
  } else {
    logSuccess('Payment prices match')
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
