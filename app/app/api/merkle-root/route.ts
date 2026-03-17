import { NextResponse } from 'next/server';
import merkleService from '@/app/lib/merkleService';

export async function GET() {
    return NextResponse.json({ root: merkleService.getRoot() });
}
