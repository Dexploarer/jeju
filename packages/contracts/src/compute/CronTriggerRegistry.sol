// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CronTriggerRegistry
 * @notice On-chain registry for scheduled worker triggers
 * @dev Enables decentralized scheduling with verification
 *
 * Features:
 * - Cron expression registration
 * - Execution verification and rewards
 * - Distributed trigger assignment
 * - Execution history
 */
contract CronTriggerRegistry is Ownable, Pausable, ReentrancyGuard {
    // =========================================================================
    // Types
    // =========================================================================

    enum ScheduleStatus {
        ACTIVE,
        PAUSED,
        DISABLED,
        ERROR
    }

    enum ExecutionStatus {
        PENDING,
        RUNNING,
        SUCCESS,
        FAILED,
        TIMEOUT
    }

    struct CronSchedule {
        bytes32 scheduleId;
        bytes32 workerId;
        address owner;
        // Schedule config
        string cronExpression;
        string timezone;
        ScheduleStatus status;
        // Execution config
        uint32 timeoutSeconds;
        uint8 maxRetries;
        uint32 retryDelaySeconds;
        // Timing
        uint256 createdAt;
        uint256 lastRunAt;
        uint256 nextRunAt;
        // Stats
        uint256 totalRuns;
        uint256 successfulRuns;
        uint256 failedRuns;
        // Rewards
        uint256 rewardPerExecution;
    }

    struct CronExecution {
        bytes32 executionId;
        bytes32 scheduleId;
        bytes32 workerId;
        address executor;
        ExecutionStatus status;
        // Timing
        uint256 scheduledAt;
        uint256 startedAt;
        uint256 completedAt;
        // Result
        bytes32 resultHash;
        string errorMessage;
        // Retries
        uint8 attempt;
    }

    struct TriggerNode {
        address operator;
        bytes32 nodeId;
        uint256 stakedAmount;
        uint256 registeredAt;
        uint256 lastHeartbeat;
        uint256 executionsCompleted;
        uint256 executionsFailed;
        bool active;
    }

    // =========================================================================
    // State
    // =========================================================================

    // Schedules
    mapping(bytes32 => CronSchedule) public schedules;
    mapping(address => bytes32[]) public ownerSchedules;
    mapping(bytes32 => bytes32[]) public workerSchedules;
    bytes32[] public allScheduleIds;

    // Executions
    mapping(bytes32 => CronExecution) public executions;
    mapping(bytes32 => bytes32[]) public scheduleExecutions;

    // Nodes
    mapping(address => TriggerNode) public nodes;
    address[] public nodeList;

    // Assignment tracking
    mapping(bytes32 => address) public scheduleAssignment;
    mapping(address => bytes32[]) public nodeAssignments;

    // Config
    uint256 public minNodeStake = 0.1 ether;
    uint256 public maxExecutionTime = 15 minutes;
    uint256 public executionRewardPool;

    // =========================================================================
    // Events
    // =========================================================================

    event ScheduleCreated(
        bytes32 indexed scheduleId,
        bytes32 indexed workerId,
        address indexed owner,
        string cronExpression
    );
    event ScheduleUpdated(bytes32 indexed scheduleId, string cronExpression);
    event SchedulePaused(bytes32 indexed scheduleId);
    event ScheduleResumed(bytes32 indexed scheduleId);
    event ScheduleDeleted(bytes32 indexed scheduleId);

    event ExecutionTriggered(
        bytes32 indexed executionId,
        bytes32 indexed scheduleId,
        address indexed executor,
        uint256 scheduledAt
    );
    event ExecutionStarted(bytes32 indexed executionId, uint256 startedAt);
    event ExecutionCompleted(bytes32 indexed executionId, ExecutionStatus status, bytes32 resultHash);
    event ExecutionFailed(bytes32 indexed executionId, string errorMessage);

    event NodeRegistered(address indexed operator, bytes32 nodeId, uint256 stakedAmount);
    event NodeDeactivated(address indexed operator);
    event ScheduleAssigned(bytes32 indexed scheduleId, address indexed node);

    event RewardPaid(address indexed node, uint256 amount);

    // =========================================================================
    // Errors
    // =========================================================================

    error ScheduleNotFound();
    error NotScheduleOwner();
    error ScheduleNotActive();
    error NodeNotRegistered();
    error NodeNotActive();
    error InsufficientStake();
    error ExecutionNotFound();
    error NotAssignedExecutor();
    error ExecutionTimeout();
    error InvalidCronExpression();

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _owner) Ownable(_owner) {}

    // =========================================================================
    // Schedule Management
    // =========================================================================

    /**
     * @notice Create a new cron schedule
     */
    function createSchedule(
        bytes32 workerId,
        string calldata cronExpression,
        string calldata timezone,
        uint32 timeoutSeconds,
        uint8 maxRetries,
        uint32 retryDelaySeconds,
        uint256 rewardPerExecution
    ) external payable nonReentrant whenNotPaused returns (bytes32 scheduleId) {
        if (!_validateCronExpression(cronExpression)) revert InvalidCronExpression();

        scheduleId = keccak256(abi.encodePacked(msg.sender, workerId, cronExpression, block.timestamp));

        schedules[scheduleId] = CronSchedule({
            scheduleId: scheduleId,
            workerId: workerId,
            owner: msg.sender,
            cronExpression: cronExpression,
            timezone: timezone,
            status: ScheduleStatus.ACTIVE,
            timeoutSeconds: timeoutSeconds > 0 ? timeoutSeconds : 30,
            maxRetries: maxRetries,
            retryDelaySeconds: retryDelaySeconds > 0 ? retryDelaySeconds : 5,
            createdAt: block.timestamp,
            lastRunAt: 0,
            nextRunAt: 0,
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            rewardPerExecution: rewardPerExecution
        });

        ownerSchedules[msg.sender].push(scheduleId);
        workerSchedules[workerId].push(scheduleId);
        allScheduleIds.push(scheduleId);

        // Add to reward pool
        if (msg.value > 0) {
            executionRewardPool += msg.value;
        }

        emit ScheduleCreated(scheduleId, workerId, msg.sender, cronExpression);

        return scheduleId;
    }

    /**
     * @notice Update schedule configuration
     */
    function updateSchedule(
        bytes32 scheduleId,
        string calldata cronExpression,
        uint32 timeoutSeconds,
        uint8 maxRetries
    ) external {
        CronSchedule storage schedule = schedules[scheduleId];
        if (schedule.createdAt == 0) revert ScheduleNotFound();
        if (schedule.owner != msg.sender) revert NotScheduleOwner();

        if (bytes(cronExpression).length > 0) {
            if (!_validateCronExpression(cronExpression)) revert InvalidCronExpression();
            schedule.cronExpression = cronExpression;
        }

        if (timeoutSeconds > 0) {
            schedule.timeoutSeconds = timeoutSeconds;
        }

        schedule.maxRetries = maxRetries;

        emit ScheduleUpdated(scheduleId, cronExpression);
    }

    /**
     * @notice Pause a schedule
     */
    function pauseSchedule(bytes32 scheduleId) external {
        CronSchedule storage schedule = schedules[scheduleId];
        if (schedule.createdAt == 0) revert ScheduleNotFound();
        if (schedule.owner != msg.sender) revert NotScheduleOwner();

        schedule.status = ScheduleStatus.PAUSED;

        emit SchedulePaused(scheduleId);
    }

    /**
     * @notice Resume a paused schedule
     */
    function resumeSchedule(bytes32 scheduleId) external {
        CronSchedule storage schedule = schedules[scheduleId];
        if (schedule.createdAt == 0) revert ScheduleNotFound();
        if (schedule.owner != msg.sender) revert NotScheduleOwner();

        schedule.status = ScheduleStatus.ACTIVE;

        emit ScheduleResumed(scheduleId);
    }

    /**
     * @notice Delete a schedule
     */
    function deleteSchedule(bytes32 scheduleId) external {
        CronSchedule storage schedule = schedules[scheduleId];
        if (schedule.createdAt == 0) revert ScheduleNotFound();
        if (schedule.owner != msg.sender) revert NotScheduleOwner();

        schedule.status = ScheduleStatus.DISABLED;

        emit ScheduleDeleted(scheduleId);
    }

    // =========================================================================
    // Execution
    // =========================================================================

    /**
     * @notice Claim an execution slot (called by trigger node)
     */
    function claimExecution(bytes32 scheduleId) external nonReentrant returns (bytes32 executionId) {
        TriggerNode storage node = nodes[msg.sender];
        if (node.registeredAt == 0) revert NodeNotRegistered();
        if (!node.active) revert NodeNotActive();

        CronSchedule storage schedule = schedules[scheduleId];
        if (schedule.createdAt == 0) revert ScheduleNotFound();
        if (schedule.status != ScheduleStatus.ACTIVE) revert ScheduleNotActive();

        executionId = keccak256(abi.encodePacked(scheduleId, block.timestamp, msg.sender));

        executions[executionId] = CronExecution({
            executionId: executionId,
            scheduleId: scheduleId,
            workerId: schedule.workerId,
            executor: msg.sender,
            status: ExecutionStatus.PENDING,
            scheduledAt: block.timestamp,
            startedAt: 0,
            completedAt: 0,
            resultHash: bytes32(0),
            errorMessage: "",
            attempt: 1
        });

        scheduleExecutions[scheduleId].push(executionId);
        scheduleAssignment[scheduleId] = msg.sender;

        emit ExecutionTriggered(executionId, scheduleId, msg.sender, block.timestamp);

        return executionId;
    }

    /**
     * @notice Mark execution as started
     */
    function startExecution(bytes32 executionId) external {
        CronExecution storage execution = executions[executionId];
        if (execution.scheduledAt == 0) revert ExecutionNotFound();
        if (execution.executor != msg.sender) revert NotAssignedExecutor();

        execution.status = ExecutionStatus.RUNNING;
        execution.startedAt = block.timestamp;

        emit ExecutionStarted(executionId, block.timestamp);
    }

    /**
     * @notice Complete an execution successfully
     */
    function completeExecution(bytes32 executionId, bytes32 resultHash) external nonReentrant {
        CronExecution storage execution = executions[executionId];
        if (execution.scheduledAt == 0) revert ExecutionNotFound();
        if (execution.executor != msg.sender) revert NotAssignedExecutor();

        CronSchedule storage schedule = schedules[execution.scheduleId];

        // Check timeout
        if (block.timestamp > execution.startedAt + schedule.timeoutSeconds) {
            execution.status = ExecutionStatus.TIMEOUT;
            schedule.failedRuns++;
            emit ExecutionFailed(executionId, "Execution timed out");
            return;
        }

        execution.status = ExecutionStatus.SUCCESS;
        execution.completedAt = block.timestamp;
        execution.resultHash = resultHash;

        schedule.totalRuns++;
        schedule.successfulRuns++;
        schedule.lastRunAt = block.timestamp;

        // Update node stats
        TriggerNode storage node = nodes[msg.sender];
        node.executionsCompleted++;

        // Pay reward
        if (schedule.rewardPerExecution > 0 && executionRewardPool >= schedule.rewardPerExecution) {
            executionRewardPool -= schedule.rewardPerExecution;
            (bool sent,) = msg.sender.call{value: schedule.rewardPerExecution}("");
            if (sent) {
                emit RewardPaid(msg.sender, schedule.rewardPerExecution);
            }
        }

        emit ExecutionCompleted(executionId, ExecutionStatus.SUCCESS, resultHash);
    }

    /**
     * @notice Mark execution as failed
     */
    function failExecution(bytes32 executionId, string calldata errorMessage) external {
        CronExecution storage execution = executions[executionId];
        if (execution.scheduledAt == 0) revert ExecutionNotFound();
        if (execution.executor != msg.sender) revert NotAssignedExecutor();

        CronSchedule storage schedule = schedules[execution.scheduleId];

        execution.status = ExecutionStatus.FAILED;
        execution.completedAt = block.timestamp;
        execution.errorMessage = errorMessage;

        schedule.totalRuns++;
        schedule.failedRuns++;
        schedule.lastRunAt = block.timestamp;

        // Check if too many failures
        if (schedule.failedRuns > schedule.successfulRuns && schedule.totalRuns > 5) {
            schedule.status = ScheduleStatus.ERROR;
        }

        // Update node stats
        TriggerNode storage node = nodes[msg.sender];
        node.executionsFailed++;

        emit ExecutionFailed(executionId, errorMessage);
    }

    // =========================================================================
    // Node Management
    // =========================================================================

    /**
     * @notice Register as a trigger node
     */
    function registerNode(bytes32 nodeId) external payable nonReentrant {
        if (msg.value < minNodeStake) revert InsufficientStake();

        if (nodes[msg.sender].registeredAt == 0) {
            nodeList.push(msg.sender);
        }

        nodes[msg.sender] = TriggerNode({
            operator: msg.sender,
            nodeId: nodeId,
            stakedAmount: msg.value,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            executionsCompleted: 0,
            executionsFailed: 0,
            active: true
        });

        emit NodeRegistered(msg.sender, nodeId, msg.value);
    }

    /**
     * @notice Node heartbeat
     */
    function heartbeat() external {
        TriggerNode storage node = nodes[msg.sender];
        if (node.registeredAt == 0) revert NodeNotRegistered();

        node.lastHeartbeat = block.timestamp;
        
        if (!node.active) {
            node.active = true;
        }
    }

    /**
     * @notice Deactivate and withdraw stake
     */
    function deactivateNode() external nonReentrant {
        TriggerNode storage node = nodes[msg.sender];
        if (node.registeredAt == 0) revert NodeNotRegistered();

        node.active = false;

        uint256 stake = node.stakedAmount;
        node.stakedAmount = 0;

        if (stake > 0) {
            (bool sent,) = msg.sender.call{value: stake}("");
            require(sent, "Transfer failed");
        }

        emit NodeDeactivated(msg.sender);
    }

    // =========================================================================
    // Views
    // =========================================================================

    function getSchedule(bytes32 scheduleId) external view returns (CronSchedule memory) {
        return schedules[scheduleId];
    }

    function getExecution(bytes32 executionId) external view returns (CronExecution memory) {
        return executions[executionId];
    }

    function getOwnerSchedules(address owner) external view returns (bytes32[] memory) {
        return ownerSchedules[owner];
    }

    function getWorkerSchedules(bytes32 workerId) external view returns (bytes32[] memory) {
        return workerSchedules[workerId];
    }

    function getScheduleExecutions(bytes32 scheduleId) external view returns (bytes32[] memory) {
        return scheduleExecutions[scheduleId];
    }

    function getNode(address operator) external view returns (TriggerNode memory) {
        return nodes[operator];
    }

    function getActiveNodes() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].active && block.timestamp - nodes[nodeList[i]].lastHeartbeat < 5 minutes) {
                count++;
            }
        }

        address[] memory activeNodes = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].active && block.timestamp - nodes[nodeList[i]].lastHeartbeat < 5 minutes) {
                activeNodes[idx++] = nodeList[i];
            }
        }

        return activeNodes;
    }

    function getTotalSchedules() external view returns (uint256) {
        return allScheduleIds.length;
    }

    // =========================================================================
    // Admin
    // =========================================================================

    function setMinNodeStake(uint256 stake) external onlyOwner {
        minNodeStake = stake;
    }

    function setMaxExecutionTime(uint256 time) external onlyOwner {
        maxExecutionTime = time;
    }

    function fundRewardPool() external payable {
        executionRewardPool += msg.value;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _validateCronExpression(string calldata expr) internal pure returns (bool) {
        bytes memory b = bytes(expr);
        if (b.length < 9 || b.length > 100) return false;

        // Basic validation: should have 5 space-separated fields
        uint256 spaces = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == " ") spaces++;
        }

        return spaces == 4;
    }

    // =========================================================================
    // Receive
    // =========================================================================

    receive() external payable {
        executionRewardPool += msg.value;
    }
}

