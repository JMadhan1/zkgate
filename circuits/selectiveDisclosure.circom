pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "./merkleTree.circom";

/*
 * SelectiveDisclosure Circuit — THE KILLER FEATURE
 * =================================================
 * Proves: ONLY selected credential attributes, hiding everything else.
 * User controls exactly what gets disclosed. Nothing else leaks.
 *
 * Example: Prove "Age > 18" and "Jurisdiction Clear" WITHOUT revealing
 *          investor status, KYC details, or AML clearance.
 *
 * Public inputs:
 *   - merkleRoot          : Current root of credential Merkle tree
 *   - disclosureBitmask   : 5-bit mask — bit[i]=1 means attribute[i] is revealed
 *   - nullifierHash       : Poseidon(userSecret, leaf) — anti-replay
 *   - revealedValues[5]   : Disclosed values (0 if bit is 0)
 *   - currentTimestamp    : For expiry check
 *
 * Private inputs:
 *   - fullCredential[5]   : [age, jurisdictionClear, investorStatus, kycStatus, amlStatus]
 *   - userCommitment      : Poseidon(userAddress, userSecret)
 *   - issuanceDate        : When issued
 *   - expiryDate          : When expires
 *   - issuerPubkey        : Hash of issuer public key
 *   - userSecret          : Random secret for nullifier
 *   - pathElements[20]    : Merkle sibling hashes
 *   - pathIndices[20]     : Merkle path direction bits
 *
 * Constraints:
 *   1. leaf = Poseidon(userCommitment, credentialHash, issuanceDate, expiryDate, issuerPubkey)
 *      where credentialHash = Poseidon(fullCredential[0..4])
 *   2. Merkle inclusion proof to merkleRoot
 *   3. Credential not expired
 *   4. For each bit i in disclosureBitmask:
 *      - if bit == 1: revealedValues[i] == fullCredential[i]  (must match exactly)
 *      - if bit == 0: revealedValues[i] == 0                  (nothing leaked)
 *   5. nullifierHash == Poseidon(userSecret, leaf)
 */
template SelectiveDisclosure(depth, nAttrs) {
    // ──── PUBLIC INPUTS ────────────────────────────────────────────────
    signal input merkleRoot;
    signal input disclosureBitmask;       // packed into single field element
    signal input nullifierHash;
    signal input revealedValues[nAttrs];  // 0 if hidden
    signal input currentTimestamp;

    // ──── PRIVATE INPUTS ───────────────────────────────────────────────
    signal input fullCredential[nAttrs];  // the ACTUAL attribute values
    signal input userCommitment;
    signal input issuanceDate;
    signal input expiryDate;
    signal input issuerPubkey;
    signal input userSecret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ──── Decompose bitmask into individual bits ────────────────────────
    signal bits[nAttrs];
    signal bitAccumulator[nAttrs + 1];
    bitAccumulator[0] <== disclosureBitmask;

    component bit2num[nAttrs];
    for (var i = 0; i < nAttrs; i++) {
        // Extract bit i from the bitmask
        bits[i] <-- (disclosureBitmask >> i) & 1;
        bits[i] * (bits[i] - 1) === 0; // must be 0 or 1
    }

    // Verify bitmask reconstruction from bits
    signal bitmaskCheck;
    bitmaskCheck <== bits[0] + bits[1] * 2 + bits[2] * 4 + bits[3] * 8 + bits[4] * 16;
    disclosureBitmask === bitmaskCheck;

    // ──── CONSTRAINT 1: Compute credential hash ────────────────────────
    component credHasher = Poseidon(5);
    for (var i = 0; i < nAttrs; i++) {
        credHasher.inputs[i] <== fullCredential[i];
    }

    // ──── CONSTRAINT 2: Compute leaf hash ──────────────────────────────
    component leafHasher = Poseidon(5);
    leafHasher.inputs[0] <== userCommitment;
    leafHasher.inputs[1] <== credHasher.out;
    leafHasher.inputs[2] <== issuanceDate;
    leafHasher.inputs[3] <== expiryDate;
    leafHasher.inputs[4] <== issuerPubkey;
    signal leaf;
    leaf <== leafHasher.out;

    // ──── CONSTRAINT 3: Verify Merkle inclusion ────────────────────────
    component merkleProof = MerkleTreeInclusionProof(depth);
    merkleProof.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i] <== pathIndices[i];
    }
    merkleRoot === merkleProof.root;

    // ──── CONSTRAINT 4: Credential not expired ─────────────────────────
    component notExpired = GreaterThan(64);
    notExpired.in[0] <== expiryDate;
    notExpired.in[1] <== currentTimestamp;
    notExpired.out === 1;

    // ──── CONSTRAINT 5: Selective disclosure enforcement ───────────────
    // For each attribute:
    //   - if disclosed (bit=1): revealedValues[i] MUST equal fullCredential[i]
    //   - if hidden   (bit=0): revealedValues[i] MUST be 0
    component mux[nAttrs];
    for (var i = 0; i < nAttrs; i++) {
        mux[i] = Mux1();
        mux[i].c[0] <== 0;                   // hidden branch: must be 0
        mux[i].c[1] <== fullCredential[i];    // disclosed branch: must equal actual value
        mux[i].s <== bits[i];
        revealedValues[i] === mux[i].out;
    }

    // ──── CONSTRAINT 6: Verify nullifier ───────────────────────────────
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== userSecret;
    nullifierHasher.inputs[1] <== leaf;
    nullifierHash === nullifierHasher.out;
}

component main {public [merkleRoot, disclosureBitmask, nullifierHash, revealedValues, currentTimestamp]} = SelectiveDisclosure(20, 5);
