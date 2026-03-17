// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IZKGate.sol";

/**
 * @title ZKGateConsumer
 * @dev Example DeFi protocol showing how to integrate ZKGate for compliance
 */
contract ZKGateConsumer {
    IZKGate public zkGate;
    
    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);
    event Swapped(address indexed user, uint256 amount);

    constructor(address _zkGate) {
        zkGate = IZKGate(_zkGate);
    }

    /**
     * @dev Deposit funds. Requires KYC_COMPLETE credential.
     */
    function deposit() external payable {
        require(
            zkGate.hasAccess(msg.sender, IZKGate.CredentialType.KYC_COMPLETE),
            "ZKGateConsumer: KYC required for deposit"
        );
        
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @dev Swap tokens. Requires ACCREDITED_INVESTOR credential.
     */
    function restrictedSwap(uint256 amount) external {
        require(
            zkGate.hasAccess(msg.sender, IZKGate.CredentialType.ACCREDITED_INVESTOR),
            "ZKGateConsumer: Accredited Investor status required for swap"
        );
        
        require(balances[msg.sender] >= amount, "ZKGateConsumer: Insufficient balance");
        
        // Simulated swap logic
        balances[msg.sender] -= amount;
        emit Swapped(msg.sender, amount);
    }

    /**
     * @dev Change the ZKGate oracle address.
     */
    function setZKGate(address _zkGate) external {
        // In reality, this should be protected by ownership
        zkGate = IZKGate(_zkGate);
    }
}
