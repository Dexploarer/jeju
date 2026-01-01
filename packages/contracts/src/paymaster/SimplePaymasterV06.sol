// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/contracts/interfaces/IPaymaster.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title SimplePaymasterV06
 * @notice A simple v0.6 compatible paymaster that sponsors all UserOperations
 */
contract SimplePaymasterV06 is IPaymaster, Ownable {
    IEntryPoint public immutable entryPoint;

    constructor(IEntryPoint _entryPoint, address _owner) Ownable(_owner) {
        entryPoint = _entryPoint;
    }

    function validatePaymasterUserOp(
        UserOperation calldata,
        bytes32,
        uint256
    ) external pure override returns (bytes memory context, uint256 validationData) {
        return ("", 0);
    }

    function postOp(
        PostOpMode,
        bytes calldata,
        uint256
    ) external pure override {
        // No post-op needed
    }

    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
}

// v0.6 UserOperation struct
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}


