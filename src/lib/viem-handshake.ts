import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  getContract,
  keccak256,
  toBytes,
} from 'viem'

/**
 * Viem Integration (handshake contract)
 *
 * This file includes:
 * - hashAgreement(text)        Hashes agreement text into a bytes32
 * - createHandshake(clients, text) Creates a handshake on-chain
 * - signHandshake(clients, docHash) Signs an existing handshake
 * - getCreation(publicClient, contractAddress, docHash) Reads creation info
 * - checkSignature(publicClient, contractAddress, docHash, address) Verifies a signature
 * - Event watchers             Real-time updates via contract event polling/subscriptions
 *
 * Server routes:
 * This repo exposes Hono API examples in `src/server.ts` (not Express) that also
 * simulate on-chain interaction with console logs + small awaited delays.
 *
 * Quick Start
 *
 *   // Hash + Create
 *   const docHash = hashAgreement('Agreement text...')
 *   await createHandshake({ publicClient, walletClient, contractAddress }, 'Agreement text...')
 *
 *   // Sign (other party)
 *   await signHandshake({ publicClient, walletClient, contractAddress }, docHash)
 *
 *   // Verify
 *   const { exists, creator } = await getCreation(publicClient, contractAddress, docHash)
 *   const { signed } = await checkSignature(publicClient, contractAddress, docHash, signerAddress)
 */

/**
 * Minimal ABI for a "handshake" signing contract.
 *
 * Note: Function/event names can differ between implementations.
 * If your on-chain contract uses different names, update this ABI only.
 */
export const handshakeAbi = [
  {
    type: 'function',
    name: 'createHandshake',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'docHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'signHandshake',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'docHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCreation',
    stateMutability: 'view',
    inputs: [{ name: 'docHash', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'creator', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'checkSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'docHash', type: 'bytes32' },
      { name: 'signer', type: 'address' },
    ],
    outputs: [{ name: 'signed', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'HandshakeCreated',
    inputs: [
      { indexed: true, name: 'docHash', type: 'bytes32' },
      { indexed: true, name: 'creator', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'HandshakeSigned',
    inputs: [
      { indexed: true, name: 'docHash', type: 'bytes32' },
      { indexed: true, name: 'signer', type: 'address' },
    ],
  },
] as const

export interface HandshakeClients {
  publicClient: PublicClient
  walletClient: WalletClient
  contractAddress: Address
}

/**
 * hashAgreement(text) - Deterministically hashes agreement text into a bytes32 (keccak256).
 */
export function hashAgreement(text: string): Hash {
  // keccak256 expects hex; toBytes(text) produces Uint8Array, which viem accepts.
  return keccak256(toBytes(text)) as Hash
}

function getHandshakeContract({ publicClient, walletClient, contractAddress }: HandshakeClients) {
  return getContract({
    address: contractAddress,
    abi: handshakeAbi,
    client: { public: publicClient, wallet: walletClient },
  })
}

/**
 * createHandshake(wallet, text) - Creates a handshake on-chain.
 * Returns the computed docHash and the transaction hash.
 */
export async function createHandshake(
  clients: HandshakeClients,
  text: string
): Promise<{ docHash: Hash; txHash: Hash }>
{
  const docHash = hashAgreement(text)
  const contract = getHandshakeContract(clients)

  const account = clients.walletClient.account
  if (!account) {
    throw new Error('walletClient.account is required to send transactions')
  }

  const txHash = await contract.write.createHandshake([docHash], {
    account,
    chain: clients.walletClient.chain,
  })

  return { docHash, txHash }
}

/**
 * signHandshake(wallet, docHash) - Signs an existing handshake.
 */
export async function signHandshake(
  clients: HandshakeClients,
  docHash: Hash
): Promise<{ txHash: Hash }>
{
  const contract = getHandshakeContract(clients)

  const account = clients.walletClient.account
  if (!account) {
    throw new Error('walletClient.account is required to send transactions')
  }

  const txHash = await contract.write.signHandshake([docHash], {
    account,
    chain: clients.walletClient.chain,
  })
  return { txHash }
}

/**
 * getCreation(docHash) - Reads creator info.
 */
export async function getCreation(
  publicClient: PublicClient,
  contractAddress: Address,
  docHash: Hash
): Promise<{ exists: boolean; creator: Address; createdAt: bigint }>
{
  const contract = getContract({
    address: contractAddress,
    abi: handshakeAbi,
    client: { public: publicClient },
  })

  const [exists, creator, createdAt] = await contract.read.getCreation([docHash])
  return { exists, creator, createdAt }
}

/**
 * checkSignature(docHash, address) - Checks whether an address has signed.
 */
export async function checkSignature(
  publicClient: PublicClient,
  contractAddress: Address,
  docHash: Hash,
  address: Address
): Promise<{ signed: boolean }>
{
  const contract = getContract({
    address: contractAddress,
    abi: handshakeAbi,
    client: { public: publicClient },
  })

  const signed = await contract.read.checkSignature([docHash, address])
  return { signed: Boolean(signed) }
}

/**
 * Event watchers - Real-time updates (polling by default unless transport supports subscriptions).
 */
export function watchHandshakeCreated(
  publicClient: PublicClient,
  contractAddress: Address,
  onEvent: (event: { docHash: Hash; creator: Address }) => void,
  options?: { pollingInterval?: number }
): () => void {
  return publicClient.watchContractEvent({
    address: contractAddress,
    abi: handshakeAbi,
    eventName: 'HandshakeCreated',
    pollingInterval: options?.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as unknown as { docHash: Hash; creator: Address }
        onEvent({ docHash: args.docHash, creator: args.creator })
      }
    },
  })
}

export function watchHandshakeSigned(
  publicClient: PublicClient,
  contractAddress: Address,
  onEvent: (event: { docHash: Hash; signer: Address }) => void,
  options?: { pollingInterval?: number }
): () => void {
  return publicClient.watchContractEvent({
    address: contractAddress,
    abi: handshakeAbi,
    eventName: 'HandshakeSigned',
    pollingInterval: options?.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as unknown as { docHash: Hash; signer: Address }
        onEvent({ docHash: args.docHash, signer: args.signer })
      }
    },
  })
}
