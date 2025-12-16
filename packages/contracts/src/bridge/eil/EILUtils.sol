// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {VoucherRequest, Voucher, FeeAuctionParams, EILAssetType} from "./EILTypes.sol";

/**
 * @title EILUtils
 * @author Jeju Network
 * @notice Utility library for EIL voucher operations
 * @dev Consolidates ID generation, fee calculation, and signature verification
 *      used across CrossChainPaymaster, NFTPaymaster, and MessagingPaymaster
 */
library EILUtils {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    /// @notice Fraud proof window in blocks
    uint256 public constant FRAUD_PROOF_WINDOW = 300;

    /// @notice Minimum fee (prevents zero-fee DOS)
    uint256 public constant MIN_FEE = 0.0001 ether;

    /// @notice Default fee increment period (blocks)
    uint256 public constant DEFAULT_INCREMENT_PERIOD = 12;

    // ============ Errors ============

    error InvalidSignature();
    error RequestExpired();
    error RequestNotExpired();
    error AlreadyClaimed();
    error AlreadyRefunded();
    error FraudProofWindowNotPassed();

    // ============ ID Generation ============

    /**
     * @notice Generate unique request ID
     * @param requester Request creator
     * @param token Token address
     * @param tokenId Token ID (0 for fungibles)
     * @param amount Amount
     * @param destinationChainId Destination chain
     * @param recipient Recipient address
     * @param nonce Request nonce
     * @return requestId Unique request identifier
     */
    function generateRequestId(
        address requester,
        address token,
        uint256 tokenId,
        uint256 amount,
        uint256 destinationChainId,
        address recipient,
        uint256 nonce
    ) internal view returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(
                block.chainid,
                requester,
                token,
                tokenId,
                amount,
                destinationChainId,
                recipient,
                nonce,
                block.number
            )
        );
    }

    /**
     * @notice Generate unique voucher ID from request
     * @param requestId Original request ID
     * @param xlp XLP address
     * @param fee Agreed fee
     * @return voucherId Unique voucher identifier
     */
    function generateVoucherId(
        bytes32 requestId,
        address xlp,
        uint256 fee
    ) internal view returns (bytes32 voucherId) {
        voucherId = keccak256(
            abi.encodePacked(requestId, xlp, fee, block.number)
        );
    }

    // ============ Fee Calculation ============

    /**
     * @notice Calculate current fee using reverse Dutch auction
     * @param params Auction parameters
     * @return currentFee Current fee at this block
     * @dev Fee decreases over time from startFee towards endFee
     */
    function calculateCurrentFee(FeeAuctionParams memory params) internal view returns (uint256 currentFee) {
        if (block.number <= params.startBlock) {
            return params.startFee;
        }

        uint256 elapsed = block.number - params.startBlock;
        uint256 decrements = elapsed / params.incrementPeriod;
        uint256 totalDecrement = decrements * params.feeIncrement;

        if (totalDecrement >= params.startFee - params.endFee) {
            return params.endFee;
        }

        currentFee = params.startFee - totalDecrement;
        if (currentFee < MIN_FEE) {
            currentFee = MIN_FEE;
        }
    }

    /**
     * @notice Calculate fee from VoucherRequest
     * @param request The voucher request
     * @return fee Current fee
     */
    function getCurrentFee(VoucherRequest memory request) internal view returns (uint256 fee) {
        FeeAuctionParams memory params = FeeAuctionParams({
            startBlock: request.createdBlock,
            startFee: request.maxFee,
            endFee: MIN_FEE,
            feeIncrement: request.feeIncrement,
            incrementPeriod: DEFAULT_INCREMENT_PERIOD
        });
        return calculateCurrentFee(params);
    }

    // ============ Signature Verification ============

    /**
     * @notice Verify XLP signature for voucher issuance
     * @param requestId Request being claimed
     * @param xlp Expected signer
     * @param fee Agreed fee
     * @param signature XLP's signature
     * @return valid True if signature is valid
     */
    function verifyVoucherSignature(
        bytes32 requestId,
        address xlp,
        uint256 fee,
        bytes memory signature
    ) internal pure returns (bool valid) {
        bytes32 messageHash = keccak256(abi.encodePacked(requestId, xlp, fee));
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        return signer == xlp;
    }

    /**
     * @notice Verify fulfillment signature
     * @param voucherId Voucher being fulfilled
     * @param recipient Asset recipient
     * @param amount Amount delivered
     * @param signature XLP's fulfillment signature
     * @param expectedSigner Expected signer address
     */
    function verifyFulfillmentSignature(
        bytes32 voucherId,
        address recipient,
        uint256 amount,
        bytes memory signature,
        address expectedSigner
    ) internal pure {
        bytes32 messageHash = keccak256(
            abi.encodePacked(voucherId, recipient, amount)
        );
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        if (signer != expectedSigner) revert InvalidSignature();
    }

    // ============ Deadline Validation ============

    /**
     * @notice Check if request has expired
     * @param request Voucher request
     * @return expired True if past deadline
     */
    function isExpired(VoucherRequest memory request) internal view returns (bool expired) {
        return block.number > request.deadline;
    }

    /**
     * @notice Require request is not expired
     * @param request Voucher request
     */
    function requireNotExpired(VoucherRequest memory request) internal view {
        if (isExpired(request)) revert RequestExpired();
    }

    /**
     * @notice Require request is expired (for refunds)
     * @param request Voucher request
     */
    function requireExpired(VoucherRequest memory request) internal view {
        if (!isExpired(request)) revert RequestNotExpired();
    }

    /**
     * @notice Check if fraud proof window has passed
     * @param voucher The voucher
     * @return passed True if window passed
     */
    function fraudProofWindowPassed(Voucher memory voucher) internal view returns (bool passed) {
        return block.number >= voucher.issuedBlock + FRAUD_PROOF_WINDOW;
    }

    /**
     * @notice Require fraud proof window has passed
     * @param voucher The voucher
     */
    function requireFraudProofWindowPassed(Voucher memory voucher) internal view {
        if (!fraudProofWindowPassed(voucher)) revert FraudProofWindowNotPassed();
    }

    // ============ State Validation ============

    /**
     * @notice Validate request can be claimed
     * @param request Voucher request
     */
    function validateClaimable(VoucherRequest memory request) internal view {
        requireNotExpired(request);
        if (request.claimed) revert AlreadyClaimed();
        if (request.refunded) revert AlreadyRefunded();
    }

    /**
     * @notice Validate request can be refunded
     * @param request Voucher request
     */
    function validateRefundable(VoucherRequest memory request) internal view {
        requireExpired(request);
        if (request.claimed) revert AlreadyClaimed();
        if (request.refunded) revert AlreadyRefunded();
    }

    // ============ Type Conversions ============

    /**
     * @notice Convert address to bytes32 for cross-chain compatibility
     * @param addr Address to convert
     * @return result Address as bytes32
     */
    function addressToBytes32(address addr) internal pure returns (bytes32 result) {
        result = bytes32(uint256(uint160(addr)));
    }

    /**
     * @notice Convert bytes32 to address
     * @param b Bytes32 value
     * @return result Extracted address
     */
    function bytes32ToAddress(bytes32 b) internal pure returns (address result) {
        result = address(uint160(uint256(b)));
    }

    // ============ Domain Hash ============

    /**
     * @notice Get domain separator for EIP-712 signatures
     * @param name Contract name
     * @param version Contract version
     * @return domainSeparator Domain separator hash
     */
    function getDomainSeparator(
        string memory name,
        string memory version
    ) internal view returns (bytes32 domainSeparator) {
        domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
    }
}
