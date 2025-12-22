/**
 * Route: /share/referral/:userId
 * Client-side shareable referral page
 * Fetches referral code and redirects to home with ref param
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

interface ReferralCodeResponse {
  referralCode: string | null;
}

async function fetchReferralCode(
  userId: string
): Promise<ReferralCodeResponse> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

  const response = await fetch(
    `${apiBaseUrl}/users/${encodeURIComponent(userId)}/referral-code`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch referral code: ${response.status}`);
  }

  return response.json() as Promise<ReferralCodeResponse>;
}

export default function ShareReferral() {
  const params = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const rawUserId = params.userId;
  const userId = rawUserId ? decodeURIComponent(rawUserId) : null;

  const { data, isSuccess, isError } = useQuery({
    queryKey: ['referralCode', userId],
    queryFn: () => fetchReferralCode(userId!),
    enabled: !!userId,
    retry: false,
    staleTime: 0,
  });

  // Handle redirect based on query result
  useEffect(() => {
    if (!userId) {
      navigate('/', { replace: true });
      return;
    }

    if (isSuccess && data?.referralCode) {
      navigate(`/?ref=${data.referralCode}`, { replace: true });
    } else if (isSuccess && !data?.referralCode) {
      navigate('/', { replace: true });
    } else if (isError) {
      navigate('/', { replace: true });
    }
  }, [userId, isSuccess, isError, data, navigate]);

  // Don't render with missing userId - redirect will happen via useEffect
  if (!userId) {
    return null;
  }

  return (
    <PageContainer>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
          <h1 className="mb-2 font-bold text-xl">Redirecting...</h1>
          <p className="text-muted-foreground">
            Taking you to your referral link
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
