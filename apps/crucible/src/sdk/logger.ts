/**
 * Crucible SDK Logger - Re-exports from shared
 */

export { createLogger, getLogger, logger, type Logger, type LogLevel, type LoggerConfig } from '@jejunetwork/shared/logger';

// Legacy interface exports for backward compatibility
export interface LogEntry {
  level: string;
  component: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
