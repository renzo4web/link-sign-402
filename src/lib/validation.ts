import type { Address } from 'viem'

export interface CreateAgreementInput {
  fileBase64: string
  fileName: string
  creatorAddress: Address
  fileBytes: Uint8Array
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(normalized)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function validateCreateBody(body: unknown): CreateAgreementInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Invalid JSON body')
  }

  const { fileBase64, fileName, creatorAddress } = body as Record<string, unknown>

  if (typeof fileBase64 !== 'string' || !fileBase64) {
    throw new ValidationError('Missing fileBase64')
  }

  if (typeof creatorAddress !== 'string' || !EVM_ADDRESS_REGEX.test(creatorAddress)) {
    throw new ValidationError('Invalid creatorAddress')
  }

  const fileBytes = base64ToBytes(fileBase64)
  if (fileBytes.length === 0) {
    throw new ValidationError('Empty file')
  }

  return {
    fileBase64,
    fileName: typeof fileName === 'string' && fileName ? fileName : 'agreement.pdf',
    creatorAddress: creatorAddress as Address,
    fileBytes,
  }
}
