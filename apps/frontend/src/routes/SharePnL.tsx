/**
 * Route: /share/pnl/:userId
 * Client-side shareable P&L page
 *
 * NOTE: For static export, OG metadata is handled by CloudFront Lambda@Edge
 * or the backend API server. This page handles the redirect for actual users.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

export default function SharePnL() {
  const params = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const rawUserId = params.userId;
  const userId = rawUserId ? decodeURIComponent(rawUserId) : '';

  useEffect(() => {
    if (!userId) {
      navigate('/', { replace: true });
      return;
    }
    // Redirect to user's profile or markets page
    // The OG metadata has already been served by the time a real user sees this
    navigate(`/profile/${encodeURIComponent(userId)}`, { replace: true });
  }, [userId, navigate]);

  // Show loading state while redirecting
  return (
    <PageContainer>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
          <h1 className="mb-2 font-bold text-xl">Redirecting...</h1>
          <p className="text-muted-foreground">Taking you to the profile</p>
        </div>
      </div>
    </PageContainer>
  );
}
