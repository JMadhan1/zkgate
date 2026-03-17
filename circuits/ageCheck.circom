pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/*
 * AgeCheck Circuit
 * ================
 * Proves: user's age >= ageThreshold WITHOUT revealing date of birth
 *
 * Public inputs:
 *   - currentTimestamp  : Unix timestamp of proof generation
 *   - ageThreshold      : Minimum age in years (e.g., 18)
 *   - credentialHash    : Poseidon(birthTimestamp, userSecret) — commitment
 *   - nullifierHash     : Poseidon(userSecret, credentialHash) — anti-replay
 *
 * Private inputs:
 *   - birthTimestamp    : User's birth date as Unix timestamp (NEVER revealed)
 *   - userSecret        : Random secret known only to user
 *
 * Constraints:
 *   1. credentialHash == Poseidon(birthTimestamp, userSecret)
 *   2. nullifierHash == Poseidon(userSecret, credentialHash)
 *   3. ageInSeconds == currentTimestamp - birthTimestamp
 *   4. ageInYears >= ageThreshold  (no overflow)
 */
template AgeCheck() {
    // ──── PUBLIC INPUTS ────────────────────────────────────────────────
    signal input currentTimestamp;
    signal input ageThreshold;        // e.g. 18 (years)
    signal input credentialHash;      // public commitment
    signal input nullifierHash;       // anti-replay

    // ──── PRIVATE INPUTS ───────────────────────────────────────────────
    signal input birthTimestamp;      // SECRET — never revealed
    signal input userSecret;          // SECRET — random salt

    // ──── INTERNAL SIGNALS ─────────────────────────────────────────────
    signal ageInSeconds;
    signal ageInYears;

    // ── CONSTRAINT 1: Verify credential commitment ─────────────────────
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== birthTimestamp;
    commitmentHasher.inputs[1] <== userSecret;
    // credentialHash must match the committed value
    credentialHash === commitmentHasher.out;

    // ── CONSTRAINT 2: Verify nullifier ─────────────────────────────────
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== userSecret;
    nullifierHasher.inputs[1] <== credentialHash;
    nullifierHash === nullifierHasher.out;

    // ── CONSTRAINT 3: Verify birthTimestamp < currentTimestamp ─────────
    component birthLtNow = LessThan(64);
    birthLtNow.in[0] <== birthTimestamp;
    birthLtNow.in[1] <== currentTimestamp;
    birthLtNow.out === 1;

    // ── CONSTRAINT 4: Compute age in seconds ───────────────────────────
    ageInSeconds <== currentTimestamp - birthTimestamp;

    // ── CONSTRAINT 5: Compute age in years (integer division approx) ───
    // 31536000 = seconds per year (365 days)
    // We use: ageInSeconds / 31536000 >= ageThreshold
    // Equivalent: ageInSeconds >= ageThreshold * 31536000
    signal ageThresholdSeconds;
    ageThresholdSeconds <== ageThreshold * 31536000;

    component ageCheck = GreaterEqThan(64);
    ageCheck.in[0] <== ageInSeconds;
    ageCheck.in[1] <== ageThresholdSeconds;
    ageCheck.out === 1;

    // ageInYears is a helper (not constrained further, for readability)
    // In production circuit you'd use integer division via range checks
    ageInYears <== ageInSeconds \ 31536000;
}

component main {public [currentTimestamp, ageThreshold, credentialHash, nullifierHash]} = AgeCheck();
