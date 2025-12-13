import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  getContract,
  http,
  isAddress,
  keccak256,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'

export const agreementOracleAbi = [
  {
    type: 'function',
    name: 'registerAgreement',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_agreementId', type: 'bytes32' },
      { name: '_docHash', type: 'bytes32' },
      { name: '_cid', type: 'string' },
      { name: '_creator', type: 'address' },
      { name: '_paymentRef', type: 'bytes32' },
      { name: '_chainRef', type: 'string' },
    ],
    outputs: [],
  },
] as const

export function networkToChainRef(network: string): string {
  // CAIP-2
  switch (network) {
    case 'base-sepolia':
      return 'eip155:84532'
    case 'base':
      return 'eip155:8453'
    case 'sepolia':
      return 'eip155:11155111'
    case 'mainnet':
      return 'eip155:1'
    default:
      return network
  }
}

function chainForNetwork(network: string) {
  switch (network) {
    case 'base-sepolia':
      return baseSepolia
    case 'base':
      return base
    case 'sepolia':
      return sepolia
    case 'mainnet':
      return mainnet
    default:
      return baseSepolia
  }
}

export function computeAgreementId(docHash: Hash, creator: Address, paymentRef: Hash): Hash {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }],
      [docHash, creator, paymentRef]
    )
  )
}

export function assertEvmAddress(value: unknown, label: string): asserts value is Address {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new Error(`Invalid ${label} (expected EVM address): ${String(value)}`)
  }
}

export function assertBytes32(value: unknown, label: string): asserts value is Hash {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Invalid ${label} (expected bytes32 hash): ${String(value)}`)
  }
}

export async function checkAgreementExists(
  params: {
    rpcUrl: string
    network: string
    contractAddress: Address
    agreementId: Hash
  }
): Promise<boolean> {
  const chain = chainForNetwork(params.network)
  const publicClient = createPublicClient({ chain, transport: http(params.rpcUrl) })

  try {
    const exists = await publicClient.readContract({
      address: params.contractAddress,
      abi: [{
        type: 'function',
        name: 'agreementExists',
        stateMutability: 'view',
        inputs: [{ name: 'agreementId', type: 'bytes32' }],
        outputs: [{ name: '', type: 'bool' }],
      }],
      functionName: 'agreementExists',
      args: [params.agreementId],
    })
    return Boolean(exists)
  } catch (err) {
    console.warn('[agreement-oracle] checkAgreementExists failed, assuming false', err)
    return false
  }
}

export async function registerAgreement(
  params: {
    rpcUrl: string
    network: string
    contractAddress: Address
    serverPrivateKey: Hex
    agreementId: Hash
    docHash: Hash
    cid: string
    creator: Address
    paymentRef: Hash
    chainRef: string
  }
): Promise<{ txHash: Hash }>
{
  const chain = chainForNetwork(params.network)
  const account = privateKeyToAccount(params.serverPrivateKey)

  const publicClient = createPublicClient({ chain, transport: http(params.rpcUrl) })
  const walletClient = createWalletClient({ chain, transport: http(params.rpcUrl), account })

  const contract = getContract({
    address: params.contractAddress,
    abi: agreementOracleAbi,
    client: { public: publicClient, wallet: walletClient },
  })

  const txHash = await contract.write.registerAgreement(
    [
      params.agreementId,
      params.docHash,
      params.cid,
      params.creator,
      params.paymentRef,
      params.chainRef,
    ],
    {
      account,
      chain,
    }
  )

  return { txHash }
}
