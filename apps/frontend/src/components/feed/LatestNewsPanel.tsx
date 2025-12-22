import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Newspaper, TrendingUp } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../shared/Skeleton';
import { apiFetch } from '../../lib/api-client';

interface ArticleItem {
  id: string;
  title: string;
  summary: string;
  authorOrgName: string;
  byline?: string;
  sentiment?: string;
  category?: string;
  publishedAt: string;
  relatedQuestion?: number;
  slant?: string;
  biasScore?: number;
}

interface PostFromAPI {
  id: string;
  type?: string;
  articleTitle?: string | null;
  authorId: string;
  authorName?: string;
  byline?: string | null;
  sentiment?: string | null;
  category?: string | null;
  timestamp: string;
  biasScore?: number | null;
  slant?: string | null;
  content: string;
}

interface ArticlesResponse {
  posts?: PostFromAPI[];
}

/**
 * Latest news panel component for displaying recent articles.
 * Converted from Next.js to plain React.
 */
export function LatestNewsPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deduplicateArticles = useCallback(
    (articles: ArticleItem[]): ArticleItem[] => {
      if (articles.length <= 1) return articles;

      const uniqueArticles: ArticleItem[] = [];
      const seenArticles: Array<{
        article: ArticleItem;
        titleWords: Set<string>;
        timestamp: number;
      }> = [];

      const sorted = [...articles].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      for (const article of sorted) {
        const commonWords = new Set([
          'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
          'can', 'her', 'was', 'one', 'our', 'out', 'day', 'has',
        ]);
        const titleWords = new Set(
          article.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(' ')
            .filter((w) => w.length > 3 && !commonWords.has(w))
        );

        const timestamp = new Date(article.publishedAt).getTime();
        let isDuplicate = false;

        for (const seen of seenArticles) {
          const timeDiff = Math.abs(timestamp - seen.timestamp);
          const isSameTimeWindow = timeDiff < 6 * 60 * 60 * 1000;

          if (isSameTimeWindow && article.category === seen.article.category) {
            const intersection = new Set(
              [...titleWords].filter((w) => seen.titleWords.has(w))
            );
            const union = new Set([...titleWords, ...seen.titleWords]);
            const jaccardSimilarity = intersection.size / union.size;

            if (jaccardSimilarity >= 0.4) {
              isDuplicate = true;
              break;
            }
          }

          const intersection = new Set(
            [...titleWords].filter((w) => seen.titleWords.has(w))
          );
          const union = new Set([...titleWords, ...seen.titleWords]);
          const jaccardSimilarity = intersection.size / union.size;

          if (jaccardSimilarity >= 0.7) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          uniqueArticles.push(article);
          seenArticles.push({ article, titleWords, timestamp });
        }
      }

      return uniqueArticles;
    },
    []
  );

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['feed', 'latest-news'],
    queryFn: async (): Promise<ArticleItem[]> => {
      const response = await apiFetch('/api/posts?type=article&limit=15');

      if (!response.ok) {
        console.error('Failed to fetch articles:', response.status);
        return [];
      }

      const data: ArticlesResponse = await response.json();

      if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
        const articlesData: ArticleItem[] = data.posts
          .filter((post) => post.type === 'article')
          .map((post) => ({
            id: post.id,
            title: post.articleTitle || 'Untitled Article',
            summary: post.content,
            authorOrgName: post.authorName || post.authorId,
            byline: post.byline || undefined,
            sentiment: post.sentiment || undefined,
            category: post.category || undefined,
            publishedAt: post.timestamp,
            slant: post.slant || undefined,
            biasScore: post.biasScore !== null ? post.biasScore : undefined,
          }));

        return deduplicateArticles(articlesData).slice(0, 5);
      }

      return [];
    },
    staleTime: 30000,
  });

  const _refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feed', 'latest-news'] });
  }, [queryClient]);

  const getSentimentIcon = useMemo(
    () => (sentiment?: string) => {
      switch (sentiment) {
        case 'positive':
          return <TrendingUp className="h-4 w-4 text-green-500" />;
        case 'negative':
          return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
          return <Newspaper className="h-4 w-4 text-[#0066FF]" />;
      }
    },
    []
  );

  const getTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const handleArticleClick = (articleId: string) => {
    navigate(`/article/${articleId}`);
  };

  return (
    <div className="flex flex-1 flex-col rounded-2xl bg-sidebar p-4">
      <h2 className="mb-3 text-left font-bold text-foreground text-lg">
        Latest News
      </h2>
      {isLoading ? (
        <div className="flex-1 space-y-3 pl-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex-1 pl-3 text-muted-foreground text-sm">
          No articles available yet.
        </div>
      ) : (
        <div className="flex-1 space-y-2 pl-3">
          {articles.map((article) => (
            <div
              key={article.id}
              onClick={() => handleArticleClick(article.id)}
              className="-ml-1.5 flex cursor-pointer items-start gap-3 rounded-lg p-1.5 transition-colors duration-200 hover:bg-muted/50"
            >
              <div className="mt-0.5 shrink-0">
                {getSentimentIcon(article.sentiment)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground text-sm leading-snug">
                  {article.title}
                </p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {article.authorOrgName} · {getTimeAgo(article.publishedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
