// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockJEJU
 * @notice Simple mock ERC20 token for testing multi-token paymaster flows
 * @dev Allows anyone to mint tokens for testing purposes
 */
contract MockJEJU is ERC20, Ownable {
    uint8 private immutable _decimals;

    constructor(address initialOwner) ERC20("Mock JEJU", "mJEJU") Ownable(initialOwner) {
        _decimals = 18;
        // Mint initial supply to owner
        _mint(initialOwner, 1_000_000_000 * 10 ** 18);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Anyone can mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burn tokens
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
