// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZKCredentialRegistry
 * @dev Stores Merkle roots of issued credentials and manages authorized issuers
 */
contract ZKCredentialRegistry is Ownable {
    mapping(address => bool) public isIssuer;
    mapping(bytes32 => bool) public roots;
    bytes32 public latestRoot;

    event CredentialIssued(bytes32 indexed root);
    event RootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    constructor() Ownable(msg.sender) {
        isIssuer[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "ZKCredentialRegistry: Caller is not an authorized issuer");
        _;
    }

    /**
     * @dev Update the Merkle root. Only callable by authorized issuers.
     * @param newRoot The new Merkle root to be added.
     */
    function updateRoot(bytes32 newRoot) external onlyIssuer {
        roots[newRoot] = true;
        bytes32 oldRoot = latestRoot;
        latestRoot = newRoot;
        emit RootUpdated(oldRoot, newRoot);
        emit CredentialIssued(newRoot);
    }

    /**
     * @dev Check if a given root is valid (exists in the registry).
     * @param root The root to check.
     * @return bool True if the root is valid.
     */
    function isValidRoot(bytes32 root) external view returns (bool) {
        return roots[root];
    }

    /**
     * @dev Add a new authorized issuer. Only callable by the owner.
     * @param issuer The address of the new issuer.
     */
    function addIssuer(address issuer) external onlyOwner {
        isIssuer[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @dev Remove an authorized issuer. Only callable by the owner.
     * @param issuer The address of the issuer to remove.
     */
    function removeIssuer(address issuer) external onlyOwner {
        isIssuer[issuer] = false;
        emit IssuerRemoved(issuer);
    }
}
