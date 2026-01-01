// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockJEJU} from "../src/tokens/MockJEJU.sol";
import {ManualPriceOracle} from "../src/oracle/ManualPriceOracle.sol";
import {PaymasterFactory} from "../src/paymaster/PaymasterFactory.sol";
import {TokenRegistry} from "../src/paymaster/TokenRegistry.sol";
import {LiquidityPaymaster} from "../src/paymaster/LiquidityPaymaster.sol";
import {LiquidityVault} from "../src/liquidity/LiquidityVault.sol";
import {FeeDistributorV2} from "../src/distributor/FeeDistributor.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {MockEntryPoint} from "../test/mocks/MockEntryPoint.sol";

/**
 * @title DeployPerTokenPaymaster
 * @notice Deploy paymaster infrastructure for a specific token
 * @dev Reads TOKEN_ADDRESS and ORACLE_ADDRESS from environment variables
 *
 * Usage:
 *   TOKEN_ADDRESS=0x... ORACLE_ADDRESS=0x... \
 *   forge script script/DeployPerTokenPaymaster.s.sol:DeployPerTokenPaymaster \
 *   --rpc-url <rpc> --private-key <key> --broadcast
 */
contract DeployPerTokenPaymaster is Script {
    // ERC-4337 EntryPoint (canonical address on most chains)
    address constant CANONICAL_ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    function run() external {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying Per-Token Paymaster Infrastructure");
        console2.log("Token:", tokenAddress);
        console2.log("Oracle:", oracleAddress);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Check if canonical EntryPoint exists, if not deploy MockEntryPoint for localnet
        address entryPointAddress = CANONICAL_ENTRY_POINT;
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(CANONICAL_ENTRY_POINT)
        }
        if (codeSize == 0) {
            console2.log("Canonical EntryPoint not found, deploying MockEntryPoint for localnet...");
            MockEntryPoint mockEntryPoint = new MockEntryPoint();
            entryPointAddress = address(mockEntryPoint);
            console2.log("MockEntryPoint deployed:", entryPointAddress);
        } else {
            console2.log("Using canonical EntryPoint:", entryPointAddress);
        }

        // 1. Deploy TokenRegistry (deployer is owner and treasury)
        TokenRegistry registry = new TokenRegistry(deployer, deployer);
        console2.log("TokenRegistry deployed:", address(registry));

        // 2. Set registration fee to 0 for testing (owner only)
        registry.setRegistrationFee(0);

        // 3. Register the token (min margin 0%, max margin 10%)
        registry.registerToken(tokenAddress, oracleAddress, 0, 1000);
        console2.log("Token registered in registry");

        // 4. Deploy PaymasterFactory with the appropriate EntryPoint
        PaymasterFactory factory = new PaymasterFactory(
            address(registry),
            entryPointAddress,
            oracleAddress,
            deployer
        );
        console2.log("PaymasterFactory deployed:", address(factory));

        // 5. Deploy paymaster for the token via factory
        // Fee margin of 10 = 1% (10/1000)
        (address paymaster, address vault, address distributor) = factory.deployPaymaster(
            tokenAddress,
            10, // 1% fee margin
            deployer // operator
        );

        console2.log("");
        console2.log("=== Per-Token Paymaster Deployment Complete ===");
        console2.log("EntryPoint:", entryPointAddress);
        console2.log("TokenRegistry:", address(registry));
        console2.log("PaymasterFactory:", address(factory));
        console2.log("LiquidityPaymaster:", paymaster);
        console2.log("LiquidityVault:", vault);
        console2.log("FeeDistributor:", distributor);
        console2.log("");

        vm.stopBroadcast();
    }
}
