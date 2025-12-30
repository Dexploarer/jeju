// SQLit service management

// Keepalive service for database health monitoring
export {
  createKeepaliveRouter,
  forceHealthCheck,
  getAllDatabases,
  getKeepaliveStats,
  getRegisteredDatabase,
  type KeepaliveConfig,
  type KeepaliveStats,
  type RegisteredDatabase,
  type ResourceStatus,
  registerDatabase,
  startKeepaliveService,
  stopKeepaliveService,
  unregisterDatabase,
} from './keepalive'
export {
  createDatabaseRouter,
  grantDatabaseAccess,
  listDatabases,
  provisionDatabase,
  revokeDatabaseAccess,
  verifySignedRequest,
} from './provisioning'
export {
  createSecureSQLitRouter,
  internalExec,
  internalQuery,
} from './secure-proxy'
export {
  ensureSQLitService,
  ensureSQLitService,
  getDatabaseConnectionInfo,
  getDatabaseConnectionInfo,
  getSQLitClientPort,
  getSQLitClientPort,
  getSQLitEndpoint,
  getSQLitEndpoint,
  getSQLitStatus,
  getSQLitStatus,
  isSQLitHealthy,
  isSQLitHealthy,
  provisionAppDatabase,
  provisionAppDatabase,
} from './sqlit-service'
