/**
 * Browser polyfills for Node.js globals required by @faremeter/payment-evm
 * Only runs in browser environment, synchronously before any code uses Buffer
 */

// Simple Buffer polyfill for browser - only needs basic functionality
if (typeof window !== 'undefined' && typeof globalThis.Buffer === 'undefined') {
  // Minimal Buffer implementation that @faremeter/payment-evm needs
  const BufferPolyfill = {
    from: (data: Uint8Array | number[] | string, encoding?: string): Uint8Array & { toString(enc?: string): string } => {
      let bytes: Uint8Array
      if (typeof data === 'string') {
        if (encoding === 'hex') {
          const matches = data.match(/.{1,2}/g) || []
          bytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
        } else {
          bytes = new TextEncoder().encode(data)
        }
      } else {
        bytes = new Uint8Array(data)
      }
      
      // Add toString method
      const result = bytes as Uint8Array & { toString(enc?: string): string }
      result.toString = function(enc?: string): string {
        if (enc === 'hex') {
          return Array.from(this).map((b) => b.toString(16).padStart(2, '0')).join('')
        }
        return new TextDecoder().decode(this)
      }
      return result
    },
    isBuffer: (obj: unknown): boolean => {
      return obj instanceof Uint8Array
    },
    alloc: (size: number): Uint8Array => {
      return new Uint8Array(size)
    },
  }
  
  globalThis.Buffer = BufferPolyfill as unknown as typeof Buffer
}

export {}
