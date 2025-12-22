/**
 * Post Detail Page
 *
 * @route /post/:id or /post/* for catch-all
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FeedCommentSection } from '@/components/feed/FeedCommentSection';
import { InteractionBar } from '@/components/interactions';
import { PostCard } from '@/components/posts/PostCard';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { useInteractionStore } from '@/stores/interactionStore';

interface PostData {
  id: string;
  type?: string;
  content: string;
  fullContent?: string | null;
  articleTitle?: string | null;
  byline?: string | null;
  biasScore?: number | null;
  sentiment?: string | null;
  slant?: string | null;
  category?: string | null;
  authorId: string;
  authorName: string;
  authorUsername?: string | null;
  authorProfileImageUrl?: string | null;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  isShared: boolean;
  isRepost?: boolean;
  isQuote?: boolean;
  quoteComment?: string | null;
  originalPostId?: string | null;
  originalPost?: {
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorProfileImageUrl: string | null;
    timestamp: string;
  } | null;
}

export default function PostDetail() {
  const { id, '*': catchAll } = useParams<{ id?: string; '*'?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Support both /post/:id and /post/* catch-all routes
  const postId = id || (catchAll ? catchAll.split('/')[0] : undefined);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const handleCommentClick = () => {
    setIsCommentModalOpen(true);
  };

  const {
    data: post,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await fetch(`/api/posts/${postId}`);
      const result = await response.json();
      const postData = result.data || result;

      if (postData.type === 'article' && postData.fullContent) {
        navigate(`/article/${postId}`, { replace: true });
        throw new Error('Redirecting to article');
      }

      const formattedPost: PostData = {
        id: postData.id,
        type: postData.type || 'post',
        content: postData.content,
        fullContent: postData.fullContent || null,
        articleTitle: postData.articleTitle || null,
        byline: postData.byline || null,
        biasScore: postData.biasScore !== undefined ? postData.biasScore : null,
        sentiment: postData.sentiment || null,
        slant: postData.slant || null,
        category: postData.category || null,
        authorId: postData.authorId,
        authorName: postData.authorName,
        authorUsername: postData.authorUsername || null,
        authorProfileImageUrl: postData.authorProfileImageUrl || null,
        timestamp: postData.timestamp,
        likeCount: postData.likeCount !== undefined ? postData.likeCount : 0,
        commentCount:
          postData.commentCount !== undefined ? postData.commentCount : 0,
        shareCount: postData.shareCount !== undefined ? postData.shareCount : 0,
        isLiked: postData.isLiked !== undefined ? postData.isLiked : false,
        isShared: postData.isShared !== undefined ? postData.isShared : false,
        isRepost: postData.isRepost || false,
        isQuote: postData.isQuote || false,
        quoteComment: postData.quoteComment || null,
        originalPostId: postData.originalPostId || null,
        originalPost: postData.originalPost || null,
      };

      const interactionPostId = postData.originalPostId || postId;
      const { postInteractions } = useInteractionStore.getState();
      const storeData = postInteractions.get(interactionPostId);

      if (
        postData.likeCount !== undefined ||
        postData.commentCount !== undefined
      ) {
        const store = useInteractionStore.getState();
        const updatedInteractions = new Map(store.postInteractions);
        updatedInteractions.set(interactionPostId, {
          postId: interactionPostId,
          likeCount: postData.likeCount ?? 0,
          commentCount: postData.commentCount ?? 0,
          shareCount: postData.shareCount ?? 0,
          isLiked: storeData?.isLiked ?? postData.isLiked ?? false,
          isShared: storeData?.isShared ?? postData.isShared ?? false,
        });
        useInteractionStore.setState({ postInteractions: updatedInteractions });
      }

      return formattedPost;
    },
    enabled: !!postId,
  });

  const error = queryError && queryError.message ? queryError.message : null;

  useEffect(() => {
    if (!postId) return;

    const unsubscribe = useInteractionStore.subscribe((state) => {
      const storeData = state.postInteractions.get(postId);
      if (storeData) {
        queryClient.setQueryData(
          ['post', postId],
          (prev: PostData | undefined) => {
            if (!prev) return undefined;

            if (
              prev.likeCount === storeData.likeCount &&
              prev.commentCount === storeData.commentCount &&
              prev.shareCount === storeData.shareCount &&
              prev.isLiked === storeData.isLiked &&
              prev.isShared === storeData.isShared
            ) {
              return prev;
            }

            return {
              ...prev,
              likeCount: storeData.likeCount,
              commentCount: storeData.commentCount,
              shareCount: storeData.shareCount,
              isLiked: storeData.isLiked,
              isShared: storeData.isShared,
            };
          }
        );
      }
    });

    return () => unsubscribe();
  }, [postId, queryClient]);

  useEffect(() => {
    if (!postId) {
      navigate('/', { replace: true });
    }
  }, [postId, navigate]);

  if (!postId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-feed space-y-4 px-4 py-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-3">
        <div className="text-center">
          <h1 className="mb-2 font-bold text-2xl">Post Not Found</h1>
          <p className="mb-4 text-muted-foreground">
            {error || 'The post you are looking for does not exist.'}
          </p>
          <button
            onClick={() => navigate('/feed')}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      {/* Desktop: Multi-column layout */}
      <div className="hidden flex-1 overflow-hidden lg:flex">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 shrink-0 border-border border-b bg-background shadow-sm">
            <div className="px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#0066FF]" />
                  <h1 className="font-semibold text-lg">Post</h1>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-feed">
              <div className="border-border border-b">
                {post.type === 'article' &&
                post.fullContent &&
                post.fullContent.length > 100 ? (
                  <article className="px-4 py-4 sm:px-6 sm:py-5">
                    {post.category && (
                      <div className="mb-4">
                        <span className="rounded bg-[#0066FF]/20 px-3 py-1 font-semibold text-[#0066FF] text-sm uppercase">
                          {post.category}
                        </span>
                      </div>
                    )}

                    <h1 className="mb-4 font-bold text-3xl text-foreground leading-tight sm:text-4xl">
                      {post.articleTitle || 'Untitled Article'}
                    </h1>

                    <div className="mb-6 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                      <span className="font-semibold text-[#0066FF]">
                        {post.authorName}
                      </span>
                      {post.byline && (
                        <>
                          <span>·</span>
                          <span>{post.byline}</span>
                        </>
                      )}
                      <span>·</span>
                      <time>
                        {new Date(post.timestamp).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </time>
                    </div>

                    <div className="prose prose-lg prose-invert mb-6 max-w-none">
                      {post.fullContent.split('\n\n').map((paragraph, i) => (
                        <p
                          key={i}
                          className="mb-4 text-base text-foreground leading-relaxed sm:text-lg"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    <div className="mt-6 border-border border-t pt-4">
                      <InteractionBar
                        postId={post.id}
                        initialInteractions={{
                          postId: post.id,
                          likeCount: post.likeCount,
                          commentCount: post.commentCount,
                          shareCount: post.shareCount,
                          isLiked: post.isLiked,
                          isShared: post.isShared,
                        }}
                        postData={post}
                        onCommentClick={handleCommentClick}
                      />
                    </div>
                  </article>
                ) : (
                  <PostCard
                    post={post}
                    showInteractions={true}
                    isDetail
                    onCommentClick={handleCommentClick}
                  />
                )}
              </div>

              <div className="border-border border-b">
                <FeedCommentSection postId={postId} postData={post} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Single column layout */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
        <div className="sticky top-0 z-10 shrink-0 border-border border-b bg-background">
          <div className="flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#0066FF]" />
              <h1 className="font-semibold text-lg">Post</h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-border border-b">
            {post.type === 'article' &&
            post.fullContent &&
            post.fullContent.length > 100 ? (
              <article className="px-4 py-4 sm:px-6 sm:py-5">
                {post.category && (
                  <div className="mb-4">
                    <span className="rounded bg-[#0066FF]/20 px-3 py-1 font-semibold text-[#0066FF] text-sm uppercase">
                      {post.category}
                    </span>
                  </div>
                )}

                <h1 className="mb-4 font-bold text-2xl text-foreground leading-tight sm:text-3xl">
                  {post.articleTitle || 'Untitled Article'}
                </h1>

                <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                  <span className="font-semibold text-[#0066FF]">
                    {post.authorName}
                  </span>
                  {post.byline && (
                    <>
                      <span>·</span>
                      <span>{post.byline}</span>
                    </>
                  )}
                  <span>·</span>
                  <time>
                    {new Date(post.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>

                <div className="prose prose-invert mb-4 max-w-none">
                  {post.fullContent.split('\n\n').map((paragraph, i) => (
                    <p
                      key={i}
                      className="mb-4 text-base text-foreground leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="mt-4 border-border border-t pt-4">
                  <InteractionBar
                    postId={post.id}
                    initialInteractions={{
                      postId: post.id,
                      likeCount: post.likeCount,
                      commentCount: post.commentCount,
                      shareCount: post.shareCount,
                      isLiked: post.isLiked,
                      isShared: post.isShared,
                    }}
                    postData={post}
                    onCommentClick={handleCommentClick}
                  />
                </div>
              </article>
            ) : (
              <PostCard
                post={post}
                showInteractions={true}
                isDetail
                onCommentClick={handleCommentClick}
              />
            )}
          </div>

          <div className="border-border border-b">
            <FeedCommentSection postId={postId} postData={post} />
          </div>
        </div>
      </div>

      {isCommentModalOpen && (
        <FeedCommentSection
          postId={postId}
          postData={post}
          onClose={() => setIsCommentModalOpen(false)}
        />
      )}
    </PageContainer>
  );
}
