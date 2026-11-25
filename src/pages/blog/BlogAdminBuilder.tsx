import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  Save,
  Send,
  ExternalLink,
  Check,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Bold,
  Italic,
  Heading2,
  List,
  Quote,
  Link2,
  RefreshCw,
  Pin,
  PinOff,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { BlogMarkdownRenderer } from './BlogMarkdownRenderer';
import { resolveCardVideoUrl, type BlogArticleItem } from './BlogListPage';
import { NeurosphereLoader } from '../../components/ui/NeurosphereLoader';
import { AIHIM_FALLBACK_COVER, normalizeClientMediaUrl } from './components/BlogRichBlocks';

const PRESET_COVERS = [
  { label: 'Алхимия ИИ', url: '/file/13/blog_01_ai_transmutation.jpg' },
  { label: '4 первоэлемента', url: '/file/14/blog_02_four_elements.jpg' },
  { label: 'Слова силы', url: '/file/15/blog_03_latin_spells.jpg' },
  { label: '12 слоёв реальности', url: '/file/16/blog_04_reality_layers.jpg' },
  { label: 'Кузня и закалка', url: '/file/17/blog_05_forge_tempering.jpg' },
  { label: 'День и Ночь', url: '/file/18/blog_06_day_night_phases.jpg' },
  { label: 'Аномалии', url: '/file/19/blog_07_anomalies_forbidden.jpg' },
  { label: 'Telegram и PWA', url: '/file/20/blog_08_telegram_miniapp.jpg' },
  { label: 'Ранги и баланс', url: '/file/21/blog_09_ranks_progression.jpg' },
  { label: 'Будущее игр ИИ', url: '/file/22/blog_10_future_neuro_games.jpg' },
  { label: 'Обложка AIhim', url: '/file/53/og_banner_1200x630.jpg' }
];

const EMPTY_FORM = {
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  content_markdown: '## Введение\n\nНачните писать статью в формате **Markdown**...\n',
  cover_image: '/file/13/blog_01_ai_transmutation.jpg',
  category: 'Технологии ИИ',
  tagsText: 'алхимия ИИ, AIhim, гайд',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  author_name: 'Редакция AIhim',
  published: true,
  notifySubscribers: false
};

export const BlogAdminBuilder: React.FC = () => {
  const [posts, setPosts] = useState<BlogArticleItem[]>([]);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [syncMeta, setSyncMeta] = useState<{
    lastSync?: { sourceDomain: string; added: number; updated: number; skipped: number; syncedAt: number } | null;
    lastError?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingRss, setSyncingRss] = useState(false);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [pushingSlug, setPushingSlug] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blog/posts?all=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) {
          setPosts(data.posts);
          setPinnedCount(
            typeof data.pinnedCount === 'number'
              ? data.pinnedCount
              : data.posts.filter((p: BlogArticleItem) => p.is_pinned).length
          );
        }
        if (data.syncStatus) {
          setSyncMeta(data.syncStatus);
        }
      }
    } catch (err) {
      console.error('Failed to load admin blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSyncRssNow = async () => {
    setSyncingRss(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/blog/sync-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось синхронизировать RSS');
      }
      await loadPosts();
      setStatusMsg(
        `RSS SAV AI синхронизирован (${data.sourceDomain}): добавлено ${data.added}, обновлено ${data.updated}, без изменений ${data.skipped}.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка синхронизации RSS');
    } finally {
      setSyncingRss(false);
    }
  };

  const handleTogglePin = async (post: BlogArticleItem) => {
    setPinBusyId(post.id);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const nextPinned = !post.is_pinned;
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(post.id)}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: nextPinned })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось изменить закрепление');
      }
      await loadPosts();
      setStatusMsg(
        nextPinned
          ? `Статья «${post.title}» закреплена в начале блога.`
          : `Статья «${post.title}» откреплена.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка закрепления статьи');
    } finally {
      setPinBusyId(null);
    }
  };

  const handleMovePin = async (post: BlogArticleItem, direction: 'up' | 'down') => {
    setPinBusyId(post.id);
    try {
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(post.id)}/move-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      });
      if (res.ok) await loadPosts();
    } catch {
      // ignore
    } finally {
      setPinBusyId(null);
    }
  };

  const handleTitleChange = async (nextTitle: string) => {
    setForm((prev) => ({
      ...prev,
      title: nextTitle,
      seo_title: prev.seo_title || nextTitle
    }));
    if (!slugTouched && nextTitle.trim()) {
      try {
        const res = await fetch('/api/blog/slugify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: nextTitle })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.slug) {
            setForm((prev) => ({ ...prev, slug: data.slug }));
          }
        }
      } catch {
        // ignore live slugify error
      }
    }
  };

  const insertSnippet = (before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = form.content_markdown.slice(start, end) || placeholder;
    const updated =
      form.content_markdown.slice(0, start) +
      before +
      selected +
      after +
      form.content_markdown.slice(end);
    setForm((prev) => ({ ...prev, content_markdown: updated }));
    setTimeout(() => {
      el.focus();
      const cursorPos = start + before.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const handleEditPost = (post: BlogArticleItem) => {
    setSlugTouched(true);
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content_markdown: post.content_markdown,
      cover_image: normalizeClientMediaUrl(post.cover_image_url || post.cover_image),
      category: post.category,
      tagsText: (post.tags || []).join(', '),
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      seo_keywords: post.seo_keywords,
      author_name: post.author_name,
      published: post.published,
      notifySubscribers: false
    });
    setStatusMsg(null);
    setErrorMsg(null);
  };

  const handleNewPost = () => {
    setSlugTouched(false);
    setForm(EMPTY_FORM);
    setStatusMsg(null);
    setErrorMsg(null);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content_markdown.trim()) {
      setErrorMsg('Укажите заголовок статьи и текст Markdown.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const tags = form.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/blog/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          title: form.title,
          slug: form.slug || undefined,
          excerpt: form.excerpt,
          content_markdown: form.content_markdown,
          cover_image: form.cover_image,
          category: form.category,
          tags,
          seo_title: form.seo_title || form.title,
          seo_description: form.seo_description || form.excerpt,
          seo_keywords: form.seo_keywords || tags.join(', '),
          author_name: form.author_name || 'Редакция AIhim',
          published: form.published,
          notifySubscribers: form.notifySubscribers
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось сохранить статью');
      }

      const saved: BlogArticleItem = data.post;
      handleEditPost(saved);
      await loadPosts();
      setStatusMsg(
        data.pushResult
          ? `Статья сохранена и опубликована! Отправлено пушей: ${data.pushResult.sent}.`
          : `Статья «${saved.title}» сохранена в PostgreSQL.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка сохранения статьи');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (post: BlogArticleItem) => {
    try {
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      if (res.ok) {
        if (form.id === post.id) handleNewPost();
        await loadPosts();
        setStatusMsg(`Статья «${post.title}» удалена.`);
      }
    } catch {
      setErrorMsg('Не удалось удалить статью');
    }
  };

  const handlePushArticle = async (slug: string) => {
    setPushingSlug(slug);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}/push`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`Пуш-уведомление о статье разослано (${data.sent || 0} из ${data.total || 0} устройств).`);
      } else {
        setErrorMsg(data.error || 'Ошибка рассылки пуша');
      }
    } catch {
      setErrorMsg('Сетевая ошибка при отправке пуша');
    } finally {
      setPushingSlug(null);
    }
  };

  const pinnedPosts = posts.filter((p) => p.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header + SAV AI RSS Sync Controls */}
      <div className="rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-[22px] font-gothic font-bold text-sepia flex items-center gap-2">
            <FileText size={20} className="text-gold shrink-0" />
            <span>Конструктор блога, импорт RSS и закрепление постов</span>
          </h2>
          <p className="text-[14px] text-sepia/80">
            Автосинхронизация с SAV AI RSS 2.0 каждые 10 минут. Закреплено: {pinnedCount} из 10 возможных.
          </p>
          {syncMeta?.lastSync && (
            <p className="text-[14px] text-amber-800 font-semibold">
              Последний импорт ({new Date(syncMeta.lastSync.syncedAt).toLocaleTimeString('ru-RU')} ·{' '}
              {syncMeta.lastSync.sourceDomain}): +{syncMeta.lastSync.added} / ~{syncMeta.lastSync.updated}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncRssNow}
            disabled={syncingRss}
            className="px-4 py-2.5 rounded-xl border border-gold/55 bg-gradient-to-r from-[#F3E5C2]/80 to-[#E9D19B]/80 hover:from-[#F3E5C2] hover:to-[#E2C278] text-sepia font-bold text-[14px] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={16} className={syncingRss ? 'animate-spin' : ''} />
            <span>{syncingRss ? 'Синхронизация...' : 'Синхронизировать RSS сейчас'}</span>
          </button>

          <Link
            to="/blog"
            target="_blank"
            className="px-4 py-2.5 rounded-xl border border-sepia/30 bg-transparent hover:border-gold text-sepia font-bold text-[14px] inline-flex items-center gap-1.5"
          >
            <ExternalLink size={16} />
            <span>Открыть /blog</span>
          </Link>

          <button
            type="button"
            onClick={handleNewPost}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] hover:brightness-105 text-ink font-bold text-[14px] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Новая статья</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl border border-emerald-600/40 bg-emerald-500/10 text-emerald-950 text-[14px] font-semibold flex items-center gap-2">
          <Check size={18} className="text-emerald-700 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-600/40 bg-rose-500/10 text-rose-950 text-[14px] font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Articles List Column */}
        <div className="xl:col-span-4 rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-sepia/15 pb-2.5">
            <h3 className="text-[17px] font-gothic font-bold text-sepia">
              Статьи ({posts.length}) · Закреплено {pinnedCount}/10
            </h3>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center">
              <NeurosphereLoader label="Загрузка" size="sm" />
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[780px] overflow-y-auto pr-1 custom-scrollbar">
              {posts.map((post) => {
                const isSelected = form.id === post.id;
                const videoCover = resolveCardVideoUrl(post);
                const imgCover = normalizeClientMediaUrl(post.cover_image_url || post.cover_image);
                const pinIdx = pinnedPosts.findIndex((p) => p.id === post.id);
                const canPinMore = post.is_pinned || pinnedCount < 10;

                return (
                  <div
                    key={post.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 bg-transparent ${
                      post.is_pinned
                        ? 'border-gold/70 shadow-xs'
                        : isSelected
                          ? 'border-gold shadow-sm'
                          : 'border-sepia/20 hover:border-gold/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {videoCover ? (
                        <video
                          src={videoCover}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-14 h-11 rounded-lg object-cover border border-sepia/20 shrink-0"
                        />
                      ) : (
                        <img
                          src={imgCover}
                          alt={post.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = AIHIM_FALLBACK_COVER;
                          }}
                          className="w-14 h-11 rounded-lg object-cover border border-sepia/20 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-sepia leading-snug break-words flex items-start gap-1.5">
                          {post.is_pinned && <Pin size={14} className="text-gold shrink-0 mt-1" />}
                          <span>{post.title}</span>
                        </div>
                        <div className="text-[14px] text-sepia/70 truncate">
                          /blog/{post.slug}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sepia/10 text-[14px]">
                      <span className={post.published ? 'text-emerald-800 font-semibold' : 'text-amber-800 font-semibold'}>
                        {post.is_pinned ? `Закреплён #${pinIdx + 1}` : post.published ? 'Опубликовано' : 'Черновик'} ·{' '}
                        {post.views_count || 0} просм.
                      </span>

                      <div className="flex flex-wrap items-center gap-1">
                        {post.is_pinned && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMovePin(post, 'up')}
                              disabled={pinBusyId === post.id || pinIdx <= 0}
                              title="Выше в закреплённых"
                              className="p-2 rounded-lg border border-sepia/20 hover:border-gold text-sepia cursor-pointer disabled:opacity-40"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePin(post, 'down')}
                              disabled={pinBusyId === post.id || pinIdx === pinnedPosts.length - 1}
                              title="Ниже в закреплённых"
                              className="p-2 rounded-lg border border-sepia/20 hover:border-gold text-sepia cursor-pointer disabled:opacity-40"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTogglePin(post)}
                          disabled={pinBusyId === post.id || (!post.is_pinned && !canPinMore)}
                          title={
                            post.is_pinned
                              ? 'Открепить статью'
                              : canPinMore
                                ? 'Закрепить вверху блога'
                                : 'Достигнут лимит 10 закреплённых постов'
                          }
                          className={`p-2 rounded-lg border cursor-pointer disabled:opacity-40 ${
                            post.is_pinned
                              ? 'border-gold bg-gold/20 text-amber-900'
                              : 'border-sepia/20 hover:border-gold text-sepia'
                          }`}
                        >
                          {post.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPost(post)}
                          title="Редактировать"
                          className="p-2 rounded-lg border border-sepia/20 hover:border-gold text-sepia cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <Link
                          to={`/blog/${post.slug}`}
                          target="_blank"
                          title="Открыть на сайте"
                          className="p-2 rounded-lg border border-sepia/20 hover:border-gold text-sepia"
                        >
                          <Eye size={15} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handlePushArticle(post.slug)}
                          disabled={pushingSlug === post.slug}
                          title="Отправить пуш подписчикам"
                          className="p-2 rounded-lg border border-sepia/20 hover:border-gold text-amber-800 cursor-pointer disabled:opacity-50"
                        >
                          <Send size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post)}
                          title="Удалить"
                          className="p-2 rounded-lg border border-sepia/20 hover:border-rose-500 text-rose-700 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Markdown Editor Column */}
        <form
          onSubmit={handleSavePost}
          className="xl:col-span-8 rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-md p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sepia/15 pb-3">
            <h3 className="text-[19px] font-gothic font-bold text-sepia">
              {form.id ? 'Редактирование статьи' : 'Создание новой статьи'}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditorMode('write')}
                className={`px-3.5 py-2 rounded-xl border text-[14px] font-bold cursor-pointer ${
                  editorMode === 'write'
                    ? 'border-gold bg-gold/20 text-sepia'
                    : 'border-sepia/25 text-sepia/75 bg-transparent'
                }`}
              >
                Редактор Markdown
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('preview')}
                className={`px-3.5 py-2 rounded-xl border text-[14px] font-bold cursor-pointer ${
                  editorMode === 'preview'
                    ? 'border-gold bg-gold/20 text-sepia'
                    : 'border-sepia/25 text-sepia/75 bg-transparent'
                }`}
              >
                Предпросмотр
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-bold text-sepia block">
                Заголовок статьи (H1)
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Например: Секреты 12 слоёв реальности в AIhim"
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-bold text-sepia block">
                SEO Slug в ссылке (/blog/slug)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((p) => ({ ...p, slug: e.target.value }));
                }}
                placeholder="avtomaticheski-iz-zagolovka"
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent font-mono text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-bold text-sepia block">Категория</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-bold text-sepia block">Автор</label>
              <input
                type="text"
                value={form.author_name}
                onChange={(e) => setForm((p) => ({ ...p, author_name: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>
          </div>

          {/* Cover image picker */}
          <div className="space-y-2">
            <label className="text-[14px] font-bold text-sepia flex items-center gap-1.5">
              <ImageIcon size={16} className="text-gold" />
              <span>Обложка статьи (URL или выбор готовой иллюстрации)</span>
            </label>
            <input
              type="text"
              value={form.cover_image}
              onChange={(e) => setForm((p) => ({ ...p, cover_image: e.target.value }))}
              placeholder="/file/13/blog_01_ai_transmutation.jpg"
              className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent font-mono text-[14px] text-sepia focus:border-gold outline-none"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_COVERS.map((cov) => (
                <button
                  key={cov.url}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, cover_image: cov.url }))}
                  className={`px-3 py-1.5 rounded-lg border text-[14px] cursor-pointer transition-colors ${
                    form.cover_image === cov.url
                      ? 'border-gold bg-gold/25 text-sepia font-bold'
                      : 'border-sepia/25 bg-transparent text-sepia/80 hover:border-gold/50'
                  }`}
                >
                  {cov.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-bold text-sepia block">
              Краткий анонс (Excerpt)
            </label>
            <textarea
              rows={2}
              value={form.excerpt}
              onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
              placeholder="Короткое интригующее описание статьи для карточки в блоге и RSS..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
            />
          </div>

          {/* Markdown editor or live preview */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[14px] font-bold text-sepia">Текст статьи (Markdown)</label>
              {editorMode === 'write' && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertSnippet('## ', '', 'Заголовок раздела')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Heading2 size={15} />
                    <span>H2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('**', '**', 'жирный текст')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('*', '*', 'курсив')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('- ', '', 'Пункт списка')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('> ', '', 'Цитата алхимика')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Quote size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('[текст ссылки](', ')', '/')}
                    className="px-2.5 py-1.5 rounded-lg border border-sepia/25 text-[14px] text-sepia hover:border-gold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Link2 size={15} />
                  </button>
                </div>
              )}
            </div>

            {editorMode === 'write' ? (
              <textarea
                ref={textareaRef}
                rows={14}
                required
                value={form.content_markdown}
                onChange={(e) => setForm((p) => ({ ...p, content_markdown: e.target.value }))}
                className="w-full p-4 rounded-xl border border-sepia/30 bg-transparent font-mono text-[14px] text-sepia leading-relaxed focus:border-gold outline-none"
              />
            ) : (
              <div className="p-5 rounded-xl border border-sepia/25 bg-transparent min-h-[260px]">
                <BlogMarkdownRenderer content={form.content_markdown} />
              </div>
            )}
          </div>

          {/* SEO Fields */}
          <div className="p-4 rounded-xl border border-gold/35 bg-transparent space-y-4">
            <div className="text-[16px] font-gothic font-bold text-sepia flex items-center gap-2">
              <Sparkles size={17} className="text-gold" />
              <span>SEO-настройки для Яндекса, Google и нейросетей</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[14px]">
                <label className="font-bold text-sepia">SEO Title (тег title)</label>
                <span className="text-sepia/70">{form.seo_title.length} / 65 симв.</span>
              </div>
              <input
                type="text"
                value={form.seo_title}
                onChange={(e) => setForm((p) => ({ ...p, seo_title: e.target.value }))}
                placeholder="Оптимальный заголовок для поисковой выдачи..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[14px]">
                <label className="font-bold text-sepia">SEO Description (мета-описание)</label>
                <span className="text-sepia/70">{form.seo_description.length} / 160 симв.</span>
              </div>
              <textarea
                rows={2}
                value={form.seo_description}
                onChange={(e) => setForm((p) => ({ ...p, seo_description: e.target.value }))}
                placeholder="Привлекательный сниппет для Яндекса, Google и соцсетей..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-bold text-sepia block">
                  Ключевые слова (Keywords)
                </label>
                <input
                  type="text"
                  value={form.seo_keywords}
                  onChange={(e) => setForm((p) => ({ ...p, seo_keywords: e.target.value }))}
                  placeholder="AIhim, алхимия ИИ, трансмутация..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-bold text-sepia block">
                  Теги (через запятую)
                </label>
                <input
                  type="text"
                  value={form.tagsText}
                  onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))}
                  placeholder="гайд, рецепты, нейросеть"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sepia/30 bg-transparent text-[14px] text-sepia focus:border-gold outline-none"
                />
              </div>
            </div>
          </div>

          {/* Publish controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-sepia/15">
            <div className="space-y-2 text-[14px] text-sepia">
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                  className="w-4 h-4 accent-amber-700"
                />
                <span>Опубликовать статью на /blog и добавить в Sitemap.xml / RSS</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={form.notifySubscribers}
                  onChange={(e) => setForm((p) => ({ ...p, notifySubscribers: e.target.checked }))}
                  className="w-4 h-4 accent-amber-700"
                />
                <span>Отправить пуш-уведомление подписчикам блога после сохранения</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] hover:brightness-105 text-ink font-gothic font-bold text-[15px] shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Save size={18} />
              <span>{saving ? 'Сохранение...' : 'Сохранить статью'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
