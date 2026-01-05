/**
 * Jeju Auth UI Components
 *
 * Standardized authentication UI that integrates with the KMS-based OAuth3 system.
 * Re-exports from @jejunetwork/auth/react with additional convenience components.
 */

// Re-export all auth components and hooks from @jejunetwork/auth/react
export {
  ConnectedAccount,
  type ConnectedAccountProps,
  type LinkedAccount,
  LoginButton,
  type LoginButtonProps,
  LoginModal,
  type LoginModalProps,
  MFASetup,
  type MFASetupProps,
  type OAuth3ContextValue,
  OAuth3Provider,
  OAuth3Provider as JejuAuthProvider,
  type OAuth3ProviderProps,
  type TypedDataParams,
  type UseCredentialsReturn,
  useCredentials,
  type UseJejuAuthReturn,
  useJejuAuth,
  type UseJejuWalletReturn,
  useJejuWallet,
  type UseLoginOptions,
  type UseLoginReturn,
  useLogin,
  type UseMFAOptions,
  type UseMFAReturn,
  useMFA,
  useOAuth3,
  useOAuth3Client,
  type UseSessionReturn,
  useSession,
} from '@jejunetwork/auth/react'

// Export the unified auth button
export { JejuAuthButton, type JejuAuthButtonProps } from './JejuAuthButton'

// Export the auth header component
export {
  AuthHeaderButton,
  type AuthHeaderButtonProps,
} from './AuthHeaderButton'
