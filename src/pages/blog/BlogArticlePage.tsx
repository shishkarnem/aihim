import React, { useEffect, useState } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { NeurosphereLoader } from '../../components/ui/NeurosphereLoader';
import { publishSeoOverride } from '../../components/seo/SeoHeadManager';
import { BlogMarkdownRenderer } from './BlogMarkdownRenderer';
import { resolveCardVideoUrl, type BlogArticleItem } from './BlogListPage';
import {
  AIHIM_FALLBACK_COVER,
  TgButtonsBlock,
  isSafeBlogUrl,
  normalizeClientMediaUrl,
  type TgButtonItem
} from './components/BlogRichBlocks';

export const BlogArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogArticleItem | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    (async () => {
      try {
        const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}?track=1`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled && data.post) {
          const loaded: BlogArticleItem = data.post;
          setPost(loaded);
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

        const listRes = await fetch('/api/blog/posts?limit=6&offset=0');
        if (listRes.ok) {
          const listData = await listRes.json();
          if (!cancelled && Array.isArray(listData.posts)) {
            setRelatedPosts(listData.posts.filter((p: BlogArticleItem) => p.slug !== slug).slice(0, 3));
          }
        }
      } catch (err) {
        console.error('Error loading blog article:', err);
        if (!cancelled) setNotFound(true);
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
  const hasInlineTgButtons = String(post.content_markdown || '').includes('```tg-buttons');
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

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Breadcrumbs */}
      <nav aria-label="Хлебные крошки" className="flex flex-wrap items-center gap-2 text-[14px] text-sepia/80">
        <Link to="/" className="hover:text-gold transition-colors">
          Главная
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/blog" className="hover:text-gold transition-colors">
          Журнал алхимика
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
            {relatedPosts.map((rel) => {
              const relVideo = resolveCardVideoUrl(rel);
              const relImage = normalizeClientMediaUrl(rel.cover_image_url || rel.cover_image);
              return (
                <Link
                  key={rel.id}
                  to={`/blog/${rel.slug}`}
                  className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md overflow-hidden hover:border-gold transition-all flex flex-col group"
                >
                  <div className="aspect-[4/3] overflow-hidden border-b border-sepia/15">
                    {relVideo ? (
                      <video
                        src={relVideo}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <img
                        src={relImage}
                        alt={rel.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = AIHIM_FALLBACK_COVER;
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-[14px] text-amber-800 font-semibold">{rel.category}</div>
                    <h3 className="text-[16px] font-gothic font-bold text-sepia group-hover:text-amber-900 leading-snug break-words">
                      {rel.title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
