// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/sqlit/SQLitIdentityRegistry.sol";

/**
 * @title DeploySQLitRegistry
 * @notice Deploys the SQLitIdentityRegistry for on-chain node identity verification
 * @dev The registry enforces CovenantSQL's cryptographic identity algorithm:
 *      NodeID = reverse(sha256(blake2b-512(publicKey || nonce)))
 *
 * Usage:
 *   forge script script/DeploySQLitRegistry.s.sol:DeploySQLitRegistry \
 *     --rpc-url $JEJU_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 *
 * Environment Variables:
 *   - STAKING_TOKEN_ADDRESS: JEJU token address (required)
 *   - REGISTRY_OWNER: Owner address for admin functions (defaults to deployer)
 */
contract DeploySQLitRegistry is Script {
    function run() external {
        address deployer = msg.sender;

        // Get staking token (JEJU) - required
        address stakingToken = vm.envAddress("STAKING_TOKEN_ADDRESS");
        require(stakingToken != address(0), "STAKING_TOKEN_ADDRESS required");

        // Registry owner (defaults to deployer)
        address registryOwner = vm.envOr("REGISTRY_OWNER", deployer);

        console.log("==================================================");
        console.log("Deploying SQLit Identity Registry");
        console.log("==================================================");
        console.log("Deployer:", deployer);
        console.log("Staking Token (JEJU):", stakingToken);
        console.log("Registry Owner:", registryOwner);
        console.log("");

        vm.startBroadcast();

        // Deploy the registry
        SQLitIdentityRegistry registry = new SQLitIdentityRegistry(
            stakingToken,
            registryOwner
        );

        console.log("SQLitIdentityRegistry deployed:", address(registry));
        console.log("");

        // Log configuration
        console.log("Configuration:");
        console.log("  MIN_BP_STAKE:", registry.MIN_BP_STAKE() / 1e18, "JEJU");
        console.log("  MIN_MINER_STAKE:", registry.MIN_MINER_STAKE() / 1e18, "JEJU");
        console.log("  MIN_NODE_ID_DIFFICULTY:", registry.MIN_NODE_ID_DIFFICULTY(), "bits");
        console.log("");

        vm.stopBroadcast();

        console.log("==================================================");
        console.log("Deployment Complete!");
        console.log("==================================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Update SQLIT_REGISTRY_ADDRESS in helm values");
        console.log("2. Approve JEJU tokens for staking");
        console.log("3. Register node identities via registerIdentity()");
        console.log("");
        console.log("Registry address:", address(registry));
    }
}

/**
 * @title RegisterSQLitNode
 * @notice Script to register a SQLit node identity on-chain
 * @dev Use after generating identity with sqlit-identity service
 *
 * Usage:
 *   forge script script/DeploySQLitRegistry.s.sol:RegisterSQLitNode \
 *     --rpc-url $JEJU_RPC_URL \
 *     --private-key $OPERATOR_PRIVATE_KEY \
 *     --broadcast
 *
 * Environment Variables:
 *   - SQLIT_REGISTRY_ADDRESS: Registry contract address
 *   - NODE_PUBLIC_KEY: 33-byte compressed public key (hex, no 0x)
 *   - NODE_ID: 32-byte node ID (hex, no 0x)
 *   - NONCE_A, NONCE_B, NONCE_C, NONCE_D: Nonce components
 *   - NODE_ENDPOINT: Network endpoint (e.g., "sqlit-0.sqlit-headless:4661")
 *   - NODE_ROLE: "bp" for block producer, "miner" for miner
 *   - STAKE_AMOUNT: Amount to stake in wei
 */
contract RegisterSQLitNode is Script {
    function run() external {
        address operator = msg.sender;

        // Get registry address
        address registryAddr = vm.envAddress("SQLIT_REGISTRY_ADDRESS");
        SQLitIdentityRegistry registry = SQLitIdentityRegistry(registryAddr);

        // Get node identity
        bytes memory publicKey = vm.envBytes("NODE_PUBLIC_KEY");
        bytes32 nodeId = vm.envBytes32("NODE_ID");

        SQLitIdentityRegistry.Nonce memory nonce = SQLitIdentityRegistry.Nonce({
            a: uint64(vm.envUint("NONCE_A")),
            b: uint64(vm.envUint("NONCE_B")),
            c: uint64(vm.envUint("NONCE_C")),
            d: uint64(vm.envUint("NONCE_D"))
        });

        string memory endpoint = vm.envString("NODE_ENDPOINT");
        string memory roleStr = vm.envString("NODE_ROLE");
        uint256 stakeAmount = vm.envUint("STAKE_AMOUNT");

        SQLitIdentityRegistry.NodeRole role = keccak256(bytes(roleStr)) == keccak256(bytes("bp"))
            ? SQLitIdentityRegistry.NodeRole.BLOCK_PRODUCER
            : SQLitIdentityRegistry.NodeRole.MINER;

        console.log("==================================================");
        console.log("Registering SQLit Node Identity");
        console.log("==================================================");
        console.log("Operator:", operator);
        console.log("Registry:", registryAddr);
        console.log("Node ID:", vm.toString(nodeId));
        console.log("Endpoint:", endpoint);
        console.log("Role:", roleStr);
        console.log("Stake:", stakeAmount / 1e18, "JEJU");
        console.log("");

        vm.startBroadcast();

        // Approve staking token
        IERC20 stakingToken = registry.stakingToken();
        stakingToken.approve(registryAddr, stakeAmount);
        console.log("Approved staking token");

        // Register identity
        registry.registerIdentity(
            publicKey,
            nonce,
            nodeId,
            role,
            endpoint,
            stakeAmount
        );

        console.log("Node registered successfully!");

        vm.stopBroadcast();

        // Verify registration
        SQLitIdentityRegistry.NodeIdentity memory identity = registry.getIdentity(nodeId);
        console.log("");
        console.log("Verification:");
        console.log("  Status:", uint8(identity.status));
        console.log("  Staked:", identity.stakedAmount / 1e18, "JEJU");
        console.log("  Registered at:", identity.registeredAt);
    }
}
