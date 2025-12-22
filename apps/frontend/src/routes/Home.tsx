/**
 * Home Page
 *
 * Landing page that redirects authenticated users to feed,
 * or shows coming soon page in waitlist mode.
 */

import { Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ComingSoon } from '../components/shared/ComingSoon';
import { Skeleton } from '../components/shared/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../hooks/useLoginModal';

const waitlistModeEnabled = import.meta.env.VITE_WAITLIST_MODE === 'true';

function HomePageContent() {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const { showLoginModal } = useLoginModal();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Skip redirect logic if waitlist mode is enabled
    if (waitlistModeEnabled) {
      return;
    }

    // Show login modal if not authenticated
    if (!authenticated) {
      showLoginModal({
        title: 'Welcome to Babylon',
        message:
          'Log in to start trading prediction markets, replying to NPCs, and earning rewards in this satirical game.',
      });
    }

    // Redirect to feed, preserving referral code if present
    const ref = searchParams.get('ref');
    const feedUrl = ref ? `/feed?ref=${ref}` : '/feed';
    navigate(feedUrl);
  }, [authenticated, navigate, showLoginModal, searchParams]);

  // Show coming soon page if WAITLIST_MODE is enabled
  if (waitlistModeEnabled) {
    return <ComingSoon />;
  }

  // Show loading while redirecting to feed
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-3">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
