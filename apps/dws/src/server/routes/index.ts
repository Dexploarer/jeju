/**
 * Route exports for DWS Server
 * All routes are Elysia plugins with type exports for Eden
 */

// ============================================================================
// Static Elysia plugins (already instantiated)
// ============================================================================

export { a2aRoutes, type A2ARoutes } from './a2a'
export { cdnRoutes, type CDNRoutes } from './cdn'
export { computeRoutes, type ComputeRoutes } from './compute'
export { storageRoutes, type StorageRoutes } from './storage'
export { rlaifRoutes, type RLAIFRoutes } from './rlaif'
export { rpcRoutes, type RPCRoutes } from './rpc'
export { trainingRoutes, type TrainingRoutes } from './training'

// ============================================================================
// Elysia route factories (with type exports)
// ============================================================================

// OAuth3 proxy
export { createOAuth3Router, type OAuth3Routes } from './oauth3'

// Key Management Service
export { createKMSRouter, type KMSRoutes } from './kms'

// VPN/Proxy
export { createVPNRouter, type VPNRoutes } from './vpn'

// Web Scraping
export { createScrapingRouter, type ScrapingRoutes } from './scraping'

// Price Streaming
export {
  createPricesRouter,
  getPriceService,
  handlePriceWebSocket,
  type PricesRoutes,
  type SubscribableWebSocket,
} from './prices'

// Moderation
export { createModerationRouter, type ModerationRoutes } from './moderation'

// S3-compatible storage
export { createS3Router, type S3Routes } from './s3'

// Workers
export { createWorkersRouter, type WorkersRoutes } from './workers'
export {
  createWorkerdRouter,
  createDefaultWorkerdRouter,
  type WorkerdRoutes,
  type WorkerdRouterOptions,
} from './workerd'

// Containers
export { createContainerRouter, type ContainerRoutes } from './containers'

// Data Availability
export { createDARouter, shutdownDA, type DARoutes } from './da'

// Edge Coordination
export { createEdgeRouter, handleEdgeWebSocket } from './edge'

// Funding
export { createFundingRouter } from './funding'

// Git
export { createGitRouter } from './git'

// MCP (Model Context Protocol)
export { createMCPRouter, type MCPRoutes } from './mcp'

// Packages
export { createPkgRouter, type PkgRoutes } from './pkg'
export {
  createPkgRegistryProxyRouter,
  type PkgRegistryProxyRoutes,
} from './pkg-registry-proxy'

// CI/CD
export { createCIRouter, type CIRoutes } from './ci'

// API Marketplace
export {
  createAPIMarketplaceRouter,
  type APIMarketplaceRoutes,
} from './api-marketplace'

// RPC (legacy factory export)
export { createRPCRouter } from './rpc'

// Models
export { createModelsRouter, type ModelsRoutes } from './models'

// Datasets
export { createDatasetsRouter, type DatasetsRoutes } from './datasets'

// Dependency Scanner
export {
  createDependencyScannerRouter,
  type DependencyScannerRoutes,
} from './dependency-scanner'
