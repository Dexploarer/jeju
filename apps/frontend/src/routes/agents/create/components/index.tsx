/**
 * Create Agent Components
 *
 * Stub components - implement based on requirements
 */

import type { ProfileFormData } from '../hooks';

interface ProfilePreviewCardProps {
  profileData: ProfileFormData;
  onEdit: () => void;
  onCycleProfilePic: (direction: 'next' | 'prev') => void;
  onCycleBanner: (direction: 'next' | 'prev') => void;
  isLoading: boolean;
}

export function ProfilePreviewCard({
  profileData,
  onEdit,
  isLoading,
}: ProfilePreviewCardProps) {
  if (isLoading) {
    return <div className="rounded-lg border border-border bg-muted/30 p-4">Loading...</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-4">
        <img
          src={profileData.coverImageUrl}
          alt="Cover"
          className="h-24 w-full rounded-lg object-cover"
        />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <img
          src={profileData.profileImageUrl}
          alt="Profile"
          className="h-12 w-12 rounded-full object-cover"
        />
        <div>
          <h3 className="font-semibold">{profileData.displayName || 'Agent Name'}</h3>
          <p className="text-muted-foreground text-sm">{profileData.bio || 'Bio'}</p>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="w-full rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
      >
        Edit Profile
      </button>
    </div>
  );
}

interface AgentConfigFormProps {
  agentData: {
    system: string;
    personality: string;
    tradingStrategy: string;
    initialDeposit: number;
  };
  generatingField: string | null;
  maxDeposit: number;
  onFieldChange: (field: string, value: string | number) => void;
  onRegenerate: (field: string) => void;
}

export function AgentConfigForm({
  agentData,
  maxDeposit,
  onFieldChange,
}: AgentConfigFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block font-medium text-sm">System Prompt</label>
        <textarea
          value={agentData.system}
          onChange={(e) => onFieldChange('system', e.target.value)}
          className="w-full rounded-lg border border-border bg-muted px-4 py-2 focus:border-[#0066FF] focus:outline-none"
          rows={4}
        />
      </div>
      <div>
        <label className="mb-2 block font-medium text-sm">Personality</label>
        <textarea
          value={agentData.personality}
          onChange={(e) => onFieldChange('personality', e.target.value)}
          className="w-full rounded-lg border border-border bg-muted px-4 py-2 focus:border-[#0066FF] focus:outline-none"
          rows={3}
        />
      </div>
      <div>
        <label className="mb-2 block font-medium text-sm">Trading Strategy</label>
        <textarea
          value={agentData.tradingStrategy}
          onChange={(e) => onFieldChange('tradingStrategy', e.target.value)}
          className="w-full rounded-lg border border-border bg-muted px-4 py-2 focus:border-[#0066FF] focus:outline-none"
          rows={3}
        />
      </div>
      <div>
        <label className="mb-2 block font-medium text-sm">Initial Deposit</label>
        <input
          type="range"
          min={100}
          max={maxDeposit}
          value={agentData.initialDeposit}
          onChange={(e) => onFieldChange('initialDeposit', Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 text-muted-foreground text-sm">
          {agentData.initialDeposit.toLocaleString()} pts
        </div>
      </div>
    </div>
  );
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: ProfileFormData;
  onSave: (data: ProfileFormData) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  profileData,
  onSave,
}: EditProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6">
        <h3 className="font-bold text-lg">Edit Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Display Name</label>
            <input
              type="text"
              defaultValue={profileData.displayName}
              className="w-full rounded-lg border border-border bg-muted px-4 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">Bio</label>
            <textarea
              defaultValue={profileData.bio}
              className="w-full rounded-lg border border-border bg-muted px-4 py-2"
              rows={3}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-muted px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(profileData)}
            className="flex-1 rounded-lg bg-[#0066FF] px-4 py-2 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
