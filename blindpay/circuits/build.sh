#!/usr/bin/env bash
#
# Build the proof-of-policy circuit and a DEVELOPMENT trusted setup.
#
#   npm --workspace blindpay/circuits run build
#
# Outputs (git-ignored) in blindpay/circuits/build/:
#   policyCheck.wasm, policyCheck.zkey, verification_key.json
#
# The setup here is single-party with entropy from this machine: fine for
# development and CI, NOT for production. Production keys come from a
# multi-party ceremony (see docs/TRUSTED_SETUP_CEREMONY_PLAN.md); publish the
# verification key and ceremony transcript where CAs can fetch them.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/build"
SNARKJS="node $ROOT/node_modules/snarkjs/build/cli.cjs"
CIRCOM="$ROOT/node_modules/.bin/circom2"
POWER=12   # 2^12 constraints: policyCheck needs ~600

mkdir -p "$OUT"
echo "── compiling policyCheck"
"$CIRCOM" "$HERE/policyCheck.circom" --r1cs --wasm -o "$OUT" -l "$ROOT/node_modules"
cp "$OUT/policyCheck_js/policyCheck.wasm" "$OUT/policyCheck.wasm"

entropy() { node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }

echo "── development trusted setup (single party)"
$SNARKJS powersoftau new bn128 $POWER "$OUT/pot_0.ptau" >/dev/null
$SNARKJS powersoftau contribute "$OUT/pot_0.ptau" "$OUT/pot_1.ptau" -e="$(entropy)" >/dev/null
$SNARKJS powersoftau prepare phase2 "$OUT/pot_1.ptau" "$OUT/pot_final.ptau" >/dev/null
$SNARKJS groth16 setup "$OUT/policyCheck.r1cs" "$OUT/pot_final.ptau" "$OUT/policyCheck_0.zkey" >/dev/null
$SNARKJS zkey contribute "$OUT/policyCheck_0.zkey" "$OUT/policyCheck.zkey" -e="$(entropy)" >/dev/null
$SNARKJS zkey export verificationkey "$OUT/policyCheck.zkey" "$OUT/verification_key.json" >/dev/null
rm -f "$OUT"/pot_*.ptau "$OUT/policyCheck_0.zkey"
$SNARKJS r1cs info "$OUT/policyCheck.r1cs" | grep -i constraints || true
echo "── done: $OUT"
