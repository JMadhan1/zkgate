pragma circom 2.1.6;

// BlindPay proof-of-policy.
//
// Proves: spentBefore + amount <= limit, where `limit` is hidden behind a
// Poseidon commitment that was published in the company's policy log before
// the spend. The verifier (the company's CA) learns that the approval stayed
// inside the committed policy, and never learns the limit.
//
//   private: limit, salt
//   public:  commitment, memberTag, period, amount, spentBefore, requestHash
//
// amount and spentBefore are public on purpose: the CA sees every approved
// amount in the Audit Pack and recomputes spentBefore itself, so the prover
// can't understate prior spend. requestHash binds the proof to one request.

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template PolicyCheck(BITS) {
    signal input limit;
    signal input salt;

    signal input commitment;
    signal input memberTag;
    signal input period;
    signal input amount;
    signal input spentBefore;
    signal input requestHash;

    // The hidden limit is the one committed for this member and period.
    component h = Poseidon(4);
    h.inputs[0] <== limit;
    h.inputs[1] <== salt;
    h.inputs[2] <== memberTag;
    h.inputs[3] <== period;
    h.out === commitment;

    // Range checks: no field wrap-around tricks (all values < 2^BITS paise).
    component rl = Num2Bits(BITS);
    rl.in <== limit;
    component ra = Num2Bits(BITS);
    ra.in <== amount;
    component rs = Num2Bits(BITS);
    rs.in <== spentBefore;

    // amount > 0
    component zero = IsZero();
    zero.in <== amount;
    zero.out === 0;

    // The policy statement itself.
    component le = LessEqThan(BITS + 1);
    le.in[0] <== spentBefore + amount;
    le.in[1] <== limit;
    le.out === 1;

    // Keep requestHash in the constraint system explicitly.
    signal requestHashSquared;
    requestHashSquared <== requestHash * requestHash;
}

component main {public [commitment, memberTag, period, amount, spentBefore, requestHash]} = PolicyCheck(48);
