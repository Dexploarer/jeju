/**
 * @jeju/oauth3
 * 
 * Decentralized OAuth3 authentication with TEE-backed key management,
 * FROST threshold signing, and cross-chain identity support.
 */

// Core types
export * from './types.js';

// TEE Agent
export { DstackAuthAgent, startAuthAgent } from './tee/dstack-agent.js';

// MPC/FROST Signing
export {
  FROSTCoordinator,
  generateKeyShares,
  generateSigningCommitment,
  generateSignatureShare,
  aggregateSignatures,
  verifySignature,
  publicKeyToAddress,
  type FROSTKeyShare,
  type FROSTSigningCommitment,
  type FROSTSignatureShare,
  type FROSTSignature,
  type FROSTCluster,
} from './mpc/frost-signing.js';

// Farcaster Provider
export {
  FarcasterProvider,
  farcasterProvider,
  type FarcasterProfile,
  type FarcasterSigner,
  type FarcasterCast,
  type FarcasterFrameContext,
} from './providers/farcaster.js';

// Social OAuth Providers (Google, Apple, Twitter, GitHub, Discord)
export {
  GoogleProvider,
  AppleProvider,
  TwitterProvider,
  GitHubProvider,
  DiscordProvider,
  createOAuthProvider,
  type OAuthConfig,
  type OAuthState,
  type OAuthToken,
  type OAuthProfile,
} from './providers/social.js';

// Verifiable Credentials
export {
  VerifiableCredentialIssuer,
  VerifiableCredentialVerifier,
  createCredentialHash,
  credentialToOnChainAttestation,
  didFromAddress,
  addressFromDid,
  type CredentialIssuanceParams,
  type CredentialVerificationResult,
  type CredentialPresentation,
} from './credentials/verifiable-credentials.js';

// Multi-tenant Council
export {
  MultiTenantCouncilManager,
  createMultiTenantCouncilManager,
  type CouncilDeployment,
  type CEOConfig,
  type CouncilAgentConfig,
} from './council/multi-tenant.js';

// SDK Client
export {
  OAuth3Client,
  createOAuth3Client,
  type OAuth3Config,
  type LoginOptions,
  type LinkOptions,
  type SignMessageOptions,
  type TransactionOptions,
  type OAuth3EventType,
  type OAuth3Event,
  type OAuth3EventHandler,
} from './sdk/client.js';

// Cross-chain Identity (Open Intents)
export {
  CrossChainIdentityManager,
  crossChainIdentityManager,
  ChainId,
  encodeTransferIntent,
  encodeContractCallIntent,
  computeIntentHash,
  type SupportedChain,
  type CrossChainIdentityState,
  type ChainIdentityState,
  type IdentitySyncIntent,
  type CrossChainAuthIntent,
} from './intents/cross-chain-identity.js';
