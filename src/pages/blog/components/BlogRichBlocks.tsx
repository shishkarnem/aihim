import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Film, Maximize2, Quote, X } from 'lucide-react';

export const SAV_DEFAULT_IMAGE_CLIENT =
  'https://file.pro-talk.ru/tgf/GgMpJwQ9JCkYKglyGHQMJH0GOjgMOTE_BA9wETwiCzYmBQ95AyhoBSJLMhgZEyQdKwssKyoEUnQKdGsEfDonABIYETY4NRQmEV9uZlUAaA11VQJrCjgDAzkkAVczLRouDiMXfQxTNBdFGT8aIyw2ZyIcIQsIKjIuHhtsBXZSBGZ5T3FP.png';

export const AIHIM_FALLBACK_COVER = '/file/53/og_banner_1200x630.jpg';

export function isSafeBlogUrl(raw?: string | null): boolean {
  const val = String(raw || '').trim();
  if (!val) return false;
  if (val.startsWith('/') && !val.startsWith('//')) return true;
  if (/^(https?:|mailto:|tel:|tg:)/i.test(val)) return true;
  return false;
}

export function normalizeClientMediaUrl(raw?: string | null): string {
  const val = String(raw || '').trim();
  if (
    !val ||
    val === SAV_DEFAULT_IMAGE_CLIENT ||
    val.includes('GgMpJwQ9JCkYKglyGHQMJH0GOjgMOTE_BA9wETwiCzYmBQ95Ayho')
  ) {
    return AIHIM_FALLBACK_COVER;
  }
  return isSafeBlogUrl(val) ? val : AIHIM_FALLBACK_COVER;
}

export interface TgMediaItem {
  type: 'photo' | 'video';
  url?: string;
  posterUrl?: string;
  postUrl?: string;
  tooLarge?: boolean;
  sizeMb?: number;
  width?: number;
  height?: number;
  duration?: number;
  caption?: string;
}

export interface TgButtonItem {
  text: string;
  url: string;
  isTelegramFallback?: boolean;
}

export interface TgCollapsePayload {
  markdown: string;
  summary?: string;
  credit?: string;
  isOpen?: boolean;
}

export const TgVideoBlock: React.FC<{ item: TgMediaItem }> = ({ item }) => {
  const [posterError, setPosterError] = useState(false);
  const safeVideoUrl = !item.tooLarge && item.url && isSafeBlogUrl(item.url) ? item.url : '';
  const safePostUrl = item.postUrl && isSafeBlogUrl(item.postUrl) ? item.postUrl : '';
  const safePoster =
    item.tooLarge && item.posterUrl && isSafeBlogUrl(item.posterUrl)
      ? normalizeClientMediaUrl(item.posterUrl)
      : '';

  if (safeVideoUrl) {
    return (
      <figure className="my-5 rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-sm overflow-hidden shadow-sm">
        <video
          src={safeVideoUrl}
          controls
          playsInline
          preload="auto"
          className="w-full max-h-[540px] object-contain"
        />
        {item.caption && (
          <figcaption className="px-4 py-2.5 text-[14px] italic text-sepia/80 border-t border-sepia/15">
            {item.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="my-5 rounded-2xl border border-gold/40 bg-transparent backdrop-blur-md overflow-hidden shadow-sm">
      {safePoster && !posterError && (
        <div className="aspect-video w-full overflow-hidden border-b border-sepia/15">
          <img
            src={safePoster}
            alt={item.caption || 'Превью видео из Telegram'}
            referrerPolicy="no-referrer"
            onError={() => setPosterError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[15px] font-bold text-sepia">
            <Film size={18} className="text-gold shrink-0" />
            <span>
              Видеозапись{item.sizeMb ? ` (${item.sizeMb.toFixed(1)} МБ)` : ''} доступна в Telegram
            </span>
          </div>
          {item.caption && (
            <p className="text-[14px] text-sepia/80 leading-relaxed">{item.caption}</p>
          )}
        </div>
        {safePostUrl && (
          <a
            href={safePostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A343] to-[#B48A2D] hover:brightness-105 text-ink font-bold text-[14px] shadow-sm transition-all shrink-0"
          >
            <span>Смотреть видео в Telegram</span>
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </div>
  );
};

export const TgGalleryBlock: React.FC<{ items: TgMediaItem[] }> = ({ items }) => {
  const photos = items.filter((m) => m.type !== 'video' && m.url && isSafeBlogUrl(m.url));
  const videos = items.filter((m) => m.type === 'video');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') setLightboxIdx((prev) => (prev === null ? null : (prev + 1) % photos.length));
      if (e.key === 'ArrowLeft') setLightboxIdx((prev) => (prev === null ? null : (prev - 1 + photos.length) % photos.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, photos.length]);

  const colsClass =
    photos.length === 1
      ? 'grid-cols-1'
      : photos.length === 2 || photos.length === 4
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="my-5 space-y-4">
      {photos.length > 0 && (
        <div className={`grid ${colsClass} gap-3`}>
          {photos.map((photo, idx) => {
            const safeImg = normalizeClientMediaUrl(photo.url);
            return (
              <button
                key={`${safeImg}-${idx}`}
                type="button"
                onClick={() => setLightboxIdx(idx)}
                className="group relative rounded-2xl border border-sepia/25 overflow-hidden bg-transparent cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-gold"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={safeImg}
                    alt={photo.caption || `Изображение ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <span
                  aria-hidden="true"
                  className="absolute top-2.5 right-2.5 p-2 rounded-lg border border-sepia/25 bg-parchment/85 backdrop-blur-md text-sepia opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 size={15} />
                </span>
                {photo.caption && (
                  <div className="px-3 py-2 text-[14px] text-sepia/85 border-t border-sepia/15">
                    {photo.caption}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {videos.map((vid, idx) => (
        <TgVideoBlock key={`gvid-${idx}`} item={vid} />
      ))}

      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onClick={() => setLightboxIdx(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full rounded-2xl border border-gold/60 bg-transparent backdrop-blur-2xl p-3 sm:p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between gap-3 text-[14px] text-sepia font-semibold">
              <span>
                Изображение {lightboxIdx + 1} из {photos.length}
              </span>
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                aria-label="Закрыть просмотр"
                className="p-2 rounded-xl border border-sepia/25 hover:border-gold text-sepia cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex items-center justify-center max-h-[72vh] overflow-hidden rounded-xl border border-sepia/20">
              <img
                src={normalizeClientMediaUrl(photos[lightboxIdx].url)}
                alt={photos[lightboxIdx].caption || 'Увеличенное изображение'}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-sepia/85">{photos[lightboxIdx].caption || ''}</p>
              {photos.length > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx - 1 + photos.length) % photos.length)}
                    aria-label="Предыдущее фото"
                    className="p-2.5 rounded-xl border border-sepia/25 hover:border-gold text-sepia cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % photos.length)}
                    aria-label="Следующее фото"
                    className="p-2.5 rounded-xl border border-sepia/25 hover:border-gold text-sepia cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TgButtonsBlock: React.FC<{ rows: TgButtonItem[][] }> = ({ rows }) => {
  const validRows = (Array.isArray(rows) ? rows : [])
    .map((row) =>
      (Array.isArray(row) ? row : []).filter(
        (btn) => btn && btn.text && btn.url && isSafeBlogUrl(btn.url)
      )
    )
    .filter((row) => row.length > 0);

  if (validRows.length === 0) return null;

  return (
    <div className="my-5 space-y-2.5">
      {validRows.map((row, rIdx) => (
        <div key={`brow-${rIdx}`} className="flex flex-wrap gap-2.5">
          {row.map((btn, bIdx) => {
            const href = btn.url.trim();
            const isInternal = href.startsWith('/') && !href.startsWith('//');
            const cls =
              'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gold/55 bg-gradient-to-r from-[#F3E5C2]/80 to-[#E9D19B]/80 hover:from-[#F3E5C2] hover:to-[#E2C278] text-sepia font-bold text-[14px] shadow-xs transition-all break-words';

            if (isInternal) {
              return (
                <Link key={`btn-${rIdx}-${bIdx}`} to={href} className={cls}>
                  <span>{btn.text}</span>
                </Link>
              );
            }

            return (
              <a
                key={`btn-${rIdx}-${bIdx}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                <span>{btn.text}</span>
                <ExternalLink size={15} className="shrink-0 opacity-75" />
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const TgCollapseBlock: React.FC<{
  payload: TgCollapsePayload;
  renderMarkdown: (md: string) => React.ReactNode;
}> = ({ payload, renderMarkdown }) => {
  const hasSummary = Boolean(payload.summary && payload.summary.trim());
  const [expanded, setExpanded] = useState<boolean>(Boolean(payload.isOpen));

  if (hasSummary) {
    return (
      <div className="my-5 rounded-2xl border border-sepia/25 bg-transparent backdrop-blur-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left text-[15px] font-bold text-sepia hover:bg-gold/10 transition-colors cursor-pointer"
        >
          <span className="break-words">{payload.summary}</span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-amber-800 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expanded && (
          <div className="px-4 pb-4 pt-2 border-t border-sepia/15 space-y-2">
            {renderMarkdown(payload.markdown || '')}
            {payload.credit && (
              <div className="text-[14px] italic text-sepia/75 pt-1">— {payload.credit}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-5 rounded-2xl border border-gold/40 bg-transparent backdrop-blur-sm p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 text-[14px] font-bold text-amber-800">
        <Quote size={16} className="text-gold shrink-0" />
        <span>Цитата из публикации</span>
      </div>

      <div
        className={`relative overflow-hidden transition-all duration-300 ${expanded ? '' : 'max-h-32'}`}
        style={
          expanded
            ? undefined
            : {
                maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)'
              }
        }
      >
        <div className="italic text-sepia/95">{renderMarkdown(payload.markdown || '')}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {payload.credit ? (
          <span className="text-[14px] italic text-sepia/75">— {payload.credit}</span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gold/50 bg-gradient-to-r from-[#F3E5C2]/70 to-[#E9D19B]/70 hover:from-[#F3E5C2] hover:to-[#E2C278] text-sepia font-bold text-[14px] cursor-pointer transition-all"
        >
          <span>{expanded ? 'Свернуть цитату' : 'Развернуть цитату'}</span>
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </div>
  );
};
