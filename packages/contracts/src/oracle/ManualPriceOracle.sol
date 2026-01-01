// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManualPriceOracle
 * @notice Simple price oracle that allows owner to manually set prices
 * @dev Used for testing paymaster infrastructure with controlled price inputs
 */
contract ManualPriceOracle is Ownable {
    /// @notice Token price in USD with 8 decimals (like Chainlink)
    uint256 public tokenPriceUSD;
    
    /// @notice ETH price in USD with 8 decimals
    uint256 public ethPriceUSD;
    
    /// @notice Last update timestamp
    uint256 public lastUpdated;
    
    /// @notice Staleness threshold (default 1 hour)
    uint256 public stalenessThreshold = 1 hours;

    event PriceUpdated(uint256 tokenPriceUSD, uint256 ethPriceUSD);
    event StalenessThresholdUpdated(uint256 newThreshold);

    error StalePrice();

    /**
     * @param _tokenPriceUSD Initial token price (8 decimals, e.g., 350000000000 = $3500)
     * @param _ethPriceUSD Initial ETH price (8 decimals, e.g., 261400000000 = $2614)
     * @param _owner Owner address
     */
    constructor(uint256 _tokenPriceUSD, uint256 _ethPriceUSD, address _owner) Ownable(_owner) {
        tokenPriceUSD = _tokenPriceUSD;
        ethPriceUSD = _ethPriceUSD;
        lastUpdated = block.timestamp;
    }

    /// @notice Update prices - only owner
    function setPrice(uint256 _tokenPriceUSD, uint256 _ethPriceUSD) external onlyOwner {
        tokenPriceUSD = _tokenPriceUSD;
        ethPriceUSD = _ethPriceUSD;
        lastUpdated = block.timestamp;
        emit PriceUpdated(_tokenPriceUSD, _ethPriceUSD);
    }

    /// @notice Update staleness threshold
    function setStalenessThreshold(uint256 _threshold) external onlyOwner {
        stalenessThreshold = _threshold;
        emit StalenessThresholdUpdated(_threshold);
    }

    /// @notice Get token price in USD (8 decimals)
    function getTokenPrice() external view returns (uint256 price, uint8 decimals_) {
        if (block.timestamp > lastUpdated + stalenessThreshold) revert StalePrice();
        return (tokenPriceUSD, 8);
    }

    /// @notice Get ETH price in USD (8 decimals)
    function getETHPrice() external view returns (uint256 price, uint8 decimals_) {
        if (block.timestamp > lastUpdated + stalenessThreshold) revert StalePrice();
        return (ethPriceUSD, 8);
    }

    /// @notice Calculate token amount needed for a given ETH value
    /// @param ethAmount Amount of ETH (18 decimals)
    /// @return tokenAmount Equivalent token amount (assumes 18 decimals token)
    function ethToToken(uint256 ethAmount) external view returns (uint256 tokenAmount) {
        if (block.timestamp > lastUpdated + stalenessThreshold) revert StalePrice();
        // ethAmount * ethPriceUSD / tokenPriceUSD
        // Both prices have 8 decimals so they cancel out
        return (ethAmount * ethPriceUSD) / tokenPriceUSD;
    }

    /// @notice Calculate ETH amount equivalent to a given token value
    /// @param tokenAmount Amount of tokens (18 decimals)
    /// @return ethAmount Equivalent ETH amount (18 decimals)
    function tokenToETH(uint256 tokenAmount) external view returns (uint256 ethAmount) {
        if (block.timestamp > lastUpdated + stalenessThreshold) revert StalePrice();
        // tokenAmount * tokenPriceUSD / ethPriceUSD
        return (tokenAmount * tokenPriceUSD) / ethPriceUSD;
    }

    /// @notice Check if price is fresh
    function isPriceFresh() external view returns (bool) {
        return block.timestamp <= lastUpdated + stalenessThreshold;
    }
}
