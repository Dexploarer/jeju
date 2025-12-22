/**
 * Training module exports
 */

export {
  createAtroposServer,
  startAtroposServer,
  type AtroposState,
  type EnvConfig,
  type Message,
  type RegisterEnv,
  type Registration,
  type ScoredData,
} from './atropos-server'

export {
  createCrossChainBridge,
  CrossChainTrainingBridge,
  type BridgeConfig,
  type BridgedRunState,
  type CheckpointData,
  type ClientRegistration,
  type RewardDistribution,
} from './cross-chain-bridge'

export {
  createDWSTrainingService,
  createTrainingRoutes,
  DWSTrainingService,
  type NodeAllocation,
  type PsycheJobConfig,
  type TrainingJobRequest,
  type TrainingJobStatus,
} from './dws-integration'

export {
  createDistributedGRPOTrainer,
  createGRPOTrainer,
  DistributedGRPOTrainer,
  GRPOTrainer,
  type BatchData,
  type TrainerStatus,
  type TrainingConfig,
  type TrainingMetrics,
} from './grpo-trainer'

export {
  createPsycheClient,
  PsycheClient,
  type ClientInfo,
  type CoordinatorConfig,
  type CoordinatorProgress,
  type CoordinatorState,
  type Model,
  type PsycheConfig,
  type RunMetadata,
  type WitnessProof,
} from './psyche-client'
