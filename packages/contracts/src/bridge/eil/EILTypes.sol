// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title EILTypes
 * @author Jeju Network
 * @notice Shared types for Ethereum Interop Layer (EIL) contracts
 * @dev Consolidates VoucherRequest, Voucher, and related structs
 *      used across CrossChainPaymaster, NFTPaymaster, and MessagingPaymaster
 */

// ============ Asset Type ============

enum EILAssetType {
    NATIVE,     // Native ETH
    ERC20,      // Fungible tokens
    ERC721,     // Non-fungible tokens
    ERC1155     // Semi-fungible tokens
}

// ============ Voucher Request ============

/**
 * @notice Cross-chain transfer request created by users
 */
struct VoucherRequest {
    address requester;
    EILAssetType assetType;
    address token;
    uint256 tokenId;      // 0 for NATIVE/ERC20, actual ID for NFTs
    uint256 amount;       // 1 for ERC721, actual amount otherwise
    uint256 destinationChainId;
    address recipient;
    uint256 gasOnDestination;
    uint256 maxFee;
    uint256 feeIncrement;
    uint256 deadline;
    uint256 createdBlock;
    bool claimed;
    bool expired;
    bool refunded;
    address winningXLP;
    uint256 winningFee;
}

// ============ Voucher ============

/**
 * @notice Voucher issued by XLP to fulfill a request
 */
struct Voucher {
    bytes32 requestId;
    address xlp;
    EILAssetType assetType;
    uint256 sourceChainId;
    uint256 destinationChainId;
    address sourceToken;
    address destinationToken;
    uint256 tokenId;
    uint256 amount;
    uint256 fee;
    uint256 gasProvided;
    uint256 issuedBlock;
    uint256 expiresBlock;
    bool fulfilled;
    bool slashed;
    bool claimed;
}

// ============ XLP Info ============

/**
 * @notice Cross-Liquidity Provider information
 */
struct XLPInfo {
    address xlp;
    uint256 totalStaked;
    uint256 totalSlashed;
    uint256 totalFillsCompleted;
    uint256 activeFills;
    uint256 registeredAt;
    bool isActive;
    uint256[] supportedChains;
}

// ============ Fee Auction Parameters ============

/**
 * @notice Reverse Dutch auction parameters for fees
 */
struct FeeAuctionParams {
    uint256 startBlock;
    uint256 startFee;
    uint256 endFee;
    uint256 feeIncrement;
    uint256 incrementPeriod;  // Blocks between decrements
}

// ============ Cross-Chain Message ============

/**
 * @notice Generic cross-chain message format
 */
struct CrossChainMessage {
    uint32 sourceDomain;
    uint32 destinationDomain;
    bytes32 sender;
    bytes32 recipient;
    bytes payload;
    uint256 gasLimit;
    uint256 fee;
    uint256 nonce;
}

// ============ Events (shared signatures) ============

/// @notice Shared event signatures for consistent event parsing

interface IEILEvents {
    event VoucherRequested(
        bytes32 indexed requestId,
        address indexed requester,
        EILAssetType assetType,
        address token,
        uint256 amount,
        uint256 destinationChainId,
        address recipient,
        uint256 maxFee,
        uint256 deadline
    );

    event VoucherIssued(
        bytes32 indexed voucherId,
        bytes32 indexed requestId,
        address indexed xlp,
        uint256 fee
    );

    event VoucherFulfilled(
        bytes32 indexed voucherId,
        address indexed recipient,
        uint256 amount
    );

    event VoucherExpired(bytes32 indexed requestId, address indexed requester);

    event Refunded(
        bytes32 indexed requestId,
        address indexed requester,
        uint256 amount
    );

    event XLPSlashed(
        bytes32 indexed voucherId,
        address indexed xlp,
        uint256 amount
    );

    event SourceAssetClaimed(
        bytes32 indexed voucherId,
        address indexed xlp,
        uint256 amount,
        uint256 fee
    );
}
