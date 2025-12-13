import { describe, expect, it } from 'vitest'
import { hashAgreement } from './viem-handshake'

describe('viem-handshake', () => {
  it('hashAgreement hashes agreement text to a stable bytes32', () => {
    expect(hashAgreement('Agreement text...')).toBe(
      '0xa7c072a548acabfd5e1b6b7739c971ae8a5f94a83ec0c30c2ef5ccd201951d95'
    )
  })

  it('hashAgreement returns a 0x-prefixed 32-byte hex string', () => {
    const h = hashAgreement('hello')
    expect(h.startsWith('0x')).toBe(true)
    expect(h.length).toBe(66)
  })
})
