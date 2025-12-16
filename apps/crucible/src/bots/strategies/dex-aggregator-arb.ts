/**
 * Cross-DEX Aggregator Arbitrage Strategy
 *
 * Captures price inefficiencies between DEX aggregators and direct pools:
 * - Compare prices between 1inch, Paraswap, 0x, Cowswap
 * - Compare aggregator prices vs direct Uniswap/Sushi pools
 * - Execute atomic arbitrage via flash loans
 *
 * Revenue Model:
 * - Pure price difference capture (0.1-0.5% typical)
 * - No capital required with flash loans
 * - Only pay gas + flash loan fee (0.09%)
 */

import { EventEmitter } from 'events';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  parseUnits,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { mainnet, arbitrum, optimism, base } from 'viem/chains';

// ============ Configuration ============

const CHAIN_CONFIGS = {
  1: { chain: mainnet, name: 'Ethereum' },
  42161: { chain: arbitrum, name: 'Arbitrum' },
  10: { chain: optimism, name: 'Optimism' },
  8453: { chain: base, name: 'Base' },
} as const;

// DEX Aggregator APIs
const AGGREGATORS = {
  oneinch: {
    name: '1inch',
    quoteUrl: 'https://api.1inch.dev/swap/v6.0',
    requiresApiKey: true,
  },
  paraswap: {
    name: 'Paraswap',
    quoteUrl: 'https://apiv5.paraswap.io',
    requiresApiKey: false,
  },
  zerox: {
    name: '0x',
    quoteUrl: 'https://api.0x.org/swap/v1',
    requiresApiKey: true,
  },
  cowswap: {
    name: 'Cowswap',
    quoteUrl: 'https://api.cow.fi/mainnet/api/v1',
    requiresApiKey: false,
  },
} as const;

// Uniswap V3 quoter addresses
const UNISWAP_QUOTER: Record<number, Address> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
};

// Aave V3 pool addresses (for flash loans)
const AAVE_POOL: Record<number, Address> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
};

// Common token pairs to monitor
const TOKEN_PAIRS: Array<{ tokenA: string; tokenB: string }> = [
  { tokenA: 'WETH', tokenB: 'USDC' },
  { tokenA: 'WETH', tokenB: 'USDT' },
  { tokenA: 'WBTC', tokenB: 'WETH' },
  { tokenA: 'WETH', tokenB: 'DAI' },
  { tokenA: 'LINK', tokenB: 'WETH' },
  { tokenA: 'UNI', tokenB: 'WETH' },
  { tokenA: 'ARB', tokenB: 'WETH' },
  { tokenA: 'OP', tokenB: 'WETH' },
];

// Token addresses by chain
const TOKENS: Record<string, Record<number, Address>> = {
  WETH: {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    10: '0x4200000000000000000000000000000000000006',
    8453: '0x4200000000000000000000000000000000000006',
  },
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  DAI: {
    1: '0x6B175474E89094C44Da98b954EescdeCB5BB',
    42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  },
  WBTC: {
    1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    42161: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  },
  LINK: {
    1: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    42161: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
  },
  UNI: {
    1: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    42161: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
  },
  ARB: {
    42161: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
  OP: {
    10: '0x4200000000000000000000000000000000000042',
  },
};

// Minimum profit thresholds
const MIN_PROFIT_BPS = 20; // 0.2% minimum
const MIN_PROFIT_USD = 5; // $5 minimum

// ============ Types ============

interface AggregatorQuote {
  aggregator: string;
  inputToken: Address;
  outputToken: Address;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpactBps: number;
  gasEstimate: bigint;
  txData?: Hex;
}

interface DexArbOpportunity {
  id: string;
  chainId: number;
  tokenA: string;
  tokenB: string;
  buyFrom: string;
  sellTo: string;
  buyQuote: AggregatorQuote;
  sellQuote: AggregatorQuote;
  profitBps: number;
  profitUsd: number;
  gasEstimate: bigint;
  netProfitUsd: number;
  expiresAt: number;
}

interface StrategyStats {
  opportunitiesDetected: number;
  tradesExecuted: number;
  totalProfitUsd: number;
  avgProfitBps: number;
  successRate: number;
}

// ============ Strategy Class ============

export class DexAggregatorArbStrategy extends EventEmitter {
  private config: {
    privateKey: Hex;
    rpcUrls: Record<number, string>;
    oneInchApiKey?: string;
    zeroXApiKey?: string;
    minProfitBps: number;
    minProfitUsd: number;
    tradeSize: bigint;
  };

  private account: PrivateKeyAccount;
  private clients: Map<number, {
    public: ReturnType<typeof createPublicClient>;
    wallet: ReturnType<typeof createWalletClient>;
  }> = new Map();

  private opportunities: Map<string, DexArbOpportunity> = new Map();
  private running = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  private stats: StrategyStats = {
    opportunitiesDetected: 0,
    tradesExecuted: 0,
    totalProfitUsd: 0,
    avgProfitBps: 0,
    successRate: 0,
  };

  constructor(config: {
    privateKey: Hex;
    rpcUrls: Record<number, string>;
    oneInchApiKey?: string;
    zeroXApiKey?: string;
    minProfitBps?: number;
    minProfitUsd?: number;
    tradeSize?: bigint;
  }) {
    super();
    this.config = {
      privateKey: config.privateKey,
      rpcUrls: config.rpcUrls,
      oneInchApiKey: config.oneInchApiKey,
      zeroXApiKey: config.zeroXApiKey,
      minProfitBps: config.minProfitBps ?? MIN_PROFIT_BPS,
      minProfitUsd: config.minProfitUsd ?? MIN_PROFIT_USD,
      tradeSize: config.tradeSize ?? parseUnits('10000', 6), // $10k default
    };

    this.account = privateKeyToAccount(config.privateKey);

    // Initialize clients
    for (const [chainIdStr, rpcUrl] of Object.entries(config.rpcUrls)) {
      const chainId = Number(chainIdStr);
      const chainConfig = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
      if (!chainConfig) continue;

      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(rpcUrl),
      });

      const walletClient = createWalletClient({
        account: this.account,
        chain: chainConfig.chain,
        transport: http(rpcUrl),
      });

      this.clients.set(chainId, { public: publicClient, wallet: walletClient });
    }
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing DEX Aggregator Arbitrage Strategy...');
    console.log(`   Wallet: ${this.account.address}`);
    console.log(`   Chains: ${Array.from(this.clients.keys()).join(', ')}`);
    console.log(`   Token pairs: ${TOKEN_PAIRS.length}`);
    console.log(`   Min profit: ${this.config.minProfitBps} bps ($${this.config.minProfitUsd})`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    console.log('   Starting DEX aggregator monitoring...');

    // Poll for opportunities every 10 seconds
    this.pollInterval = setInterval(() => this.scanForOpportunities(), 10000);

    // Initial scan
    this.scanForOpportunities();
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getOpportunities(): DexArbOpportunity[] {
    return Array.from(this.opportunities.values())
      .filter(o => o.expiresAt > Date.now())
      .sort((a, b) => b.netProfitUsd - a.netProfitUsd);
  }

  getStats(): StrategyStats {
    return { ...this.stats };
  }

  // ============ Core Logic ============

  private async scanForOpportunities(): Promise<void> {
    for (const chainId of this.clients.keys()) {
      for (const pair of TOKEN_PAIRS) {
        const tokenA = TOKENS[pair.tokenA]?.[chainId];
        const tokenB = TOKENS[pair.tokenB]?.[chainId];

        if (!tokenA || !tokenB) continue;

        await this.checkPairForArbitrage(chainId, pair.tokenA, pair.tokenB, tokenA, tokenB);
      }
    }
  }

  private async checkPairForArbitrage(
    chainId: number,
    symbolA: string,
    symbolB: string,
    tokenA: Address,
    tokenB: Address
  ): Promise<void> {
    const amount = this.config.tradeSize;

    // Get quotes from all aggregators for A -> B
    const forwardQuotes = await this.getAllQuotes(chainId, tokenA, tokenB, amount);

    // Get quotes from all aggregators for B -> A
    // Use best forward output as input for reverse
    const bestForward = forwardQuotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
    if (!bestForward) return;

    const reverseQuotes = await this.getAllQuotes(chainId, tokenB, tokenA, bestForward.outputAmount);

    // Find best arbitrage path
    const bestReverse = reverseQuotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
    if (!bestReverse) return;

    // Calculate profit
    const profit = bestReverse.outputAmount - amount;
    const profitBps = Number(profit * 10000n / amount);

    // Estimate gas cost in USD (rough)
    const gasPrice = await this.clients.get(chainId)?.public.getGasPrice() || 0n;
    const totalGas = bestForward.gasEstimate + bestReverse.gasEstimate;
    const gasCostWei = gasPrice * totalGas;
    const gasCostUsd = Number(gasCostWei) / 1e18 * 2000; // Assume $2000 ETH

    // Calculate net profit
    const profitUsd = Number(profit) / 1e6; // Assuming 6 decimals
    const netProfitUsd = profitUsd - gasCostUsd;

    if (profitBps >= this.config.minProfitBps && netProfitUsd >= this.config.minProfitUsd) {
      const opportunity: DexArbOpportunity = {
        id: `dex-arb-${chainId}-${symbolA}-${symbolB}-${Date.now()}`,
        chainId,
        tokenA: symbolA,
        tokenB: symbolB,
        buyFrom: bestForward.aggregator,
        sellTo: bestReverse.aggregator,
        buyQuote: bestForward,
        sellQuote: bestReverse,
        profitBps,
        profitUsd,
        gasEstimate: totalGas,
        netProfitUsd,
        expiresAt: Date.now() + 30000, // 30 second expiry
      };

      this.opportunities.set(opportunity.id, opportunity);
      this.stats.opportunitiesDetected++;

      console.log(
        `🔄 DEX arb: ${symbolA}/${symbolB} on chain ${chainId} | ` +
        `${bestForward.aggregator} → ${bestReverse.aggregator} | ` +
        `+${profitBps}bps ($${netProfitUsd.toFixed(2)})`
      );

      this.emit('opportunity', opportunity);
    }
  }

  private async getAllQuotes(
    chainId: number,
    inputToken: Address,
    outputToken: Address,
    amount: bigint
  ): Promise<AggregatorQuote[]> {
    const quotes: AggregatorQuote[] = [];

    // Get Uniswap direct quote
    const uniQuote = await this.getUniswapQuote(chainId, inputToken, outputToken, amount);
    if (uniQuote) quotes.push(uniQuote);

    // Get 1inch quote
    if (this.config.oneInchApiKey) {
      const oneInchQuote = await this.get1inchQuote(chainId, inputToken, outputToken, amount);
      if (oneInchQuote) quotes.push(oneInchQuote);
    }

    // Get Paraswap quote
    const paraQuote = await this.getParaswapQuote(chainId, inputToken, outputToken, amount);
    if (paraQuote) quotes.push(paraQuote);

    return quotes;
  }

  private async getUniswapQuote(
    chainId: number,
    inputToken: Address,
    outputToken: Address,
    amount: bigint
  ): Promise<AggregatorQuote | null> {
    const clients = this.clients.get(chainId);
    if (!clients) return null;

    const quoterAddress = UNISWAP_QUOTER[chainId];
    if (!quoterAddress) return null;

    const QUOTER_ABI = parseAbi([
      'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
    ]);

    const result = await clients.public.simulateContract({
      address: quoterAddress,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: amount,
        fee: 3000, // 0.3% pool
        sqrtPriceLimitX96: 0n,
      }],
    });

    return {
      aggregator: 'uniswap',
      inputToken,
      outputToken,
      inputAmount: amount,
      outputAmount: result.result[0],
      priceImpactBps: 10,
      gasEstimate: 150000n,
    };
  }

  private async get1inchQuote(
    chainId: number,
    inputToken: Address,
    outputToken: Address,
    amount: bigint
  ): Promise<AggregatorQuote | null> {
    const url = `${AGGREGATORS.oneinch.quoteUrl}/${chainId}/quote?src=${inputToken}&dst=${outputToken}&amount=${amount}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.oneInchApiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      dstAmount: string;
      gas: number;
    };

    return {
      aggregator: '1inch',
      inputToken,
      outputToken,
      inputAmount: amount,
      outputAmount: BigInt(data.dstAmount),
      priceImpactBps: 10,
      gasEstimate: BigInt(data.gas),
    };
  }

  private async getParaswapQuote(
    chainId: number,
    inputToken: Address,
    outputToken: Address,
    amount: bigint
  ): Promise<AggregatorQuote | null> {
    const url = `${AGGREGATORS.paraswap.quoteUrl}/prices?srcToken=${inputToken}&destToken=${outputToken}&amount=${amount}&network=${chainId}&side=SELL`;

    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json() as {
      priceRoute: {
        destAmount: string;
        gasCost: string;
      };
    };

    return {
      aggregator: 'paraswap',
      inputToken,
      outputToken,
      inputAmount: amount,
      outputAmount: BigInt(data.priceRoute.destAmount),
      priceImpactBps: 10,
      gasEstimate: BigInt(data.priceRoute.gasCost),
    };
  }

  // ============ Execution ============

  async executeArbitrage(opportunity: DexArbOpportunity): Promise<{
    success: boolean;
    txHash?: string;
    profit?: number;
    error?: string;
  }> {
    const clients = this.clients.get(opportunity.chainId);
    if (!clients) {
      return { success: false, error: 'Chain not configured' };
    }

    console.log(`🔄 Executing DEX arb: ${opportunity.id}`);

    const aavePool = AAVE_POOL[opportunity.chainId];
    if (!aavePool) {
      return { success: false, error: 'Flash loan not available on this chain' };
    }

    const tokenA = TOKENS[opportunity.tokenA]?.[opportunity.chainId];
    if (!tokenA) {
      return { success: false, error: `Token ${opportunity.tokenA} not found on chain ${opportunity.chainId}` };
    }

    console.log(`   Flash loan: ${formatUnits(opportunity.buyQuote.inputAmount, 6)} ${opportunity.tokenA}`);
    console.log(`   Buy on ${opportunity.buyFrom}: ${opportunity.tokenA} → ${opportunity.tokenB}`);
    console.log(`   Sell on ${opportunity.sellTo}: ${opportunity.tokenB} → ${opportunity.tokenA}`);
    console.log(`   Expected profit: $${opportunity.netProfitUsd.toFixed(2)}`);

    // Execute flash loan with callback
    const flashLoanAbi = parseAbi([
      'function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external',
    ]);

    // Encode the arbitrage params for the callback
    const arbParams = this.encodeArbParams(opportunity);

    // Get a deployed arbitrage executor contract address
    const executorAddress = this.getExecutorAddress(opportunity.chainId);
    if (!executorAddress) {
      return { success: false, error: 'No executor contract deployed on this chain' };
    }

    // Execute flash loan
    const flashLoanData = encodeFunctionData({
      abi: flashLoanAbi,
      functionName: 'flashLoanSimple',
      args: [
        executorAddress,
        tokenA,
        opportunity.buyQuote.inputAmount,
        arbParams,
        0, // referral code
      ],
    });

    const hash = await clients.wallet.sendTransaction({
      to: aavePool,
      data: flashLoanData,
    });

    console.log(`   Tx submitted: ${hash}`);

    const receipt = await clients.public.waitForTransactionReceipt({ hash });

    if (receipt.status === 'reverted') {
      return { success: false, error: 'Transaction reverted', txHash: hash };
    }

    this.stats.tradesExecuted++;
    this.stats.totalProfitUsd += opportunity.netProfitUsd;

    console.log(`   ✓ Arbitrage executed successfully`);

    return {
      success: true,
      txHash: hash,
      profit: opportunity.netProfitUsd,
    };
  }

  private encodeArbParams(opportunity: DexArbOpportunity): Hex {
    // Encode: buyRouter, buyData, sellRouter, sellData, minProfit
    const buyRouter = this.getRouterAddress(opportunity.buyFrom, opportunity.chainId);
    const sellRouter = this.getRouterAddress(opportunity.sellTo, opportunity.chainId);

    // ABI encode the params
    const params = encodeFunctionData({
      abi: parseAbi(['function execute(address buyRouter, bytes buyData, address sellRouter, bytes sellData, uint256 minProfit)']),
      functionName: 'execute',
      args: [
        buyRouter,
        opportunity.buyQuote.txData || '0x',
        sellRouter,
        opportunity.sellQuote.txData || '0x',
        BigInt(Math.floor(opportunity.netProfitUsd * 1e6)), // min profit in USDC decimals
      ],
    });

    return params;
  }

  private getRouterAddress(aggregator: string, chainId: number): Address {
    const routers: Record<string, Record<number, Address>> = {
      uniswap: {
        1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        8453: '0x2626664c2603336E57B271c5C0b26F421741e481',
      },
      '1inch': {
        1: '0x1111111254EEB25477B68fb85Ed929f73A960582',
        42161: '0x1111111254EEB25477B68fb85Ed929f73A960582',
        10: '0x1111111254EEB25477B68fb85Ed929f73A960582',
        8453: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      },
      paraswap: {
        1: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        42161: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        10: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        8453: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
      },
    };

    return routers[aggregator]?.[chainId] || '0x0000000000000000000000000000000000000000' as Address;
  }

  private getExecutorAddress(chainId: number): Address | null {
    // These would be pre-deployed arbitrage executor contracts
    const executors: Record<number, Address> = {
      1: '0x0000000000000000000000000000000000000000' as Address, // Deploy needed
      42161: '0x0000000000000000000000000000000000000000' as Address,
      10: '0x0000000000000000000000000000000000000000' as Address,
      8453: '0x0000000000000000000000000000000000000000' as Address,
    };

    const addr = executors[chainId];
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    return addr;
  }
}

// ============ Factory ============

export function createDexAggregatorArbStrategy(config: {
  privateKey: Hex;
  rpcUrls: Record<number, string>;
  oneInchApiKey?: string;
  zeroXApiKey?: string;
  minProfitBps?: number;
  minProfitUsd?: number;
}): DexAggregatorArbStrategy {
  return new DexAggregatorArbStrategy(config);
}

