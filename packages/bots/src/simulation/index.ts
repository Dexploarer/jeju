/**
 * Simulation & Backtesting Framework
 */

export { type BacktestConfig, Backtester } from './backtester'
export { HistoricalDataFetcher, type PriceCandle } from './data-fetcher'
export {
  type FlashLoanTestConfig,
  FlashLoanTester,
  type FlashLoanTestResult,
  runFlashLoanTests,
} from './flashloan-tests'
export {
  type BlockBuilder,
  type CompetitionSimResult,
  MEVCompetitionSimulator,
  type MEVSearcher,
  type MEVStrategy,
  runMEVCompetitionSim,
} from './mev-competition'
export {
  type ChainPrice,
  type CrossChainOpportunity,
  createScanner,
  MultiChainScanner,
  type SameChainOpportunity,
  type ScannerConfig,
  type ScanResult,
} from './multi-chain-scanner'
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
export {
  runStressTests,
  type StressTestConfig,
  type StressTestResult,
  StressTestRunner,
} from './stress-tests'
export {
  TestPipeline,
  type TestPipelineConfig,
  type TestPipelineResult,
} from './test-runner'
