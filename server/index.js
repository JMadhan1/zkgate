const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const merkleService = require('./services/merkleTree');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// In-memory record of issued credentials (for demo)
const credentials = [];

/**
 * @route POST /api/issue-credential
 * @desc Takes KYC data, generates a commitment, and adds it to the Merkle tree
 */
app.post('/api/issue-credential', (req, res) => {
    try {
        const { userData, credentialType } = req.body;
        
        if (!userData || !credentialType) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 1. Create a commitment: Hash(secret + userData)
        // In a real ZK system, the user would generate this and just send the commitment
        const userSecret = Math.random().toString(36).substring(7);
        const commitmentData = JSON.stringify({
            secret: userSecret,
            userData: userData,
            type: credentialType,
            issuedAt: Date.now()
        });

        // 2. Add to Merkle Tree
        const result = merkleService.addLeaf(commitmentData);

        const credentialRecord = {
            id: credentials.length,
            commitment: result.leaf,
            root: result.root,
            type: credentialType,
            userData: userData,
            secret: userSecret,
            status: 'ISSUED'
        };

        credentials.push(credentialRecord);

        res.json({
            success: true,
            credential: credentialRecord,
            merkleResult: result
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @route POST /api/generate-proof
 * @desc Mock proof generation helper
 */
app.post('/api/generate-proof', (req, res) => {
    try {
        const { commitment, credentialType } = req.body;
        
        const record = credentials.find(c => c.commitment === commitment);
        if (!record) {
            return res.status(404).json({ error: "Credential not found" });
        }

        const proof = merkleService.getProof(JSON.stringify({
            secret: record.secret,
            userData: record.userData,
            type: record.type,
            issuedAt: record.issuedAt
        }));

        // Mock ZK proof components for the on-chain verifier
        const zkProof = {
            a: ["0x" + "1".repeat(64), "0x" + "2".repeat(64)],
            b: [
                ["0x" + "3".repeat(64), "0x" + "4".repeat(64)],
                ["0x" + "5".repeat(64), "0x" + "6".repeat(64)]
            ],
            c: ["0x" + "7".repeat(64), "0x" + "8".repeat(64)]
        };

        const publicSignals = [
            merkleService.getRoot(),
            credentialType,
            Math.floor(Date.now() / 1000),
            '0x' + "f".repeat(64) // mock nullifier
        ];

        res.json({
            success: true,
            proof: zkProof,
            publicSignals: publicSignals
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/merkle-root', (req, res) => {
    res.json({ root: merkleService.getRoot() });
});

app.listen(PORT, () => {
    console.log(`ZKGate Backend running on http://localhost:${PORT}`);
});
