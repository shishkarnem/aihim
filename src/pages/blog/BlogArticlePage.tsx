import React, { memo, useEffect, useLayoutEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Sparkles,
  User,
  Check,
  ExternalLink,
  X
} from 'lucide-react';
import { NeurosphereLoader } from '../../components/ui/NeurosphereLoader';
import { publishSeoOverride } from '../../components/seo/SeoHeadManager';
import { BlogMarkdownRenderer } from './BlogMarkdownRenderer';
import { BlogCoverMedia, type BlogArticleItem } from './BlogListPage';
import {
  AIHIM_FALLBACK_COVER,
  ProgressiveBlogImage,
  TgButtonsBlock,
  TgVideoBlock,
  isSafeBlogUrl,
  normalizeClientMediaUrl,
  type TgButtonItem,
  type TgMediaItem
} from './components/BlogRichBlocks';
import {
  getCachedBlogArticle,
  getCachedRelatedArticles,
  prefetchBlogPost,
  scrollPageToY,
  setCachedBlogArticle
} from './components/blogCache';

function publishArticleSeo(loaded: BlogArticleItem) {
  const origin = window.location.origin;
  const imgCover = normalizeClientMediaUrl(loaded.cover_image_url || loaded.cover_image);
  const coverAbs = imgCover.startsWith('http')
    ? imgCover
    : `${origin}${imgCover.startsWith('/') ? '' : '/'}${imgCover}`;

  publishSeoOverride({
    title: loaded.seo_title || `${loaded.title} — Блог AIhim`,
    description: loaded.seo_description || loaded.excerpt,
    keywords: loaded.seo_keywords || (loaded.tags || []).join(', '),
    canonical: `${origin}/blog/${loaded.slug}`,
    ogType: 'article',
    ogImage: coverAbs,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: loaded.title,
      description: loaded.seo_description || loaded.excerpt,
      image: [coverAbs],
      datePublished: new Date(loaded.created_at).toISOString(),
      dateModified: new Date(loaded.updated_at || loaded.created_at).toISOString(),
      author: { '@type': 'Person', name: loaded.author_name },
      publisher: {
        '@type': 'Organization',
        name: 'AIhim (ООО «РентРоп»)',
        logo: { '@type': 'ImageObject', url: `${origin}/file/42/pwa_icon_512x512.png` }
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${origin}/blog/${loaded.slug}` },
      keywords: loaded.seo_keywords || (loaded.tags || []).join(', ')
    }
  });
}

export const BlogArticlePage: React.FC = memo(() => {
  const { slug } = useParams<{ slug: string }>();
  const initialCached = slug ? getCachedBlogArticle(slug) : null;
  const initialRelated = slug ? getCachedRelatedArticles(slug, 3) : [];

  const [post, setPost] = useState<BlogArticleItem | null>(() => initialCached?.post || null);
  const [relatedPosts, setRelatedPosts] = useState<BlogArticleItem[]>(() => initialRelated);
  const [loading, setLoading] = useState<boolean>(() => !initialCached?.post);
  const [notFound, setNotFound] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);

  // Always open every article from the very top of the page
  useLayoutEffect(() => {
    scrollPageToY(0);
    const raf = window.requestAnimationFrame(() => {
      scrollPageToY(0);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [slug]);

  useEffect(() => {
    if (!coverLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCoverLightboxOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [coverLightboxOpen]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setCoverLightboxOpen(false);
    setNotFound(false);

    const cached = getCachedBlogArticle(slug);
    const cachedRelated = getCachedRelatedArticles(slug, 3);
    if (cachedRelated.length > 0) {
      setRelatedPosts(cachedRelated);
    }

    if (cached?.post) {
      setPost(cached.post);
      setLoading(false);
      publishArticleSeo(cached.post);
    } else {
      setPost(null);
      setLoading(true);
    }

    (async () => {
      try {
        const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}?track=1`);
        if (!res.ok) {
          if (!cancelled && !cached?.post) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.post) {
          const loaded: BlogArticleItem = data.post;
          setCachedBlogArticle(loaded);
          setPost((prev) => {
            if (
              prev &&
              prev.slug === loaded.slug &&
              prev.updated_at === loaded.updated_at &&
              prev.content_markdown === loaded.content_markdown
            ) {
              return prev.views_count === loaded.views_count
                ? prev
                : { ...prev, views_count: loaded.views_count };
            }
            return loaded;
          });
          publishArticleSeo(loaded);
        }

        if (cachedRelated.length === 0) {
          const listRes = await fetch('/api/blog/posts?limit=6&offset=0');
          if (listRes.ok) {
            const listData = await listRes.json();
            if (!cancelled && Array.isArray(listData.posts)) {
              setRelatedPosts(listData.posts.filter((p: BlogArticleItem) => p.slug !== slug).slice(0, 3));
            }
          }
        }
      } catch (err) {
        console.error('Error loading blog article:', err);
        if (!cancelled && !cached?.post) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      publishSeoOverride(null);
    };
  }, [slug]);

  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center bg-transparent">
        <NeurosphereLoader label="Загрузка" size="md" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md p-8 text-center space-y-4">
        <h1 className="text-[24px] font-gothic font-bold text-sepia">Статья не найдена</h1>
        <p className="text-[15px] text-sepia/80">
          Возможно, этот свиток был перемещён или удалён из журнала.
        </p>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] text-ink font-bold text-[14px]"
        >
          <ArrowLeft size={16} />
          <span>Вернуться ко всем статьям</span>
        </Link>
      </div>
    );
  }

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(post.title);
  const rawMd = String(post.content_markdown || '');
  const hasInlineTgButtons = rawMd.includes('```tg-buttons');
  const hasInlineRichMedia =
    rawMd.includes('```tg-video') ||
    rawMd.includes('```tg-gallery') ||
    /!\[[^\]]*\]\([^)]+\)/.test(rawMd);

  let parsedMedia: TgMediaItem[] = [];
  if (post.media_json) {
    try {
      const m = JSON.parse(post.media_json);
      if (Array.isArray(m)) parsedMedia = m;
    } catch {
      parsedMedia = [];
    }
  }

  let extraButtons: TgButtonItem[][] = [];
  if (!hasInlineTgButtons && post.buttons_json) {
    try {
      const parsed = JSON.parse(post.buttons_json);
      if (Array.isArray(parsed)) extraButtons = parsed;
    } catch {
      extraButtons = [];
    }
  }
  const safeTelegramPostUrl = isSafeBlogUrl(post.telegram_post_url) ? post.telegram_post_url : '';

  const singlePhotoItem = parsedMedia.find((m) => m.type !== 'video' && m.url && isSafeBlogUrl(m.url));
  const rawCoverCandidate = (post.cover_image_url || post.cover_image || singlePhotoItem?.url || '').trim();
  const normalizedCover = normalizeClientMediaUrl(rawCoverCandidate);
  const hasCustomOrPhotoCover =
    !post.external_id ||
    Boolean(singlePhotoItem) ||
    (rawCoverCandidate !== '' && normalizedCover !== AIHIM_FALLBACK_COVER);
  const standaloneVideoUrl =
    !hasInlineRichMedia && post.cover_video_url && isSafeBlogUrl(post.cover_video_url)
      ? post.cover_video_url.trim()
      : '';
  const showStandaloneCoverImage = !hasInlineRichMedia && !standaloneVideoUrl && hasCustomOrPhotoCover;

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Breadcrumbs */}
      <nav aria-label="Хлебные крошки" className="flex flex-wrap items-center gap-2 text-[14px] text-sepia/80">
        <Link to="/" className="hover:text-gold transition-colors">
          Главная
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1 hover:text-gold transition-colors font-semibold text-sepia"
        >
          <ArrowLeft size={15} />
          <span>Журнал алхимика</span>
        </Link>
        <span aria-hidden="true">·</span>
        <span className="text-amber-900 font-semibold">{post.category}</span>
      </nav>

      {/* Main Article Frame — NO duplicate top cover image/video banner inside the article */}
      <article className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md overflow-hidden shadow-lg">
        <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-amber-800 font-semibold tabular-nums">
            <span>{post.category}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-sepia/85">
              <User size={15} />
              <span>{post.author_name}</span>
              {post.author_role ? <span className="text-sepia/65">({post.author_role})</span> : null}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-sepia/80">
              <Calendar size={15} />
              {new Date(post.created_at).toLocaleDateString('ru-RU')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-sepia/80">
              <Clock size={15} />
              {post.reading_time} мин.
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-sepia/80">
              <Eye size={15} />
              {post.views_count || 0}
            </span>
            {safeTelegramPostUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={safeTelegramPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-amber-900 hover:text-gold underline underline-offset-4"
                >
                  <span>Источник в Telegram</span>
                  <ExternalLink size={14} />
                </a>
              </>
            )}
          </div>

          <h1 className="text-[26px] sm:text-[34px] font-gothic font-bold text-sepia leading-tight break-words">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-[16px] sm:text-[18px] text-sepia/85 italic leading-relaxed border-b border-sepia/15 pb-5">
              {post.excerpt}
            </p>
          )}

          {/* Standalone cover image / single photo for posts without inline gallery or video */}
          {standaloneVideoUrl && (
            <TgVideoBlock
              item={{
                type: 'video',
                url: standaloneVideoUrl,
                postUrl: safeTelegramPostUrl || undefined
              }}
            />
          )}

          {showStandaloneCoverImage && (
            <figure className="my-4">
              <div className="aspect-[16/9] w-full max-h-[460px] rounded-2xl border border-sepia/25 overflow-hidden shadow-sm">
                <ProgressiveBlogImage
                  src={normalizedCover}
                  alt={post.title}
                  priority
                  onClick={() => setCoverLightboxOpen(true)}
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              {singlePhotoItem?.caption && (
                <figcaption className="mt-2 text-center text-[14px] italic text-sepia/75">
                  {singlePhotoItem.caption}
                </figcaption>
              )}
            </figure>
          )}

          {/* Markdown Body */}
          <div className="pt-1">
            <BlogMarkdownRenderer content={post.content_markdown} />
          </div>

          {/* Extra Telegram inline buttons if not already embedded in markdown */}
          {extraButtons.length > 0 && <TgButtonsBlock rows={extraButtons} />}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="pt-5 border-t border-sepia/15 flex flex-wrap gap-2">
              {post.tags.map((tag, idx) => (
                <Link
                  key={idx}
                  to={`/blog?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1.5 rounded-xl border border-sepia/25 bg-transparent hover:border-gold text-[14px] text-sepia/85 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Share & CTA Row */}
          <div className="mt-6 p-5 rounded-2xl border border-gold/40 bg-transparent space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-gothic font-bold text-sepia">
                  Попробуйте алхимию на практике
                </h3>
                <p className="text-[14px] text-sepia/85 mt-0.5">
                  Откройте верстак AIhim в браузере, Telegram Mini App или установите мобильное приложение в профиле.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] hover:brightness-105 text-ink font-bold text-[14px] shadow-sm"
                >
                  <Sparkles size={16} />
                  <span>Играть сейчас</span>
                </Link>
                <a
                  href="https://t.me/AI_HimBot/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-sepia/30 bg-transparent hover:border-gold text-sepia font-bold text-[14px]"
                >
                  <span>Telegram Бот</span>
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            <div className="pt-3 border-t border-sepia/15 flex flex-wrap items-center gap-2 text-[14px]">
              <span className="text-sepia/75 font-semibold mr-1">Поделиться:</span>
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sepia/25 hover:border-gold bg-transparent text-sepia cursor-pointer text-[14px]"
              >
                {copiedUrl ? <Check size={15} className="text-emerald-700" /> : <Share2 size={15} />}
                <span>{copiedUrl ? 'Ссылка скопирована' : 'Копировать ссылку'}</span>
              </button>
              <a
                href={`https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-sepia/25 hover:border-gold text-sepia text-[14px]"
              >
                Telegram
              </a>
              <a
                href={`https://vk.com/share.php?url=${shareUrl}&title=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-sepia/25 hover:border-gold text-sepia text-[14px]"
              >
                ВКонтакте
              </a>
            </div>
          </div>
        </div>
      </article>

      {/* Related articles */}
      {relatedPosts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[20px] font-gothic font-bold text-sepia">Читайте также в журнале AIhim</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedPosts.map((rel) => (
              <Link
                key={rel.id}
                to={`/blog/${rel.slug}`}
                onMouseEnter={() => prefetchBlogPost(rel.slug)}
                onFocus={() => prefetchBlogPost(rel.slug)}
                className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md overflow-hidden hover:border-gold transition-all flex flex-col group"
              >
                <div className="aspect-[4/3] overflow-hidden border-b border-sepia/15">
                  <BlogCoverMedia
                    post={rel}
                    className="group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="text-[14px] text-amber-800 font-semibold">{rel.category}</div>
                  <h3 className="text-[16px] font-gothic font-bold text-sepia group-hover:text-amber-900 leading-snug break-words">
                    {rel.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Transparent cover image lightbox */}
      {coverLightboxOpen && showStandaloneCoverImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр иллюстрации"
          onClick={() => setCoverLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full rounded-2xl border border-gold/60 bg-transparent backdrop-blur-2xl p-3 sm:p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between gap-3 text-[14px] text-sepia font-semibold">
              <span className="truncate">{post.title}</span>
              <button
                type="button"
                onClick={() => setCoverLightboxOpen(false)}
                aria-label="Закрыть просмотр"
                className="p-2 rounded-xl border border-sepia/25 hover:border-gold text-sepia cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] overflow-hidden rounded-xl border border-sepia/20">
              <img
                src={normalizedCover}
                alt={post.title}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
