/**
 * ZKGate Proof Module
 * ===================
 * Uses the JS simulation layer which matches the exact I/O interface of
 * snarkjs.groth16.fullProve(). Works in the browser without any native deps.
 *
 * TO ACTIVATE REAL PROOFS (after hackathon, or if circom is available):
 *   1. Run: cd circuits && bash build.sh
 *   2. The .wasm and .zkey files will be in app/public/circuits/
 *   3. Install snarkjs: cd app && npm install snarkjs
 *   4. Uncomment the snarkjs blocks below and set NEXT_PUBLIC_USE_REAL_CIRCUITS=true
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

// ── Age Verification Proof ─────────────────────────────────────────────────
export async function generateAgeProof(input: AgeCheckInput): Promise<ProofResult> {
  // When real circuits are compiled, replace with:
  //   const snarkjs = await import('snarkjs');
  //   const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  //     { birthTimestamp: ..., userSecret: ..., currentTimestamp: ..., ageThreshold: ... },
  //     '/circuits/ageCheck.wasm', '/circuits/ageCheck_final.zkey'
  //   );
  return simulateAgeProof(input);
}

// ── Credential Merkle Inclusion Proof ─────────────────────────────────────
export async function generateCredentialProof(
  input: CredentialCheckInput
): Promise<ProofResult> {
  // When real circuits are compiled, replace with snarkjs.groth16.fullProve(...)
  return simulateCredentialProof(input);
}

// ── Selective Disclosure Proof — THE KILLER FEATURE ───────────────────────
export async function generateSelectiveDisclosureProof(
  input: SelectiveDisclosureInput
): Promise<ProofResult & { revealedValues: (number | null)[]; disclosureBitmask: number }> {
  // When real circuits are compiled, replace with snarkjs.groth16.fullProve(...)
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
  const payload = { v: 1, p: result.proof, s: result.publicSignals, n: result.nullifierHash, t: Date.now() };
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
    const data = JSON.parse(atob(padded));
    return { proof: data.p, publicSignals: data.s, nullifierHash: data.n, timestamp: data.t };
  } catch {
    return null;
  }
}
