// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DistributedTrainingCoordinator} from "../src/training/DistributedTrainingCoordinator.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

contract DeployTraining is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock token for rewards with initial supply
        MockERC20 token = new MockERC20("JejuTrainingReward", "JTR", 18, 1_000_000 ether);
        console.log("Mock Token deployed:", address(token));

        // Deploy coordinator
        DistributedTrainingCoordinator coordinator = new DistributedTrainingCoordinator(address(token));
        console.log("DistributedTrainingCoordinator deployed:", address(coordinator));

        vm.stopBroadcast();
    }
}

