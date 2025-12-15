/**
 * Jeju Shared Package
 * Common hooks, components, APIs, database, cache, secrets, triggers, and utilities for Jeju apps
 */

// Hooks
export { 
  useBanStatus, 
  getBanTypeLabel, 
  getBanTypeColor,
  BanType,
  type BanStatus,
  type BanCheckConfig 
} from './hooks/useBanStatus';

// Components
export { 
  BanBanner, 
  BanIndicator, 
  BanOverlay 
} from './components/BanBanner';

// Moderation API
export {
  ModerationAPI,
  createModerationAPI,
  BAN_TYPES,
  CASE_STATUS,
  REPUTATION_TIERS,
  REPORT_TYPES,
  SEVERITY_LEVELS,
  LABELS,
  type ModerationConfig,
  type BanStatus as ModerationBanStatus,
  type ModeratorProfile,
  type ModerationCase,
  type Report,
  type AgentLabels,
  type ModerationStats,
  type TransactionRequest,
} from './api/moderation';

// Health Check Middleware
export {
  healthMiddleware,
  healthChecks,
} from './health-middleware';

// Decentralized Cache
export {
  getCacheClient,
  getCacheRentalClient,
  resetCacheClients,
  resetCacheRentalClient,
  type CacheClient,
  type CacheClientConfig,
  type CacheStats,
  type CacheInstance,
  type CacheRentalPlan,
  CacheRentalClient,
} from './cache';

// Decentralized Secrets
export {
  getSecretsLoader,
  initializeSecrets,
  loadSecretsFromEnv,
  validateSecrets,
  resetSecretsLoaders,
  type SecretsLoader,
  type SecretsConfig,
  type SecretMetadata,
  type AppSecretsConfig,
} from './secrets';

// Decentralized Triggers
export {
  getTriggerClient,
  registerAppTriggers,
  unregisterAppTriggers,
  resetTriggerClient,
  type TriggerClient,
  type TriggerConfig,
  type Trigger,
  type CreateTriggerRequest,
  type TriggerProof,
  type TriggerStats,
  type AppTriggerConfig,
  type AppTriggersConfig,
} from './triggers';

// Node Authentication
export {
  NodeAuth,
  getNodeAuth,
  resetNodeAuth,
  getNodeAddress,
  nodeSign,
  initializeNode,
  type NodeIdentity,
  type NodeAuthConfig,
} from './node-auth';
