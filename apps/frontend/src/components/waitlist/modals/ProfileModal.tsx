import { POINTS } from '@babylon/shared';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  User,
  X,
} from 'lucide-react';

interface ProfileFormState {
  username: string;
  displayName: string;
  bio: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileComplete?: boolean;
  isSavingProfile: boolean;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  profilePictureIndex: number;
  bannerIndex: number;
  uploadedProfileImage: string | null;
  uploadedBanner: string | null;
  isCheckingUsername: boolean;
  usernameStatus: UsernameStatus;
  usernameSuggestion: string | null;
  onCycleProfilePicture: (direction: 'next' | 'prev') => void;
  onCycleBanner: (direction: 'next' | 'prev') => void;
  onProfileImageUpload: (file: File) => Promise<void>;
  onBannerUpload: (file: File) => Promise<void>;
  onSaveProfile: () => Promise<void>;
}

/**
 * Profile completion/edit modal.
 */
export function ProfileModal({
  isOpen,
  onClose,
  profileComplete,
  isSavingProfile,
  profileForm,
  setProfileForm,
  profilePictureIndex,
  bannerIndex,
  uploadedProfileImage,
  uploadedBanner,
  isCheckingUsername,
  usernameStatus,
  usernameSuggestion,
  onCycleProfilePicture,
  onCycleBanner,
  onProfileImageUpload,
  onBannerUpload,
  onSaveProfile,
}: ProfileModalProps) {
  if (!isOpen) return null;

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void onProfileImageUpload(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void onBannerUpload(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSaveProfile();
  };

  const isSubmitDisabled = (() => {
    const username = (profileForm.username ?? '').trim();
    const displayName = (profileForm.displayName ?? '').trim();
    return isSavingProfile || !username || !displayName;
  })();

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={() => !isSavingProfile && onClose()}
        style={{ pointerEvents: 'auto' }}
      />
      <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
        <div
          className="pointer-events-auto my-8 w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl transition-all duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-border border-b p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-2xl">
                  {profileComplete ? 'Edit Profile' : 'Complete Profile'}
                </h2>
                {!profileComplete ? (
                  <p className="text-muted-foreground text-sm">
                    Earn{' '}
                    <span className="font-semibold text-primary">
                      +{POINTS.PROFILE_COMPLETION} points
                    </span>{' '}
                    when complete
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Update your profile information
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSavingProfile}
              className="rounded-lg p-2 transition-colors hover:bg-muted disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Help Text */}
            {!profileComplete && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <p className="text-foreground text-sm leading-relaxed">
                  <span className="font-semibold">Pro Tip:</span> Complete all
                  fields below to earn{' '}
                  <span className="font-bold text-primary">
                    {POINTS.PROFILE_COMPLETION} points
                  </span>{' '}
                  and personalize your experience
                </p>
              </div>
            )}

            {/* Banner Image */}
            <div className="space-y-2">
              <label className="block font-medium text-sm">
                Profile Banner
              </label>
              <div className="group relative h-40 overflow-hidden rounded-lg bg-muted">
                <img
                  src={
                    uploadedBanner ||
                    profileForm.coverImageUrl ||
                    `/assets/user-banners/banner-${bannerIndex}.jpg`
                  }
                  alt="Profile banner"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onCycleBanner('prev')}
                    className="rounded-lg bg-background/80 p-2 transition-colors hover:bg-background"
                    title="Previous banner"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <label
                    className="cursor-pointer rounded-lg bg-background/80 p-2 transition-colors hover:bg-background"
                    title="Upload banner"
                  >
                    <Upload className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                      disabled={isSavingProfile}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onCycleBanner('next')}
                    className="rounded-lg bg-background/80 p-2 transition-colors hover:bg-background"
                    title="Next banner"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Click to cycle through banners or upload your own
              </p>
            </div>

            {/* Profile Picture and Basic Info */}
            <div className="flex items-start gap-4">
              <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                <img
                  src={
                    uploadedProfileImage ||
                    profileForm.profileImageUrl ||
                    `/assets/user-profiles/profile-${profilePictureIndex}.jpg`
                  }
                  alt="Profile picture"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onCycleProfilePicture('prev')}
                    className="rounded-lg bg-background/80 p-1.5 transition-colors hover:bg-background"
                    title="Previous picture"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <label
                    className="cursor-pointer rounded-lg bg-background/80 p-1.5 transition-colors hover:bg-background"
                    title="Upload picture"
                  >
                    <Upload className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageUpload}
                      className="hidden"
                      disabled={isSavingProfile}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onCycleProfilePicture('next')}
                    className="rounded-lg bg-background/80 p-1.5 transition-colors hover:bg-background"
                    title="Next picture"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {/* Display Name */}
                <div className="space-y-2">
                  <label className="block font-medium text-sm">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                    placeholder="Your display name"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSavingProfile}
                    maxLength={50}
                  />
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <label className="block font-medium text-sm">
                    Username *
                  </label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                      @
                    </span>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                      placeholder="Choose a username"
                      className="w-full rounded-lg border border-border bg-muted py-2 pr-10 pl-8 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isSavingProfile}
                      maxLength={20}
                    />
                    {isCheckingUsername && (
                      <div className="absolute top-1/2 right-3 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                    {usernameStatus === 'available' && !isCheckingUsername && (
                      <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
                    )}
                    {usernameStatus === 'taken' && !isCheckingUsername && (
                      <X className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-red-500" />
                    )}
                  </div>
                  {usernameStatus === 'taken' && usernameSuggestion && (
                    <p className="text-muted-foreground text-xs">
                      Suggestion:{' '}
                      <button
                        type="button"
                        className="text-primary underline hover:text-primary/80"
                        onClick={() =>
                          setProfileForm((prev) => ({
                            ...prev,
                            username: usernameSuggestion,
                          }))
                        }
                      >
                        {usernameSuggestion}
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="block font-medium text-sm">Bio</label>
              <textarea
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    bio: e.target.value,
                  }))
                }
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={280}
                className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSavingProfile}
              />
              <p className="text-right text-muted-foreground text-xs">
                {profileForm.bio.length}/280
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingProfile}
                className="flex-1 rounded-lg border border-border bg-sidebar px-4 py-2 font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="min-h-[44px] flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile
                  ? 'Saving...'
                  : profileComplete
                    ? 'Save Changes'
                    : 'Save & Earn Points'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export type { ProfileFormState, UsernameStatus };
