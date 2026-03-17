import { NextResponse } from 'next/server';
import merkleService from '@/app/lib/merkleService';

export async function POST(req: Request) {
    try {
        const { userData, credentialType } = await req.json();
        
        if (!userData || !credentialType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Create a commitment: Hash(secret + userData)
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
            commitment: result.leaf,
            root: result.root,
            type: credentialType,
            userData: userData,
            secret: userSecret,
            status: 'ISSUED',
            issuedAt: Date.now() // Needed for proof gen reproducibility
        };

        return NextResponse.json({
            success: true,
            credential: credentialRecord,
            merkleResult: result
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
