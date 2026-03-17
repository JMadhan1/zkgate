/**
 * ZKGate Proof Module
 * ===================
 * Real proof generation using snarkjs.groth16.fullProve().
 * Falls back to simulation when circuit files are not yet compiled.
 *
 * TO ACTIVATE REAL PROOFS:
 *   1. Run: cd circuits && bash build.sh
 *   2. The .wasm and .zkey files will be copied to app/public/circuits/
 *   3. Set NEXT_PUBLIC_USE_REAL_CIRCUITS=true in .env.local
 */

import {
  simulateAgeProof,
  simulateCredentialProof,
  simulateSelectiveDisclosureProof,
  formatProofForContract,
  verifyProofLocally,
  PROOF_STEPS,
  type ProofResult,
  type ContractProof,
  type AgeCheckInput,
  type CredentialCheckInput,
  type SelectiveDisclosureInput,
} from './zkSimulation';

export { formatProofForContract, verifyProofLocally, PROOF_STEPS };
export type { ProofResult, ContractProof };

const USE_REAL_CIRCUITS =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_REAL_CIRCUITS === 'true';

// ── Age Verification Proof ─────────────────────────────────────────────────
export async function generateAgeProof(input: AgeCheckInput): Promise<ProofResult> {
  if (USE_REAL_CIRCUITS) {
    const snarkjs = await import('snarkjs');
    const startTime = Date.now();
    const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);
    const ageThreshold = input.ageThreshold ?? 18;

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        birthTimestamp: input.birthTimestamp.toString(),
        userSecret: BigInt(input.userSecret).toString(),
        currentTimestamp: currentTimestamp.toString(),
        ageThreshold: ageThreshold.toString(),
      },
      '/circuits/ageCheck.wasm',
      '/circuits/ageCheck_final.zkey'
    );

    return {
      proof: proof as ProofResult['proof'],
      publicSignals: publicSignals as string[],
      nullifierHash: '0x' + BigInt(publicSignals[3]).toString(16).padStart(64, '0'),
      proofTime: Date.now() - startTime,
      isSimulated: false,
    };
  }

  return simulateAgeProof(input);
}

// ── Credential Merkle Inclusion Proof ─────────────────────────────────────
export async function generateCredentialProof(
  input: CredentialCheckInput
): Promise<ProofResult> {
  if (USE_REAL_CIRCUITS) {
    const snarkjs = await import('snarkjs');
    const startTime = Date.now();
    const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        userCommitment: BigInt(input.userCommitment).toString(),
        credType: input.credType.toString(),
        issuanceDate: input.issuanceDate.toString(),
        expiryDate: input.expiryDate.toString(),
        issuerPubkey: BigInt(input.issuerPubkey).toString(),
        userSecret: BigInt(input.userSecret).toString(),
        pathElements: input.pathElements.map(p => BigInt(p).toString()),
        pathIndices: input.pathIndices.map(String),
        merkleRoot: BigInt(input.merkleRoot).toString(),
        credentialType: input.credentialType.toString(),
        currentTimestamp: currentTimestamp.toString(),
      },
      '/circuits/credentialCheck.wasm',
      '/circuits/credentialCheck_final.zkey'
    );

    return {
      proof: proof as ProofResult['proof'],
      publicSignals: publicSignals as string[],
      nullifierHash: '0x' + BigInt(publicSignals[2]).toString(16).padStart(64, '0'),
      proofTime: Date.now() - startTime,
      isSimulated: false,
    };
  }

  return simulateCredentialProof(input);
}

// ── Selective Disclosure Proof — THE KILLER FEATURE ───────────────────────
export async function generateSelectiveDisclosureProof(
  input: SelectiveDisclosureInput
): Promise<ProofResult & { revealedValues: (number | null)[]; disclosureBitmask: number }> {
  if (USE_REAL_CIRCUITS) {
    const snarkjs = await import('snarkjs');
    const startTime = Date.now();
    const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        fullCredential: input.fullCredential.map(String),
        disclosureBitmask: input.disclosureBitmask.toString(),
        userCommitment: BigInt(input.userCommitment).toString(),
        issuanceDate: input.issuanceDate.toString(),
        expiryDate: input.expiryDate.toString(),
        issuerPubkey: BigInt(input.issuerPubkey).toString(),
        userSecret: BigInt(input.userSecret).toString(),
        pathElements: input.pathElements.map(p => BigInt(p).toString()),
        pathIndices: input.pathIndices.map(String),
        merkleRoot: BigInt(input.merkleRoot).toString(),
        currentTimestamp: currentTimestamp.toString(),
      },
      '/circuits/selectiveDisclosure.wasm',
      '/circuits/selectiveDisclosure_final.zkey'
    );

    const revealedValues = input.fullCredential.map((val, i) =>
      (input.disclosureBitmask >> i) & 1 ? val : null
    );

    return {
      proof: proof as ProofResult['proof'],
      publicSignals: publicSignals as string[],
      nullifierHash: '0x' + BigInt(publicSignals[2]).toString(16).padStart(64, '0'),
      proofTime: Date.now() - startTime,
      isSimulated: false,
      revealedValues,
      disclosureBitmask: input.disclosureBitmask,
    };
  }

  return simulateSelectiveDisclosureProof(input);
}

// ── Helper: build credential input from stored data ────────────────────────
export function buildCredentialInput(stored: {
  commitment: string;
  secret: string;
  type: number;
  issuedAt: number;
  merkleRoot: string;
  merklePath: string[];
  merklePathIndices: number[];
}): CredentialCheckInput {
  const YEAR = 365 * 24 * 3600;
  return {
    userCommitment: stored.commitment,
    credType: stored.type,
    issuanceDate: stored.issuedAt,
    expiryDate: stored.issuedAt + YEAR,
    issuerPubkey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    userSecret: stored.secret,
    pathElements: stored.merklePath,
    pathIndices: stored.merklePathIndices,
    credentialType: stored.type,
    merkleRoot: stored.merkleRoot,
  };
}

// ── Encode proof as shareable URL-safe string ──────────────────────────────
export function encodeProofForSharing(result: ProofResult): string {
  const payload = {
    v: 1, // version
    p: result.proof,
    s: result.publicSignals,
    n: result.nullifierHash,
    t: Date.now(),
  };
  return btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function decodeSharedProof(encoded: string): {
  proof: ProofResult['proof'];
  publicSignals: string[];
  nullifierHash: string;
  timestamp: number;
} | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const data = JSON.parse(json);
    return { proof: data.p, publicSignals: data.s, nullifierHash: data.n, timestamp: data.t };
  } catch {
    return null;
  }
}
