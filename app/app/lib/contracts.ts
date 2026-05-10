import deployments from './deployments.json';

// ── Chain helpers ──────────────────────────────────────────────────────────
export const SUPPORTED_CHAIN_IDS = [133, 177] as const;
export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];

export function getDeployment(chainId: number) {
  if (chainId === 177) return deployments.hashkeyMainnet;
  if (chainId === 133) return deployments.hashkeyTestnet;
  return null;
}

export function getExplorerUrl(chainId: number) {
  const d = getDeployment(chainId);
  return d?.explorer ?? 'https://explorer.hsk.xyz';
}

// ── ABIs (minimal — only what the frontend calls) ─────────────────────────
export const ZKGATE_ABI = [
  {
    name: 'hasAccess',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'credentialType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getCredentialExpiry',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'credentialType', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'verifyAge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_pA', type: 'uint256[2]' },
      { name: '_pB', type: 'uint256[2][2]' },
      { name: '_pC', type: 'uint256[2]' },
      { name: '_pubSignals', type: 'uint256[4]' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const ZKAIRDROP_ABI = [
  {
    name: 'claimWithAgeProof',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_pA', type: 'uint256[2]' },
      { name: '_pB', type: 'uint256[2][2]' },
      { name: '_pC', type: 'uint256[2]' },
      { name: '_pubSignals', type: 'uint256[4]' },
    ],
    outputs: [],
  },
  {
    name: 'hasClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'totalClaims',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxClaims',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'CLAIM_AMOUNT',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'Claimed',
    type: 'event',
    inputs: [
      { name: 'claimer', type: 'address', indexed: true },
      { name: 'nullifier', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ZKCREDENTIAL_REGISTRY_ABI = [
  {
    name: 'updateRoot',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRoot', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'latestRoot',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'issued', type: 'uint256' },
      { name: 'revoked', type: 'uint256' },
      { name: 'currentRoot', type: 'bytes32' },
    ],
  },
] as const;

export const ZKGATE_CONSUMER_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'balances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ── CredentialType enum (matches Solidity) ────────────────────────────────
export const CredentialType = {
  AGE_VERIFIED: 0,
  ACCREDITED_INVESTOR: 1,
  JURISDICTION_CLEAR: 2,
  KYC_COMPLETE: 3,
  AML_CLEAR: 4,
} as const;
