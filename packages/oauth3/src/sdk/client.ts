/**
 * OAuth3 Client SDK
 * 
 * TypeScript SDK for integrating OAuth3 authentication into web applications.
 * Supports all authentication providers and credential management.
 */

import {
  keccak256,
  toBytes,
  toHex,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  AuthProvider,
  OAuth3Identity,
  OAuth3Session,
  OAuth3App,
  LinkedProvider,
  VerifiableCredential,
  FarcasterIdentity,
  TEEAttestation,
} from '../types.js';
import { FarcasterProvider } from '../providers/farcaster.js';

export interface OAuth3Config {
  appId: Hex;
  redirectUri: string;
  teeAgentUrl: string;
  rpcUrl: string;
  chainId: number;
  identityRegistryAddress: Address;
  appRegistryAddress: Address;
  accountFactoryAddress: Address;
}

export interface LoginOptions {
  provider: AuthProvider;
  scope?: string[];
  nonce?: string;
  state?: Record<string, unknown>;
}

export interface LinkOptions {
  provider: AuthProvider;
  scope?: string[];
}

export interface SignMessageOptions {
  message: string | Uint8Array;
  useSessionKey?: boolean;
}

export interface TransactionOptions {
  to: Address;
  value?: bigint;
  data?: Hex;
  gasLimit?: bigint;
}

export type OAuth3EventType = 
  | 'login'
  | 'logout'
  | 'sessionRefresh'
  | 'providerLinked'
  | 'providerUnlinked'
  | 'error';

export interface OAuth3Event {
  type: OAuth3EventType;
  data?: unknown;
  timestamp: number;
}

export type OAuth3EventHandler = (event: OAuth3Event) => void;

export class OAuth3Client {
  private config: OAuth3Config;
  private session: OAuth3Session | null = null;
  private identity: OAuth3Identity | null = null;
  private publicClient: PublicClient;
  private farcasterProvider: FarcasterProvider;
  private eventHandlers: Map<OAuth3EventType, Set<OAuth3EventHandler>> = new Map();

  constructor(config: OAuth3Config) {
    this.config = config;
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });
    this.farcasterProvider = new FarcasterProvider();
    this.loadSession();
  }

  async login(options: LoginOptions): Promise<OAuth3Session> {
    this.emit('login', { provider: options.provider, status: 'started' });

    switch (options.provider) {
      case 'wallet' as AuthProvider:
        return this.loginWithWallet();
      case 'farcaster' as AuthProvider:
        return this.loginWithFarcaster();
      default:
        return this.loginWithOAuth(options);
    }
  }

  private async loginWithWallet(): Promise<OAuth3Session> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No Ethereum provider found');
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];

    const address = accounts[0] as Address;
    const nonce = crypto.randomUUID();
    
    const message = this.createSignInMessage(address, nonce);
    
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    }) as Hex;

    const response = await fetch(`${this.config.teeAgentUrl}/auth/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
        message,
        appId: this.config.appId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Wallet login failed: ${response.status}`);
    }

    const session = await response.json() as OAuth3Session;
    this.setSession(session);
    this.emit('login', { provider: 'wallet', session });

    return session;
  }

  private async loginWithFarcaster(): Promise<OAuth3Session> {
    const nonce = crypto.randomUUID();
    const domain = new URL(this.config.redirectUri).hostname;

    const message = this.farcasterProvider.generateSignInMessage({
      domain,
      address: '0x0000000000000000000000000000000000000000' as Address,
      fid: 0,
      custody: '0x0000000000000000000000000000000000000000' as Address,
      nonce,
    });

    const signatureRequest = {
      type: 'farcaster_sign_in',
      message,
      nonce,
      domain,
    };

    const result = await this.requestFarcasterSignature(signatureRequest);

    const response = await fetch(`${this.config.teeAgentUrl}/auth/farcaster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid: result.fid,
        custodyAddress: result.custodyAddress,
        signature: result.signature,
        message: result.message,
        appId: this.config.appId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Farcaster login failed: ${response.status}`);
    }

    const session = await response.json() as OAuth3Session;
    this.setSession(session);
    this.emit('login', { provider: 'farcaster', session });

    return session;
  }

  private async loginWithOAuth(options: LoginOptions): Promise<OAuth3Session> {
    const initResponse = await fetch(`${this.config.teeAgentUrl}/auth/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: options.provider,
        appId: this.config.appId,
        redirectUri: this.config.redirectUri,
      }),
    });

    if (!initResponse.ok) {
      throw new Error(`Failed to initialize OAuth: ${initResponse.status}`);
    }

    const { authUrl, state, sessionId } = await initResponse.json() as {
      authUrl: string;
      state: string;
      sessionId: Hex;
    };

    sessionStorage.setItem('oauth3_state', state);
    sessionStorage.setItem('oauth3_session_id', sessionId);

    const popup = this.openPopup(authUrl);

    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== new URL(this.config.redirectUri).origin) return;

        const { code, state: returnedState, error } = event.data as {
          code?: string;
          state?: string;
          error?: string;
        };

        if (error) {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          reject(new Error(error));
          return;
        }

        if (!code || returnedState !== state) {
          return;
        }

        window.removeEventListener('message', handleMessage);
        popup?.close();

        const callbackResponse = await fetch(`${this.config.teeAgentUrl}/auth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, code }),
        });

        if (!callbackResponse.ok) {
          reject(new Error(`OAuth callback failed: ${callbackResponse.status}`));
          return;
        }

        const session = await callbackResponse.json() as OAuth3Session;
        this.setSession(session);
        this.emit('login', { provider: options.provider, session });
        resolve(session);
      };

      window.addEventListener('message', handleMessage);

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Login cancelled'));
        }
      }, 1000);
    });
  }

  async logout(): Promise<void> {
    if (!this.session) return;

    await fetch(`${this.config.teeAgentUrl}/session/${this.session.sessionId}`, {
      method: 'DELETE',
    });

    this.clearSession();
    this.emit('logout', {});
  }

  async linkProvider(options: LinkOptions): Promise<LinkedProvider> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    const linkSession = await this.login(options as LoginOptions);

    const linkedProvider: LinkedProvider = {
      provider: options.provider,
      providerId: linkSession.identityId,
      providerHandle: '',
      linkedAt: Date.now(),
      verified: true,
      credential: null,
    };

    this.emit('providerLinked', { provider: options.provider });
    return linkedProvider;
  }

  async unlinkProvider(provider: AuthProvider): Promise<void> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    this.emit('providerUnlinked', { provider });
  }

  async signMessage(options: SignMessageOptions): Promise<Hex> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    const messageHex = typeof options.message === 'string'
      ? toHex(new TextEncoder().encode(options.message))
      : toHex(options.message);

    const response = await fetch(`${this.config.teeAgentUrl}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.session.sessionId,
        message: messageHex,
      }),
    });

    if (!response.ok) {
      throw new Error(`Signing failed: ${response.status}`);
    }

    const { signature } = await response.json() as { signature: Hex };
    return signature;
  }

  async issueCredential(
    provider: AuthProvider,
    providerId: string,
    providerHandle: string
  ): Promise<VerifiableCredential> {
    if (!this.session) {
      throw new Error('Not logged in');
    }

    const response = await fetch(`${this.config.teeAgentUrl}/credential/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.session.sessionId,
        provider,
        providerId,
        providerHandle,
        walletAddress: this.session.smartAccount,
      }),
    });

    if (!response.ok) {
      throw new Error(`Credential issuance failed: ${response.status}`);
    }

    return response.json() as Promise<VerifiableCredential>;
  }

  async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    const response = await fetch(`${this.config.teeAgentUrl}/credential/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      return false;
    }

    const { valid } = await response.json() as { valid: boolean };
    return valid;
  }

  async getAttestation(): Promise<TEEAttestation> {
    const response = await fetch(`${this.config.teeAgentUrl}/attestation`);
    
    if (!response.ok) {
      throw new Error(`Failed to get attestation: ${response.status}`);
    }

    return response.json() as Promise<TEEAttestation>;
  }

  async refreshSession(): Promise<OAuth3Session> {
    if (!this.session) {
      throw new Error('No session to refresh');
    }

    const response = await fetch(
      `${this.config.teeAgentUrl}/session/${this.session.sessionId}/refresh`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error(`Session refresh failed: ${response.status}`);
    }

    const newSession = await response.json() as OAuth3Session;
    this.setSession(newSession);
    this.emit('sessionRefresh', { session: newSession });

    return newSession;
  }

  getSession(): OAuth3Session | null {
    return this.session;
  }

  getIdentity(): OAuth3Identity | null {
    return this.identity;
  }

  isLoggedIn(): boolean {
    return this.session !== null && this.session.expiresAt > Date.now();
  }

  on(event: OAuth3EventType, handler: OAuth3EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private emit(type: OAuth3EventType, data?: unknown): void {
    const event: OAuth3Event = { type, data, timestamp: Date.now() };
    this.eventHandlers.get(type)?.forEach(handler => handler(event));
  }

  private setSession(session: OAuth3Session): void {
    this.session = session;
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('oauth3_session', JSON.stringify(session));
    }
  }

  private clearSession(): void {
    this.session = null;
    this.identity = null;
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('oauth3_session');
    }
  }

  private loadSession(): void {
    if (typeof localStorage === 'undefined') return;

    const stored = localStorage.getItem('oauth3_session');
    if (!stored) return;

    const session = JSON.parse(stored) as OAuth3Session;
    
    if (session.expiresAt > Date.now()) {
      this.session = session;
    } else {
      localStorage.removeItem('oauth3_session');
    }
  }

  private createSignInMessage(address: Address, nonce: string): string {
    const domain = new URL(this.config.redirectUri).hostname;
    return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to OAuth3

URI: ${this.config.redirectUri}
Version: 1
Chain ID: ${this.config.chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
  }

  private openPopup(url: string): Window | null {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return window.open(
      url,
      'oauth3_popup',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  }

  private async requestFarcasterSignature(_request: {
    type: string;
    message: string;
    nonce: string;
    domain: string;
  }): Promise<{
    fid: number;
    custodyAddress: Address;
    signature: Hex;
    message: string;
  }> {
    throw new Error('Farcaster signature request must be handled by frame or wallet');
  }
}

export function createOAuth3Client(config: OAuth3Config): OAuth3Client {
  return new OAuth3Client(config);
}

declare global {
  interface Window {
    ethereum?: {
      request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
