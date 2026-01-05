/**
 * DWS Service Provisioners - Unified Exports
 *
 * All DWS services are now provisioned through DWS rather than K8s.
 * This module exports all service provisioners for:
 *
 * Stateful Services (use StatefulProvisioner):
 * - OAuth3 (MPC-enabled auth with 2-of-3 threshold for testnet)
 * - Data Availability (IPFS-backed with KZG commitments)
 * - Email (decentralized email infrastructure)
 * - Farcaster Hubble (permissionless hub nodes)
 *
 * Stateless Workers (use ContainerProvisioner):
 * - x402 Facilitator (payment protocol)
 * - RPC Gateway (load balancer with rate limiting)
 * - SQLit Adapter (HTTP API for SQLite)
 *
 * These replace the following K8s Helm charts (now deprecated):
 * - packages/deployment/kubernetes/helm/oauth3
 * - packages/deployment/kubernetes/helm/jeju-da
 * - packages/deployment/kubernetes/helm/email
 * - packages/deployment/kubernetes/helm/farcaster-hubble
 * - packages/deployment/kubernetes/helm/x402-facilitator
 * - packages/deployment/kubernetes/helm/rpc-gateway
 * - packages/deployment/kubernetes/helm/sqlit-adapter
 * - packages/deployment/kubernetes/helm/sqlit
 * - packages/deployment/kubernetes/helm/subsquid
 */

// StatefulProvisioner - core abstraction for replicated stateful services
export {
  StatefulProvisioner,
  getStatefulProvisioner,
  type StatefulServiceConfig,
  type StatefulService,
  type StatefulReplica,
  type VolumeConfig,
  type ConsensusConfig,
  type MPCConfig,
  type ConsensusProtocol,
  type VolumeStorageTier,
  type ReplicaRole,
} from '../containers/stateful-provisioner'

// Service Discovery - internal JNS-based DNS
export {
  registerStatefulService,
  registerTypedService,
  updateServiceEndpoints,
  markEndpointHealthy,
  markEndpointUnhealthy,
  deregisterService,
  resolveA,
  resolveSRV,
  resolveTXT,
  resolvePod,
  resolveLeader,
  resolveWithLoadBalancing,
  getService,
  getServiceByFqdn,
  getServicesByType,
  listServices,
  handleDNSQuery,
  getDatabaseConnectionString,
  getServiceUrl,
  type ServiceType,
  type ServiceRecord,
  type ServiceEndpoint,
  type DNSRecord,
  type DNSQuery,
  type DNSResponse,
} from './discovery'

// OAuth3 Service (2-of-3 MPC for testnet)
export {
  deployOAuth3,
  getOAuth3Service,
  getOAuth3ServiceByName,
  listOAuth3Services,
  scaleOAuth3,
  terminateOAuth3,
  requestThresholdSignature,
  getOAuth3MPCStatus,
  rotateOAuth3MPCKeys,
  getTestnetOAuth3Config,
  type OAuth3Config,
  type OAuth3Provider,
  type OAuth3Service,
} from './oauth3'

// Data Availability Service
export {
  deployDA,
  getDAService,
  getDAServiceByName,
  listDAServices,
  scaleDA,
  terminateDA,
  submitBlob,
  retrieveBlob,
  getDAStats,
  getTestnetDAConfig,
  type DAConfig,
  type DAService,
  type CommitmentScheme,
  type ArchiveBackend,
} from './data-availability'

// Email Service
export {
  deployEmail,
  getEmailService,
  listEmailServices,
  terminateEmail,
  getTestnetEmailConfig,
  type EmailConfig,
  type EmailService,
  type StakeTier,
  type RateLimits,
} from './email'

// Farcaster Hubble Service
export {
  deployHubble,
  getHubbleService,
  getHubbleServiceByName,
  listHubbleServices,
  scaleHubble,
  terminateHubble,
  getHubbleStats,
  queryCastsByFid,
  getTestnetHubbleConfig,
  type HubbleConfig,
  type HubbleService,
} from './hubble'

// Stateless Workers
export {
  deployX402Facilitator,
  deployRPCGateway,
  deploySQLitAdapter,
  getWorkerService,
  listWorkerServices,
  scaleWorker,
  terminateWorker,
  getTestnetX402Config,
  getTestnetRPCGatewayConfig,
  getTestnetSQLitAdapterConfig,
  type WorkerType,
  type WorkerConfig,
  type WorkerService,
  type X402FacilitatorConfig,
  type RPCGatewayConfig,
  type SQLitAdapterConfig,
} from './workers'

// Re-export existing infrastructure services for backwards compatibility
export {
  provisionService,
  stopService,
  removeService,
  getService as getInfraService,
  getServiceByName as getInfraServiceByName,
  listServices as listInfraServices,
  checkServiceHealth,
  createDatabase,
  discoverExistingServices,
  createServicesRouter,
  type ServiceConfig as InfraServiceConfig,
  type ServiceInstance as InfraServiceInstance,
  type ServiceType as InfraServiceType,
  type ServiceStatus as InfraServiceStatus,
} from './index'
