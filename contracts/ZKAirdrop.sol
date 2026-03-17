// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZKGate.sol";

/**
 * @title ZKAirdrop
 * @dev ZK-gated token airdrop contract.
 *
 * KEY INSIGHT: The claiming wallet (msg.sender) is NEVER linked to the user's
 * KYC identity. The ZK proof proves eligibility cryptographically, while the
 * nullifier prevents double-claiming — all without surveillance.
 *
 * Flow:
 *   1. User gets a ZK credential (KYC + age check) — links to their identity wallet
 *   2. User generates proof with a DIFFERENT claiming wallet as the target
 *   3. User claims tokens from the claiming wallet
 *   4. Nullifier prevents double-claim
 *   5. Nobody can link the claiming wallet to the identity wallet
 *
 * This is the core "proving without leaking" use case.
 */
contract ZKAirdrop is Ownable {
    IZKGate public zkGate;

    uint256 public constant CLAIM_AMOUNT = 1_000 * 10**18;  // 1000 ZKG tokens
    uint256 public totalClaims;
    uint256 public maxClaims;

    // Nullifier → claimed (prevents double-claim even across wallet changes)
    mapping(bytes32 => bool) public claimedNullifiers;
    // Track claims per address for UI (not for security — nullifier does that)
    mapping(address => bool) public hasClaimed;

    event Claimed(
        address indexed claimer,
        bytes32 indexed nullifier,
        uint256 amount,
        uint256 timestamp
    );
    event AirdropFunded(uint256 amount);
    event MaxClaimsUpdated(uint256 newMax);

    constructor(address _zkGate, uint256 _maxClaims) Ownable(msg.sender) {
        zkGate    = IZKGate(_zkGate);
        maxClaims = _maxClaims;
    }

    receive() external payable {
        emit AirdropFunded(msg.value);
    }

    /**
     * @notice Claim airdrop tokens using an age ZK proof.
     * @dev The proof proves age >= 18 without revealing identity.
     *      The nullifier ensures one claim per credential (not per wallet).
     *
     * @param _pA, _pB, _pC  Groth16 proof from AgeCheck circuit
     * @param _pubSignals     [currentTimestamp, ageThreshold, credentialHash, nullifierHash]
     */
    function claimWithAgeProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external {
        require(totalClaims < maxClaims, "ZKAirdrop: Airdrop fully claimed");
        require(address(this).balance >= CLAIM_AMOUNT, "ZKAirdrop: Insufficient funds");

        bytes32 nullifier = bytes32(_pubSignals[3]);
        require(!claimedNullifiers[nullifier], "ZKAirdrop: Already claimed with this proof");

        // Verify age proof via ZKGate
        // This also marks the nullifier as used in ZKGate — but we track separately
        // because the claimer may use a different wallet than the verified one
        require(
            zkGate.verifyAge(_pA, _pB, _pC, _pubSignals),
            "ZKAirdrop: Invalid proof"
        );

        claimedNullifiers[nullifier] = true;
        hasClaimed[msg.sender]       = true;
        totalClaims++;

        (bool sent,) = payable(msg.sender).call{value: CLAIM_AMOUNT}("");
        require(sent, "ZKAirdrop: Transfer failed");

        emit Claimed(msg.sender, nullifier, CLAIM_AMOUNT, block.timestamp);
    }

    /**
     * @notice Claim using a credential Merkle proof (more general).
     * @dev Proves you have KYC_COMPLETE credential without revealing identity.
     */
    function claimWithCredentialProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external {
        require(totalClaims < maxClaims, "ZKAirdrop: Airdrop fully claimed");
        require(address(this).balance >= CLAIM_AMOUNT, "ZKAirdrop: Insufficient funds");

        bytes32 nullifier = bytes32(_pubSignals[2]);
        require(!claimedNullifiers[nullifier], "ZKAirdrop: Already claimed with this proof");

        // credentialType must be KYC_COMPLETE (3)
        require(_pubSignals[1] == 3, "ZKAirdrop: KYC_COMPLETE proof required");

        require(
            zkGate.verifyCredential(_pA, _pB, _pC, _pubSignals),
            "ZKAirdrop: Invalid credential proof"
        );

        claimedNullifiers[nullifier] = true;
        hasClaimed[msg.sender]       = true;
        totalClaims++;

        (bool sent,) = payable(msg.sender).call{value: CLAIM_AMOUNT}("");
        require(sent, "ZKAirdrop: Transfer failed");

        emit Claimed(msg.sender, nullifier, CLAIM_AMOUNT, block.timestamp);
    }

    /**
     * @notice Check how many claims remain.
     */
    function remainingClaims() external view returns (uint256) {
        return maxClaims - totalClaims;
    }

    function setMaxClaims(uint256 _max) external onlyOwner {
        maxClaims = _max;
        emit MaxClaimsUpdated(_max);
    }

    function setZKGate(address _zkGate) external onlyOwner {
        zkGate = IZKGate(_zkGate);
    }

    // Emergency withdrawal
    function withdraw() external onlyOwner {
        (bool sent,) = payable(owner()).call{value: address(this).balance}("");
        require(sent, "ZKAirdrop: Withdrawal failed");
    }
}
