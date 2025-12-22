import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS } from '../config';
import { BAN_MANAGER_ABI } from '@jejunetwork/types';

export function useBanStatus() {
  const { address, isConnected } = useAccount();

  const { data: isBanned, isLoading } = useReadContract({
    address: CONTRACTS.banManager,
    abi: BAN_MANAGER_ABI,
    functionName: 'isAddressBanned',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && CONTRACTS.banManager !== '0x0000000000000000000000000000000000000000',
    },
  });

  const { data: banRecord } = useReadContract({
    address: CONTRACTS.banManager,
    abi: BAN_MANAGER_ABI,
    functionName: 'getAddressBanRecord',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && isBanned === true,
    },
  });

  return {
    isBanned: isBanned ?? false,
    isLoading,
    banRecord: banRecord as {
      isBanned: boolean;
      banType: number;
      bannedAt: bigint;
      expiresAt: bigint;
      reason: string;
      proposalId: string;
      reporter: string;
      caseId: string;
    } | undefined,
  };
}


