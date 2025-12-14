export type Caip2Network = `eip155:${number}`
export type SupportedNetwork = 'base-sepolia' | 'base' | 'sepolia' | 'mainnet'

type NetworkInfo = {
  caip2: Caip2Network
  chainId: number
  explorerUrl: string
}

const NETWORKS: Record<SupportedNetwork, NetworkInfo> = {
  'base-sepolia': { caip2: 'eip155:84532', chainId: 84532, explorerUrl: 'https://sepolia.basescan.org' },
  'base': { caip2: 'eip155:8453', chainId: 8453, explorerUrl: 'https://basescan.org' },
  'sepolia': { caip2: 'eip155:11155111', chainId: 11155111, explorerUrl: 'https://sepolia.etherscan.io' },
  'mainnet': { caip2: 'eip155:1', chainId: 1, explorerUrl: 'https://etherscan.io' },
}

// Reverse lookup: caip2 -> NetworkInfo
const CAIP2_TO_NETWORK = Object.fromEntries(
  Object.entries(NETWORKS).map(([, info]) => [info.caip2, info])
) as Record<Caip2Network, NetworkInfo>

export function getNetworkCaip2(network: string): Caip2Network {
  const info = NETWORKS[network as SupportedNetwork]
  if (!info) {
    throw new Error(`Unsupported network: ${network}. Use: ${Object.keys(NETWORKS).join(', ')}`)
  }
  return info.caip2
}

function normalizeNetworkName(network: string): SupportedNetwork {
  const normalized = network.toLowerCase().replace(/\s+/g, '-') as SupportedNetwork
  return normalized
}

export function getChainId(network: string): number {
  const info = NETWORKS[normalizeNetworkName(network)]
  if (!info) {
    throw new Error(`Unsupported network: ${network}. Use: ${Object.keys(NETWORKS).join(', ')}`)
  }
  return info.chainId
}

export function getExplorerUrl(chainRef: string | undefined): string | null {
  if (!chainRef) return null
  const info = CAIP2_TO_NETWORK[chainRef as Caip2Network]
  return info?.explorerUrl ?? null
}

export function buildTxUrl(chainRef: string | undefined, txHash: string | null | undefined): string | null {
  const base = getExplorerUrl(chainRef)
  return base && txHash ? `${base}/tx/${txHash}` : null
}

export function buildAddressUrl(chainRef: string | undefined, address: string | undefined): string | null {
  const base = getExplorerUrl(chainRef)
  return base && address ? `${base}/address/${address}` : null
}

export function buildIpfsUrl(cid: string | undefined): string | null {
  return cid ? `https://ipfs.io/ipfs/${cid}` : null
}
