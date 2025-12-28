/**
 * DWS Deploy Module
 *
 * Provides Heroku/EKS-like deployment experience for apps on the Jeju network.
 * Includes Vercel-like CI/CD for GitHub integration.
 */

export {
  AppDeployer,
  type AppManifest,
  createAppDeployerRouter,
  type DeploymentResult,
  type DWSConfig,
  type ProvisionedService,
  type ServiceDefinition,
} from './app-deployer'

export {
  createGitHubIntegrationRouter,
  githubIntegration,
} from './github-integration'
