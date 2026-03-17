import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

class MerkleService {
    private leaves: any[] = [];
    private tree: MerkleTree;

    constructor() {
        this.tree = new MerkleTree([], keccak256, { sortPairs: true });
    }

    addLeaf(leafData: string) {
        const leaf = keccak256(leafData);
        this.leaves.push(leaf);
        this.tree = new MerkleTree(this.leaves, keccak256, { sortPairs: true });
        return {
            leaf: '0x' + leaf.toString('hex'),
            root: '0x' + this.tree.getRoot().toString('hex'),
            index: this.leaves.length - 1
        };
    }

    getProof(leafData: string) {
        const leaf = keccak256(leafData);
        // Regrow tree with existing leaves to ensure proof is calculated correctly if state was lost
        // (Though in serverless this is still problematic)
        const proof = this.tree.getProof(leaf).map(x => '0x' + x.data.toString('hex'));
        return proof;
    }

    getRoot() {
        return '0x' + this.tree.getRoot().toString('hex');
    }
}

// In Next.js, we can use a global variable to persist state in development 
// and potentially across warm starts in production.
const globalForMerkle = global as unknown as { merkleService: MerkleService };

export const merkleService = globalForMerkle.merkleService || new MerkleService();

if (process.env.NODE_ENV !== 'production') globalForMerkle.merkleService = merkleService;

export default merkleService;
