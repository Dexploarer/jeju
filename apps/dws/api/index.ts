/**
 * DWS API - Decentralized Web Services
 * 
 * Complete replacement for centralized cloud services:
 * - Vercel: Preview deployments, serverless workers, CI/CD
 * - Cloudflare: CDN, WAF, DDoS protection, workers
 * - AWS: Managed databases, container orchestration, autoscaling
 */

// ============================================================================
// Database Services (Managed EQLite + PostgreSQL)
// ============================================================================

export {
  getManagedDatabaseService,
  ManagedDatabaseService,
  CreateDatabaseSchema,
  UpdateDatabaseSchema,
  type DatabaseEngine,
  type DatabaseInstance,
  type DatabasePlan,
  type DatabaseConfig,
  type Backup,
  type Replica,
  type UsageMetrics,
  type PostgresConnection,
  type EQLiteConnection,
} from './database/managed-service'

export { createDatabaseRoutes } from './database/routes'

// ============================================================================
// Git & Deployments
// ============================================================================

export {
  runDeployHook,
  handlePostReceive,
  detectFramework,
  hasWorkerCode,
  configureDeployHook,
  type DeployHookConfig,
  type DeploymentResult,
} from './git/deploy-hook'

export {
  getPreviewManager,
  PreviewDeploymentManager,
  CreatePreviewSchema,
  type PreviewDeployment,
  type PreviewConfig,
  type PreviewType,
  type PreviewStatus,
} from './git/preview-deployments'

// ============================================================================
// CI/CD
// ============================================================================

export {
  WorkflowEngine,
  type WorkflowEngineConfig,
} from './ci/workflow-engine'

export {
  getBuildCacheManager,
  BuildCacheManager,
  generateCacheKey,
  generateDependencyCacheKey,
  generateDockerLayerCacheKey,
  restoreNodeModules,
  saveNodeModules,
  restoreCargoCache,
  saveCargoCache,
  type CacheEntry,
  type CacheStats,
  type RestoreResult,
  type SaveResult,
} from './ci/build-cache'

// ============================================================================
// Workers & Serverless
// ============================================================================

export {
  NextJSCompiler,
  ElysiaCompiler,
  compileNextJS,
  compileElysia,
  compileProject,
  type CompiledRoute,
  type CompilationResult,
  type WorkerManifest,
  type RouteType,
} from './workers/nextjs-compiler'

export {
  SSEWriter,
  NDJSONWriter,
  ChunkedWriter,
  StreamConnectionManager,
  getStreamConnectionManager,
  createSSEResponse,
  createNDJSONResponse,
  createChunkedResponse,
  streamWithProgress,
  createLLMStreamResponse,
  type StreamConfig,
  type StreamConnection,
  type StreamStats,
  type LLMStreamEvent,
} from './workers/streaming'

export {
  CronScheduler,
  getCronScheduler,
  parseCronExpression,
  getNextRunTime,
  matchesCron,
  CronScheduleSchema,
  type CronSchedule,
  type CronExecution,
  type CronEvent,
  type WorkerResult,
} from './workers/cron-scheduler'

// ============================================================================
// Security
// ============================================================================

export {
  SSLCertificateManager,
  getSSLManager,
  CertificateRequestSchema,
  CustomCertificateSchema,
  type Certificate,
  type CertificateStatus,
  type ChallengeType,
  type ACMEAccount,
} from './security/ssl-manager'

export {
  SecretsManager,
  getSecretsManager,
  CreateSecretSchema,
  UpdateSecretSchema,
  type Secret,
  type SecretValue,
  type SecretScope,
  type SecretStatus,
  type AuditEntry as SecretAuditEntry,
} from './security/secrets-manager'

export {
  WebApplicationFirewall,
  getWAF,
  type WAFRule,
  type WAFDecision,
  type ThreatType,
  type WAFAction,
  type RateLimitConfig as WAFRateLimitConfig,
  type DDoSConfig,
  type SecurityEvent,
  type IPReputationEntry,
} from './security/waf'

export {
  AccessControlManager,
  getAccessControl,
  CreateRoleSchema,
  CreateAPIKeySchema,
  type Role,
  type User,
  type Organization,
  type Team,
  type APIKey,
  type Session,
  type Permission,
  type ResourceType,
  type AccessDecision,
} from './security/access-control'

export {
  AuditLogger,
  getAuditLogger,
  LogAuditEventSchema,
  type AuditEvent,
  type AuditActor,
  type AuditTarget,
  type AuditQuery,
  type AuditCategory,
  type AuditSeverity,
  type AuditOutcome,
  type ComplianceReport,
} from './security/audit-logger'

// ============================================================================
// Infrastructure
// ============================================================================

export {
  ServiceMesh,
  getServiceMesh,
  type ServiceDefinition,
  type ServiceEndpoint,
  type ServiceStatus,
  type LoadBalanceStrategy,
  type CircuitState,
  type RetryPolicy,
  type CircuitBreakerConfig,
  type RateLimitConfig,
  type TrafficPolicy,
} from './infrastructure/service-mesh'

export {
  ClusterAutoscaler,
  getClusterAutoscaler,
  type ScalingPolicy,
  type ScalingDecision,
  type ScalingMetric,
  type ScalingBehavior,
  type NodePool,
  type NodePoolScalingDecision,
  type MetricType,
  type ScalingDirection,
} from './infrastructure/cluster-autoscaler'

// ============================================================================
// Observability
// ============================================================================

export {
  Logger,
  getLogger,
  MetricsRegistry,
  getMetricsRegistry,
  Tracer,
  getTracer,
  AlertManager,
  getAlertManager,
  HealthChecker,
  getHealthChecker,
  type LogEntry,
  type LogLevel,
  type LogQuery,
  type MetricValue,
  type HistogramValue,
  type Span,
  type SpanEvent,
  type SpanKind,
  type SpanStatus,
  type TraceQuery,
  type AlertRule,
  type Alert,
  type AlertSeverity,
  type AlertState,
  type HealthStatus,
} from './observability'
