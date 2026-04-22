// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZKGate.sol";
import "./AgeCheckVerifier.sol";
import "./CredentialCheckVerifier.sol";
import "./SelectiveDisclosureVerifier.sol";
import "./ZKCredentialRegistry.sol";
import "./ZKBadge.sol";

/**
 * @title ZKGate
 * @dev Main gateway for ZK-based identity verification on HashKey Chain.
 *      Three Groth16 verifiers:
 *        1. AgeCheckVerifier             — proves age >= threshold (no DOB revealed)
 *        2. CredentialCheckVerifier      — proves Merkle inclusion of any credential
 *        3. SelectiveDisclosureVerifier  — proves only chosen attributes (killer feature)
 *
 * All proofs use Poseidon-based nullifiers to prevent replay attacks.
 */
contract ZKGate is IZKGate, Ownable {
    AgeCheckVerifier            public ageVerifier;
    CredentialCheckVerifier     public credentialVerifier;
    SelectiveDisclosureVerifier public selectiveVerifier;
    ZKCredentialRegistry        public registry;
    ZKBadge                     public zkBadge;

    mapping(address => mapping(CredentialType => bool))    private _userCredentials;
    mapping(address => mapping(CredentialType => uint256)) private _userExpiries;
    mapping(bytes32 => bool)                               public  usedNullifiers;

    uint256 public constant DEFAULT_EXPIRY = 365 days;

    event VerificationCompleted(address indexed user, CredentialType credType, bytes32 nullifier);
    event SelectiveProofVerified(address indexed user, uint256 disclosureBitmask, bytes32 nullifier);
    event AccessGranted(address indexed user, CredentialType credType, uint256 expiry);
    event AccessRevoked(address indexed user, CredentialType credType);
    event NullifierUsed(bytes32 indexed nullifier, address indexed user);

    constructor(
        address _ageVerifier,
        address _credentialVerifier,
        address _selectiveVerifier,
        address _registry
    ) Ownable(msg.sender) {
        ageVerifier        = AgeCheckVerifier(_ageVerifier);
        credentialVerifier = CredentialCheckVerifier(_credentialVerifier);
        selectiveVerifier  = SelectiveDisclosureVerifier(_selectiveVerifier);
        registry           = ZKCredentialRegistry(_registry);
    }

    // ── 1. Age Verification ────────────────────────────────────────────────
    /**
     * @notice Prove you are >= ageThreshold years old without revealing DOB.
     * @param _pubSignals [currentTimestamp, ageThreshold, credentialHash, nullifierHash]
     */
    function verifyAge(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external returns (bool) {
        bytes32 nullifier = bytes32(_pubSignals[3]);
        _requireUnusedNullifier(nullifier);

        require(ageVerifier.verifyProof(_pA, _pB, _pC, _pubSignals), "ZKGate: Invalid age proof");

        _consumeNullifier(nullifier);
        _grantAccess(msg.sender, CredentialType.AGE_VERIFIED);
        emit VerificationCompleted(msg.sender, CredentialType.AGE_VERIFIED, nullifier);
        return true;
    }

    // ── 2. Credential Merkle Inclusion Verification ────────────────────────
    /**
     * @notice Prove credential exists in the Merkle tree without revealing which one.
     * @param _pubSignals [merkleRoot, credentialType, nullifierHash, currentTimestamp]
     */
    function verifyCredential(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external returns (bool) {
        bytes32 nullifier  = bytes32(_pubSignals[2]);
        bytes32 merkleRoot = bytes32(_pubSignals[0]);
        CredentialType ct  = CredentialType(_pubSignals[1]);

        _requireUnusedNullifier(nullifier);
        require(registry.isValidRoot(merkleRoot), "ZKGate: Invalid Merkle root");
        require(credentialVerifier.verifyProof(_pA, _pB, _pC, _pubSignals), "ZKGate: Invalid credential proof");

        _consumeNullifier(nullifier);
        _grantAccess(msg.sender, ct);
        emit VerificationCompleted(msg.sender, ct, nullifier);
        return true;
    }

    // ── 3. Selective Disclosure — THE KILLER FEATURE ──────────────────────
    /**
     * @notice Prove ONLY the attributes you choose. Nothing else leaks.
     * @param _pubSignals [merkleRoot, disclosureBitmask, nullifierHash,
     *                     revealedValues[0..4], currentTimestamp]  (8 total)
     * @param disclosureBitmask  5-bit mask: bit[i]=1 means attribute[i] was disclosed
     *
     * Attribute mapping: 0=AGE, 1=JURISDICTION, 2=INVESTOR_STATUS, 3=KYC, 4=AML
     */
    function verifySelective(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[8] calldata _pubSignals,
        uint256 disclosureBitmask
    ) external returns (bool) {
        bytes32 nullifier  = bytes32(_pubSignals[2]);
        bytes32 merkleRoot = bytes32(_pubSignals[0]);

        _requireUnusedNullifier(nullifier);
        require(registry.isValidRoot(merkleRoot), "ZKGate: Invalid Merkle root");
        require(disclosureBitmask == _pubSignals[1], "ZKGate: Bitmask mismatch");
        require(selectiveVerifier.verifyProof(_pA, _pB, _pC, _pubSignals), "ZKGate: Invalid selective proof");

        _consumeNullifier(nullifier);

        for (uint i = 0; i < 5; i++) {
            if ((disclosureBitmask >> i) & 1 == 1) {
                _grantAccess(msg.sender, CredentialType(i));
            }
        }

        emit SelectiveProofVerified(msg.sender, disclosureBitmask, nullifier);
        return true;
    }

    // ── Legacy verifyIdentity (IZKGate backward compat) ───────────────────
    function verifyIdentity(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external override returns (bool) {
        require(publicInputs.length >= 4, "ZKGate: Invalid public inputs length");

        bytes32 nullifier  = bytes32(publicInputs[3]);
        bytes32 merkleRoot = bytes32(publicInputs[0]);
        CredentialType ct  = CredentialType(publicInputs[1]);

        _requireUnusedNullifier(nullifier);
        require(registry.isValidRoot(merkleRoot), "ZKGate: Invalid Merkle Root");
        require(publicInputs[2] <= block.timestamp, "ZKGate: Proof from the future");

        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) =
            abi.decode(proof, (uint256[2], uint256[2][2], uint256[2]));

        uint[4] memory sigs = [publicInputs[0], publicInputs[1], publicInputs[2], publicInputs[3]];
        require(
            credentialVerifier.verifyProof([a[0], a[1]], [[b[0][0], b[0][1]], [b[1][0], b[1][1]]], [c[0], c[1]], sigs),
            "ZKGate: Invalid ZK Proof"
        );

        _consumeNullifier(nullifier);
        _grantAccess(msg.sender, ct);
        emit VerificationCompleted(msg.sender, ct, nullifier);
        return true;
    }

    // ── Access Queries ─────────────────────────────────────────────────────
    function hasAccess(address user, CredentialType ct) public view override returns (bool) {
        return _userCredentials[user][ct] && block.timestamp < _userExpiries[user][ct];
    }

    function getCredentialExpiry(address user, CredentialType ct) external view override returns (uint256) {
        return _userExpiries[user][ct];
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function grantAccess(address user, CredentialType ct) external onlyOwner {
        _grantAccess(user, ct);
    }

    function revokeAccess(address user, CredentialType ct) external onlyOwner {
        _userCredentials[user][ct] = false;
        _userExpiries[user][ct]    = 0;
        emit AccessRevoked(user, ct);
    }

    function setAgeVerifier(address v) external onlyOwner        { ageVerifier        = AgeCheckVerifier(v); }
    function setCredentialVerifier(address v) external onlyOwner  { credentialVerifier = CredentialCheckVerifier(v); }
    function setSelectiveVerifier(address v) external onlyOwner   { selectiveVerifier  = SelectiveDisclosureVerifier(v); }
    function setRegistry(address r) external onlyOwner            { registry           = ZKCredentialRegistry(r); }
    function setBadgeContract(address b) external onlyOwner       { zkBadge            = ZKBadge(b); }

    // ── Internal ───────────────────────────────────────────────────────────
    function _requireUnusedNullifier(bytes32 nullifier) internal view {
        require(!usedNullifiers[nullifier], "ZKGate: Nullifier already used");
    }

    function _consumeNullifier(bytes32 nullifier) internal {
        usedNullifiers[nullifier] = true;
        emit NullifierUsed(nullifier, msg.sender);
    }

    function _grantAccess(address user, CredentialType ct) internal {
        uint256 expiry = block.timestamp + DEFAULT_EXPIRY;
        _userCredentials[user][ct] = true;
        _userExpiries[user][ct]    = expiry;
        emit AccessGranted(user, ct, expiry);

        // Mint soulbound badge if ZKBadge contract is configured
        if (address(zkBadge) != address(0)) {
            try zkBadge.mintBadge(user, ct, expiry) {} catch {}
        }
    }
}
