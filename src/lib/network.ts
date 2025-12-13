export type Caip2Network = `eip155:${number}`
export type SupportedNetwork = 'base-sepolia' | 'base' | 'sepolia' | 'mainnet'

const NETWORK_MAP: Record<SupportedNetwork, Caip2Network> = {
  'base-sepolia': 'eip155:84532',
  'base': 'eip155:8453',
  'sepolia': 'eip155:11155111',
  'mainnet': 'eip155:1',
}

export function getNetworkCaip2(network: string): Caip2Network {
  const caip2 = NETWORK_MAP[network as SupportedNetwork]
  if (!caip2) {
    throw new Error(`Unsupported network: ${network}. Use: ${Object.keys(NETWORK_MAP).join(', ')}`)
  }
  return caip2
}
