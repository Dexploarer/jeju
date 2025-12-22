import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../shared/Skeleton';
import { apiFetch } from '../../lib/api-client';

interface TrendingItem {
  id: string;
  tags: string[];
  tagSlugs: string[];
  category?: string;
  summary?: string;
  postCount: number;
}

interface TrendingResponse {
  success: boolean;
  trending?: TrendingItem[];
}

/**
 * Trending panel component for displaying trending topics.
 * Converted from Next.js to plain React.
 */
export function TrendingPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: trending = [], isLoading } = useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: async (): Promise<TrendingItem[]> => {
      const response = await apiFetch('/api/feed/widgets/trending');
      if (!response.ok) {
        throw new Error('Failed to fetch trending');
      }
      const data: TrendingResponse = await response.json();
      if (!data.success) {
        return [];
      }
      if (!data.trending) {
        throw new Error('Trending API returned success without trending data');
      }
      return data.trending;
    },
    staleTime: 30000,
  });

  const _refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feed', 'trending'] });
  }, [queryClient]);

  const handleTrendingClick = (item: TrendingItem) => {
    if (item.tagSlugs.length > 1) {
      const tagSlugsParam = item.tagSlugs.join(',');
      navigate(`/trending/group?tags=${encodeURIComponent(tagSlugsParam)}`);
    } else {
      navigate(`/trending/${item.tagSlugs[0]}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col rounded-2xl bg-sidebar p-4">
      <h2 className="mb-3 text-left font-bold text-foreground text-lg">
        Trending
      </h2>
      {isLoading ? (
        <div className="flex-1 space-y-3 pl-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : trending.length === 0 ? (
        <div className="flex-1 pl-3 text-muted-foreground text-sm">
          No trending topics at the moment.
        </div>
      ) : (
        <div className="flex-1 space-y-2 pl-3">
          {trending.map((item) => (
            <div
              key={item.id}
              onClick={() => handleTrendingClick(item)}
              className="-ml-1.5 flex cursor-pointer items-start gap-3 rounded-lg p-1.5 transition-colors duration-200 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">
                  {item.category || 'Trending'} · Trending
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {item.tags.map((tag, idx) => (
                    <span key={idx}>
                      <span className="font-semibold text-foreground text-sm leading-snug">
                        {tag}
                      </span>
                      {idx < item.tags.length - 1 && (
                        <span className="mx-1 text-muted-foreground text-xs">
                          •
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                {item.summary && (
                  <p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
