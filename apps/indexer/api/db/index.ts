/**
 * Database module for Indexer
 *
 * Exports SQLit-based database utilities
 */

export {
  count,
  exec,
  find,
  findOne,
  getClient,
  getDatabaseId,
  getDB,
  getProcessorStatus,
  getTableName,
  initializeSchema,
  isAvailable,
  query,
  sql,
} from './client'

export { INDEX_DDL, SCHEMA_DDL, TABLE_NAMES, type TableName } from './schema'

// Export all database types
export type {
  Account,
  Block,
  ComputeProvider,
  ComputeRental,
  ContainerImage,
  Contract,
  CrossServiceRequest,
  DecodedEvent,
  JnsName,
  Log,
  MarketplaceStats,
  NodeStake,
  OracleDispute,
  OracleFeed,
  OracleOperator,
  OracleReport,
  OracleSubscription,
  RegisteredAgent,
  StorageDeal,
  StorageProvider,
  TagIndex,
  Token,
  TokenBalance,
  TokenTransfer,
  Trace,
  Transaction,
} from './types'

// Export enum constants
export {
  ComputeRentalStatus,
  ContractType,
  CrossServiceRequestStatus,
  OracleDisputeStatus,
  StorageDealStatus,
  TokenStandard,
  TransactionStatus,
} from './types'
