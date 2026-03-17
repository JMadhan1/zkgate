// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZKCredentialRegistry
 * @dev Stores Merkle roots of issued credentials + privacy-preserving revocation.
 *      Revocation is anonymous: issuer can revoke by credentialHash without
 *      knowing which user it belongs to.
 */
contract ZKCredentialRegistry is Ownable {
    mapping(address => bool) public isIssuer;
    mapping(bytes32 => bool) public roots;
    mapping(bytes32 => bool) public revokedCredentials;
    bytes32 public latestRoot;
    uint256 public totalIssued;
    uint256 public totalRevoked;

    event RootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot, address indexed issuer);
    event CredentialIssued(bytes32 indexed root, uint256 totalIssued);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed revokedBy);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    constructor() Ownable(msg.sender) {
        isIssuer[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "ZKCredentialRegistry: Not an authorized issuer");
        _;
    }

    /**
     * @notice Update Merkle root after adding a credential leaf.
     */
    function updateRoot(bytes32 newRoot) external onlyIssuer {
        bytes32 oldRoot = latestRoot;
        roots[newRoot]  = true;
        latestRoot      = newRoot;
        totalIssued++;
        emit RootUpdated(oldRoot, newRoot, msg.sender);
        emit CredentialIssued(newRoot, totalIssued);
    }

    /**
     * @notice Revoke a credential by hash — WITHOUT knowing which user it is.
     * @dev Privacy-preserving revocation: issuer only has the leaf hash,
     *      not the user's identity. User's privacy is preserved even after revocation.
     * @param credentialHash Poseidon(userCommitment, credType, issuanceDate, expiryDate, issuerPubkey)
     */
    function revokeCredential(bytes32 credentialHash) external onlyIssuer {
        require(!revokedCredentials[credentialHash], "ZKCredentialRegistry: Already revoked");
        revokedCredentials[credentialHash] = true;
        totalRevoked++;
        emit CredentialRevoked(credentialHash, msg.sender);
    }

    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return revokedCredentials[credentialHash];
    }

    function isValidRoot(bytes32 root) external view returns (bool) {
        return roots[root];
    }

    function getStats() external view returns (uint256 issued, uint256 revoked, bytes32 currentRoot) {
        return (totalIssued, totalRevoked, latestRoot);
    }

    function addIssuer(address issuer) external onlyOwner {
        isIssuer[issuer] = true;
        emit IssuerAdded(issuer);
    }

    function removeIssuer(address issuer) external onlyOwner {
        isIssuer[issuer] = false;
        emit IssuerRemoved(issuer);
    }
}
