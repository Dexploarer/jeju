/**
 * SQLit Schema for Indexer
 *
 * Defines all tables for SQLit database
 * Based on TypeORM entities in src/model/generated/
 */

// Core tables DDL for SQLit
export const SCHEMA_DDL = [
  // Processor status tracking
  `CREATE TABLE IF NOT EXISTS _squid_processor_status (
    id INTEGER PRIMARY KEY,
    height INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  )`,

  // Block table
  `CREATE TABLE IF NOT EXISTS block (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    transaction_count INTEGER NOT NULL,
    gas_used TEXT NOT NULL,
    gas_limit TEXT NOT NULL,
    base_fee_per_gas TEXT,
    size INTEGER NOT NULL,
    miner_id TEXT
  )`,

  // Account table
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    balance TEXT NOT NULL DEFAULT '0',
    transaction_count INTEGER NOT NULL DEFAULT 0,
    is_contract INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    first_seen_block INTEGER
  )`,

  // Transaction table
  `CREATE TABLE IF NOT EXISTS transaction (
    id TEXT PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    from_id TEXT,
    to_id TEXT,
    block_id TEXT,
    block_number INTEGER NOT NULL,
    transaction_index INTEGER NOT NULL,
    value TEXT NOT NULL,
    gas_price TEXT,
    gas_limit TEXT NOT NULL,
    gas_used TEXT,
    input TEXT,
    nonce INTEGER NOT NULL,
    status TEXT NOT NULL,
    type INTEGER,
    max_fee_per_gas TEXT,
    max_priority_fee_per_gas TEXT,
    contract_address_id TEXT
  )`,

  // Contract table
  `CREATE TABLE IF NOT EXISTS contract (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    creator_id TEXT,
    creation_tx_id TEXT,
    creation_block INTEGER,
    bytecode TEXT,
    contract_type TEXT,
    name TEXT,
    symbol TEXT,
    decimals INTEGER,
    verified INTEGER NOT NULL DEFAULT 0,
    is_proxy INTEGER NOT NULL DEFAULT 0,
    implementation_address TEXT
  )`,

  // Log table
  `CREATE TABLE IF NOT EXISTS log (
    id TEXT PRIMARY KEY,
    log_index INTEGER NOT NULL,
    transaction_id TEXT,
    block_id TEXT,
    block_number INTEGER NOT NULL,
    address TEXT NOT NULL,
    topic0 TEXT,
    topic1 TEXT,
    topic2 TEXT,
    topic3 TEXT,
    data TEXT
  )`,

  // Decoded Event table
  `CREATE TABLE IF NOT EXISTS decoded_event (
    id TEXT PRIMARY KEY,
    log_id TEXT NOT NULL,
    name TEXT NOT NULL,
    signature TEXT NOT NULL,
    contract_type TEXT,
    args TEXT
  )`,

  // Trace table
  `CREATE TABLE IF NOT EXISTS trace (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    block_number INTEGER NOT NULL,
    trace_address TEXT NOT NULL,
    trace_type TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    value TEXT,
    gas TEXT,
    gas_used TEXT,
    input TEXT,
    output TEXT,
    error TEXT,
    revert_reason TEXT
  )`,

  // Token Transfer table
  `CREATE TABLE IF NOT EXISTS token_transfer (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    log_id TEXT,
    block_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    token_address TEXT NOT NULL,
    from_id TEXT,
    to_id TEXT,
    value TEXT NOT NULL,
    token_id TEXT,
    token_standard TEXT NOT NULL
  )`,

  // Token Balance table
  `CREATE TABLE IF NOT EXISTS token_balance (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    token_address TEXT NOT NULL,
    balance TEXT NOT NULL,
    token_standard TEXT NOT NULL,
    token_id TEXT,
    last_updated_block INTEGER NOT NULL
  )`,

  // Token table
  `CREATE TABLE IF NOT EXISTS token (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    name TEXT,
    symbol TEXT,
    decimals INTEGER,
    total_supply TEXT,
    token_standard TEXT NOT NULL,
    holder_count INTEGER NOT NULL DEFAULT 0,
    transfer_count INTEGER NOT NULL DEFAULT 0
  )`,

  // Token Approval Event table
  `CREATE TABLE IF NOT EXISTS token_approval_event (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    block_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    token_address TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    spender_id TEXT NOT NULL,
    value TEXT NOT NULL
  )`,

  // NFT Approval Event table
  `CREATE TABLE IF NOT EXISTS nft_approval_event (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    block_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    token_address TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    approved_id TEXT,
    operator_id TEXT,
    token_id TEXT,
    approved INTEGER
  )`,

  // Registered Agent table
  `CREATE TABLE IF NOT EXISTS registered_agent (
    id TEXT PRIMARY KEY,
    agent_id INTEGER NOT NULL UNIQUE,
    owner_id TEXT,
    endpoint TEXT,
    metadata_uri TEXT,
    metadata TEXT,
    tags TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    stake_amount TEXT NOT NULL DEFAULT '0',
    reputation_score INTEGER NOT NULL DEFAULT 100,
    total_reports INTEGER NOT NULL DEFAULT 0,
    successful_reports INTEGER NOT NULL DEFAULT 0,
    last_updated_block INTEGER,
    registered_at TEXT,
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT
  )`,

  // Tag Index table
  `CREATE TABLE IF NOT EXISTS tag_index (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    agent_count INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT
  )`,

  // Node Stake table
  `CREATE TABLE IF NOT EXISTS node_stake (
    id TEXT PRIMARY KEY,
    node_address TEXT NOT NULL,
    operator_id TEXT,
    stake_amount TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT,
    last_performance_update TEXT,
    uptime_score INTEGER NOT NULL DEFAULT 100,
    response_time_ms INTEGER,
    total_rewards TEXT NOT NULL DEFAULT '0'
  )`,

  // Compute Provider table
  `CREATE TABLE IF NOT EXISTS compute_provider (
    id TEXT PRIMARY KEY,
    provider_address TEXT NOT NULL UNIQUE,
    agent_id INTEGER,
    stake_amount TEXT,
    total_earnings TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    cpu_cores INTEGER,
    memory_gb INTEGER,
    gpu_count INTEGER,
    gpu_model TEXT,
    region TEXT,
    registered_at TEXT
  )`,

  // Storage Provider table
  `CREATE TABLE IF NOT EXISTS storage_provider (
    id TEXT PRIMARY KEY,
    provider_address TEXT NOT NULL UNIQUE,
    agent_id INTEGER,
    stake_amount TEXT,
    total_capacity_gb TEXT,
    used_capacity_gb TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    provider_type TEXT,
    tier TEXT,
    region TEXT,
    registered_at TEXT
  )`,

  // Compute Rental table
  `CREATE TABLE IF NOT EXISTS compute_rental (
    id TEXT PRIMARY KEY,
    rental_id TEXT NOT NULL,
    provider_id TEXT,
    renter_id TEXT,
    resource_type TEXT,
    cpu_cores INTEGER,
    memory_gb INTEGER,
    gpu_count INTEGER,
    price_per_hour TEXT,
    status TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    total_cost TEXT
  )`,

  // Storage Deal table
  `CREATE TABLE IF NOT EXISTS storage_deal (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL,
    provider_id TEXT,
    client_id TEXT,
    cid TEXT,
    size_bytes TEXT,
    price_per_gb TEXT,
    duration_days INTEGER,
    status TEXT NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    total_cost TEXT
  )`,

  // Container Image table
  `CREATE TABLE IF NOT EXISTS container_image (
    id TEXT PRIMARY KEY,
    cid TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    owner_id TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    architecture TEXT,
    size_bytes TEXT,
    created_at TEXT,
    pull_count INTEGER NOT NULL DEFAULT 0
  )`,

  // Cross Service Request table
  `CREATE TABLE IF NOT EXISTS cross_service_request (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    requester_id TEXT,
    provider_id TEXT,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL,
    compute_cid TEXT,
    storage_cid TEXT,
    created_at TEXT,
    completed_at TEXT,
    error TEXT
  )`,

  // Oracle Feed table
  `CREATE TABLE IF NOT EXISTS oracle_feed (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    category TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    heartbeat_interval INTEGER,
    deviation_threshold TEXT,
    latest_value TEXT,
    latest_timestamp TEXT,
    total_reports INTEGER NOT NULL DEFAULT 0
  )`,

  // Oracle Operator table
  `CREATE TABLE IF NOT EXISTS oracle_operator (
    id TEXT PRIMARY KEY,
    operator_address TEXT NOT NULL UNIQUE,
    name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_jailed INTEGER NOT NULL DEFAULT 0,
    staked_amount TEXT NOT NULL DEFAULT '0',
    total_earnings TEXT NOT NULL DEFAULT '0',
    participation_score INTEGER NOT NULL DEFAULT 100,
    accuracy_score INTEGER NOT NULL DEFAULT 100,
    total_reports INTEGER NOT NULL DEFAULT 0,
    registered_at TEXT
  )`,

  // Oracle Report table
  `CREATE TABLE IF NOT EXISTS oracle_report (
    id TEXT PRIMARY KEY,
    feed_id TEXT,
    operator_id TEXT,
    value TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    transaction_id TEXT,
    is_disputed INTEGER NOT NULL DEFAULT 0
  )`,

  // Oracle Dispute table
  `CREATE TABLE IF NOT EXISTS oracle_dispute (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    report_id TEXT,
    disputer_id TEXT,
    status TEXT NOT NULL,
    outcome TEXT,
    created_at TEXT,
    resolved_at TEXT,
    reason TEXT
  )`,

  // Oracle Subscription table
  `CREATE TABLE IF NOT EXISTS oracle_subscription (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT,
    feed_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    expires_at TEXT
  )`,

  // JNS Name table
  `CREATE TABLE IF NOT EXISTS jns_name (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    owner_id TEXT,
    resolver TEXT,
    expires_at TEXT,
    registered_at TEXT,
    registration_block INTEGER
  )`,

  // Marketplace Stats table (aggregated)
  `CREATE TABLE IF NOT EXISTS marketplace_stats (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    total_compute_providers INTEGER NOT NULL DEFAULT 0,
    active_compute_providers INTEGER NOT NULL DEFAULT 0,
    total_storage_providers INTEGER NOT NULL DEFAULT 0,
    active_storage_providers INTEGER NOT NULL DEFAULT 0,
    total_rentals INTEGER NOT NULL DEFAULT 0,
    total_deals INTEGER NOT NULL DEFAULT 0,
    total_agents INTEGER NOT NULL DEFAULT 0
  )`,
]

// Indexes for performance
export const INDEX_DDL = [
  // Block indexes
  'CREATE INDEX IF NOT EXISTS idx_block_number ON block(number)',
  'CREATE INDEX IF NOT EXISTS idx_block_timestamp ON block(timestamp)',
  'CREATE INDEX IF NOT EXISTS idx_block_hash ON block(hash)',

  // Transaction indexes
  'CREATE INDEX IF NOT EXISTS idx_transaction_hash ON "transaction"(hash)',
  'CREATE INDEX IF NOT EXISTS idx_transaction_block_number ON "transaction"(block_number)',
  'CREATE INDEX IF NOT EXISTS idx_transaction_from ON "transaction"(from_id)',
  'CREATE INDEX IF NOT EXISTS idx_transaction_to ON "transaction"(to_id)',
  'CREATE INDEX IF NOT EXISTS idx_transaction_block ON "transaction"(block_id)',

  // Account indexes
  'CREATE INDEX IF NOT EXISTS idx_account_address ON account(address)',

  // Contract indexes
  'CREATE INDEX IF NOT EXISTS idx_contract_address ON contract(address)',
  'CREATE INDEX IF NOT EXISTS idx_contract_type ON contract(contract_type)',

  // Log indexes
  'CREATE INDEX IF NOT EXISTS idx_log_transaction ON log(transaction_id)',
  'CREATE INDEX IF NOT EXISTS idx_log_block ON log(block_id)',
  'CREATE INDEX IF NOT EXISTS idx_log_address ON log(address)',
  'CREATE INDEX IF NOT EXISTS idx_log_topic0 ON log(topic0)',

  // Token Transfer indexes
  'CREATE INDEX IF NOT EXISTS idx_token_transfer_block ON token_transfer(block_number)',
  'CREATE INDEX IF NOT EXISTS idx_token_transfer_from ON token_transfer(from_id)',
  'CREATE INDEX IF NOT EXISTS idx_token_transfer_to ON token_transfer(to_id)',
  'CREATE INDEX IF NOT EXISTS idx_token_transfer_token ON token_transfer(token_address)',

  // Token Balance indexes
  'CREATE INDEX IF NOT EXISTS idx_token_balance_account ON token_balance(account_id)',
  'CREATE INDEX IF NOT EXISTS idx_token_balance_token ON token_balance(token_address)',

  // Registered Agent indexes
  'CREATE INDEX IF NOT EXISTS idx_registered_agent_agent_id ON registered_agent(agent_id)',
  'CREATE INDEX IF NOT EXISTS idx_registered_agent_active ON registered_agent(active)',
  'CREATE INDEX IF NOT EXISTS idx_registered_agent_owner ON registered_agent(owner_id)',

  // Node Stake indexes
  'CREATE INDEX IF NOT EXISTS idx_node_stake_address ON node_stake(node_address)',
  'CREATE INDEX IF NOT EXISTS idx_node_stake_active ON node_stake(is_active)',

  // Provider indexes
  'CREATE INDEX IF NOT EXISTS idx_compute_provider_active ON compute_provider(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_storage_provider_active ON storage_provider(is_active)',

  // Oracle indexes
  'CREATE INDEX IF NOT EXISTS idx_oracle_feed_active ON oracle_feed(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_oracle_operator_active ON oracle_operator(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_oracle_report_feed ON oracle_report(feed_id)',
  'CREATE INDEX IF NOT EXISTS idx_oracle_dispute_status ON oracle_dispute(status)',
]

// Table name to snake_case mapping for TypeORM entity compatibility
export const TABLE_NAMES = {
  Block: 'block',
  Transaction: 'transaction',
  Account: 'account',
  Contract: 'contract',
  Log: 'log',
  DecodedEvent: 'decoded_event',
  Trace: 'trace',
  TokenTransfer: 'token_transfer',
  TokenBalance: 'token_balance',
  Token: 'token',
  TokenApprovalEvent: 'token_approval_event',
  NftApprovalEvent: 'nft_approval_event',
  RegisteredAgent: 'registered_agent',
  TagIndex: 'tag_index',
  NodeStake: 'node_stake',
  ComputeProvider: 'compute_provider',
  StorageProvider: 'storage_provider',
  ComputeRental: 'compute_rental',
  StorageDeal: 'storage_deal',
  ContainerImage: 'container_image',
  CrossServiceRequest: 'cross_service_request',
  OracleFeed: 'oracle_feed',
  OracleOperator: 'oracle_operator',
  OracleReport: 'oracle_report',
  OracleDispute: 'oracle_dispute',
  OracleSubscription: 'oracle_subscription',
  JnsName: 'jns_name',
  MarketplaceStats: 'marketplace_stats',
} as const

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES]
