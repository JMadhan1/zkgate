pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./merkleTree.circom";

/*
 * CredentialCheck Circuit
 * =======================
 * Proves: user's credential exists in the Merkle tree WITHOUT revealing which one
 *
 * Public inputs:
 *   - merkleRoot       : Current root of the credential Merkle tree (on-chain)
 *   - credentialType   : Type claimed (0=AGE, 1=ACCREDITED, 2=JURISDICTION, 3=KYC, 4=AML)
 *   - nullifierHash    : Poseidon(userSecret, leaf) — anti-replay token
 *   - currentTimestamp : For expiry check
 *
 * Private inputs:
 *   - userCommitment   : Poseidon(userAddress, userSecret)
 *   - credType         : Actual credential type in the leaf (must match public)
 *   - issuanceDate     : When credential was issued
 *   - expiryDate       : When credential expires
 *   - issuerPubkey     : Hash of issuer's public key
 *   - userSecret       : Random secret for nullifier
 *   - pathElements[20] : Sibling hashes in the Merkle path
 *   - pathIndices[20]  : Left/right indicators for the Merkle path
 *
 * Constraints:
 *   1. leaf = Poseidon(userCommitment, credType, issuanceDate, expiryDate, issuerPubkey)
 *   2. Merkle path from leaf leads to merkleRoot
 *   3. credType == credentialType (public input matches private credential)
 *   4. expiryDate > currentTimestamp (credential not expired)
 *   5. nullifierHash == Poseidon(userSecret, leaf)
 */
template CredentialCheck(depth) {
    // ──── PUBLIC INPUTS ────────────────────────────────────────────────
    signal input merkleRoot;
    signal input credentialType;
    signal input nullifierHash;
    signal input currentTimestamp;

    // ──── PRIVATE INPUTS ───────────────────────────────────────────────
    signal input userCommitment;
    signal input credType;
    signal input issuanceDate;
    signal input expiryDate;
    signal input issuerPubkey;
    signal input userSecret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ──── CONSTRAINT 1: Compute leaf hash ──────────────────────────────
    component leafHasher = Poseidon(5);
    leafHasher.inputs[0] <== userCommitment;
    leafHasher.inputs[1] <== credType;
    leafHasher.inputs[2] <== issuanceDate;
    leafHasher.inputs[3] <== expiryDate;
    leafHasher.inputs[4] <== issuerPubkey;
    signal leaf;
    leaf <== leafHasher.out;

    // ──── CONSTRAINT 2: Verify Merkle inclusion ────────────────────────
    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }
    merkleRoot === merkleProof.root;

    // ──── CONSTRAINT 3: Credential type matches ────────────────────────
    credentialType === credType;

    // ──── CONSTRAINT 4: Credential not expired ─────────────────────────
    component notExpired = GreaterThan(64);
    notExpired.in[0] <== expiryDate;
    notExpired.in[1] <== currentTimestamp;
    notExpired.out === 1;

    // ──── CONSTRAINT 5: Verify nullifier ───────────────────────────────
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== userSecret;
    nullifierHasher.inputs[1] <== leaf;
    nullifierHash === nullifierHasher.out;
}

component main {public [merkleRoot, credentialType, nullifierHash, currentTimestamp]} = CredentialCheck(20);
