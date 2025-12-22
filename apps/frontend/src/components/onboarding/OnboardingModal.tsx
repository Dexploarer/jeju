import type { OnboardingProfilePayload } from '@babylon/shared'
import { cn, logger } from '@babylon/shared'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '../shared/Skeleton'
import { api } from '../../lib/api'

/**
 * Imported profile data structure from social platforms.
 */
export interface ImportedProfileData {
  platform: 'twitter' | 'farcaster'
  username: string
  displayName: string
  bio?: string
  profileImageUrl?: string | null
  coverImageUrl?: string | null
  twitterId?: string
  farcasterFid?: string
}

/**
 * Onboarding modal component for user onboarding flow.
 */
interface OnboardingModalProps {
  isOpen: boolean
  stage: 'PROFILE' | 'ONCHAIN' | 'COMPLETED'
  isSubmitting: boolean
  error?: string | null
  isWalletReady: boolean
  onSubmitProfile: (payload: OnboardingProfilePayload) => Promise<void>
  onRetryOnchain: () => Promise<void>
  onSkipOnchain: () => void
  onClose: () => void
  onLogout?: () => Promise<void>
  user: {
    id?: string
    username?: string
    walletAddress?: string
    onChainRegistered?: boolean
  } | null
  importedData?: ImportedProfileData | null
  initialEmail?: string | null
}

interface GeneratedProfileResponse {
  name: string
  username: string
  bio: string
}

interface RandomAssetsResponse {
  profilePictureIndex: number
  bannerIndex: number
}

const TOTAL_PROFILE_PICTURES = 100
const TOTAL_BANNERS = 100
const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i

function resolveAssetUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value
  }
  if (typeof window !== 'undefined' && value.startsWith('/')) {
    return new URL(value, window.location.origin).toString()
  }
  return value
}

export function OnboardingModal({
  isOpen,
  stage,
  isSubmitting,
  error,
  isWalletReady,
  onSubmitProfile,
  onRetryOnchain,
  onSkipOnchain,
  onClose,
  onLogout,
  user,
  importedData,
  initialEmail,
}: OnboardingModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [profilePictureIndex, setProfilePictureIndex] = useState(1)
  const [bannerIndex, setBannerIndex] = useState(1)
  const [uploadedProfileImage, setUploadedProfileImage] = useState<
    string | null
  >(null)
  const [uploadedBanner, setUploadedBanner] = useState<string | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<
    'available' | 'taken' | null
  >(null)
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(
    null
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const currentProfileImage = useMemo(() => {
    return (
      uploadedProfileImage ||
      `/assets/user-profiles/profile-${profilePictureIndex}.jpg`
    )
  }, [uploadedProfileImage, profilePictureIndex])

  const currentBanner = useMemo(() => {
    return uploadedBanner || `/assets/user-banners/banner-${bannerIndex}.jpg`
  }, [uploadedBanner, bannerIndex])

  // Pre-fill form with imported social data
  useEffect(() => {
    if (!importedData || stage !== 'PROFILE') return

    logger.info(
      'Pre-filling profile with imported data',
      {
        platform: importedData.platform,
        hasProfileImage: !!importedData.profileImageUrl,
        hasCoverImage: !!importedData.coverImageUrl,
        hasBio: !!importedData.bio,
      },
      'OnboardingModal'
    )

    setDisplayName(importedData.displayName)
    setUsername(importedData.username)
    setBio(importedData.bio || '')

    if (importedData.profileImageUrl) {
      setUploadedProfileImage(importedData.profileImageUrl)
    } else {
      setUploadedProfileImage(null)
      setProfilePictureIndex(
        Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
      )
    }

    if (importedData.coverImageUrl) {
      setUploadedBanner(importedData.coverImageUrl)
    } else {
      setUploadedBanner(null)
      setBannerIndex(Math.floor(Math.random() * TOTAL_BANNERS) + 1)
    }
  }, [importedData, stage])

  // Fetch generated profile defaults
  const { data: generatedProfile } = useQuery({
    queryKey: ['onboarding', 'generateProfile'],
    queryFn: async (): Promise<GeneratedProfileResponse> => {
      return api.onboarding.generateProfile() as Promise<GeneratedProfileResponse>
    },
    enabled: isOpen && stage === 'PROFILE' && !importedData,
    staleTime: Infinity,
  })

  // Fetch random assets
  const { data: randomAssets } = useQuery({
    queryKey: ['onboarding', 'randomAssets'],
    queryFn: async (): Promise<RandomAssetsResponse> => {
      return api.onboarding.getRandomAssets() as Promise<RandomAssetsResponse>
    },
    enabled: isOpen && stage === 'PROFILE' && !importedData,
    staleTime: Infinity,
  })

  // Apply generated profile and assets when they load
  useEffect(() => {
    if (!isOpen || stage !== 'PROFILE') return

    if (importedData) {
      setIsLoadingDefaults(false)
      return
    }

    if (generatedProfile) {
      setDisplayName(generatedProfile.name)
      setUsername(generatedProfile.username)
      setBio(generatedProfile.bio)
    } else if (
      !generatedProfile &&
      isOpen &&
      stage === 'PROFILE' &&
      !importedData
    ) {
      setDisplayName('New Babylonian')
      setUsername(`user_${Math.random().toString(36).slice(2, 10)}`)
      setBio('Just joined Babylon')
    }

    if (randomAssets) {
      setProfilePictureIndex(randomAssets.profilePictureIndex)
      setBannerIndex(randomAssets.bannerIndex)
    } else if (
      !randomAssets &&
      isOpen &&
      stage === 'PROFILE' &&
      !importedData
    ) {
      setProfilePictureIndex(
        Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1
      )
      setBannerIndex(Math.floor(Math.random() * TOTAL_BANNERS) + 1)
    }

    setUploadedProfileImage(null)
    setUploadedBanner(null)
    setIsLoadingDefaults(false)
  }, [isOpen, stage, importedData, generatedProfile, randomAssets])

  // Initialize email from initialEmail prop when available
  useEffect(() => {
    if (initialEmail && !email && stage === 'PROFILE') {
      setEmail(initialEmail)
    }
  }, [initialEmail, email, stage])

  // Debounced username for check
  const [debouncedUsername, setDebouncedUsername] = useState(username)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(username)
    }, 300)
    return () => clearTimeout(timer)
  }, [username])

  // Username availability check query
  const { data: usernameCheckResult, isLoading: isCheckingUsernameQuery } =
    useQuery({
      queryKey: ['onboarding', 'checkUsername', debouncedUsername],
      queryFn: async (): Promise<{
        available: boolean
        suggestion?: string
      }> => {
        return api.onboarding.checkUsername(debouncedUsername) as Promise<{
          available: boolean
          suggestion?: string
        }>
      },
      enabled:
        stage === 'PROFILE' &&
        !!debouncedUsername &&
        debouncedUsername.length >= 3,
    })

  // Update username status from query result
  useEffect(() => {
    if (stage !== 'PROFILE') return
    if (!debouncedUsername || debouncedUsername.length < 3) {
      setUsernameStatus(null)
      setUsernameSuggestion(null)
      return
    }

    if (usernameCheckResult) {
      setUsernameStatus(usernameCheckResult.available ? 'available' : 'taken')
      setUsernameSuggestion(
        usernameCheckResult.available
          ? null
          : usernameCheckResult.suggestion || null
      )
    }
  }, [stage, debouncedUsername, usernameCheckResult])

  // Sync isCheckingUsername with query loading state
  useEffect(() => {
    setIsCheckingUsername(isCheckingUsernameQuery)
  }, [isCheckingUsernameQuery])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (stage !== 'PROFILE' || isSubmitting) return

    setFormError(null)

    if (!displayName.trim()) {
      setFormError('Please enter a display name')
      return
    }

    if (!username.trim() || username.length < 3) {
      setFormError('Please pick a username of at least 3 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setFormError(
        'Username can only contain letters, numbers, and underscores'
      )
      return
    }

    if (usernameStatus === 'taken') {
      setFormError('Username is already taken. Please choose another.')
      return
    }

    if (!acceptedTerms) {
      setFormError(
        'Please accept the Terms of Service and Privacy Policy to continue'
      )
      return
    }

    const profilePayload: OnboardingProfilePayload = {
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      email: email.trim() || undefined,
      bio: bio.trim() || undefined,
      profileImageUrl: resolveAssetUrl(
        uploadedProfileImage ??
          `/assets/user-profiles/profile-${profilePictureIndex}.jpg`
      ),
      coverImageUrl: resolveAssetUrl(
        uploadedBanner ?? `/assets/user-banners/banner-${bannerIndex}.jpg`
      ),
      importedFrom: importedData?.platform || null,
      twitterId:
        importedData && importedData.platform === 'twitter'
          ? importedData.twitterId
          : null,
      twitterUsername:
        importedData && importedData.platform === 'twitter'
          ? importedData.username
          : null,
      farcasterFid:
        importedData && importedData.platform === 'farcaster'
          ? importedData.farcasterFid
          : null,
      farcasterUsername:
        importedData && importedData.platform === 'farcaster'
          ? importedData.username
          : null,
      tosAccepted: acceptedTerms,
      privacyPolicyAccepted: acceptedTerms,
    }

    await onSubmitProfile(profilePayload)
  }

  const renderProfileForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-2">
        <label className="block font-medium text-sm">Profile Banner</label>
        <div className="group relative h-40 overflow-hidden rounded-lg bg-muted">
          <img
            src={currentBanner}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => cycleBanner('prev')}
              className="rounded-lg bg-background/80 p-2 hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <label className="cursor-pointer rounded-lg bg-background/80 p-2 hover:bg-background">
              <Upload className="h-5 w-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => cycleBanner('next')}
              className="rounded-lg bg-background/80 p-2 hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
          <img
            src={currentProfileImage}
            alt="Profile picture"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => cycleProfilePicture('prev')}
              className="rounded-lg bg-background/80 p-1.5 hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="cursor-pointer rounded-lg bg-background/80 p-1.5 hover:bg-background">
              <Upload className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileImageUpload}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => cycleProfilePicture('next')}
              className="rounded-lg bg-background/80 p-1.5 hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <label htmlFor="displayName" className="block font-medium text-sm">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="username" className="block font-medium text-sm">
              Username
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your handle"
                className="w-full rounded-lg border border-border bg-muted py-2 pr-3 pl-8 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                maxLength={20}
              />
              {isCheckingUsername && (
                <RefreshCw className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {usernameStatus === 'available' && !isCheckingUsername && (
                <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
              )}
              {usernameStatus === 'taken' && !isCheckingUsername && (
                <AlertCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-red-500" />
              )}
            </div>
            {usernameStatus === 'taken' && usernameSuggestion && (
              <p className="text-muted-foreground text-xs">
                Suggestion:{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setUsername(usernameSuggestion)}
                >
                  {usernameSuggestion}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block font-medium text-sm">
          Email{' '}
          <span className="font-normal text-muted-foreground text-xs">
            (optional)
          </span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
        />
        <p className="text-muted-foreground text-xs">
          Used for important updates and marketing (optional)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="block font-medium text-sm">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell the world who you are"
          rows={3}
          maxLength={280}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
        />
        <p className="text-right text-muted-foreground text-xs">
          {bio.length}/280
        </p>
      </div>

      {(formError || error) && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{formError || error}</span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <label className="group flex flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-[#0066FF] focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-0"
          />
          <span className="text-muted-foreground text-sm group-hover:text-foreground">
            I accept the{' '}
            <a
              href="https://docs.babylon.market/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0066FF] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://docs.babylon.market/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0066FF] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>
          </span>
        </label>
        <button
          type="submit"
          className={cn(
            'whitespace-nowrap rounded-lg bg-[#0066FF] px-4 py-2 text-primary-foreground hover:bg-[#0066FF]/90',
            isSubmitting && 'opacity-60'
          )}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </form>
  )

  const cycleProfilePicture = (direction: 'next' | 'prev') => {
    setUploadedProfileImage(null)
    setProfilePictureIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_PROFILE_PICTURES ? 1 : prev + 1
      }
      return prev <= 1 ? TOTAL_PROFILE_PICTURES : prev - 1
    })
  }

  const cycleBanner = (direction: 'next' | 'prev') => {
    setUploadedBanner(null)
    setBannerIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_BANNERS ? 1 : prev + 1
      }
      return prev <= 1 ? TOTAL_BANNERS : prev - 1
    })
  }

  const handleProfileImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedProfileImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedBanner(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const canClose = !isSubmitting
  const canLogout = stage !== 'COMPLETED' && !isSubmitting && onLogout

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
    }
  }

  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    }
    setIsVisible(false)
    return undefined
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[100] rounded-lg bg-black/70 backdrop-blur-sm transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={canClose ? onClose : undefined}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
        <div
          className={cn(
            'my-8 w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl transition-all duration-300',
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-border border-b p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#0066FF]/10 p-2">
                <Sparkles className="h-6 w-6 text-[#0066FF]" />
              </div>
              <div>
                <h2 className="font-bold text-2xl">Welcome to Babylon</h2>
                <p className="text-muted-foreground text-sm">
                  {stage === 'PROFILE'
                    ? 'Set up your profile'
                    : stage === 'ONCHAIN'
                      ? 'Complete registration'
                      : 'Setup complete'}
                </p>
                {stage === 'PROFILE' && importedData && (
                  <p className="mt-1 text-[#0066FF] text-xs">
                    Imported from{' '}
                    {importedData.platform === 'twitter' ? '𝕏' : 'Farcaster'}
                  </p>
                )}
                {user?.username && stage !== 'PROFILE' && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    @{user.username}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={canClose ? onClose : undefined}
              className="rounded-lg p-2 hover:bg-muted disabled:opacity-50"
              disabled={!canClose}
              title={canClose ? 'Close' : 'Complete onboarding to close'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {stage === 'COMPLETED' ? (
            <div className="flex flex-col items-center gap-4 p-12">
              <Check className="h-10 w-10 text-[#0066FF]" />
              <p className="font-semibold text-lg">
                Onboarding complete - Enjoy Babylon 🎉
              </p>
              <button
                type="button"
                className="rounded-lg bg-[#0066FF] px-4 py-2 text-primary-foreground"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          ) : stage === 'ONCHAIN' ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              {isSubmitting ? (
                <>
                  <div className="w-full max-w-md space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="mx-auto h-4 w-3/4" />
                  </div>
                  <p className="font-semibold text-lg">
                    Finalising on-chain registration...
                  </p>
                  <p className="max-w-md text-muted-foreground text-sm">
                    Waiting for blockchain confirmation. This may take 10-30
                    seconds.
                  </p>
                  <p className="mt-2 text-muted-foreground/70 text-xs">
                    You can close this window and return later - your
                    registration will continue in the background.
                  </p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="font-semibold text-lg">Registration Error</p>
                  <p className="max-w-md text-red-500 text-sm">{error}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {!error.toLowerCase().includes('already registered') && (
                      <div className="max-w-md text-muted-foreground text-xs">
                        <p className="mb-2 font-medium">Common issues:</p>
                        <ul className="list-inside list-disc space-y-1 text-left">
                          <li>Transaction rejected in wallet</li>
                          <li>Insufficient gas on Base Sepolia</li>
                          <li>Network connectivity issues</li>
                        </ul>
                      </div>
                    )}
                    {error.toLowerCase().includes('already registered') && (
                      <div className="max-w-md text-left text-muted-foreground text-xs">
                        <p className="mb-2">
                          Your wallet is already registered on the blockchain.
                          This can happen if you previously completed
                          registration or if another account is using this
                          wallet.
                        </p>
                        <p>
                          You can skip this step and continue using the platform
                          with your off-chain profile.
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[#0066FF] px-4 py-2 text-primary-foreground disabled:opacity-50"
                        onClick={onRetryOnchain}
                        disabled={isSubmitting}
                      >
                        Retry Registration
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-muted px-4 py-2 text-foreground"
                        onClick={onSkipOnchain}
                      >
                        Skip for Now
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="h-8 w-8 text-[#0066FF]" />
                  <p className="font-semibold text-lg">
                    Complete On-Chain Registration
                  </p>
                  <div className="max-w-md space-y-2 text-muted-foreground text-sm">
                    <p>
                      Register your identity on Base Sepolia blockchain to
                      unlock full features:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-left">
                      <li>On-chain reputation tracking</li>
                      <li>Verifiable trading history</li>
                      <li>NFT-based identity</li>
                    </ul>
                  </div>
                  {user?.walletAddress && (
                    <p className="text-muted-foreground/70 text-xs">
                      Wallet: {user.walletAddress.slice(0, 6)}...
                      {user.walletAddress.slice(-4)}
                    </p>
                  )}
                  {!isWalletReady && (
                    <p className="max-w-md text-amber-500 text-xs">
                      Preparing your Babylon smart wallet. We will continue
                      automatically once it is ready.
                    </p>
                  )}
                  <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
                    <button
                      type="button"
                      className="w-full rounded-lg bg-[#0066FF] px-4 py-2 text-primary-foreground hover:bg-[#0066FF]/90 disabled:opacity-50"
                      onClick={onRetryOnchain}
                      disabled={isSubmitting || !isWalletReady}
                    >
                      {isWalletReady
                        ? 'Register On-Chain'
                        : 'Preparing Wallet...'}
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-muted-foreground text-sm hover:text-foreground hover:underline"
                      onClick={onSkipOnchain}
                    >
                      Skip & Continue Exploring
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : isLoadingDefaults ? (
            <div className="flex flex-col items-center gap-4 p-12">
              <div className="w-full max-w-md space-y-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="mx-auto h-24 w-24 rounded-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            renderProfileForm()
          )}

          {/* Footer with logout option */}
          {canLogout && (
            <div className="flex justify-center gap-4 border-border border-t p-4 text-muted-foreground text-xs">
              <button
                onClick={handleLogout}
                className="hover:text-foreground hover:underline"
                disabled={isSubmitting}
              >
                Logout & Switch Account
              </button>
              {stage === 'ONCHAIN' && (
                <button
                  onClick={onSkipOnchain}
                  className="hover:text-foreground hover:underline"
                  disabled={isSubmitting}
                >
                  Skip On-Chain Registration
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
