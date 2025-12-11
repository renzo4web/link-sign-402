/**
 * Minimal crypto shim for browser environments.
 * Provides randomBytes using the native Web Crypto API.
 * Required by @faremeter/payment-evm which imports from "crypto".
 */

// Minimal Buffer-like object with toString("hex") support
class RandomBytesResult extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === 'hex') {
      return Array.from(this)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
    return super.toString()
  }
}

export function randomBytes(size: number): RandomBytesResult {
  const bytes = new RandomBytesResult(size)
  crypto.getRandomValues(bytes)
  return bytes
}

// Re-export as default for compatibility
export default { randomBytes }
