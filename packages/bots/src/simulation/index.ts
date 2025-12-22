/**
 * Simulation & Backtesting Framework
 *
 * Provides:
 * - Historical price simulation
 * - Strategy backtesting
 * - Risk metrics calculation
 * - Performance attribution
 * - Stress testing (crashes, depegs)
 * - Flash loan integration testing
 * - MEV competition simulation
 * - Multi-chain opportunity scanning
 */

// Core simulation
export { type BacktestConfig, Backtester } from './backtester'
export { HistoricalDataFetcher, type PriceCandle } from './data-fetcher'
// Flash loan testing
export {
  type FlashLoanTestConfig,
  FlashLoanTester,
  type FlashLoanTestResult,
  runFlashLoanTests,
} from './flashloan-tests'
// MEV competition simulation
export {
  type BlockBuilder,
  type CompetitionSimResult,
  MEVCompetitionSimulator,
  type MEVSearcher,
  type MEVStrategy,
  runMEVCompetitionSim,
} from './mev-competition'
// Multi-chain scanning
export {
  type ChainPrice,
  type CrossChainOpportunity,
  createScanner,
  MultiChainScanner,
  type SameChainOpportunity,
  type ScannerConfig,
  type ScanResult,
} from './multi-chain-scanner'
// Multi-source data fetching
export {
  type DataSourceConfig,
  type GasDataPoint,
  type MEVOpportunity,
  MultiSourceFetcher,
  type PoolStateSnapshot,
  STRESS_SCENARIOS,
  type StressTestScenario,
  SUPPORTED_CHAINS,
} from './multi-source-fetcher'
export { PortfolioSimulator } from './portfolio-simulator'
export {
  type DrawdownAnalysis,
  RiskAnalyzer,
  type RiskMetrics,
} from './risk-analyzer'
// Stress testing
export {
  runStressTests,
  type StressTestConfig,
  type StressTestResult,
  StressTestRunner,
} from './stress-tests'

// Full test pipeline
export {
  TestPipeline,
  type TestPipelineConfig,
  type TestPipelineResult,
} from './test-runner'
