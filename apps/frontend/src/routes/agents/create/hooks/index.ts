/**
 * Create Agent Hooks
 */

import { useState, useCallback } from 'react';

export interface ProfileFormData {
  displayName: string;
  bio: string;
  profileImageUrl: string;
  coverImageUrl: string;
}

export interface AgentFormData {
  system: string;
  personality: string;
  tradingStrategy: string;
  initialDeposit: number;
}

interface UseAgentFormReturn {
  profileData: ProfileFormData;
  agentData: AgentFormData;
  isInitialized: boolean;
  generatingField: string | null;
  updateProfileField: (field: keyof ProfileFormData, value: string) => void;
  updateAgentField: (field: keyof AgentFormData, value: string | number) => void;
  setProfileData: (data: ProfileFormData) => void;
  regenerateField: (field: string) => void;
  clearDraft: () => void;
}

export function useAgentForm(): UseAgentFormReturn {
  const [profileData, setProfileDataState] = useState<ProfileFormData>({
    displayName: '',
    bio: '',
    profileImageUrl: '/assets/user-profiles/profile-1.jpg',
    coverImageUrl: '/assets/user-banners/banner-1.jpg',
  });

  const [agentData, setAgentData] = useState<AgentFormData>({
    system: 'You are an autonomous trading agent.',
    personality: 'Analytical, risk-aware, and decisive.',
    tradingStrategy: 'Focus on high-probability setups with strict risk management.',
    initialDeposit: 1000,
  });

  const [isInitialized] = useState(true);
  const [generatingField] = useState<string | null>(null);

  const updateProfileField = useCallback(
    (field: keyof ProfileFormData, value: string) => {
      setProfileDataState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateAgentField = useCallback(
    (field: keyof AgentFormData, value: string | number) => {
      setAgentData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const setProfileData = useCallback((data: ProfileFormData) => {
    setProfileDataState(data);
  }, []);

  const regenerateField = useCallback((_field: string) => {
    // Implement AI regeneration
  }, []);

  const clearDraft = useCallback(() => {
    setProfileDataState({
      displayName: '',
      bio: '',
      profileImageUrl: '/assets/user-profiles/profile-1.jpg',
      coverImageUrl: '/assets/user-banners/banner-1.jpg',
    });
    setAgentData({
      system: 'You are an autonomous trading agent.',
      personality: 'Analytical, risk-aware, and decisive.',
      tradingStrategy: 'Focus on high-probability setups with strict risk management.',
      initialDeposit: 1000,
    });
  }, []);

  return {
    profileData,
    agentData,
    isInitialized,
    generatingField,
    updateProfileField,
    updateAgentField,
    setProfileData,
    regenerateField,
    clearDraft,
  };
}
