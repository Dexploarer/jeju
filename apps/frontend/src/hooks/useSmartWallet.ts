/**
 * Smart Wallet Hook
 */

import { useState } from 'react';

interface SmartWalletState {
  smartWalletReady: boolean;
  smartWalletAddress: string | null;
}

export function useSmartWallet(): SmartWalletState {
  const [smartWalletReady] = useState(true);
  const [smartWalletAddress] = useState<string | null>(null);

  return { smartWalletReady, smartWalletAddress };
}
