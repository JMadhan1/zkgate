#!/bin/bash
# ============================================================
# ZKGate Circuit Build Script
# Compiles Circom circuits, runs trusted setup, generates keys
# ============================================================
# Prerequisites:
#   npm install -g circom snarkjs
#   OR: cargo install circom (from https://github.com/iden3/circom)
# ============================================================

set -e
CIRCUITS_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$CIRCUITS_DIR/build"
mkdir -p "$BUILD_DIR"

echo "===== ZKGate Circuit Build ====="
echo "Circuits dir: $CIRCUITS_DIR"
echo "Build dir:    $BUILD_DIR"
echo ""

# ── Step 1: Compile circuits ──────────────────────────────────
echo "[1/4] Compiling circuits..."
CIRCUITS=("ageCheck" "credentialCheck" "selectiveDisclosure")

for circuit in "${CIRCUITS[@]}"; do
    echo "  Compiling $circuit.circom..."
    circom "$CIRCUITS_DIR/$circuit.circom" \
        --r1cs --wasm --sym \
        -l "$CIRCUITS_DIR/../node_modules" \
        -o "$BUILD_DIR"
    echo "  ✓ $circuit compiled"
done
echo ""

# ── Step 2: Powers of Tau (trusted setup — Phase 1) ───────────
echo "[2/4] Running Powers of Tau ceremony..."
if [ ! -f "$BUILD_DIR/pot14_final.ptau" ]; then
    snarkjs powersoftau new bn128 14 "$BUILD_DIR/pot14_0000.ptau" -v
    snarkjs powersoftau contribute "$BUILD_DIR/pot14_0000.ptau" "$BUILD_DIR/pot14_0001.ptau" \
        --name="ZKGate First Contributor" -e="$(openssl rand -hex 32)"
    snarkjs powersoftau prepare phase2 "$BUILD_DIR/pot14_0001.ptau" "$BUILD_DIR/pot14_final.ptau" -v
    echo "  ✓ Powers of tau complete"
else
    echo "  ✓ pot14_final.ptau already exists, skipping"
fi
echo ""

# ── Step 3: Generate zkeys (circuit-specific setup — Phase 2) ─
echo "[3/4] Generating zkeys..."
for circuit in "${CIRCUITS[@]}"; do
    echo "  Setting up $circuit..."
    snarkjs groth16 setup \
        "$BUILD_DIR/$circuit.r1cs" \
        "$BUILD_DIR/pot14_final.ptau" \
        "$BUILD_DIR/${circuit}_0000.zkey"

    snarkjs zkey contribute \
        "$BUILD_DIR/${circuit}_0000.zkey" \
        "$BUILD_DIR/${circuit}_final.zkey" \
        --name="ZKGate $circuit" \
        -e="$(openssl rand -hex 32)"

    snarkjs zkey export verificationkey \
        "$BUILD_DIR/${circuit}_final.zkey" \
        "$BUILD_DIR/${circuit}_vkey.json"

    echo "  ✓ $circuit zkey generated"
done
echo ""

# ── Step 4: Export Solidity verifiers ─────────────────────────
echo "[4/4] Exporting Solidity verifiers..."
for circuit in "${CIRCUITS[@]}"; do
    # Capitalize first letter for contract name
    ContractName="$(tr '[:lower:]' '[:upper:]' <<< "${circuit:0:1}")${circuit:1}Verifier"
    snarkjs zkey export solidityverifier \
        "$BUILD_DIR/${circuit}_final.zkey" \
        "$CIRCUITS_DIR/../contracts/${ContractName}.sol"

    # Fix pragma version to match project
    sed -i 's/pragma solidity \^0\.[0-9]*/pragma solidity ^0.8/' \
        "$CIRCUITS_DIR/../contracts/${ContractName}.sol"

    echo "  ✓ contracts/${ContractName}.sol exported"
done

# ── Step 5: Copy WASM and zkeys to frontend public folder ─────
echo ""
echo "[5/5] Copying circuit files to frontend..."
FRONTEND_CIRCUITS="$CIRCUITS_DIR/../app/public/circuits"
mkdir -p "$FRONTEND_CIRCUITS"

for circuit in "${CIRCUITS[@]}"; do
    cp "$BUILD_DIR/${circuit}_js/${circuit}.wasm" "$FRONTEND_CIRCUITS/${circuit}.wasm"
    cp "$BUILD_DIR/${circuit}_final.zkey" "$FRONTEND_CIRCUITS/${circuit}_final.zkey"
    cp "$BUILD_DIR/${circuit}_vkey.json" "$FRONTEND_CIRCUITS/${circuit}_vkey.json"
    echo "  ✓ $circuit files copied to public/circuits/"
done

echo ""
echo "===== Build Complete! ====="
echo ""
echo "Next steps:"
echo "  1. Deploy contracts:  cd .. && npx hardhat run scripts/deploy.js --network hashkeyTestnet"
echo "  2. Run demo:          npx hardhat run scripts/demo-flow.js --network hashkeyTestnet"
echo "  3. Start frontend:    cd app && npm run dev"
echo ""
echo "IMPORTANT: The .zkey files are large (~50MB each). Add to .gitignore"
echo "           and serve from a CDN or IPFS in production."
