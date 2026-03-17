# 🛡️ ZKGate

**Privacy-preserving identity verification protocol for HashKey Chain.**

> "Prove without leaking." ZKGate enables users to verify their identity (KYC, age, accredited status) to DeFi protocols WITHOUT revealing any personal data on-chain.

Built for the **HashKey Chain Horizon Hackathon 2026** (ZKID Track).

---

## 🚀 Overview

ZKGate solves the paradox between regulatory compliance (KYC/AML) and user privacy in Web3. By leveraging Zero-Knowledge Proofs (Groth16), ZKGate allows users to:
1. Complete KYC with a trusted issuer.
2. Receive a ZK-compatible credential commitment.
3. Generate proofs of specific attributes (e.g., "I am over 18" or "I am an accredited investor").
4. Submit these proofs to HashKey Chain dApps to unlock access.

## 🏗️ Architecture

```ascii
      +-----------------+       +-------------------+       +--------------------+
      |   User App      |       |   Issuer Server   |       |   HashKey Chain    |
      +-----------------+       +-------------------+       +--------------------+
               |                         |                           |
    1. Submit KYC Data ----------------->|                           |
               |                         |                           |
               |<-- 2. Issue Credential -|                           |
               |       (Commitment)      |                           |
               |                         |---- 3. Update Root ------>| (ZKCredentialRegistry)
               |                         |                           |
    4. Gen ZK Proof ------------------------------------------------>| (ZKGate Verifier)
               |                         |                           |
               |<--------------------------- 5. Grant Access --------| (ZKGate.sol)
               |                                                     |
    6. Interact with DeFi <------------------------------------------| (ZKGateConsumer)
```

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity 0.8.20, Hardhat, OpenZeppelin
- **ZK Logic**: Circom 2.x + snarkjs (Groth16) / Simulated for Demo
- **Backend**: Node.js, Express, MerkleTree.js
- **Frontend**: Next.js 14 (App Router), TailwindCSS, ethers.js v6, RainbowKit, Wagmi
- **Network**: HashKey Chain (Layer 2, OP Stack based)

## 📦 Project Structure

```text
zkgate/
├── contracts/          # Solidity smart contracts
├── server/             # Express.js backend (Credential Issuance)
├── app/                # Next.js 14 Frontend
├── scripts/            # Deployment & demo scripts
├── test/               # Hardhat tests
└── hardhat.config.js   # HashKey Chain network config
```

## 🚦 Quick Start

### 1. Installation
```bash
npm install
cd app && npm install && cd ..
```

### 2. Environment Setup
Copy `.env.example` to `.env` and add your private key.
```bash
cp .env.example .env
```

### 3. Compile & Test
```bash
npx hardhat compile
npx hardhat test
```

### 4. Deploy to HashKey Chain
```bash
npx hardhat deploy --network hashkeyTestnet
```

### 5. Run Demo Flow
```bash
npx hardhat run scripts/demo-flow.js
```

### 6. Start Frontend & Backend
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
cd app && npm run dev
```

## 🧩 Integration Guide

Integrate ZKGate into your dApp in minutes:

```solidity
import "./interfaces/IZKGate.sol";

contract YourDeFiPool {
    IZKGate public zkGate;

    function restrictedAction() external {
        require(
            zkGate.hasAccess(msg.sender, IZKGate.CredentialType.KYC_COMPLETE),
            "ZKGate: KYC Required"
        );
        // ... business logic
    }
}
```

## 🛡️ Security

- **Nullifier System**: Prevents double-spend/replay of identity proofs.
- **Commitment Scheme**: Personal data never touches the blockchain.
- **Sparse Merkle Trees**: Scalable on-chain verification.

## 🗺️ Roadmap

- [x] Phase 1: Hackathon MVP (Current)
- [ ] Phase 2: Mainnet Audit & Deployment
- [ ] Phase 3: Multi-issuer Support & Governance
- [ ] Phase 4: Mobile App (ZK-Wallet integration)

## ⚖️ License
MIT

---
**Built for HashKey Chain Horizon Hackathon 2026 — ZKID Track**
