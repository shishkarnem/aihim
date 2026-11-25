import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  AIHIM_FALLBACK_COVER,
  isSafeBlogUrl,
  normalizeClientMediaUrl,
  type TgMediaItem
} from './components/BlogRichBlocks';

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

const BlogCoverMedia: React.FC<{ post: BlogArticleItem; className?: string }> = ({
  post,
  className = ''
}) => {
  const videoUrl = resolveCardVideoUrl(post);
  const [imgSrc, setImgSrc] = useState(() =>
    normalizeClientMediaUrl(post.cover_image_url || post.cover_image)
  );

  useEffect(() => {
    setImgSrc(normalizeClientMediaUrl(post.cover_image_url || post.cover_image));
  }, [post.cover_image_url, post.cover_image]);

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <img
      src={imgSrc}
      alt={post.title}
      referrerPolicy="no-referrer"
      onError={() => {
        if (imgSrc !== AIHIM_FALLBACK_COVER) setImgSrc(AIHIM_FALLBACK_COVER);
      }}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const BlogListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogArticleItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['Все']);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBatch = useCallback(
    async (offset: number, limit: number, replace: boolean) => {
      if (inFlightRef.current && !replace) return;
      inFlightRef.current = true;
      if (replace) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(limit)
        });
        if (selectedCategory && selectedCategory !== 'Все') {
          params.set('category', selectedCategory);
        }
        if (debouncedSearch.trim()) {
          params.set('q', debouncedSearch.trim());
        }

        const res = await fetch(`/api/blog/posts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: BlogArticleItem[] = Array.isArray(data.posts) ? data.posts : [];
          setPosts((prev) => {
            if (replace) return incoming;
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...incoming.filter((p) => !seen.has(p.id))];
          });
          setTotal(Number(data.total) || incoming.length);
          setHasMore(Boolean(data.hasMore));
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories);
          }
        }
      } catch (err) {
        console.error('Failed to load blog posts:', err);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, debouncedSearch]
  );

  // Initial load: strictly <= 20 articles per page
  useEffect(() => {
    fetchBatch(0, 20, true);
  }, [fetchBatch]);

  // Progressive scroll loading: 10 more articles each time sentinel enters viewport
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !inFlightRef.current) {
          fetchBatch(posts.length, 10, false);
        }
      },
      { rootMargin: '280px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, posts.length, fetchBatch]);

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
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-gold/45 bg-transparent backdrop-blur-md overflow-hidden shadow-lg hover:border-gold transition-all"
            >
              <Link to={`/blog/${featuredPost.slug}`} className="grid grid-cols-1 lg:grid-cols-12 group">
                <div className="lg:col-span-6 aspect-[4/3] lg:aspect-auto lg:min-h-[300px] overflow-hidden border-b lg:border-b-0 lg:border-r border-sepia/15">
                  <BlogCoverMedia
                    post={featuredPost}
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
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min((idx % 10) * 0.03, 0.25) }}
                  className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md overflow-hidden shadow-md hover:border-gold/70 transition-all flex flex-col"
                >
                  <Link to={`/blog/${post.slug}`} className="flex flex-col h-full group">
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
          <div ref={sentinelRef} className="pt-2 flex flex-col items-center justify-center gap-3">
            {loadingMore && <NeurosphereLoader label="Загрузка" size="sm" />}
            {hasMore && !loadingMore && (
              <button
                type="button"
                onClick={() => fetchBatch(posts.length, 10, false)}
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
};
