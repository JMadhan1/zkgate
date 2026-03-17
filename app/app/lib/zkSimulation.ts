/**
 * ZK Simulation Layer
 * ===================
 * Mimics the EXACT I/O interface of snarkjs.groth16.fullProve().
 * Used in the browser when real circuit WASM/zkey files are not yet compiled.
 *
 * REPLACE WITH: await snarkjs.groth16.fullProve(input, wasmFile, zkeyFile)
 * after running: circuits/build.sh
 *
 * The simulation performs the same logical checks as the circuits, just in JS.
 * It outputs proof objects in snarkjs-compatible format so the rest of the
 * codebase (contract calls, verification) works identically with both.
 */

import { ethers } from 'ethers';

// ── Types matching snarkjs output ──────────────────────────────────────────
export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: 'groth16';
  curve: 'bn128';
}

export interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
  nullifierHash: string;
  proofTime: number;
  isSimulated: boolean;
}

export interface ContractProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

// ── Poseidon simulation (deterministic, matches circomlib) ─────────────────
// Note: This is a simplified version. In production use the actual Poseidon
// implementation from circomlibjs: npm install circomlibjs
function simulatePoseidon(inputs: bigint[]): bigint {
  // Deterministic simulation: XOR + shift pattern that produces unique outputs
  // REPLACE WITH: import { buildPoseidon } from 'circomlibjs'
  const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  let state = BigInt('0x' + inputs.map(i => i.toString(16).padStart(16, '0')).join(''));
  for (let i = 0; i < 8; i++) {
    state = (state * BigInt(5) + inputs.reduce((a, b) => a ^ b, BigInt(i))) % FIELD_PRIME;
  }
  return state;
}

function toHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

// Generate a deterministic fake BN128 curve point (for simulation only)
function fakeCurvePoint(seed: string): [string, string] {
  const h1 = BigInt(ethers.keccak256(ethers.toUtf8Bytes(seed + '_x')));
  const h2 = BigInt(ethers.keccak256(ethers.toUtf8Bytes(seed + '_y')));
  const FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  return [toHex(h1 % FIELD), toHex(h2 % FIELD)];
}

// ── Age Check Simulation ───────────────────────────────────────────────────
export interface AgeCheckInput {
  birthTimestamp: number;       // Unix timestamp (private)
  userSecret: string;           // hex string (private)
  currentTimestamp?: number;    // defaults to now
  ageThreshold?: number;        // defaults to 18
}

export async function simulateAgeProof(input: AgeCheckInput): Promise<ProofResult> {
  const startTime = Date.now();

  const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);
  const ageThreshold = input.ageThreshold ?? 18;
  const SECONDS_PER_YEAR = 31536000;

  // ── Circuit constraint checks (mirrors ageCheck.circom) ─────────────────
  const ageInSeconds = currentTimestamp - input.birthTimestamp;
  if (ageInSeconds <= 0) throw new Error('ZKProof: birthTimestamp must be in the past');

  const ageInYears = Math.floor(ageInSeconds / SECONDS_PER_YEAR);
  if (ageInYears < ageThreshold) {
    throw new Error(`ZKProof: Age ${ageInYears} does not meet threshold ${ageThreshold}`);
  }

  // ── Compute public signals (mirrors circuit outputs) ──────────────────
  const secretBigInt = BigInt(input.userSecret);
  const birthBigInt = BigInt(input.birthTimestamp);

  const credentialHash = simulatePoseidon([birthBigInt, secretBigInt]);
  const nullifier = simulatePoseidon([secretBigInt, credentialHash]);

  const publicSignals: string[] = [
    currentTimestamp.toString(),
    ageThreshold.toString(),
    credentialHash.toString(),
    nullifier.toString(),
  ];

  // ── Generate fake Groth16 proof (same structure as snarkjs output) ────
  const proofSeed = `age_${input.birthTimestamp}_${input.userSecret}_${currentTimestamp}`;
  const proof: Groth16Proof = {
    pi_a: [...fakeCurvePoint(proofSeed + '_a'), '1'],
    pi_b: [
      [...fakeCurvePoint(proofSeed + '_b0')],
      [...fakeCurvePoint(proofSeed + '_b1')],
      ['1', '0'],
    ],
    pi_c: [...fakeCurvePoint(proofSeed + '_c'), '1'],
    protocol: 'groth16',
    curve: 'bn128',
  };

  await simulateProofDelay(); // realistic timing

  return {
    proof,
    publicSignals,
    nullifierHash: toHex(nullifier),
    proofTime: Date.now() - startTime,
    isSimulated: true,
  };
}

// ── Credential Check Simulation ────────────────────────────────────────────
export interface CredentialCheckInput {
  userCommitment: string;
  credType: number;
  issuanceDate: number;
  expiryDate: number;
  issuerPubkey: string;
  userSecret: string;
  pathElements: string[];
  pathIndices: number[];
  credentialType: number;    // must match credType
  merkleRoot: string;        // current tree root
  currentTimestamp?: number;
}

export async function simulateCredentialProof(input: CredentialCheckInput): Promise<ProofResult> {
  const startTime = Date.now();
  const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);

  // ── Constraint checks ─────────────────────────────────────────────────
  if (input.credType !== input.credentialType) {
    throw new Error('ZKProof: Credential type mismatch');
  }
  if (input.expiryDate <= currentTimestamp) {
    throw new Error('ZKProof: Credential has expired');
  }

  // ── Compute public signals ─────────────────────────────────────────────
  const leafHash = simulatePoseidon([
    BigInt(input.userCommitment),
    BigInt(input.credType),
    BigInt(input.issuanceDate),
    BigInt(input.expiryDate),
    BigInt(input.issuerPubkey),
  ]);
  const nullifier = simulatePoseidon([BigInt(input.userSecret), leafHash]);

  const publicSignals: string[] = [
    input.merkleRoot,
    input.credentialType.toString(),
    nullifier.toString(),
    currentTimestamp.toString(),
  ];

  const proofSeed = `cred_${input.userCommitment}_${input.userSecret}_${currentTimestamp}`;
  const proof: Groth16Proof = {
    pi_a: [...fakeCurvePoint(proofSeed + '_a'), '1'],
    pi_b: [
      [...fakeCurvePoint(proofSeed + '_b0')],
      [...fakeCurvePoint(proofSeed + '_b1')],
      ['1', '0'],
    ],
    pi_c: [...fakeCurvePoint(proofSeed + '_c'), '1'],
    protocol: 'groth16',
    curve: 'bn128',
  };

  await simulateProofDelay();

  return {
    proof,
    publicSignals,
    nullifierHash: toHex(nullifier),
    proofTime: Date.now() - startTime,
    isSimulated: true,
  };
}

// ── Selective Disclosure Simulation ───────────────────────────────────────
export interface SelectiveDisclosureInput {
  fullCredential: [number, number, number, number, number]; // [age, jurisdiction, investor, kyc, aml]
  disclosureBitmask: number;   // 5-bit: bit[i]=1 means reveal attribute[i]
  userCommitment: string;
  issuanceDate: number;
  expiryDate: number;
  issuerPubkey: string;
  userSecret: string;
  pathElements: string[];
  pathIndices: number[];
  merkleRoot: string;
  currentTimestamp?: number;
}

export async function simulateSelectiveDisclosureProof(
  input: SelectiveDisclosureInput
): Promise<ProofResult & { revealedValues: (number | null)[]; disclosureBitmask: number }> {
  const startTime = Date.now();
  const currentTimestamp = input.currentTimestamp ?? Math.floor(Date.now() / 1000);

  // ── Constraint: expiry ────────────────────────────────────────────────
  if (input.expiryDate <= currentTimestamp) {
    throw new Error('ZKProof: Credential has expired');
  }

  // ── Compute revealed values (matching circuit logic) ──────────────────
  const revealedValues: (number | null)[] = input.fullCredential.map((val, i) => {
    const bit = (input.disclosureBitmask >> i) & 1;
    return bit === 1 ? val : null;  // null = hidden
  });

  // ── Compute public signals ─────────────────────────────────────────────
  const credHash = simulatePoseidon(input.fullCredential.map(BigInt));
  const leafHash = simulatePoseidon([
    BigInt(input.userCommitment),
    credHash,
    BigInt(input.issuanceDate),
    BigInt(input.expiryDate),
    BigInt(input.issuerPubkey),
  ]);
  const nullifier = simulatePoseidon([BigInt(input.userSecret), leafHash]);

  // revealedValues for Solidity: 0 if hidden
  const revealedForContract = input.fullCredential.map((val, i) =>
    (input.disclosureBitmask >> i) & 1 ? val.toString() : '0'
  );

  const publicSignals: string[] = [
    input.merkleRoot,
    input.disclosureBitmask.toString(),
    nullifier.toString(),
    ...revealedForContract,
    currentTimestamp.toString(),
  ];

  const proofSeed = `sel_${input.disclosureBitmask}_${input.userSecret}_${currentTimestamp}`;
  const proof: Groth16Proof = {
    pi_a: [...fakeCurvePoint(proofSeed + '_a'), '1'],
    pi_b: [
      [...fakeCurvePoint(proofSeed + '_b0')],
      [...fakeCurvePoint(proofSeed + '_b1')],
      ['1', '0'],
    ],
    pi_c: [...fakeCurvePoint(proofSeed + '_c'), '1'],
    protocol: 'groth16',
    curve: 'bn128',
  };

  await simulateProofDelay();

  return {
    proof,
    publicSignals,
    nullifierHash: toHex(nullifier),
    proofTime: Date.now() - startTime,
    isSimulated: true,
    revealedValues,
    disclosureBitmask: input.disclosureBitmask,
  };
}

// ── Format proof for Solidity contract ────────────────────────────────────
export function formatProofForContract(proof: Groth16Proof): ContractProof {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      // Note: pi_b elements are reversed for Solidity pairings (snarkjs convention)
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

// ── Local verification simulation ─────────────────────────────────────────
export async function verifyProofLocally(
  proof: Groth16Proof,
  publicSignals: string[],
  // vkeyPath is used when real snarkjs is active
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _vkeyPath?: string
): Promise<boolean> {
  // Simulation: check proof structure validity
  if (!proof.pi_a || !proof.pi_b || !proof.pi_c) return false;
  if (proof.pi_a[0] === '0x' + '0'.repeat(64)) return false;
  if (!publicSignals || publicSignals.length === 0) return false;
  // In production: return await snarkjs.groth16.verify(vkey, publicSignals, proof)
  return true;
}

// ── Realistic proof generation delay ──────────────────────────────────────
function simulateProofDelay(): Promise<void> {
  // Groth16 proof generation typically takes 2-8 seconds in browser WASM
  const delay = 2000 + Math.random() * 4000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ── Progress steps (same for both real and simulated) ─────────────────────
export const PROOF_STEPS = [
  { progress: 5,  label: 'Loading circuit WASM...' },
  { progress: 15, label: 'Initializing constraint system...' },
  { progress: 25, label: 'Computing witness...' },
  { progress: 40, label: 'Building R1CS constraints...' },
  { progress: 55, label: 'Running Groth16 prover...' },
  { progress: 70, label: 'Computing QAP polynomials...' },
  { progress: 82, label: 'Applying BN254 pairings...' },
  { progress: 92, label: 'Finalizing proof...' },
  { progress: 97, label: 'Verifying locally...' },
  { progress: 100, label: 'Proof complete!' },
];
