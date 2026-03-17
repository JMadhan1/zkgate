// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZKGate.sol";
import "./ZKVerifier.sol";
import "./ZKCredentialRegistry.sol";

/**
 * @title ZKGate
 * @dev Main gateway for ZK-based identity verification on HashKey Chain
 */
contract ZKGate is IZKGate, Ownable {
    ZKVerifier public verifier;
    ZKCredentialRegistry public registry;

    mapping(address => mapping(CredentialType => bool)) private userCredentials;
    mapping(address => mapping(CredentialType => uint256)) private userExpiries;
    mapping(bytes32 => bool) public usedNullifiers;

    uint256 public constant DEFAULT_EXPIRY = 365 days;

    constructor(address _verifier, address _registry) Ownable(msg.sender) {
        verifier = ZKVerifier(_verifier);
        registry = ZKCredentialRegistry(_registry);
    }

    /**
     * @dev Verify identity using a ZK proof and grant access.
     * @param proof Encoded proof components (a, b, c)
     * @param publicInputs Public signals: [root, credentialType, timestamp, nullifierHash]
     */
    function verifyIdentity(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external override returns (bool) {
        require(publicInputs.length >= 4, "ZKGate: Invalid public inputs length");
        
        uint256 root = publicInputs[0];
        CredentialType credType = CredentialType(publicInputs[1]);
        uint256 timestamp = publicInputs[2];
        bytes32 nullifierHash = bytes32(publicInputs[3]);

        // 1. Verify Merkle Root exists in registry
        require(registry.isValidRoot(bytes32(root)), "ZKGate: Invalid Merkle Root");

        // 2. Prevent Double Spend / Replay
        require(!usedNullifiers[nullifierHash], "ZKGate: Nullifier already used");

        // 3. Check Timestamp freshness (optional, depending on circuit)
        require(timestamp <= block.timestamp, "ZKGate: Proof from the future");

        // 4. Verify ZK Proof
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = abi.decode(
            proof, 
            (uint256[2], uint256[2][2], uint256[2])
        );

        bool success = verifier.verifyProof(a, b, c, publicInputs);
        require(success, "ZKGate: Invalid ZK Proof");

        // 5. Grant Access
        usedNullifiers[nullifierHash] = true;
        userCredentials[msg.sender][credType] = true;
        userExpiries[msg.sender][credType] = block.timestamp + DEFAULT_EXPIRY;

        emit VerificationCompleted(msg.sender, credType, nullifierHash);
        emit AccessGranted(msg.sender, credType, userExpiries[msg.sender][credType]);

        return true;
    }

    /**
     * @dev Check if a user has a valid, non-expired credential.
     */
    function hasAccess(address user, CredentialType credType) public view override returns (bool) {
        return userCredentials[user][credType] && block.timestamp < userExpiries[user][credType];
    }

    /**
     * @dev Grant access manually (for administrative purposes/governance).
     */
    function grantAccess(address user, CredentialType credType) external onlyOwner {
        userCredentials[user][credType] = true;
        userExpiries[user][credType] = block.timestamp + DEFAULT_EXPIRY;
        emit AccessGranted(user, credType, userExpiries[user][credType]);
    }

    /**
     * @dev Revoke access for a specific user and credential type.
     */
    function revokeAccess(address user, CredentialType credType) external onlyOwner {
        userCredentials[user][credType] = false;
        userExpiries[user][credType] = 0;
        emit AccessRevoked(user, credType);
    }

    function getCredentialExpiry(address user, CredentialType credType) external view override returns (uint256) {
        return userExpiries[user][credType];
    }

    function updateVerifier(address _verifier) external onlyOwner {
        verifier = ZKVerifier(_verifier);
    }
}
