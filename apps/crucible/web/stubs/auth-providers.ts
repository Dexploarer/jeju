/**
 * Browser stub for server-side auth providers
 * These providers use KMS/server features and are not available in browser
 * Exported as classes since the SDK uses `new Provider(...)`
 */

export function generateFarcasterSignInMessage(_params: {
  domain: string
  address: string
  uri: string
  nonce?: string
  chainId?: number
  statement?: string
}): string {
  throw new Error('Farcaster sign-in requires server-side support')
}

export class FarcasterProvider {
  name = 'farcaster'
  async authenticate(): Promise<never> {
    throw new Error('Farcaster auth requires server-side support')
  }
}

export class EmailProvider {
  name = 'email'
  async sendCode(): Promise<never> {
    throw new Error('Email auth requires server-side support')
  }
  async verify(): Promise<never> {
    throw new Error('Email auth requires server-side support')
  }
}

export class PhoneProvider {
  name = 'phone'
  async sendCode(): Promise<never> {
    throw new Error('Phone auth requires server-side support')
  }
  async verify(): Promise<never> {
    throw new Error('Phone auth requires server-side support')
  }
}

export default {}
