/**
 * Recording Module
 *
 * Provides trajectory recording infrastructure for agent training:
 * - Time window utilities for organizing training data
 * - Trajectory recording with pluggable storage backends
 * - In-memory storage for testing/development
 *
 * @packageDocumentation
 */

// Trajectory recorder
export {
  // Types
  type ActiveTrajectory,
  // Instances
  defaultStorage,
  type EndTrajectoryOptions,
  // Classes
  InMemoryTrajectoryStorage,
  type LLMCallLogRecord,
  type StartTrajectoryOptions,
  type TrajectoryRecord,
  TrajectoryRecorder,
  type TrajectoryStorage,
  trajectoryRecorder,
} from './trajectory-recorder'
// Window utilities
export {
  generateWindowIds,
  getCurrentWindowId,
  getPreviousWindowId,
  getWindowIdForTimestamp,
  getWindowRange,
  isTimestampInWindow,
  isWindowComplete,
  type ParsedWindowId,
  parseWindowId,
  type WindowRange,
} from './window-utils'
