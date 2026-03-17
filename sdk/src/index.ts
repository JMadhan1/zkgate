/**
 * @zkgate/sdk
 * ===========
 * One-line ZK identity verification for any DeFi protocol on HashKey Chain.
 *
 * Install:
 *   npm install @zkgate/sdk
 *
 * Usage — literally 3 lines:
 *   import { ZKGateSDK } from '@zkgate/sdk'
 *   const gate = new ZKGateSDK({ contractAddress: '0x...', chainId: 133 })
 *   const verified = await gate.hasAccess(userAddress, 'KYC_COMPLETE')
 */

import { ethers } from 'ethers';

// ── Types ──────────────────────────────────────────────────────────────────

export type CredentialType =
  | 'AGE_VERIFIED'
  | 'JURISDICTION_CLEAR'
  | 'ACCREDITED_INVESTOR'
  | 'KYC_COMPLETE'
  | 'AML_CLEAR';

const CREDENTIAL_TYPE_MAP: Record<CredentialType, number> = {
  AGE_VERIFIED:        0,
  JURISDICTION_CLEAR:  1,
  ACCREDITED_INVESTOR: 2,
  KYC_COMPLETE:        3,
  AML_CLEAR:           4,
};

export interface ZKGateConfig {
  contractAddress: string;
  chainId: number;
  rpcUrl?: string;
  issuerApiUrl?: string;  // URL of the credential issuer server
}

export interface ProofInput {
  birthTimestamp?: number;   // for age proofs
  userSecret: string;        // hex string, stored client-side
  currentTimestamp?: number;
  credentialType?: CredentialType;
  merkleRoot?: string;
  merklePath?: string[];
  merklePathIndices?: number[];
}

export interface ZKProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  publicSignals: string[];
  nullifierHash: string;
  isSimulated: boolean;
  proofTime: number;
}

export interface CredentialRecord {
  commitment: string;
  merkleRoot: string;
  type: number;
  secret: string;
  issuedAt: number;
  merklePath: string[];
  merklePathIndices: number[];
}

// ── ABI (minimal) ─────────────────────────────────────────────────────────

const ZKGATE_ABI = [
  'function hasAccess(address user, uint8 credType) view returns (bool)',
  'function getCredentialExpiry(address user, uint8 credType) view returns (uint256)',
  'function verifyAge(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[4] pubSignals) returns (bool)',
  'function verifyCredential(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[4] pubSignals) returns (bool)',
  'function verifySelective(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[8] pubSignals, uint256 bitmask) returns (bool)',
  'event VerificationCompleted(address indexed user, uint8 credType, bytes32 nullifier)',
  'event AccessGranted(address indexed user, uint8 credType, uint256 expiry)',
];

// ── ZKGateSDK class ────────────────────────────────────────────────────────

export class ZKGateSDK {
  private config: ZKGateConfig;
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;

  // Default HashKey Chain RPC URLs
  private static readonly RPC_URLS: Record<number, string> = {
    133: 'https://hashkeychain-testnet.alt.technology',
    177: 'https://hashkeychain-mainnet.alt.technology',
  };

  constructor(config: ZKGateConfig) {
    this.config = config;
  }

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl = this.config.rpcUrl
        ?? ZKGateSDK.RPC_URLS[this.config.chainId]
        ?? 'https://hashkeychain-testnet.alt.technology';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.provider;
  }

  private getContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
    const base = signerOrProvider ?? this.getProvider();
    return new ethers.Contract(this.config.contractAddress, ZKGATE_ABI, base);
  }

  /**
   * Check if a user has a valid, non-expired credential.
   * This is the most common operation — works as a read-only gate check.
   *
   * @example
   * const hasKYC = await gate.hasAccess(userAddress, 'KYC_COMPLETE')
   * if (!hasKYC) throw new Error('KYC required')
   */
  async hasAccess(userAddress: string, credType: CredentialType): Promise<boolean> {
    const contract = this.getContract();
    return contract.hasAccess(userAddress, CREDENTIAL_TYPE_MAP[credType]);
  }

  /**
   * Get when a credential expires (Unix timestamp).
   * Returns 0 if the user has no credential.
   */
  async getExpiry(userAddress: string, credType: CredentialType): Promise<number> {
    const contract = this.getContract();
    const expiry = await contract.getCredentialExpiry(userAddress, CREDENTIAL_TYPE_MAP[credType]);
    return Number(expiry);
  }

  /**
   * Check multiple credentials at once.
   *
   * @example
   * const { KYC_COMPLETE, AGE_VERIFIED } = await gate.checkMultiple(addr, ['KYC_COMPLETE', 'AGE_VERIFIED'])
   */
  async checkMultiple(
    userAddress: string,
    credTypes: CredentialType[]
  ): Promise<Record<CredentialType, boolean>> {
    const results = await Promise.all(
      credTypes.map(ct => this.hasAccess(userAddress, ct))
    );
    return Object.fromEntries(
      credTypes.map((ct, i) => [ct, results[i]])
    ) as Record<CredentialType, boolean>;
  }

  /**
   * Issue a credential via the ZKGate issuer API.
   * Adds user data to the Merkle tree and returns a credential record.
   *
   * @example
   * const credential = await gate.issueCredential({ userData: { name: '...', dob: '...' }, credentialType: 'KYC_COMPLETE' })
   */
  async issueCredential(params: {
    userData: Record<string, string>;
    credentialType: CredentialType;
  }): Promise<CredentialRecord> {
    const apiUrl = this.config.issuerApiUrl ?? '/api';
    const response = await fetch(`${apiUrl}/issue-credential`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userData: params.userData,
        credentialType: params.credentialType,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`ZKGateSDK: Failed to issue credential — ${error.error}`);
    }

    const data = await response.json();
    return data.credential as CredentialRecord;
  }

  /**
   * Generate a ZK proof (uses simulation if circuits not compiled).
   * Returns proof in the format expected by the smart contract.
   */
  async generateProof(
    type: 'age' | 'credential' | 'selective',
    input: ProofInput & {
      disclosureBitmask?: number;
      fullCredential?: [number, number, number, number, number];
    }
  ): Promise<ZKProof> {
    // Dynamic import to avoid SSR issues
    const { generateAgeProof, generateCredentialProof, generateSelectiveDisclosureProof, formatProofForContract } =
      await import('../../app/app/lib/zkproof');

    const now = input.currentTimestamp ?? Math.floor(Date.now() / 1000);

    let result;
    if (type === 'age' && input.birthTimestamp) {
      result = await generateAgeProof({
        birthTimestamp: input.birthTimestamp,
        userSecret: input.userSecret,
        currentTimestamp: now,
      });
    } else if (type === 'credential' && input.credentialType && input.merkleRoot) {
      result = await generateCredentialProof({
        userCommitment: input.userSecret,
        credType: CREDENTIAL_TYPE_MAP[input.credentialType],
        issuanceDate: now - 86400 * 30,
        expiryDate: now + 86400 * 335,
        issuerPubkey: '0x1234567890abcdef',
        userSecret: input.userSecret,
        pathElements: input.merklePath ?? Array(20).fill('0x' + '0'.repeat(64)),
        pathIndices: input.merklePathIndices ?? Array(20).fill(0),
        credentialType: CREDENTIAL_TYPE_MAP[input.credentialType],
        merkleRoot: input.merkleRoot,
        currentTimestamp: now,
      });
    } else if (type === 'selective' && input.disclosureBitmask !== undefined && input.merkleRoot && input.fullCredential) {
      result = await generateSelectiveDisclosureProof({
        fullCredential: input.fullCredential,
        disclosureBitmask: input.disclosureBitmask,
        userCommitment: input.userSecret,
        issuanceDate: now - 86400 * 30,
        expiryDate: now + 86400 * 335,
        issuerPubkey: '0x1234567890abcdef',
        userSecret: input.userSecret,
        pathElements: input.merklePath ?? Array(20).fill('0x' + '0'.repeat(64)),
        pathIndices: input.merklePathIndices ?? Array(20).fill(0),
        merkleRoot: input.merkleRoot,
        currentTimestamp: now,
      });
    } else {
      throw new Error('ZKGateSDK: Invalid proof type or missing required inputs');
    }

    const contractProof = formatProofForContract(result.proof);
    return {
      ...contractProof,
      publicSignals: result.publicSignals,
      nullifierHash: result.nullifierHash,
      isSimulated: result.isSimulated,
      proofTime: result.proofTime,
    };
  }

  /**
   * Submit a proof on-chain and wait for confirmation.
   *
   * @example
   * const proof = await gate.generateProof('age', { birthTimestamp, userSecret })
   * const receipt = await gate.submitProof('age', proof, signer)
   */
  async submitProof(
    type: 'age' | 'credential' | 'selective',
    proof: ZKProof,
    signer: ethers.Signer,
    disclosureBitmask?: number
  ): Promise<ethers.TransactionReceipt> {
    const contract = this.getContract(signer);
    let tx: ethers.TransactionResponse;

    const pA: [string, string] = proof.a;
    const pB: [[string, string], [string, string]] = proof.b;
    const pC: [string, string] = proof.c;

    if (type === 'age') {
      const sigs = proof.publicSignals.slice(0, 4).map(BigInt) as [bigint, bigint, bigint, bigint];
      tx = await contract.verifyAge(pA, pB, pC, sigs);
    } else if (type === 'credential') {
      const sigs = proof.publicSignals.slice(0, 4).map(BigInt) as [bigint, bigint, bigint, bigint];
      tx = await contract.verifyCredential(pA, pB, pC, sigs);
    } else if (type === 'selective' && disclosureBitmask !== undefined) {
      const sigs = proof.publicSignals.slice(0, 8).map(BigInt);
      tx = await contract.verifySelective(pA, pB, pC, sigs, disclosureBitmask);
    } else {
      throw new Error('ZKGateSDK: Invalid proof type for submitProof');
    }

    return tx.wait() as Promise<ethers.TransactionReceipt>;
  }

  /**
   * All-in-one: generate proof + submit on-chain in one call.
   * Throws if the user is not eligible.
   *
   * @example
   * // DeFi protocol gating — one line
   * await gate.requireCredential(signer, userAddress, 'KYC_COMPLETE')
   */
  async requireCredential(
    signer: ethers.Signer,
    userAddress: string,
    credType: CredentialType,
    proofInput: ProofInput
  ): Promise<boolean> {
    // Check if already verified
    const already = await this.hasAccess(userAddress, credType);
    if (already) return true;

    // Generate and submit proof
    const proof = await this.generateProof('credential', { ...proofInput, credentialType: credType });
    await this.submitProof('credential', proof, signer);
    return true;
  }

  /**
   * Listen for on-chain verification events.
   *
   * @example
   * gate.onVerified(userAddress, (credType) => console.log('Verified:', credType))
   */
  onVerified(
    userAddress: string,
    callback: (credType: CredentialType, nullifier: string) => void
  ): () => void {
    const contract = this.getContract();
    const filter = contract.filters.VerificationCompleted(userAddress);

    const handler = (user: string, credTypeIdx: number, nullifier: string) => {
      const credType = (Object.keys(CREDENTIAL_TYPE_MAP) as CredentialType[])
        .find(k => CREDENTIAL_TYPE_MAP[k] === credTypeIdx);
      if (credType) callback(credType, nullifier);
    };

    contract.on(filter, handler);
    return () => contract.off(filter, handler);
  }
}

// ── Convenience export ─────────────────────────────────────────────────────
export { CREDENTIAL_TYPE_MAP };
export default ZKGateSDK;
