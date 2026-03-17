pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon hash with 2 inputs
template PoseidonHash2() {
    signal input in[2];
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== in[0];
    hasher.inputs[1] <== in[1];
    out <== hasher.out;
}

// Poseidon hash with 5 inputs (for full credential)
template PoseidonHash5() {
    signal input in[5];
    signal output out;

    component hasher = Poseidon(5);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== in[i];
    }
    out <== hasher.out;
}

component main = PoseidonHash2();
