/**
 * @jeju/dapp-services - Shared Decentralized Services
 * 
 * Provides unified integration layer for all Jeju dApps:
 * - Database (CQL)
 * - Cache (Compute Redis)
 * - Storage (IPFS)
 * - Secrets (KMS)
 * - Triggers (Cron)
 * - Naming (JNS)
 * - Protocols (A2A, MCP)
 * - Deployment
 */

// Database
export { createDatabaseService, type DatabaseService, type DatabaseConfig } from './database/index.js';

// Cache
export { createCacheService, type CacheService, type CacheConfig, cacheKeys } from './cache/index.js';

// Storage
export { createStorageService, type StorageService, type StorageConfig } from './storage/index.js';

// KMS
export { createKMSService, type KMSServiceClient, type KMSConfig } from './kms/index.js';

// Cron
export { createCronService, type CronService, type CronConfig, type CronJob } from './cron/index.js';

// JNS
export { createJNSService, type JNSService, type JNSConfig, type JNSRecords } from './jns/index.js';

// Protocols
export { createA2AServer, type A2AConfig, type A2ASkill, type AgentCard } from './protocols/a2a.js';
export { createMCPServer, type MCPConfig, type MCPTool, type MCPResource } from './protocols/mcp.js';

// Deployment
export { deployApp, type DeployConfig, type DeployResult } from './deploy/index.js';

// Types
export type { Address, Hex } from 'viem';
