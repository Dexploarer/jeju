// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "forge-std/Script.sol";

/**
 * @title L2OutputOracle
 * @notice Minimal L2OutputOracle for OP Stack L2 chains
 * @dev Stores L2 output roots proposed by the proposer
 */
contract L2OutputOracle {
    struct OutputProposal {
        bytes32 outputRoot;
        uint128 timestamp;
        uint128 l2BlockNumber;
    }

    /// @notice The number of the first L2 block recorded in this contract
    uint256 public startingBlockNumber;

    /// @notice The timestamp of the first L2 block recorded in this contract
    uint256 public startingTimestamp;

    /// @notice The time between L2 blocks in seconds
    uint256 public l2BlockTime;

    /// @notice The address of the proposer
    address public proposer;

    /// @notice The address of the challenger
    address public challenger;

    /// @notice The number of seconds that must elapse before a withdrawal can be finalized
    uint256 public finalizationPeriodSeconds;

    /// @notice The minimum time (in seconds) that must elapse before a withdrawal can be finalized
    uint256 public constant FINALIZATION_PERIOD_SECONDS = 12 seconds; // Short for testnet

    /// @notice Array of L2 output proposals
    OutputProposal[] internal l2Outputs;

    /// @notice Emitted when an output is proposed
    event OutputProposed(
        bytes32 indexed outputRoot,
        uint256 indexed l2OutputIndex,
        uint256 indexed l2BlockNumber,
        uint256 l1Timestamp
    );

    /// @notice Emitted when outputs are deleted
    event OutputsDeleted(uint256 indexed prevNextOutputIndex, uint256 indexed newNextOutputIndex);

    error Unauthorized();
    error InvalidBlockNumber();
    error OutputAlreadyExists();

    constructor(
        uint256 _startingBlockNumber,
        uint256 _startingTimestamp,
        uint256 _l2BlockTime,
        uint256 _finalizationPeriodSeconds,
        address _proposer,
        address _challenger
    ) {
        startingBlockNumber = _startingBlockNumber;
        startingTimestamp = _startingTimestamp;
        l2BlockTime = _l2BlockTime;
        finalizationPeriodSeconds = _finalizationPeriodSeconds;
        proposer = _proposer;
        challenger = _challenger;
    }

    function proposeL2Output(
        bytes32 _outputRoot,
        uint256 _l2BlockNumber,
        bytes32 _l1BlockHash,
        uint256 _l1BlockNumber
    ) external payable {
        if (msg.sender != proposer) revert Unauthorized();
        if (_l2BlockNumber <= latestBlockNumber()) revert InvalidBlockNumber();

        l2Outputs.push(OutputProposal({
            outputRoot: _outputRoot,
            timestamp: uint128(block.timestamp),
            l2BlockNumber: uint128(_l2BlockNumber)
        }));

        emit OutputProposed(_outputRoot, l2Outputs.length - 1, _l2BlockNumber, block.timestamp);
    }

    function deleteL2Outputs(uint256 _l2OutputIndex) external {
        if (msg.sender != challenger) revert Unauthorized();

        uint256 prevNextL2OutputIndex = l2Outputs.length;
        for (uint256 i = _l2OutputIndex; i < l2Outputs.length; i++) {
            l2Outputs.pop();
        }

        emit OutputsDeleted(prevNextL2OutputIndex, _l2OutputIndex);
    }

    function getL2Output(uint256 _l2OutputIndex) external view returns (OutputProposal memory) {
        return l2Outputs[_l2OutputIndex];
    }

    function getL2OutputIndexAfter(uint256 _l2BlockNumber) external view returns (uint256) {
        uint256 lo = 0;
        uint256 hi = l2Outputs.length;

        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (l2Outputs[mid].l2BlockNumber < _l2BlockNumber) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        return lo;
    }

    function getL2OutputAfter(uint256 _l2BlockNumber) external view returns (OutputProposal memory) {
        return l2Outputs[this.getL2OutputIndexAfter(_l2BlockNumber)];
    }

    function latestOutputIndex() external view returns (uint256) {
        return l2Outputs.length == 0 ? 0 : l2Outputs.length - 1;
    }

    function latestBlockNumber() public view returns (uint256) {
        return l2Outputs.length == 0 ? startingBlockNumber : l2Outputs[l2Outputs.length - 1].l2BlockNumber;
    }

    function nextOutputIndex() external view returns (uint256) {
        return l2Outputs.length;
    }

    function computeL2Timestamp(uint256 _l2BlockNumber) external view returns (uint256) {
        return startingTimestamp + ((_l2BlockNumber - startingBlockNumber) * l2BlockTime);
    }
}

contract DeployL2OutputOracle is Script {
    function run() external {
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proposer = vm.envAddress("PROPOSER_ADDRESS");
        address challenger = vm.envAddress("CHALLENGER_ADDRESS");

        // L2 chain configuration
        uint256 startingBlockNumber = 0;
        uint256 startingTimestamp = 1633267491; // Match genesis timestamp
        uint256 l2BlockTime = 2; // 2 second blocks
        uint256 finalizationPeriodSeconds = 12; // Short for testnet

        vm.startBroadcast(deployerPrivateKey);

        L2OutputOracle oracle = new L2OutputOracle(
            startingBlockNumber,
            startingTimestamp,
            l2BlockTime,
            finalizationPeriodSeconds,
            proposer,
            challenger
        );

        vm.stopBroadcast();

        console.log("L2OutputOracle deployed at:", address(oracle));
        console.log("Proposer:", proposer);
        console.log("Challenger:", challenger);
    }
}
