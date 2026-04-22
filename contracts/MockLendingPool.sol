// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IZKGate.sol";

/**
 * @title MockLendingPool
 * @dev Demonstration contract showing ZKGate integration in a DeFi protocol.
 *      Real token logic is omitted — focus is on the ZKGate identity gate.
 */
contract MockLendingPool {
    IZKGate public immutable zkGate;

    event Deposit(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);

    constructor(address _zkGate) {
        require(_zkGate != address(0), "MockLendingPool: zero address");
        zkGate = IZKGate(_zkGate);
    }

    modifier onlyKYCVerified() {
        require(
            zkGate.hasAccess(msg.sender, IZKGate.CredentialType.KYC_COMPLETE),
            "ZKGate: KYC verification required"
        );
        _;
    }

    /**
     * @notice Deposit funds — only KYC-verified users are allowed.
     * @param amount Amount to deposit (no actual token transfer for demo).
     */
    function deposit(uint256 amount) external onlyKYCVerified {
        require(amount > 0, "MockLendingPool: amount must be > 0");
        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Borrow funds — only KYC-verified users are allowed.
     * @param amount Amount to borrow (no actual token transfer for demo).
     */
    function borrow(uint256 amount) external onlyKYCVerified {
        require(amount > 0, "MockLendingPool: amount must be > 0");
        emit Borrow(msg.sender, amount);
    }

    /**
     * @notice Check if an address has KYC access.
     */
    function checkAccess(address user) external view returns (bool) {
        return zkGate.hasAccess(user, IZKGate.CredentialType.KYC_COMPLETE);
    }
}
