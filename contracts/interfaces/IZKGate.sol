// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZKGate
 * @dev Interface for the ZKGate protocol
 */
interface IZKGate {
    enum CredentialType {
        AGE_VERIFIED,
        ACCREDITED_INVESTOR,
        JURISDICTION_CLEAR,
        KYC_COMPLETE,
        AML_CLEAR
    }

    event AccessGranted(address indexed user, CredentialType credentialType, uint256 expiry);
    event AccessRevoked(address indexed user, CredentialType credentialType);
    event VerificationCompleted(address indexed user, CredentialType credentialType, bytes32 nullifierHash);

    function verifyIdentity(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external returns (bool);

    function hasAccess(address user, CredentialType credentialType) external view returns (bool);
    
    function getCredentialExpiry(address user, CredentialType credentialType) external view returns (uint256);
}
