import { PinataSDK } from 'pinata'
import { getServerConfig } from '../config/env'

let instance: PinataSDK | null = null

export function getPinata(): PinataSDK {
  if (!instance) {
    const config = getServerConfig()
    instance = new PinataSDK({
      pinataJwt: config.pinata.jwt,
      pinataGateway: config.pinata.gateway,
    })
  }
  return instance
}

export async function uploadToIPFS(fileBytes: Uint8Array, fileName: string): Promise<string> {
  const pinata = getPinata()
  const file = new File([fileBytes.buffer as ArrayBuffer], fileName, { type: 'application/pdf' })
  const upload = await pinata.upload.public.file(file)

  // Pinata returns cid in different fields depending on version
  const cid = (upload as any)?.cid ?? (upload as any)?.IpfsHash ?? (upload as any)?.ipfsHash
  if (!cid || typeof cid !== 'string') {
    throw new Error('Pinata did not return CID')
  }
  return cid
}
