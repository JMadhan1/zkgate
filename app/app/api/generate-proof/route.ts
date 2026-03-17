import { NextResponse } from 'next/server';
import merkleService from '@/app/lib/merkleService';

export async function POST(req: Request) {
    try {
        const { commitment, userData, secret, type, issuedAt } = await req.json();
        
        // In this serverless demo, since we don't have a DB, we expect the client 
        // to send back the data needed to reconstruct the leaf.
        if (!commitment || !userData || !secret) {
            return NextResponse.json({ error: "Missing required data for proof generation" }, { status: 400 });
        }

        const proof = merkleService.getProof(JSON.stringify({
            secret,
            userData,
            type,
            issuedAt
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
            type,
            Math.floor(Date.now() / 1000),
            '0x' + "f".repeat(64) // mock nullifier
        ];

        return NextResponse.json({
            success: true,
            proof: zkProof,
            publicSignals: publicSignals,
            merkleProof: proof
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
