const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

class MerkleService {
    constructor() {
        this.leaves = [];
        this.tree = new MerkleTree([], keccak256, { sortPairs: true });
    }

    addLeaf(leafData) {
        const leaf = keccak256(leafData);
        this.leaves.push(leaf);
        this.tree = new MerkleTree(this.leaves, keccak256, { sortPairs: true });
        return {
            leaf: '0x' + leaf.toString('hex'),
            root: '0x' + this.tree.getRoot().toString('hex'),
            index: this.leaves.length - 1
        };
    }

    getProof(leafData) {
        const leaf = keccak256(leafData);
        const proof = this.tree.getProof(leaf).map(x => '0x' + x.data.toString('hex'));
        return proof;
    }

    getRoot() {
        return '0x' + this.tree.getRoot().toString('hex');
    }

    getLeaves() {
        return this.leaves.map(l => '0x' + l.toString('hex'));
    }
}

module.exports = new MerkleService();
