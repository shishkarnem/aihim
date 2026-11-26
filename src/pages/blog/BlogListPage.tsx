import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpen,
  Search,
  ArrowRight,
  Clock,
  Eye,
  Rss,
  FileCode2,
  Sparkles,
  Pin
} from 'lucide-react';
import { NeurosphereLoader } from '../../components/ui/NeurosphereLoader';
import {
  ProgressiveBlogImage,
  isSafeBlogUrl,
  normalizeClientMediaUrl,
  type TgMediaItem
} from './components/BlogRichBlocks';
import {
  getCachedBlogList,
  getCurrentScrollY,
  getSavedBlogScrollPosition,
  getSavedBlogScrollState,
  prefetchBlogPost,
  saveBlogScrollPosition,
  scrollPageToY,
  setCachedBlogList
} from './components/blogCache';

export interface BlogArticleItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_markdown: string;
  cover_image: string;
  cover_image_url?: string;
  cover_video_url?: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  author_name: string;
  author_role?: string;
  reading_time: number;
  published: boolean;
  views_count: number;
  external_id?: string | null;
  external_updated_at?: string;
  source_url?: string;
  telegram_post_url?: string;
  telegram_channel?: string;
  media_json?: string;
  buttons_json?: string;
  is_pinned?: boolean;
  pinned_order?: number;
  pinned_at?: number | null;
  created_at: number;
  updated_at: number;
}

export function resolveCardVideoUrl(post: BlogArticleItem): string {
  if (post.cover_video_url && isSafeBlogUrl(post.cover_video_url)) {
    return post.cover_video_url.trim();
  }
  if (post.media_json) {
    try {
      const items = JSON.parse(post.media_json) as TgMediaItem[];
      if (Array.isArray(items)) {
        const playable = items.find((m) => m.type === 'video' && !m.tooLarge && m.url && isSafeBlogUrl(m.url));
        if (playable?.url) return playable.url;
      }
    } catch {
      // ignore malformed media_json
    }
  }
  return '';
}

export const BlogCoverMedia: React.FC<{ post: BlogArticleItem; className?: string; priority?: boolean }> = memo(
  ({ post, className = '', priority = false }) => {
    const videoUrl = resolveCardVideoUrl(post);
    const imgSrc = normalizeClientMediaUrl(post.cover_image_url || post.cover_image);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [inView, setInView] = useState(priority);

    useEffect(() => {
      if (!videoUrl) return;
      const el = videoRef.current;
      if (!el || typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = Boolean(entries[0]?.isIntersecting);
          if (visible) {
            setInView(true);
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        },
        { rootMargin: '200px 0px' }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [videoUrl]);

    if (videoUrl) {
      return (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay={inView}
          muted
          loop
          playsInline
          preload={inView ? 'metadata' : 'none'}
          className={`w-full h-full object-cover ${className}`}
        />
      );
    }

    return (
      <ProgressiveBlogImage
        src={imgSrc}
        alt={post.title}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }
);

export const BlogListPage: React.FC = memo(() => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialHit = getCachedBlogList('Все', initialQuery);
  const initialHasPosts = Boolean(initialHit && initialHit.entry.posts.length > 0);
  const initialSavedY = initialHasPosts ? getSavedBlogScrollPosition('Все', initialQuery) : 0;

  const [posts, setPosts] = useState<BlogArticleItem[]>(() => initialHit?.entry.posts || []);
  const [categories, setCategories] = useState<string[]>(() => initialHit?.entry.categories || ['Все']);
  const [total, setTotal] = useState<number>(() => initialHit?.entry.total || 0);
  const [hasMore, setHasMore] = useState<boolean>(() => initialHit?.entry.hasMore || false);
  const [loading, setLoading] = useState<boolean>(() => !initialHasPosts);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(() => initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(() => initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const postsRef = useRef<BlogArticleItem[]>(posts);
  postsRef.current = posts;
  const categoriesRef = useRef<string[]>(categories);
  categoriesRef.current = categories;
  const nextOffsetRef = useRef<number>(
    Math.max(Number(initialHit?.entry.nextOffset) || 0, initialHit?.entry.posts.length || 0)
  );

  const inFlightReplaceRef = useRef(false);
  const inFlightMoreRef = useRef(false);
  const lastMoreCompletedAtRef = useRef(0);
  const autoLoadBlockedRef = useRef(false);
  const queryEpochRef = useRef(0);
  const skipEnterAnimRef = useRef<boolean>(initialHasPosts && initialSavedY > 0);

  const activeKey = `${selectedCategory}::${debouncedSearch}`;
  const prevActiveKeyRef = useRef<string>(activeKey);
  const restorePendingKeyRef = useRef<string | null>(activeKey);
  if (prevActiveKeyRef.current !== activeKey) {
    prevActiveKeyRef.current = activeKey;
    restorePendingKeyRef.current = activeKey;
    queryEpochRef.current += 1;
    autoLoadBlockedRef.current = false;
    nextOffsetRef.current = 0;
  }

  const isRestoringScrollRef = useRef(false);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  const fetchBatch = useCallback(
    async (offset: number, limit: number, replace: boolean, silent = false) => {
      if (replace) {
        if (silent && (inFlightReplaceRef.current || inFlightMoreRef.current)) return;
        inFlightReplaceRef.current = true;
        if (!silent) {
          setLoading(true);
          autoLoadBlockedRef.current = false;
        }
      } else {
        if (postsRef.current.length === 0 || offset <= 0) return;
        if (inFlightMoreRef.current || inFlightReplaceRef.current) return;
        inFlightMoreRef.current = true;
        setLoadingMore(true);
      }

      const reqCategory = selectedCategory;
      const reqSearch = debouncedSearch;
      const reqEpoch = queryEpochRef.current;

      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(limit)
        });
        if (reqCategory && reqCategory !== 'Все') {
          params.set('category', reqCategory);
        }
        if (reqSearch.trim()) {
          params.set('q', reqSearch.trim());
        }

        const res = await fetch(`/api/blog/posts?${params.toString()}`);
        if (reqEpoch !== queryEpochRef.current) return;

        if (!res.ok) {
          if (!replace) autoLoadBlockedRef.current = true;
          return;
        }

        const data = await res.json();
        if (reqEpoch !== queryEpochRef.current) return;

        const incoming: BlogArticleItem[] = Array.isArray(data.posts) ? data.posts : [];
        const nextTotal = Number(data.total) || incoming.length;
        const nextCategories =
          Array.isArray(data.categories) && data.categories.length > 0
            ? data.categories
            : categoriesRef.current;

        const currentPosts = postsRef.current;
        let nextPosts: BlogArticleItem[];

        if (replace && silent) {
          if (incoming.length === 0) return;
          if (currentPosts.length > incoming.length) {
            const incomingIds = new Set(incoming.map((p) => p.id));
            nextPosts = [
              ...incoming,
              ...currentPosts.slice(incoming.length).filter((p) => !incomingIds.has(p.id))
            ];
            nextOffsetRef.current = Math.max(nextOffsetRef.current, nextPosts.length);
          } else {
            nextPosts = incoming;
            nextOffsetRef.current = Number(data.nextOffset) || incoming.length;
          }
        } else if (replace) {
          nextPosts = incoming;
          nextOffsetRef.current = Number(data.nextOffset) || incoming.length;
        } else {
          const seen = new Set(currentPosts.map((p) => p.id));
          const uniqueIncoming = incoming.filter((p) => !seen.has(p.id));
          nextPosts = [...currentPosts, ...uniqueIncoming];
          nextOffsetRef.current = Math.max(
            Number(data.nextOffset) || offset + incoming.length,
            nextPosts.length
          );
          if (incoming.length > 0 && uniqueIncoming.length === 0 && Boolean(data.hasMore)) {
            autoLoadBlockedRef.current = true;
          }
        }

        const serverHasMore = Boolean(data.hasMore);
        const computedHasMore =
          incoming.length === 0
            ? false
            : replace && silent && nextPosts.length > incoming.length
              ? nextPosts.length < nextTotal
              : serverHasMore && nextPosts.length < nextTotal;

        postsRef.current = nextPosts;
        categoriesRef.current = nextCategories;

        setPosts(nextPosts);
        setTotal(nextTotal);
        setHasMore(computedHasMore);
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(nextCategories);
        }

        setCachedBlogList(reqCategory, reqSearch, {
          posts: nextPosts,
          total: nextTotal,
          hasMore: computedHasMore,
          nextOffset: nextOffsetRef.current,
          categories: nextCategories
        });
      } catch (err) {
        console.error('Failed to load blog posts:', err);
        if (!replace) {
          autoLoadBlockedRef.current = true;
        }
      } finally {
        if (replace) {
          inFlightReplaceRef.current = false;
          if (!silent && reqEpoch === queryEpochRef.current) {
            setLoading(false);
          }
        } else {
          lastMoreCompletedAtRef.current = Date.now();
          inFlightMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [selectedCategory, debouncedSearch]
  );

  // Instant restore from cache + stale-while-revalidate refresh (no loader flash when cached)
  useEffect(() => {
    const cached = getCachedBlogList(selectedCategory, debouncedSearch);
    if (cached && cached.entry.posts.length > 0) {
      postsRef.current = cached.entry.posts;
      nextOffsetRef.current = Math.max(
        Number(cached.entry.nextOffset) || 0,
        cached.entry.posts.length
      );
      if (cached.entry.categories?.length) {
        categoriesRef.current = cached.entry.categories;
        setCategories(cached.entry.categories);
      }
      setPosts(cached.entry.posts);
      setTotal(cached.entry.total);
      setHasMore(cached.entry.hasMore);
      setLoading(false);
      if (!cached.isFresh) {
        fetchBatch(0, 20, true, true);
      }
      return;
    }

    fetchBatch(0, 20, true, false);
  }, [selectedCategory, debouncedSearch, fetchBatch]);

  // Progressive scroll loading: 10 more articles each time sentinel enters viewport
  useEffect(() => {
    if (!hasMore || loading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (
          inFlightMoreRef.current ||
          inFlightReplaceRef.current ||
          isRestoringScrollRef.current ||
          autoLoadBlockedRef.current
        ) {
          return;
        }
        if (Date.now() - lastMoreCompletedAtRef.current < 450) return;
        const offset = Math.max(nextOffsetRef.current, postsRef.current.length);
        if (offset > 0) {
          fetchBatch(offset, 10, false);
        }
      },
      { rootMargin: '220px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, fetchBatch]);

  // Continuously save feed scroll position while on /blog (never overwrites during restore)
  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (window.location.pathname !== '/blog') return;
      if (restorePendingKeyRef.current === activeKey || isRestoringScrollRef.current) return;
      autoLoadBlockedRef.current = false;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (window.location.pathname !== '/blog') return;
        if (restorePendingKeyRef.current === activeKey || isRestoringScrollRef.current) return;
        saveBlogScrollPosition(selectedCategory, debouncedSearch, getCurrentScrollY());
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [activeKey, selectedCategory, debouncedSearch]);

  // Restore saved feed scroll position cleanly once cached/loaded posts render
  useLayoutEffect(() => {
    if (loading || posts.length === 0) return;
    if (restorePendingKeyRef.current !== activeKey) return;

    const saved = getSavedBlogScrollState(selectedCategory, debouncedSearch);
    if (saved.y <= 0 && !saved.slug) {
      restorePendingKeyRef.current = null;
      isRestoringScrollRef.current = false;
      scrollPageToY(0);
      return;
    }

    isRestoringScrollRef.current = true;
    userInteractedRef.current = false;

    const markUserInteracted = () => {
      userInteractedRef.current = true;
      isRestoringScrollRef.current = false;
      restorePendingKeyRef.current = null;
    };

    window.addEventListener('wheel', markUserInteracted, { passive: true, once: true });
    window.addEventListener('touchstart', markUserInteracted, { passive: true, once: true });
    window.addEventListener('keydown', markUserInteracted, { passive: true, once: true });

    const scrollToSlugFallback = () => {
      if (!saved.slug) return false;
      const safeSlug = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(saved.slug) : saved.slug;
      const card = document.querySelector(`[data-blog-slug="${safeSlug}"]`);
      if (card instanceof HTMLElement) {
        card.scrollIntoView({ block: 'center', behavior: 'auto' });
        return true;
      }
      return false;
    };

    const applyTarget = (allowSlugFallback = false) => {
      if (userInteractedRef.current || window.location.pathname !== '/blog') return;
      if (saved.y > 0) {
        if (Math.abs(getCurrentScrollY() - saved.y) > 8) {
          scrollPageToY(saved.y);
        }
        if (allowSlugFallback && Math.abs(getCurrentScrollY() - saved.y) > 140) {
          scrollToSlugFallback();
        }
      } else if (allowSlugFallback && saved.slug) {
        scrollToSlugFallback();
      }
    };

    applyTarget(false);
    const raf1 = window.requestAnimationFrame(() => applyTarget(false));
    const t1 = window.setTimeout(() => applyTarget(false), 70);
    const t2 = window.setTimeout(() => applyTarget(true), 190);
    const t3 = window.setTimeout(() => {
      applyTarget(true);
      isRestoringScrollRef.current = false;
      skipEnterAnimRef.current = false;
      restorePendingKeyRef.current = null;
    }, 380);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener('wheel', markUserInteracted);
      window.removeEventListener('touchstart', markUserInteracted);
      window.removeEventListener('keydown', markUserInteracted);
      isRestoringScrollRef.current = false;
    };
  }, [activeKey, loading, posts.length, selectedCategory, debouncedSearch]);

  const handleCardOpen = useCallback(
    (slug?: string) => {
      saveBlogScrollPosition(selectedCategory, debouncedSearch, getCurrentScrollY(), slug);
    },
    [selectedCategory, debouncedSearch]
  );

  const handleManualLoadMore = useCallback(() => {
    autoLoadBlockedRef.current = false;
    const offset = Math.max(nextOffsetRef.current, postsRef.current.length);
    if (offset > 0) {
      fetchBatch(offset, 10, false);
    }
  }, [fetchBatch]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const featuredPost = posts[0];
  const gridPosts = posts.slice(1);
  const skipEnterAnim = skipEnterAnimRef.current;

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Editorial Hero Header */}
      <header className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md p-5 sm:p-7 shadow-md">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[14px] font-bold text-amber-800">
              <BookOpen size={18} className="text-gold shrink-0" />
              <span>Журнал алхимика AIhim</span>
            </div>
            <h1 className="text-[26px] sm:text-[34px] font-gothic font-bold text-sepia leading-tight">
              Хроники, технологии ИИ и секреты алхимии
            </h1>
            <p className="text-[15px] sm:text-[16px] text-sepia/85 leading-relaxed">
              Гайды по трансмутации стихий, свежие материалы о нейросетевой автоматизации SAV AI, слова силы и разбор 12 слоёв реальности.
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] hover:brightness-105 text-ink font-gothic font-bold text-[14px] shadow-md transition-all shrink-0"
          >
            <Sparkles size={17} />
            <span>Открыть лабораторию</span>
          </Link>
        </div>

        {/* Search & Wrapped Categories (no horizontal overflow on mobile) */}
        <div className="mt-6 pt-5 border-t border-sepia/15 space-y-4">
          <div className="relative w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sepia/55 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Поиск по статьям, тегам и темам..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-sepia/25 bg-transparent backdrop-blur-sm text-[15px] text-sepia placeholder:text-sepia/50 focus:border-gold outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl border text-[14px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-gold bg-gradient-to-r from-[#F3E5C2]/80 to-[#E9D19B]/80 text-sepia shadow-xs'
                      : 'border-sepia/25 bg-transparent text-sepia/80 hover:border-gold/50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="py-12 flex justify-center bg-transparent">
          <NeurosphereLoader label="Загрузка" size="md" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sepia/30 bg-transparent p-10 text-center text-[15px] text-sepia/80">
          По вашему запросу статьи не найдены. Попробуйте сбросить фильтр категории или изменить поисковый запрос.
        </div>
      ) : (
        <>
          {/* Featured Lead Article */}
          {featuredPost && (
            <motion.article
              data-blog-slug={featuredPost.slug}
              initial={skipEnterAnim ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: skipEnterAnim ? 0 : 0.25 }}
              className="rounded-2xl border border-gold/45 bg-transparent backdrop-blur-md overflow-hidden shadow-lg hover:border-gold transition-all"
            >
              <Link
                to={`/blog/${featuredPost.slug}`}
                onPointerDown={() => handleCardOpen(featuredPost.slug)}
                onClick={() => handleCardOpen(featuredPost.slug)}
                onMouseEnter={() => prefetchBlogPost(featuredPost.slug)}
                onFocus={() => prefetchBlogPost(featuredPost.slug)}
                className="grid grid-cols-1 lg:grid-cols-12 group"
              >
                <div className="lg:col-span-6 aspect-[4/3] lg:aspect-auto lg:min-h-[300px] overflow-hidden border-b lg:border-b-0 lg:border-r border-sepia/15">
                  <BlogCoverMedia
                    post={featuredPost}
                    priority
                    className="group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="lg:col-span-6 p-5 sm:p-7 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] text-amber-800 font-semibold">
                      {featuredPost.is_pinned && (
                        <>
                          <span className="inline-flex items-center gap-1 text-amber-900 font-bold">
                            <Pin size={14} className="text-gold shrink-0" />
                            Закреплено
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span>{featuredPost.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(featuredPost.created_at).toLocaleDateString('ru-RU')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        {featuredPost.reading_time} мин. чтения
                      </span>
                    </div>
                    <h2 className="text-[22px] sm:text-[26px] font-gothic font-bold text-sepia group-hover:text-amber-900 transition-colors leading-snug break-words">
                      {featuredPost.title}
                    </h2>
                    <p className="text-[15px] sm:text-[16px] text-sepia/85 leading-relaxed break-words">
                      {featuredPost.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-sepia/15 text-[14px]">
                    <span className="text-sepia/75 font-medium truncate max-w-[60%]">
                      {featuredPost.author_name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-900 group-hover:translate-x-1 transition-transform shrink-0">
                      <span>Читать статью</span>
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          )}

          {/* Articles Grid */}
          {gridPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {gridPosts.map((post, idx) => (
                <motion.article
                  key={post.id}
                  data-blog-slug={post.slug}
                  initial={skipEnterAnim ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: skipEnterAnim ? 0 : 0.22,
                    delay: skipEnterAnim ? 0 : Math.min((idx % 10) * 0.03, 0.25)
                  }}
                  className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md overflow-hidden shadow-md hover:border-gold/70 transition-all flex flex-col"
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    onPointerDown={() => handleCardOpen(post.slug)}
                    onClick={() => handleCardOpen(post.slug)}
                    onMouseEnter={() => prefetchBlogPost(post.slug)}
                    onFocus={() => prefetchBlogPost(post.slug)}
                    className="flex flex-col h-full group"
                  >
                    <div className="aspect-[4/3] overflow-hidden border-b border-sepia/15">
                      <BlogCoverMedia
                        post={post}
                        className="group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-[14px] text-amber-800 font-semibold">
                          {post.is_pinned && (
                            <>
                              <span className="inline-flex items-center gap-1 text-amber-900 font-bold">
                                <Pin size={14} className="text-gold shrink-0" />
                                Закреплено
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{post.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{new Date(post.created_at).toLocaleDateString('ru-RU')}</span>
                          <span aria-hidden="true">·</span>
                          <span>{post.reading_time} мин.</span>
                        </div>
                        <h2 className="text-[19px] sm:text-[21px] font-gothic font-bold text-sepia group-hover:text-amber-900 transition-colors leading-snug break-words">
                          {post.title}
                        </h2>
                        <p className="text-[14px] sm:text-[15px] text-sepia/85 leading-relaxed break-words">
                          {post.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-sepia/15 text-[14px] text-sepia/80 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Eye size={15} className="text-sepia/60" />
                          <span>{post.views_count || 0}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-amber-900 group-hover:translate-x-1 transition-transform">
                          <span>Подробнее</span>
                          <ArrowRight size={15} />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}

          {/* Progressive Scroll Loader (10 articles per scroll) */}
          <div ref={sentinelRef} className="pt-2 min-h-[64px] flex flex-col items-center justify-center gap-3">
            {loadingMore && <NeurosphereLoader label="Загрузка" size="sm" />}
            {hasMore && !loadingMore && (
              <button
                type="button"
                onClick={handleManualLoadMore}
                className="px-5 py-2.5 rounded-xl border border-gold/55 bg-gradient-to-r from-[#F3E5C2]/80 to-[#E9D19B]/80 hover:from-[#F3E5C2] hover:to-[#E2C278] text-sepia font-bold text-[14px] shadow-xs cursor-pointer transition-all"
              >
                Показать ещё 10 статей ({posts.length} из {total})
              </button>
            )}
          </div>
        </>
      )}

      {/* SEO & Syndication Links */}
      <footer className="rounded-2xl border border-sepia/20 bg-transparent backdrop-blur-sm p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[14px] text-sepia/80">
        <div>
          Подпишитесь на обновления журнала AIhim в вашей RSS-читалке или откройте карту сайта для индексации.
        </div>
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-sepia hover:text-gold transition-colors"
          >
            <Rss size={16} className="text-gold" />
            <span>RSS-лента</span>
          </a>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-sepia hover:text-gold transition-colors"
          >
            <FileCode2 size={16} className="text-gold" />
            <span>Карта сайта Sitemap</span>
          </a>
        </div>
      </footer>
    </div>
  );
});
