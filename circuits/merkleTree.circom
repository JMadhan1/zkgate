pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// Single level of a Merkle tree using Poseidon hash
template MerkleTreeLevel() {
    signal input left;
    signal input right;
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    out <== hasher.out;
}

// Merkle tree inclusion proof verifier (depth 20)
// Given a leaf and a path, proves the leaf is in the tree with the given root
template MerkleTreeInclusionProof(depth) {
    signal input leaf;
    signal input pathIndices[depth]; // 0 = leaf is left, 1 = leaf is right
    signal input pathElements[depth];
    signal output root;

    component hashers[depth];
    component mux[depth];
    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // pathIndices[i] must be 0 or 1
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];   // if index == 0: leaf is left
        mux[i].c[0][1] <== pathElements[i];   // if index == 1: sibling is left
        mux[i].c[1][0] <== pathElements[i];   // if index == 0: sibling is right
        mux[i].c[1][1] <== levelHashes[i];    // if index == 1: leaf is right
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[depth];
}
