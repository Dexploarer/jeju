// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ServerRegistry
 * @notice On-chain registry for game server instances
 * @dev Manages permissionless game server operation with failover
 *
 * Features:
 * - Game server registration with TEE attestation
 * - Heartbeat monitoring for liveness
 * - Automatic failover when servers go stale
 * - State checkpoint anchoring on IPFS
 * - Permissionless takeover of stale instances
 *
 * Inspired by Persistent BitTorrent Trackers paper:
 * - If operator disappears, anyone can take over
 * - State persists via IPFS checkpoints
 * - TEE attestation proves legitimate operation
 */
contract ServerRegistry is Ownable, ReentrancyGuard {
    // =========================================================================
    // Types
    // =========================================================================

    enum ServerStatus {
        INACTIVE, // Not running
        STARTING, // Booting up
        RUNNING, // Active and healthy
        STALE, // Heartbeat missed
        FAILED // Explicitly failed

    }

    struct ServerInstance {
        bytes32 instanceId;
        address operator;
        bytes32 attestationHash; // TEE attestation proof
        string endpoint; // Public API endpoint
        uint256 registeredAt;
        uint256 lastHeartbeat;
        bytes32 stateHash; // Hash of current game state
        string checkpointCid; // IPFS CID of latest checkpoint
        uint256 checkpointAt;
        ServerStatus status;
        uint256 tickCount; // Number of game ticks processed
        uint256 stake; // Operator stake
    }

    struct FailoverRecord {
        bytes32 oldInstanceId;
        bytes32 newInstanceId;
        address oldOperator;
        address newOperator;
        uint256 timestamp;
        string reason;
    }

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Current active server instance
    bytes32 public activeInstanceId;

    /// @notice All server instances
    mapping(bytes32 => ServerInstance) public instances;

    /// @notice Instance history
    bytes32[] public instanceHistory;

    /// @notice Failover history
    FailoverRecord[] public failoverHistory;

    /// @notice Heartbeat timeout (default 5 minutes)
    uint256 public heartbeatTimeout = 5 minutes;

    /// @notice Checkpoint interval (default 5 minutes)
    uint256 public checkpointInterval = 5 minutes;

    /// @notice Minimum operator stake
    uint256 public minOperatorStake = 0.1 ether;

    /// @notice Stale check cooldown to prevent spam
    uint256 public staleCooldown = 1 minutes;

    /// @notice Last stale check timestamp
    uint256 public lastStaleCheck;

    // =========================================================================
    // Events
    // =========================================================================

    event ServerRegistered(bytes32 indexed instanceId, address indexed operator, bytes32 attestationHash, string endpoint);

    event ServerStarted(bytes32 indexed instanceId);

    event Heartbeat(bytes32 indexed instanceId, bytes32 stateHash, uint256 tickCount);

    event CheckpointSaved(bytes32 indexed instanceId, string checkpointCid, bytes32 stateHash);

    event ServerStale(bytes32 indexed instanceId, uint256 lastHeartbeat, uint256 timeout);

    event ServerFailed(bytes32 indexed instanceId, string reason);

    event Failover(bytes32 indexed oldInstanceId, bytes32 indexed newInstanceId, address indexed newOperator, string reason);

    event StakeDeposited(bytes32 indexed instanceId, uint256 amount);
    event StakeWithdrawn(bytes32 indexed instanceId, uint256 amount);

    // =========================================================================
    // Errors
    // =========================================================================

    error InstanceNotFound();
    error InstanceAlreadyExists();
    error ActiveInstanceExists();
    error NotOperator();
    error InsufficientStake();
    error InstanceNotStale();
    error StaleCooldownActive();
    error InstanceNotInactive();
    error InvalidEndpoint();
    error InvalidAttestation();
    error TransferFailed();
    error CannotWithdrawWhileActive();

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // Server Registration
    // =========================================================================

    /**
     * @notice Register a new game server instance
     * @param attestationHash TEE attestation proof
     * @param endpoint Public API endpoint
     */
    function registerInstance(bytes32 attestationHash, string calldata endpoint)
        external
        payable
        nonReentrant
        returns (bytes32)
    {
        if (bytes(endpoint).length == 0) revert InvalidEndpoint();
        if (attestationHash == bytes32(0)) revert InvalidAttestation();
        if (msg.value < minOperatorStake) revert InsufficientStake();

        // Check if there's an active instance
        if (activeInstanceId != bytes32(0)) {
            ServerInstance storage active = instances[activeInstanceId];
            if (active.status == ServerStatus.RUNNING) {
                // Check if active is stale
                if (!_isStale(activeInstanceId)) {
                    revert ActiveInstanceExists();
                }
            }
        }

        bytes32 instanceId = keccak256(abi.encodePacked(msg.sender, attestationHash, block.timestamp));

        if (instances[instanceId].registeredAt != 0) {
            revert InstanceAlreadyExists();
        }

        ServerInstance storage instance = instances[instanceId];
        instance.instanceId = instanceId;
        instance.operator = msg.sender;
        instance.attestationHash = attestationHash;
        instance.endpoint = endpoint;
        instance.registeredAt = block.timestamp;
        instance.lastHeartbeat = block.timestamp;
        instance.status = ServerStatus.STARTING;
        instance.stake = msg.value;

        instanceHistory.push(instanceId);

        emit ServerRegistered(instanceId, msg.sender, attestationHash, endpoint);

        return instanceId;
    }

    /**
     * @notice Claim an active instance that has gone stale
     * @param attestationHash New operator's TEE attestation
     * @param endpoint New operator's endpoint
     */
    function claimStaleInstance(bytes32 attestationHash, string calldata endpoint)
        external
        payable
        nonReentrant
        returns (bytes32)
    {
        if (activeInstanceId == bytes32(0)) {
            // No active instance, just register
            return this.registerInstance{value: msg.value}(attestationHash, endpoint);
        }

        // Check cooldown
        if (block.timestamp < lastStaleCheck + staleCooldown) {
            revert StaleCooldownActive();
        }
        lastStaleCheck = block.timestamp;

        ServerInstance storage staleInstance = instances[activeInstanceId];

        if (!_isStale(activeInstanceId)) {
            revert InstanceNotStale();
        }

        if (msg.value < minOperatorStake) revert InsufficientStake();

        // Mark old instance as failed
        bytes32 oldInstanceId = activeInstanceId;
        staleInstance.status = ServerStatus.FAILED;

        emit ServerStale(oldInstanceId, staleInstance.lastHeartbeat, heartbeatTimeout);

        // Create new instance, inheriting checkpoint
        bytes32 newInstanceId = keccak256(abi.encodePacked(msg.sender, attestationHash, block.timestamp));

        ServerInstance storage newInstance = instances[newInstanceId];
        newInstance.instanceId = newInstanceId;
        newInstance.operator = msg.sender;
        newInstance.attestationHash = attestationHash;
        newInstance.endpoint = endpoint;
        newInstance.registeredAt = block.timestamp;
        newInstance.lastHeartbeat = block.timestamp;
        newInstance.status = ServerStatus.STARTING;
        newInstance.stake = msg.value;

        // Inherit checkpoint from stale instance
        newInstance.checkpointCid = staleInstance.checkpointCid;
        newInstance.stateHash = staleInstance.stateHash;

        instanceHistory.push(newInstanceId);
        activeInstanceId = newInstanceId;

        // Record failover
        failoverHistory.push(
            FailoverRecord({
                oldInstanceId: oldInstanceId,
                newInstanceId: newInstanceId,
                oldOperator: staleInstance.operator,
                newOperator: msg.sender,
                timestamp: block.timestamp,
                reason: "stale_takeover"
            })
        );

        emit Failover(oldInstanceId, newInstanceId, msg.sender, "stale_takeover");
        emit ServerRegistered(newInstanceId, msg.sender, attestationHash, endpoint);

        return newInstanceId;
    }

    /**
     * @notice Start a registered instance (make it active)
     * @param instanceId Instance to start
     */
    function startInstance(bytes32 instanceId) external {
        ServerInstance storage instance = instances[instanceId];
        if (instance.registeredAt == 0) revert InstanceNotFound();
        if (instance.operator != msg.sender) revert NotOperator();
        if (instance.status != ServerStatus.STARTING) revert InstanceNotInactive();

        // If there's already an active instance, it must be stale
        if (activeInstanceId != bytes32(0) && activeInstanceId != instanceId) {
            if (!_isStale(activeInstanceId)) {
                revert ActiveInstanceExists();
            }
            // Mark old as stale
            instances[activeInstanceId].status = ServerStatus.STALE;
        }

        instance.status = ServerStatus.RUNNING;
        instance.lastHeartbeat = block.timestamp;
        activeInstanceId = instanceId;

        emit ServerStarted(instanceId);
    }

    // =========================================================================
    // Heartbeat & Checkpoints
    // =========================================================================

    /**
     * @notice Send heartbeat with current state hash
     * @param stateHash Hash of current game state
     */
    function heartbeat(bytes32 stateHash) external {
        ServerInstance storage instance = instances[activeInstanceId];
        if (instance.operator != msg.sender) revert NotOperator();

        instance.lastHeartbeat = block.timestamp;
        instance.stateHash = stateHash;
        instance.tickCount++;

        emit Heartbeat(activeInstanceId, stateHash, instance.tickCount);
    }

    /**
     * @notice Save a state checkpoint
     * @param checkpointCid IPFS CID of the checkpoint
     * @param stateHash Hash of the checkpointed state
     */
    function checkpoint(string calldata checkpointCid, bytes32 stateHash) external {
        ServerInstance storage instance = instances[activeInstanceId];
        if (instance.operator != msg.sender) revert NotOperator();

        instance.checkpointCid = checkpointCid;
        instance.stateHash = stateHash;
        instance.checkpointAt = block.timestamp;
        instance.lastHeartbeat = block.timestamp;

        emit CheckpointSaved(activeInstanceId, checkpointCid, stateHash);
    }

    /**
     * @notice Report server failure
     * @param reason Failure reason
     */
    function reportFailure(string calldata reason) external {
        ServerInstance storage instance = instances[activeInstanceId];
        if (instance.operator != msg.sender) revert NotOperator();

        instance.status = ServerStatus.FAILED;
        activeInstanceId = bytes32(0);

        emit ServerFailed(instance.instanceId, reason);
    }

    /**
     * @notice Gracefully shutdown the server
     */
    function shutdown() external nonReentrant {
        ServerInstance storage instance = instances[activeInstanceId];
        if (instance.operator != msg.sender) revert NotOperator();

        instance.status = ServerStatus.INACTIVE;

        // Return stake
        uint256 stake = instance.stake;
        instance.stake = 0;

        activeInstanceId = bytes32(0);

        (bool sent,) = msg.sender.call{value: stake}("");
        if (!sent) revert TransferFailed();
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get active instance details
     */
    function getActiveInstance() external view returns (ServerInstance memory) {
        if (activeInstanceId == bytes32(0)) {
            return ServerInstance({
                instanceId: bytes32(0),
                operator: address(0),
                attestationHash: bytes32(0),
                endpoint: "",
                registeredAt: 0,
                lastHeartbeat: 0,
                stateHash: bytes32(0),
                checkpointCid: "",
                checkpointAt: 0,
                status: ServerStatus.INACTIVE,
                tickCount: 0,
                stake: 0
            });
        }
        return instances[activeInstanceId];
    }

    /**
     * @notice Get instance by ID
     */
    function getInstance(bytes32 instanceId) external view returns (ServerInstance memory) {
        return instances[instanceId];
    }

    /**
     * @notice Check if active instance is stale
     */
    function isActiveStale() external view returns (bool) {
        if (activeInstanceId == bytes32(0)) return false;
        return _isStale(activeInstanceId);
    }

    /**
     * @notice Get time until instance is considered stale
     */
    function timeUntilStale() external view returns (uint256) {
        if (activeInstanceId == bytes32(0)) return 0;

        ServerInstance storage instance = instances[activeInstanceId];
        uint256 staleAt = instance.lastHeartbeat + heartbeatTimeout;

        if (block.timestamp >= staleAt) return 0;
        return staleAt - block.timestamp;
    }

    /**
     * @notice Get latest checkpoint CID
     */
    function getLatestCheckpoint() external view returns (string memory cid, bytes32 stateHash) {
        if (activeInstanceId == bytes32(0)) return ("", bytes32(0));

        ServerInstance storage instance = instances[activeInstanceId];
        return (instance.checkpointCid, instance.stateHash);
    }

    /**
     * @notice Get failover history
     */
    function getFailoverHistory() external view returns (FailoverRecord[] memory) {
        return failoverHistory;
    }

    /**
     * @notice Get instance history
     */
    function getInstanceHistory() external view returns (bytes32[] memory) {
        return instanceHistory;
    }

    /**
     * @notice Get instance count
     */
    function getInstanceCount() external view returns (uint256) {
        return instanceHistory.length;
    }

    /**
     * @dev Check if an instance is stale
     */
    function _isStale(bytes32 instanceId) internal view returns (bool) {
        ServerInstance storage instance = instances[instanceId];
        if (instance.status != ServerStatus.RUNNING) return true;
        return block.timestamp > instance.lastHeartbeat + heartbeatTimeout;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set heartbeat timeout
     */
    function setHeartbeatTimeout(uint256 timeout) external onlyOwner {
        heartbeatTimeout = timeout;
    }

    /**
     * @notice Set checkpoint interval
     */
    function setCheckpointInterval(uint256 interval) external onlyOwner {
        checkpointInterval = interval;
    }

    /**
     * @notice Set minimum operator stake
     */
    function setMinOperatorStake(uint256 stake) external onlyOwner {
        minOperatorStake = stake;
    }

    /**
     * @notice Set stale check cooldown
     */
    function setStaleCooldown(uint256 cooldown) external onlyOwner {
        staleCooldown = cooldown;
    }

    /**
     * @notice Emergency stop - pause active server
     */
    function emergencyStop() external onlyOwner {
        if (activeInstanceId != bytes32(0)) {
            instances[activeInstanceId].status = ServerStatus.INACTIVE;
            activeInstanceId = bytes32(0);
        }
    }

    /**
     * @notice Contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
