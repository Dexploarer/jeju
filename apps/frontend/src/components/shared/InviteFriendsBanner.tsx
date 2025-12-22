import { getReferralUrl } from '@babylon/shared';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, Trophy, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../lib/api';

interface InviteFriendsBannerProps {
  onDismiss?: () => void;
}

interface ProfileUpdatePayload {
  bannerLastShown?: string;
  bannerDismissCount?: number;
}

async function updateUserProfile(
  userId: string,
  payload: ProfileUpdatePayload
): Promise<void> {
  const response = await apiFetch(
    `/api/users/${encodeURIComponent(userId)}/update-profile`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }
}

/**
 * Invite friends banner component for referral program.
 */
export function InviteFriendsBanner({ onDismiss }: InviteFriendsBannerProps) {
  const { user, setUser } = useAuthStore();
  const [copiedReferral, setCopiedReferral] = useState(false);
  const hasTrackedView = useRef(false);

  const trackViewMutation = useMutation({
    mutationFn: (userId: string) =>
      updateUserProfile(userId, {
        bannerLastShown: new Date().toISOString(),
      }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({
      userId,
      dismissCount,
    }: {
      userId: string;
      dismissCount: number;
    }) =>
      updateUserProfile(userId, {
        bannerDismissCount: dismissCount,
      }),
    onSuccess: (_, { dismissCount }) => {
      if (user) {
        setUser({
          ...user,
          bannerDismissCount: dismissCount,
        });
      }
      onDismiss?.();
    },
  });

  useEffect(() => {
    if (!user?.id || hasTrackedView.current) return;

    const viewKey = `banner_view_${user.id}`;
    const lastView = localStorage.getItem(viewKey);
    const now = Date.now();

    localStorage.setItem(viewKey, now.toString());

    if (!lastView || now - parseInt(lastView) > 86400000) {
      hasTrackedView.current = true;
      trackViewMutation.mutate(user.id);
    }
  }, [user?.id, trackViewMutation]);

  const handleCopyReferral = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user?.referralCode) return;
    const referralUrl = getReferralUrl(user.referralCode);
    await navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user?.id) return;

    const dismissKey = `banner_dismiss_${user.id}`;
    const dismissCount = parseInt(localStorage.getItem(dismissKey) ?? '0') + 1;
    localStorage.setItem(dismissKey, dismissCount.toString());
    localStorage.setItem(
      `banner_dismiss_time_${user.id}`,
      Date.now().toString()
    );

    dismissMutation.mutate({ userId: user.id, dismissCount });
  };

  if (!user?.referralCode) {
    return null;
  }

  return (
    <Link
      to="/rewards"
      className="group block border-border border-b transition-colors hover:bg-muted/30"
    >
      <div className="mx-auto max-w-feed p-4">
        <div className="relative rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4 transition-colors hover:border-purple-500/40">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 rounded-full p-1 opacity-0 transition-colors hover:bg-background/50 group-hover:opacity-100"
            title="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="mb-2 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-foreground">Invite Friends</h3>
            <span className="ml-auto rounded bg-green-500/10 px-2 py-1 text-green-500 text-xs">
              50% of fees
            </span>
          </div>
          <p className="mb-3 text-muted-foreground text-sm">
            Earn 50% of all trading fees from your referrals
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={handleCopyReferral}
              className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-foreground transition-colors hover:bg-sidebar-accent/70"
            >
              {copiedReferral ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="text-sm">Copy Link</span>
                </>
              )}
            </button>
            <span className="flex items-center gap-1 text-purple-500 text-sm group-hover:text-purple-400">
              View All
              <ExternalLink className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
