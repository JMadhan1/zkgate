// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZKGate.sol";

/**
 * @title ZKBadge
 * @dev Soulbound Token (SBT) minted upon successful ZKGate proof verification.
 *      Non-transferable — represents a user's on-chain identity credential.
 */
contract ZKBadge is ERC721, Ownable {

    struct BadgeData {
        IZKGate.CredentialType credType;
        uint256 validUntil;
        uint256 issuedAt;
    }

    address public zkGate;
    uint256 private _nextTokenId;

    mapping(uint256 => BadgeData) public badges;
    mapping(address => mapping(IZKGate.CredentialType => uint256)) public userBadge;

    event BadgeMinted(
        address indexed recipient,
        uint256 indexed tokenId,
        IZKGate.CredentialType credType,
        uint256 validUntil
    );

    constructor(address _zkGate) ERC721("ZKGate Identity Badge", "ZKBADGE") Ownable(msg.sender) {
        zkGate = _zkGate;
    }

    modifier onlyZKGate() {
        require(msg.sender == zkGate, "ZKBadge: caller is not ZKGate");
        _;
    }

    /**
     * @notice Mint a soulbound badge for a user after successful proof verification.
     *         Called by ZKGate contract after _grantAccess.
     */
    function mintBadge(
        address recipient,
        IZKGate.CredentialType credType,
        uint256 validUntil
    ) external onlyZKGate returns (uint256 tokenId) {
        tokenId = _nextTokenId++;

        // Burn old badge of same type if exists
        uint256 oldId = userBadge[recipient][credType];
        if (_ownerOf(oldId) == recipient) {
            _burn(oldId);
        }

        _safeMint(recipient, tokenId);
        badges[tokenId] = BadgeData({ credType: credType, validUntil: validUntil, issuedAt: block.timestamp });
        userBadge[recipient][credType] = tokenId;

        emit BadgeMinted(recipient, tokenId, credType, validUntil);
    }

    /**
     * @notice Check if a user holds a valid, non-expired badge for a credential type.
     */
    function isValidBadge(address user, IZKGate.CredentialType credType) external view returns (bool) {
        uint256 tokenId = userBadge[user][credType];
        if (_ownerOf(tokenId) != user) return false;
        return badges[tokenId].validUntil > block.timestamp;
    }

    /**
     * @notice Get badge data for a user's credential type.
     */
    function getBadge(address user, IZKGate.CredentialType credType)
        external
        view
        returns (bool exists, IZKGate.CredentialType ctype, uint256 validUntil, uint256 issuedAt)
    {
        uint256 tokenId = userBadge[user][credType];
        if (_ownerOf(tokenId) != user) return (false, IZKGate.CredentialType.AGE_VERIFIED, 0, 0);
        BadgeData memory b = badges[tokenId];
        return (true, b.credType, b.validUntil, b.issuedAt);
    }

    function setZKGate(address _zkGate) external onlyOwner {
        zkGate = _zkGate;
    }

    // ── Non-transferable (SBT) ──────────────────────────────────────────────
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) and burning (to == address(0)), block transfers
        require(from == address(0) || to == address(0), "ZKBadge: Soulbound - non-transferable");
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        BadgeData memory b = badges[tokenId];
        string memory credName = _credName(b.credType);
        bool valid = b.validUntil > block.timestamp;
        // Minimal on-chain URI — integrators can override with a metadata server
        return string(abi.encodePacked(
            'data:application/json;charset=utf-8,{"name":"ZKGate Badge - ', credName,
            '","description":"Soulbound identity badge issued by ZKGate protocol.","attributes":[',
            '{"trait_type":"Credential","value":"', credName, '"},',
            '{"trait_type":"Status","value":"', valid ? "Valid" : "Expired", '"},',
            '{"trait_type":"ValidUntil","value":', _toString(b.validUntil), '}]}'
        ));
    }

    function _credName(IZKGate.CredentialType ct) internal pure returns (string memory) {
        if (ct == IZKGate.CredentialType.AGE_VERIFIED)        return "Age Verified";
        if (ct == IZKGate.CredentialType.ACCREDITED_INVESTOR) return "Accredited Investor";
        if (ct == IZKGate.CredentialType.JURISDICTION_CLEAR)  return "Jurisdiction Clear";
        if (ct == IZKGate.CredentialType.KYC_COMPLETE)        return "KYC Complete";
        if (ct == IZKGate.CredentialType.AML_CLEAR)           return "AML Clear";
        return "Unknown";
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
