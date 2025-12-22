/**
 * Profile Detail Page - View other users' profiles
 *
 * @route /profile/:id
 */

import type { ProfileInfo } from '@babylon/shared';
import {
  type Actor,
  cn,
  extractUsername,
  type FeedPost,
  getBannerImageUrl,
  isUsername,
  type Organization,
  POST_TYPES,
} from '@babylon/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Coins, MessageCircle, Search } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { FollowButton } from '@/components/interactions/FollowButton';
import { ModerationMenu } from '@/components/moderation/ModerationMenu';
import { SendPointsModal } from '@/components/points/SendPointsModal';
import { PostCard } from '@/components/posts/PostCard';
import { OnChainBadge } from '@/components/profile/OnChainBadge';
import { ProfileWidget } from '@/components/profile/ProfileWidget';
import { Avatar } from '@/components/shared/Avatar';
import { PageContainer } from '@/components/shared/PageContainer';
import {
  FeedSkeleton,
  ProfileHeaderSkeleton,
} from '@/components/shared/Skeleton';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { TradesFeed } from '@/components/trades/TradesFeed';
import { useAuth } from '@/hooks/useAuth';
import { useErrorToasts } from '@/hooks/useErrorToasts';
import { useGameStore } from '@/stores/gameStore';

interface ApiPost {
  id: string;
  content: string;
  author: string;
  authorId: string;
  timestamp: string;
  authorName?: string;
  authorUsername?: string | null;
  authorProfileImageUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isLiked?: boolean;
  isShared?: boolean;
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

export default function ProfileDetail() {
  const { id: rawId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const identifier = rawId ? decodeURIComponent(rawId) : '';
  const isUsernameParam = identifier ? isUsername(identifier) : false;
  const actorId = isUsernameParam ? extractUsername(identifier) : identifier;
  const { user, authenticated, getAccessToken } = useAuth();

  useEffect(() => {
    if (!identifier) {
      navigate('/', { replace: true });
    }
  }, [identifier, navigate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'posts' | 'replies' | 'trades'>('posts');
  const { allGames } = useGameStore();
  const [optimisticFollowerCount, setOptimisticFollowerCount] = useState<
    number | null
  >(null);

  const isOwnProfile =
    authenticated &&
    user &&
    (user.id === actorId ||
      user.id === decodeURIComponent(identifier) ||
      user.username === actorId ||
      (user.username &&
        user.username.startsWith('@') &&
        user.username.slice(1) === actorId) ||
      (user.username &&
        !user.username.startsWith('@') &&
        user.username === actorId));

  useLayoutEffect(() => {
    if (authenticated && user?.username && !isUsernameParam) {
      const decodedIdentifier = decodeURIComponent(identifier);
      const viewingOwnId =
        user.id === actorId ||
        user.id === decodedIdentifier ||
        user.id === identifier;

      if (viewingOwnId && user.username) {
        const cleanUsername = user.username.startsWith('@')
          ? user.username.slice(1)
          : user.username;
        if (
          cleanUsername &&
          identifier !== cleanUsername &&
          decodedIdentifier !== cleanUsername &&
          actorId !== cleanUsername
        ) {
          navigate(`/profile/${cleanUsername}`, { replace: true });
        }
      }
    }
  }, [
    authenticated,
    user?.id,
    user?.username,
    actorId,
    identifier,
    isUsernameParam,
    navigate,
  ]);

  useErrorToasts();

  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const [sendPointsModalOpen, setSendPointsModalOpen] = useState(false);

  const {
    data: actorInfo,
    isLoading: loading,
    refetch: loadActorInfo,
  } = useQuery({
    queryKey: ['profile', actorId],
    queryFn: async (): Promise<ProfileInfo | null> => {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const userResponse = await fetch(
        `/api/users/${encodeURIComponent(actorId)}/profile`,
        { headers }
      ).catch((error: Error) => {
        console.error('Error loading user by ID:', error);
        return null;
      });

      if (userResponse?.ok) {
        const userData = await userResponse.json();
        if (userData.user) {
          const fetchedUser = userData.user;
          const profileInfo: ProfileInfo = {
            id: fetchedUser.id,
            name: fetchedUser.displayName || fetchedUser.username || 'User',
            description: fetchedUser.bio || '',
            role: fetchedUser.isActor ? 'Actor' : 'User',
            type: fetchedUser.isActor ? 'actor' : ('user' as const),
            isUser: true,
            username: fetchedUser.username,
            profileImageUrl: fetchedUser.profileImageUrl,
            coverImageUrl: fetchedUser.coverImageUrl,
            stats: fetchedUser.stats,
          };

          if (fetchedUser.username && !isUsernameParam && !isOwnProfile) {
            const cleanUsername = fetchedUser.username.startsWith('@')
              ? fetchedUser.username.slice(1)
              : fetchedUser.username;
            navigate(`/profile/${cleanUsername}`, { replace: true });
          }

          return profileInfo;
        }
      }

      if (
        isUsernameParam ||
        (!actorId.startsWith('did:') &&
          actorId.length <= 42 &&
          !actorId.includes('-'))
      ) {
        const usernameLookupResponse = await fetch(
          `/api/users/by-username/${encodeURIComponent(actorId)}`,
          { headers }
        ).catch((error: Error) => {
          console.error('Error loading user by username:', error);
          return null;
        });

        if (usernameLookupResponse?.ok) {
          const usernameData = await usernameLookupResponse.json();
          if (usernameData.user) {
            const fetchedUser = usernameData.user;
            const profileInfo: ProfileInfo = {
              id: fetchedUser.id,
              name: fetchedUser.displayName || fetchedUser.username || 'User',
              description: fetchedUser.bio || '',
              role: fetchedUser.isActor ? 'Actor' : 'User',
              type: fetchedUser.isActor ? 'actor' : ('user' as const),
              isUser: true,
              username: fetchedUser.username,
              profileImageUrl: fetchedUser.profileImageUrl,
              coverImageUrl: fetchedUser.coverImageUrl,
              stats: fetchedUser.stats,
            };

            if (!isUsernameParam && fetchedUser.username && !isOwnProfile) {
              const cleanUsername = fetchedUser.username.startsWith('@')
                ? fetchedUser.username.slice(1)
                : fetchedUser.username;
              navigate(`/profile/${cleanUsername}`, { replace: true });
            }

            return profileInfo;
          }
        }
      }

      const response = await fetch('/api/actors');
      if (!response.ok) throw new Error('Failed to load actors');

      const actorsDb = (await response.json()) as {
        actors?: Actor[];
        organizations?: Organization[];
      };

      let actor = actorsDb.actors?.find((a) => a.id === actorId);
      if (!actor) {
        actor = actorsDb.actors?.find((a) => a.name === actorId);
      }
      if (actor) {
        let gameId: string | null = null;
        for (const game of allGames) {
          const allActors = [
            ...(game.setup?.mainActors || []),
            ...(game.setup?.supportingActors || []),
            ...(game.setup?.extras || []),
          ];
          if (allActors.some((a) => a.id === actorId)) {
            gameId = game.id;
            break;
          }
        }

        let stats = { followers: 0, following: 0, posts: 0 };
        const statsResponse = await fetch(
          `/api/actors/${encodeURIComponent(actor.id)}/stats`
        ).catch((error: Error) => {
          console.error('Failed to load actor stats:', error);
          return null;
        });

        if (statsResponse?.ok) {
          const statsData = await statsResponse.json();
          if (statsData.stats) {
            stats = {
              followers: statsData.stats.followers || 0,
              following: statsData.stats.following || 0,
              posts: statsData.stats.posts || 0,
            };
          }
        }

        return {
          id: actor.id,
          name: actor.name,
          description: actor.description,
          profileDescription: actor.profileDescription,
          tier: actor.tier,
          domain: actor.domain,
          personality: actor.personality,
          affiliations: actor.affiliations,
          role: actor.role || actor.tier || 'Actor',
          type: 'actor' as const,
          game: gameId ? { id: gameId } : undefined,
          username: ('username' in actor
            ? (actor.username as string)
            : actor.id) as string | undefined,
          stats,
        };
      }

      let org = actorsDb.organizations?.find((o) => o.id === actorId);
      if (!org) {
        org = actorsDb.organizations?.find((o) => o.name === actorId);
      }
      if (org) {
        let stats = { followers: 0, following: 0, posts: 0 };
        const statsResponse = await fetch(
          `/api/actors/${encodeURIComponent(org.id)}/stats`
        ).catch((error: Error) => {
          console.error('Failed to load organization stats:', error);
          return null;
        });

        if (statsResponse?.ok) {
          const statsData = await statsResponse.json();
          if (statsData.stats) {
            stats = {
              followers: statsData.stats.followers || 0,
              following: statsData.stats.following || 0,
              posts: statsData.stats.posts || 0,
            };
          }
        }

        return {
          id: org.id,
          name: org.name,
          description: org.description,
          profileDescription: org.profileDescription,
          type: 'organization' as const,
          role: 'Organization',
          stats,
        };
      }

      return null;
    },
    enabled: !!actorId,
  });

  const { data: apiPosts = [] as ApiPost[], isLoading: loadingPosts } =
    useQuery<ApiPost[]>({
      queryKey: ['profilePosts', actorInfo?.id ?? actorId],
      queryFn: async (): Promise<ApiPost[]> => {
        const searchId = actorInfo?.id || actorId;
        const response = await fetch(
          `/api/posts?actorId=${encodeURIComponent(searchId)}&limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.posts && Array.isArray(data.posts)) {
            return data.posts as ApiPost[];
          }
        }
        return [];
      },
      enabled: !!actorInfo?.id,
    });

  const handleMessageClick = async () => {
    if (!authenticated || !actorInfo?.id || isCreatingDM || !user?.id) return;

    setIsCreatingDM(true);

    const sortedIds = [user.id, actorInfo.id].sort();
    const chatId = `dm-${sortedIds.join('-')}`;

    navigate(`/chats?chat=${chatId}&newDM=${actorInfo.id}`);

    setIsCreatingDM(false);
  };

  useEffect(() => {
    const handleProfileUpdate = () => {
      setTimeout(() => {
        setOptimisticFollowerCount(null);
        loadActorInfo();
      }, 1000);
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () =>
      window.removeEventListener('profile-updated', handleProfileUpdate);
  }, [loadActorInfo]);

  useEffect(() => {
    if (actorInfo && optimisticFollowerCount !== null) {
      const timer = setTimeout(() => {
        setOptimisticFollowerCount(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [actorInfo, optimisticFollowerCount]);

  const gameStorePosts = useMemo(() => {
    const posts: Array<{
      post: FeedPost;
      gameId: string;
      gameName: string;
      timestampMs: number;
    }> = [];

    allGames.forEach((game) => {
      game.timeline?.forEach((day) => {
        day.feedPosts?.forEach((post) => {
          if (post.author === actorId) {
            const postDate = new Date(post.timestamp);
            posts.push({
              post,
              gameId: game.id,
              gameName: game.id,
              timestampMs: postDate.getTime(),
            });
          }
        });
      });
    });

    return posts.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [allGames, actorId]);

  const actorPosts = useMemo(() => {
    const combined: Array<{
      post: FeedPost;
      gameId: string;
      gameName: string;
      timestampMs: number;
    }> = [];

    apiPosts.forEach((apiPost) => {
      combined.push({
        post: {
          id: apiPost.id,
          day: 0,
          content: apiPost.content,
          author: apiPost.authorId,
          authorName: apiPost.authorName || actorInfo?.name || apiPost.authorId,
          authorUsername: apiPost.authorUsername || actorInfo?.username || null,
          authorProfileImageUrl:
            apiPost.authorProfileImageUrl || actorInfo?.profileImageUrl || null,
          timestamp: apiPost.timestamp,
          type: POST_TYPES.POST,
          sentiment: 0,
          clueStrength: 0,
          pointsToward: null,
          likeCount: apiPost.likeCount,
          commentCount: apiPost.commentCount,
          shareCount: apiPost.shareCount,
          isLiked: apiPost.isLiked,
          isShared: apiPost.isShared,
          isRepost: apiPost.isRepost,
          isQuote: apiPost.isQuote,
          quoteComment: apiPost.quoteComment,
          originalPostId: apiPost.originalPostId,
          originalPost: apiPost.originalPost,
        },
        gameId: '',
        gameName: '',
        timestampMs: new Date(apiPost.timestamp).getTime(),
      });
    });

    const apiPostIds = new Set(apiPosts.map((p) => p.id));
    gameStorePosts.forEach((gamePost) => {
      if (!apiPostIds.has(gamePost.post.id)) {
        combined.push({
          ...gamePost,
          post: {
            ...gamePost.post,
            authorProfileImageUrl:
              gamePost.post.authorProfileImageUrl ||
              actorInfo?.profileImageUrl ||
              null,
          },
        });
      }
    });

    return combined.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [apiPosts, gameStorePosts, actorInfo]);

  const originalPosts = useMemo(() => {
    return actorPosts.filter((item) => !item.post.replyTo);
  }, [actorPosts]);

  const replyPosts = useMemo(() => {
    return actorPosts.filter((item) => item.post.replyTo);
  }, [actorPosts]);

  const tabFilteredPosts = useMemo(() => {
    return tab === 'posts' ? originalPosts : replyPosts;
  }, [tab, originalPosts, replyPosts]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredPosts;

    const query = searchQuery.toLowerCase();
    return tabFilteredPosts.filter((item) =>
      item.post.content?.toLowerCase().includes(query)
    );
  }, [tabFilteredPosts, searchQuery]);

  if (!identifier) {
    return null;
  }

  if (loading) {
    if (isOwnProfile && user?.username && !isUsernameParam) {
      return null;
    }

    return (
      <PageContainer noPadding className="min-h-screen">
        <div className="mx-auto w-full max-w-[700px]">
          <ProfileHeaderSkeleton />
          <div className="mt-4 border-border/5 border-t">
            <FeedSkeleton count={5} />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!actorInfo) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="sticky top-0 z-10 bg-background">
          <div className="flex items-center gap-4 px-4 py-3">
            <Link
              to="/feed"
              className="rounded-full p-2 transition-colors hover:bg-muted/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-bold text-xl">Profile Not Found</h1>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">
            User or Actor &quot;{actorId}&quot; not found
          </p>
          <Link
            to="/feed"
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Back to Feed
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop: Content + Widget layout */}
      <div className="hidden flex-1 overflow-hidden xl:flex">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-4 py-3">
              <Link
                to="/feed"
                className="rounded-full p-2 transition-colors hover:bg-muted/50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex-1">
                <h1 className="font-bold text-xl">{actorInfo.name}</h1>
                <p className="text-muted-foreground text-sm">
                  {actorInfo.stats?.posts || actorPosts.length} posts
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="border-border border-b">
              <div className="relative h-[200px] bg-muted">
                {(() => {
                  const bannerUrl =
                    actorInfo.isUser &&
                    actorInfo.type === 'user' &&
                    'coverImageUrl' in actorInfo
                      ? (actorInfo.coverImageUrl as string)
                      : getBannerImageUrl(
                          null,
                          actorInfo.id,
                          actorInfo.type === 'organization'
                            ? 'organization'
                            : 'actor'
                        );

                  return bannerUrl ? (
                    <img
                      src={bannerUrl}
                      alt={`${actorInfo.name} banner`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove(
                          'hidden'
                        );
                      }}
                    />
                  ) : null;
                })()}
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-br from-primary/20 to-primary/5',
                    actorInfo.type === 'actor' ||
                      actorInfo.type === 'organization'
                      ? 'hidden'
                      : ''
                  )}
                />
              </div>

              <div className="px-4 pb-4">
                <div className="mb-4 flex items-start justify-between">
                  <div className="relative -mt-16 sm:-mt-20">
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-background bg-background sm:h-36 sm:w-36">
                      <Avatar
                        id={actorInfo.id}
                        name={
                          (actorInfo.name ?? actorInfo.username ?? '') as string
                        }
                        type={
                          actorInfo.type === 'organization'
                            ? 'business'
                            : actorInfo.isUser || actorInfo.type === 'user'
                              ? 'user'
                              : (actorInfo.type as 'actor' | undefined)
                        }
                        src={actorInfo.profileImageUrl || undefined}
                        size="lg"
                        className="h-full w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3">
                    {authenticated && user && user.id !== actorInfo.id && (
                      <>
                        {actorInfo.isUser && actorInfo.type === 'user' && (
                          <button
                            onClick={handleMessageClick}
                            disabled={isCreatingDM}
                            className="rounded-full border border-border p-2 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Send message"
                          >
                            <MessageCircle className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => setSendPointsModalOpen(true)}
                          className="rounded-full border border-border p-2 transition-colors hover:bg-muted/50"
                          title="Send points"
                        >
                          <Coins className="h-5 w-5" />
                        </button>
                        <FollowButton
                          userId={actorInfo.id}
                          size="md"
                          variant="button"
                          onFollowerCountChange={(delta) => {
                            setOptimisticFollowerCount((prev) => {
                              const currentCount =
                                prev !== null
                                  ? prev
                                  : actorInfo.stats?.followers || 0;
                              return Math.max(0, currentCount + delta);
                            });
                          }}
                        />
                        {actorInfo.isUser && actorInfo.type === 'user' && (
                          <ModerationMenu
                            targetUserId={actorInfo.id}
                            targetUsername={actorInfo.username ?? undefined}
                            targetDisplayName={actorInfo.name ?? undefined}
                            targetProfileImageUrl={
                              actorInfo.profileImageUrl ?? undefined
                            }
                            onActionComplete={() => {
                              loadActorInfo();
                            }}
                          />
                        )}
                      </>
                    )}
                    {isOwnProfile && (
                      <Link
                        to="/settings"
                        className="rounded-full border border-border px-4 py-2 font-bold transition-colors hover:bg-muted/50"
                      >
                        Edit profile
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-0.5 flex items-center gap-1">
                    <h2 className="font-bold text-xl">
                      {actorInfo.name ?? actorInfo.username ?? ''}
                    </h2>
                    {actorInfo.type === 'actor' && !actorInfo.isUser && (
                      <VerifiedBadge size="md" />
                    )}
                    {actorInfo.type === 'user' && (
                      <OnChainBadge
                        isRegistered={actorInfo.onChainRegistered ?? false}
                        nftTokenId={actorInfo.nftTokenId ?? null}
                        size="md"
                      />
                    )}
                  </div>
                  {actorInfo.username && (
                    <p className="text-[15px] text-muted-foreground">
                      @{actorInfo.username}
                    </p>
                  )}
                </div>

                {(actorInfo.profileDescription || actorInfo.description) && (
                  <p className="mb-3 whitespace-pre-wrap text-[15px] text-foreground">
                    {actorInfo.profileDescription || actorInfo.description}
                  </p>
                )}

                <div className="flex gap-4 text-[15px]">
                  <Link to="#" className="hover:underline">
                    <span className="font-bold text-foreground">
                      {actorInfo.stats?.following || 0}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      Following
                    </span>
                  </Link>
                  <Link to="#" className="hover:underline">
                    <span className="font-bold text-foreground">
                      {optimisticFollowerCount !== null
                        ? optimisticFollowerCount
                        : actorInfo.stats?.followers || 0}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      Followers
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur-sm">
              <div className="flex h-14 items-center justify-between px-4">
                <div className="flex flex-1 items-center">
                  <button
                    onClick={() => setTab('posts')}
                    className={cn(
                      'relative h-full px-4 font-semibold transition-all duration-300 hover:bg-muted/30',
                      tab === 'posts'
                        ? 'text-foreground opacity-100'
                        : 'text-foreground opacity-50'
                    )}
                  >
                    Posts
                  </button>
                  <button
                    onClick={() => setTab('replies')}
                    className={cn(
                      'relative h-full px-4 font-semibold transition-all duration-300 hover:bg-muted/30',
                      tab === 'replies'
                        ? 'text-foreground opacity-100'
                        : 'text-foreground opacity-50'
                    )}
                  >
                    Replies
                  </button>
                  <button
                    onClick={() => setTab('trades')}
                    className={cn(
                      'relative h-full px-4 font-semibold transition-all duration-300 hover:bg-muted/30',
                      tab === 'trades'
                        ? 'text-foreground opacity-100'
                        : 'text-foreground opacity-50'
                    )}
                  >
                    Trades
                  </button>
                </div>

                {tab !== 'trades' && (
                  <div className="relative w-64">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${tab}...`}
                      className="w-full rounded-full border-0 bg-muted py-2 pr-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-4">
              {tab === 'trades' ? (
                <TradesFeed userId={actorInfo.id} />
              ) : loadingPosts ? (
                <div className="w-full">
                  <FeedSkeleton count={5} />
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? 'No posts found matching your search'
                      : 'No posts yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredPosts.map((item, i) => {
                    const postData = {
                      id: item.post.id,
                      type: item.post.type,
                      content: item.post.content,
                      fullContent: item.post.fullContent || null,
                      articleTitle: item.post.articleTitle || null,
                      byline: item.post.byline || null,
                      biasScore: item.post.biasScore ?? null,
                      category: item.post.category || null,
                      authorId: item.post.author,
                      authorName: item.post.authorName,
                      authorUsername: item.post.authorUsername || null,
                      authorProfileImageUrl:
                        item.post.authorProfileImageUrl || null,
                      timestamp: item.post.timestamp,
                      likeCount: item.post.likeCount,
                      commentCount: item.post.commentCount,
                      shareCount: item.post.shareCount,
                      isLiked: item.post.isLiked,
                      isShared: item.post.isShared,
                      isRepost: item.post.isRepost || false,
                      isQuote: item.post.isQuote || false,
                      quoteComment: item.post.quoteComment || null,
                      originalPostId: item.post.originalPostId || null,
                      originalPost: item.post.originalPost || null,
                    };

                    return postData.type && postData.type === 'article' ? (
                      <ArticleCard
                        key={`${item.post.id}-${i}`}
                        post={postData}
                      />
                    ) : (
                      <PostCard
                        key={`${item.post.id}-${i}`}
                        post={postData}
                        showInteractions={true}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {actorInfo && actorInfo.isUser && (
          <div className="hidden w-96 flex-shrink-0 flex-col overflow-y-auto bg-sidebar p-4 xl:flex">
            <ProfileWidget userId={actorInfo.id} />
          </div>
        )}
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex flex-1 flex-col overflow-hidden xl:hidden">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-4 px-4 py-3">
            <Link
              to="/feed"
              className="rounded-full p-2 transition-colors hover:bg-muted/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <h1 className="font-bold text-xl">{actorInfo.name}</h1>
              <p className="text-muted-foreground text-sm">
                {actorInfo.stats?.posts || actorPosts.length} posts
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-border border-b">
            <div className="relative h-[200px] bg-muted">
              {(() => {
                const bannerUrl =
                  actorInfo.isUser &&
                  actorInfo.type === 'user' &&
                  'coverImageUrl' in actorInfo
                    ? (actorInfo.coverImageUrl as string)
                    : getBannerImageUrl(
                        null,
                        actorInfo.id,
                        actorInfo.type === 'organization'
                          ? 'organization'
                          : 'actor'
                      );

                return bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt={`${actorInfo.name} banner`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove(
                        'hidden'
                      );
                    }}
                  />
                ) : null;
              })()}
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-br from-primary/20 to-primary/5',
                  actorInfo.type === 'actor' ||
                    actorInfo.type === 'organization'
                    ? 'hidden'
                    : ''
                )}
              />
            </div>

            <div className="px-4 pb-4">
              <div className="mb-4 flex items-start justify-between">
                <div className="relative -mt-16 sm:-mt-20">
                  <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-background bg-background sm:h-36 sm:w-36">
                    <Avatar
                      id={actorInfo.id}
                      name={
                        (actorInfo.name ?? actorInfo.username ?? '') as string
                      }
                      type={
                        actorInfo.type === 'organization'
                          ? 'business'
                          : actorInfo.isUser || actorInfo.type === 'user'
                            ? 'user'
                            : (actorInfo.type as 'actor' | undefined)
                      }
                      src={actorInfo.profileImageUrl || undefined}
                      size="lg"
                      className="h-full w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3">
                  {authenticated && user && user.id !== actorInfo.id && (
                    <>
                      {actorInfo.isUser && actorInfo.type === 'user' && (
                        <button
                          onClick={handleMessageClick}
                          disabled={isCreatingDM}
                          className="rounded-full border border-border p-2 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Send message"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => setSendPointsModalOpen(true)}
                        className="rounded-full border border-border p-2 transition-colors hover:bg-muted/50"
                        title="Send points"
                      >
                        <Coins className="h-5 w-5" />
                      </button>
                      <FollowButton
                        userId={actorInfo.id}
                        size="md"
                        variant="button"
                        onFollowerCountChange={(delta) => {
                          setOptimisticFollowerCount((prev) => {
                            const currentCount =
                              prev !== null
                                ? prev
                                : actorInfo.stats?.followers || 0;
                            return Math.max(0, currentCount + delta);
                          });
                        }}
                      />
                    </>
                  )}
                  {isOwnProfile && (
                    <Link
                      to="/settings"
                      className="rounded-full border border-border px-4 py-2 font-bold transition-colors hover:bg-muted/50"
                    >
                      Edit profile
                    </Link>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-0.5 flex items-center gap-1">
                  <h2 className="font-bold text-xl">
                    {actorInfo.name ?? actorInfo.username ?? ''}
                  </h2>
                  {actorInfo.type === 'actor' && !actorInfo.isUser && (
                    <VerifiedBadge size="md" />
                  )}
                </div>
                {actorInfo.username && (
                  <p className="text-[15px] text-muted-foreground">
                    @{actorInfo.username}
                  </p>
                )}
              </div>

              {(actorInfo.profileDescription || actorInfo.description) && (
                <p className="mb-3 whitespace-pre-wrap text-[15px] text-foreground">
                  {actorInfo.profileDescription || actorInfo.description}
                </p>
              )}

              <div className="flex gap-4 text-[15px]">
                <Link to="#" className="hover:underline">
                  <span className="font-bold text-foreground">
                    {actorInfo.stats?.following || 0}
                  </span>
                  <span className="ml-1 text-muted-foreground">Following</span>
                </Link>
                <Link to="#" className="hover:underline">
                  <span className="font-bold text-foreground">
                    {optimisticFollowerCount !== null
                      ? optimisticFollowerCount
                      : actorInfo.stats?.followers || 0}
                  </span>
                  <span className="ml-1 text-muted-foreground">Followers</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col px-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center">
                <button
                  onClick={() => setTab('posts')}
                  className={cn(
                    'relative h-14 px-4 font-semibold transition-all duration-300 hover:bg-muted/30',
                    tab === 'posts'
                      ? 'text-foreground opacity-100'
                      : 'text-foreground opacity-50'
                  )}
                >
                  Posts
                </button>
                <button
                  onClick={() => setTab('replies')}
                  className={cn(
                    'relative h-14 px-4 font-semibold transition-all duration-300 hover:bg-muted/30',
                    tab === 'replies'
                      ? 'text-foreground opacity-100'
                      : 'text-foreground opacity-50'
                  )}
                >
                  Replies
                </button>
              </div>

              <div className="relative w-full py-2 sm:w-64 sm:py-0">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${tab}...`}
                  className="w-full rounded-full border-0 bg-muted py-2 pr-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="px-4">
            {loadingPosts ? (
              <div className="w-full">
                <FeedSkeleton count={4} />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'No posts found matching your search'
                    : 'No posts yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredPosts.map((item, i) => {
                  const postData = {
                    id: item.post.id,
                    type: item.post.type,
                    content: item.post.content,
                    fullContent: item.post.fullContent || null,
                    articleTitle: item.post.articleTitle || null,
                    byline: item.post.byline || null,
                    biasScore: item.post.biasScore ?? null,
                    category: item.post.category || null,
                    authorId: item.post.author,
                    authorName: item.post.authorName,
                    authorUsername: item.post.authorUsername || null,
                    authorProfileImageUrl:
                      item.post.authorProfileImageUrl || null,
                    timestamp: item.post.timestamp,
                    likeCount: item.post.likeCount,
                    commentCount: item.post.commentCount,
                    shareCount: item.post.shareCount,
                    isLiked: item.post.isLiked,
                    isShared: item.post.isShared,
                    isRepost: item.post.isRepost || false,
                    isQuote: item.post.isQuote || false,
                    quoteComment: item.post.quoteComment || null,
                    originalPostId: item.post.originalPostId || null,
                    originalPost: item.post.originalPost || null,
                  };

                  return postData.type && postData.type === 'article' ? (
                    <ArticleCard key={`${item.post.id}-${i}`} post={postData} />
                  ) : (
                    <PostCard
                      key={`${item.post.id}-${i}`}
                      post={postData}
                      showInteractions={true}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {actorInfo && (
        <SendPointsModal
          isOpen={sendPointsModalOpen}
          onClose={() => setSendPointsModalOpen(false)}
          recipientId={actorInfo.id}
          recipientName={actorInfo.name ?? actorInfo.username ?? ''}
          recipientUsername={actorInfo.username}
          onSuccess={() => {
            loadActorInfo();
          }}
        />
      )}
    </PageContainer>
  );
}
