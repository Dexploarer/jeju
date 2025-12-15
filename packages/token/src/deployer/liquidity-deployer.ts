/**
 * Liquidity Deployer
 * Adds liquidity to DEXes on supported chains
 */

import {
  type Address,
  type Hex,
  type PublicClient,
  parseAbi,
  type WalletClient,
} from 'viem';
import type { ChainDeployment, LiquidityAllocation } from '../types';

// Uniswap V2 Router ABI (used by most DEXes)
const UNISWAP_V2_ROUTER_ABI = parseAbi([
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  'function WETH() external view returns (address)',
]);

// ERC20 ABI for approvals
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

export interface LiquidityDeploymentParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  tokenAddress: Address;
  routerAddress: Address;
  tokenAmount: bigint;
  ethAmount: bigint;
  recipient: Address;
  deadline?: bigint;
}

export interface LiquidityDeploymentResult {
  txHash: Hex;
  lpTokenAmount: bigint;
  tokenAmountUsed: bigint;
  ethAmountUsed: bigint;
}

/**
 * Add liquidity to a Uniswap V2-style DEX
 */
export async function addLiquidityV2(
  params: LiquidityDeploymentParams
): Promise<LiquidityDeploymentResult> {
  const {
    publicClient,
    walletClient,
    tokenAddress,
    routerAddress,
    tokenAmount,
    ethAmount,
    recipient,
  } = params;

  const account = walletClient.account;
  if (!account) throw new Error('WalletClient must have an account');

  // Default deadline: 20 minutes from now
  const deadline =
    params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 1200);

  // 1. Approve router to spend tokens
  console.log(
    `Approving router ${routerAddress} to spend ${tokenAmount} tokens...`
  );
  const approvalHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [routerAddress, tokenAmount],
    chain: walletClient.chain ?? null,
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  console.log(`Approval confirmed: ${approvalHash}`);

  // 2. Add liquidity
  console.log(`Adding liquidity: ${tokenAmount} tokens + ${ethAmount} ETH...`);

  // Allow 1% slippage
  const minTokenAmount = (tokenAmount * 99n) / 100n;
  const minEthAmount = (ethAmount * 99n) / 100n;

  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: 'addLiquidityETH',
    args: [
      tokenAddress,
      tokenAmount,
      minTokenAmount,
      minEthAmount,
      recipient,
      deadline,
    ],
    value: ethAmount,
    chain: walletClient.chain ?? null,
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Add liquidity failed: ${txHash}`);
  }

  console.log(`Liquidity added: ${txHash}`);

  // Parse the logs to get the actual amounts (simplified)
  return {
    txHash,
    lpTokenAmount: 0n, // Would need to parse logs
    tokenAmountUsed: tokenAmount,
    ethAmountUsed: ethAmount,
  };
}

/**
 * Deploy liquidity for a chain
 */
export async function deployLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  deployment: ChainDeployment,
  allocation: LiquidityAllocation,
  dexRouter: Address,
  ethAmount: bigint
): Promise<Hex | null> {
  const account = walletClient.account;
  if (!account) throw new Error('WalletClient must have an account');

  // Get token balance
  const tokenBalance = await publicClient.readContract({
    address: deployment.token as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  if (tokenBalance === 0n) {
    console.log(`No tokens to add as liquidity on chain ${deployment.chainId}`);
    return null;
  }

  // Calculate token amount based on allocation percentage
  const tokenAmount = (tokenBalance * BigInt(allocation.percentage)) / 100n;

  console.log(`Deploying liquidity on ${allocation.dex}:`);
  console.log(`  Tokens: ${tokenAmount}`);
  console.log(`  ETH: ${ethAmount}`);
  console.log(`  Router: ${dexRouter}`);

  try {
    const result = await addLiquidityV2({
      publicClient,
      walletClient,
      tokenAddress: deployment.token as Address,
      routerAddress: dexRouter,
      tokenAmount,
      ethAmount,
      recipient: account.address,
    });

    return result.txHash;
  } catch (error) {
    console.error(`Failed to add liquidity:`, error);
    throw error;
  }
}

/**
 * Lock LP tokens (placeholder - requires LP locker contract)
 */
export async function lockLPTokens(
  _walletClient: WalletClient,
  _lpTokenAddress: Address,
  _amount: bigint,
  _lockDuration: number
): Promise<void> {
  // LP locking would require deploying a locker contract
  // or using an existing service like Team Finance or Unicrypt
  console.log('LP token locking requires a locker contract');
  console.log('Consider using Team Finance or Unicrypt for production');
}
