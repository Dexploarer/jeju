# Chainlink Integration for Jeju Network

This directory contains configuration and documentation for integrating Chainlink services into Jeju Network.

## Overview

Jeju integrates with Chainlink in two ways:
1. **As a Consumer**: Using Chainlink data feeds, VRF, and oracles on other chains
2. **As a Provider**: Running our own VRF, Automation, and Oracle services on Jeju L2

## Services Available on Jeju

| Service | Status | Contract | Description |
|---------|--------|----------|-------------|
| VRF v2.5 | ✅ | `VRFCoordinatorV2_5` | Verifiable randomness for games, lotteries, NFTs |
| Automation | ✅ | `AutomationRegistry` | Decentralized smart contract automation |
| Oracle Router | ✅ | `OracleRouter` | Generic off-chain data requests |
| Governance | ✅ | `ChainlinkGovernance` | DAO control over all parameters |

## Quick Start

### 1. Using VRF (Randomness)

```solidity
import {VRFConsumerBaseV2_5} from "@jeju/contracts/chainlink/VRFCoordinatorV2_5.sol";

contract MyGame is VRFConsumerBaseV2_5 {
    constructor(address coordinator) VRFConsumerBaseV2_5(coordinator) {}
    
    function requestRandom() external returns (uint256 requestId) {
        return requestRandomWords(
            keyHash,      // See config for available keys
            subscriptionId,
            3,            // Confirmations
            100000,       // Callback gas limit
            1             // Number of words
        );
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        // Use randomWords[0]
    }
}
```

### 2. Using Automation (Keepers)

```solidity
import {IAutomationCompatible} from "@jeju/contracts/chainlink/AutomationRegistry.sol";

contract MyAutomated is IAutomationCompatible {
    function checkUpkeep(bytes calldata) external view returns (bool needed, bytes memory data) {
        needed = shouldExecute();
        data = "";
    }
    
    function performUpkeep(bytes calldata) external {
        doWork();
    }
}
```

### 3. Using Oracle Router (External Data)

```solidity
import {IOracleConsumer, OracleJobs} from "@jeju/contracts/chainlink/OracleRouter.sol";

contract MyConsumer is IOracleConsumer {
    function requestPrice() external payable {
        router.requestData{value: 0.001 ether}(
            OracleJobs.PRICE_FEED,
            abi.encode("ETH/USD"),
            address(this),
            this.oracleCallback.selector
        );
    }
    
    function oracleCallback(bytes32 requestId, bytes calldata response) external {
        uint256 price = abi.decode(response, (uint256));
    }
}
```

## LINK Staking

Jeju Network participates in Chainlink's LINK Staking v0.2 program.

### Staking Strategy

| Phase | LINK Amount | Purpose | Est. Annual Reward |
|-------|-------------|---------|-------------------|
| 1 (Current) | 15,000 | Community stake, earn rewards | ~712 LINK |
| 2 (Future) | 75,000 | Node operator qualification | ~3,562 LINK |

### How to Stake

1. **Prerequisites**
   - LINK tokens on Ethereum mainnet
   - ETH for gas (~$50-100 worth)
   - Private key with LINK balance

2. **Staking Commands**
   ```bash
   # Check current status
   bun run scripts/chainlink/stake.ts status
   
   # Stake LINK (max 15,000 for community)
   bun run scripts/chainlink/stake.ts stake --amount 15000
   
   # View rewards
   bun run scripts/chainlink/stake.ts status
   
   # Claim rewards (can be done anytime)
   bun run scripts/chainlink/stake.ts claim
   ```

3. **Unstaking**
   - 28-day unbonding period
   - 7-day claim window after unbonding
   ```bash
   bun run scripts/chainlink/stake.ts unstake --amount 5000
   # Wait 28 days...
   bun run scripts/chainlink/stake.ts status  # Check if claimable
   bun run scripts/chainlink/stake.ts claim   # Withdraw
   ```

### When to Stake

- **Best time**: When LINK price is low relative to your USD budget
- **Amount**: Start with 1,000-5,000 LINK to test, then increase to 15,000
- **Timeline**: Plan for long-term (6+ months) to benefit from compound rewards

### Staking Economics

```
Current Pool Size:    ~40,000,000 LINK
Annual Emission:      ~2,000,000 LINK
Base APY:             ~4.75%
Delegation APY:       ~0.25% (variable)

Example: 15,000 LINK stake
- Annual reward: ~750 LINK
- Monthly reward: ~62.5 LINK
- At $15/LINK: ~$11,250/year
```

## Infrastructure

### Running Chainlink Nodes

Jeju runs Chainlink nodes for:
1. VRF fulfillment on Jeju L2
2. Price feed aggregation
3. Automation/keeper execution
4. Cross-chain oracle jobs

**Deployment:**
```bash
kubectl apply -f packages/deployment/kubernetes/chainlink/
```

**Cost Estimates (per region):**
| Region | Monthly Cost | Latency to ETH |
|--------|--------------|----------------|
| us-east-1 | ~$150 | <50ms |
| eu-west-1 | ~$165 | <80ms |
| ap-northeast-1 | ~$180 | <120ms |

### Cost Optimization

1. **Spot Instances**: Use AWS spot instances with on-demand fallback
2. **Right-sizing**: Start with m5.large, scale based on load
3. **Multi-region**: Only needed for redundancy, not performance
4. **Storage**: Use gp3 EBS volumes (cheaper than gp2)

## Governance Integration

All Chainlink-related parameters are controlled by Jeju's DAO via Autocrat:

### Fee Parameters (DAO-controlled)

| Parameter | Default | Range | Contract |
|-----------|---------|-------|----------|
| VRF Premium | 0.5 LINK | 0.1-2.0 LINK | VRFCoordinatorV2_5 |
| Keeper Fee | 10% | 5-20% | AutomationRegistry |
| Oracle Fee | 10% | 5-20% | OracleRouter |

### Revenue Distribution

| Destination | Percentage | Purpose |
|-------------|------------|---------|
| Treasury | 70% | Protocol reserves |
| Operational | 20% | Node costs, gas |
| Community | 10% | Staker rewards |

### Changing Parameters

```solidity
// Via Autocrat governance proposal
chainlinkGovernance.propose(
    ProposalType.VRF_FEE_UPDATE,
    vrfCoordinator,
    abi.encodeWithSignature("setConfig(...)"),
    0,
    "Update VRF fees"
);
```

## File Reference

| File | Description |
|------|-------------|
| `feeds.json` | Chainlink price feed addresses for all chains |
| `staking.json` | LINK staking configuration and recommendations |
| `vrf.json` | VRF coordinator settings and key hashes |
| `automation.json` | Keeper/automation registry configuration |
| `nodes.json` | Chainlink node infrastructure settings |
| `index.ts` | TypeScript exports for config access |

## Useful Links

- [Chainlink Documentation](https://docs.chain.link/)
- [Chainlink Staking](https://staking.chain.link/)
- [VRF Subscription Manager](https://vrf.chain.link/)
- [Jeju Chainlink Dashboard](#) (internal)

## Support

- Jeju Discord: #chainlink-integration
- Chainlink Discord: discord.gg/chainlink

