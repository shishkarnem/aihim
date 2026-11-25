import { XMLParser } from 'fast-xml-parser';
import { queryAll, queryRun } from '../core';
import {
  AIHIM_DEFAULT_COVER,
  SAV_DEFAULT_FALLBACK_IMAGE,
  ensureBlogTableAndSeed,
  estimateReadingTime,
  normalizeBlogCoverImage,
  slugifyCyrillic
} from './blog';

const RSS_DOMAINS = [
  'https://savbot.ru',
  'https://sav-ai.ru',
  'https://aisav.ru',
  'https://ai-greenland.ru',
  'https://aisav.online'
];

export interface SavRssSyncResult {
  added: number;
  updated: number;
  skipped: number;
  totalParsed: number;
  sourceDomain: string;
  sourceUrl: string;
  syncedAt: number;
}

let isSyncInProgress = false;
let lastSyncStats: SavRssSyncResult | null = null;
let lastSyncError: string | null = null;

export function getSavRssSyncStatus() {
  return {
    inProgress: isSyncInProgress,
    lastSync: lastSyncStats,
    lastError: lastSyncError
  };
}

export function sanitizeSafeUrl(rawUrl: any, allowRelative = true): string {
  const val = String(rawUrl || '').trim();
  if (!val) return '';
  if (allowRelative && val.startsWith('/') && !val.startsWith('//')) {
    return val;
  }
  try {
    const parsed = new URL(val);
    if (['https:', 'http:', 'mailto:', 'tel:', 'tg:'].includes(parsed.protocol)) {
      return val;
    }
  } catch {
    if (allowRelative && /^tg:\/\//i.test(val)) return val;
  }
  return '';
}

function replaceSavDefaultInsideText(str: string): string {
  if (!str) return '';
  return str
    .split(SAV_DEFAULT_FALLBACK_IMAGE)
    .join(AIHIM_DEFAULT_COVER);
}

function extractXmlValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return extractXmlValue(val[0]);
  if (typeof val === 'object') {
    if (typeof val.__cdata === 'string') return val.__cdata;
    if (typeof val['#text'] === 'string') return val['#text'];
    if (val['#text'] !== undefined) return String(val['#text']);
  }
  return '';
}

function findPrefixedTag(item: Record<string, any>, localName: string, preferredPrefix = 'sav'): any {
  const directKey = `${preferredPrefix}:${localName}`;
  if (item[directKey] !== undefined) return item[directKey];

  const lowerSuffix = `:${localName.toLowerCase()}`;
  for (const k of Object.keys(item)) {
    if (k.toLowerCase().endsWith(lowerSuffix)) {
      return item[k];
    }
  }
  return undefined;
}

function normalizeMediaItems(raw: any): any[] {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  return list
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const safeUrl = sanitizeSafeUrl(m.url, true);
      const safePosterRaw = sanitizeSafeUrl(m.posterUrl, true);
      const safePoster = safePosterRaw ? normalizeBlogCoverImage(safePosterRaw) : '';
      const safePostUrl = sanitizeSafeUrl(m.postUrl, true);
      return {
        type: m.type === 'video' ? 'video' : 'photo',
        url: m.type === 'photo' && safeUrl ? normalizeBlogCoverImage(safeUrl) : safeUrl || undefined,
        posterUrl: safePoster || undefined,
        postUrl: safePostUrl || undefined,
        tooLarge: Boolean(m.tooLarge),
        sizeMb: m.sizeMb !== undefined ? Number(m.sizeMb) : undefined,
        width: m.width !== undefined ? Number(m.width) : undefined,
        height: m.height !== undefined ? Number(m.height) : undefined,
        duration: m.duration !== undefined ? Number(m.duration) : undefined,
        caption: typeof m.caption === 'string' ? m.caption : undefined
      };
    });
}

function normalizeButtonRows(raw: any): any[][] {
  let rows: any[] = [];
  if (Array.isArray(raw)) rows = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed)) rows = parsed;
    } catch {
      rows = [];
    }
  }

  return rows
    .filter((r) => Array.isArray(r))
    .map((row) =>
      row
        .filter((btn: any) => btn && typeof btn === 'object' && btn.text && btn.url)
        .map((btn: any) => ({
          text: String(btn.text).trim(),
          url: sanitizeSafeUrl(btn.url, true),
          isTelegramFallback: Boolean(btn.isTelegramFallback)
        }))
        .filter((btn: any) => btn.url !== '')
    )
    .filter((row) => row.length > 0);
}

function htmlFallbackToMarkdown(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div|figure|figcaption)[^>]*>/gi, '\n')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl, inner) => `\n${'#'.repeat(Number(lvl))} ${inner}\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const safe = sanitizeSafeUrl(href, true);
      return safe ? `[${label}](${safe})` : label;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

async function fetchRssXmlWithFallback(options: {
  limit?: number;
  category?: string;
} = {}): Promise<{ xml: string; domain: string; url: string }> {
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 100));
  const query = new URLSearchParams({ limit: String(limit) });
  if (options.category && options.category.trim()) {
    query.set('category', options.category.trim());
  }
  const qs = query.toString();

  const errors: string[] = [];

  for (const domain of RSS_DOMAINS) {
    const candidates = [`${domain}/rss.xml?${qs}`, `${domain}/feed.xml?${qs}`];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) {
          errors.push(`${url} -> HTTP ${res.status}`);
          continue;
        }
        const text = await res.text();
        if (!text || (!text.includes('<rss') && !text.includes('<channel'))) {
          errors.push(`${url} -> invalid RSS XML`);
          continue;
        }
        return { xml: text, domain, url };
      } catch (err: any) {
        errors.push(`${url} -> ${err?.message || 'network error'}`);
      }
    }
  }

  throw new Error(`Не удалось загрузить RSS-ленту SAV AI ни с одного из доменов: ${errors.slice(0, 4).join('; ')}`);
}

export async function syncSavRssFeed(options: {
  limit?: number;
  category?: string;
} = {}): Promise<SavRssSyncResult> {
  if (isSyncInProgress) {
    if (lastSyncStats) return lastSyncStats;
    throw new Error('Синхронизация RSS уже выполняется');
  }

  isSyncInProgress = true;
  lastSyncError = null;

  try {
    await ensureBlogTableAndSeed();

    const { xml, domain, url } = await fetchRssXmlWithFallback(options);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      cdataPropName: '__cdata',
      trimValues: false,
      parseTagValue: false,
      isArray: (tagName) => ['item', 'category', 'media:content'].includes(tagName)
    });

    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel || parsed?.channel;
    const rawItems: any[] = Array.isArray(channel?.item)
      ? channel.item
      : channel?.item
        ? [channel.item]
        : [];

    const existingRows = await queryAll<any>(
      'SELECT id, external_id, external_updated_at, slug, cover_image FROM blog_posts'
    );

    const byExternalId = new Map<string, any>();
    const usedSlugs = new Set<string>();
    for (const row of existingRows) {
      if (row.external_id) byExternalId.set(String(row.external_id), row);
      if (row.slug) usedSlugs.add(String(row.slug));
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;

      const savId = extractXmlValue(findPrefixedTag(item, 'id')).trim();
      const guidVal = extractXmlValue(item.guid).trim();
      const linkVal = sanitizeSafeUrl(extractXmlValue(item.link).trim(), false);
      const externalId = savId || guidVal || linkVal;
      if (!externalId) continue;

      const savUpdatedAt = extractXmlValue(findPrefixedTag(item, 'updatedAt')).trim();
      const atomUpdated = extractXmlValue(findPrefixedTag(item, 'updated', 'atom')).trim();
      const pubDateRaw = extractXmlValue(item.pubDate).trim();
      const incomingUpdatedAt = savUpdatedAt || atomUpdated || pubDateRaw;

      const existing = byExternalId.get(externalId);
      const hasLegacySavCover = existing?.cover_image === SAV_DEFAULT_FALLBACK_IMAGE;

      if (existing && existing.external_updated_at === incomingUpdatedAt && !hasLegacySavCover) {
        skipped++;
        continue;
      }

      const title = extractXmlValue(item.title).trim() || 'Публикация SAV AI';
      const rawMarkdown = extractXmlValue(findPrefixedTag(item, 'contentMarkdown'));
      const rawHtml = extractXmlValue(findPrefixedTag(item, 'encoded', 'content'));
      const rawExcerpt = extractXmlValue(item.description).trim();

      let contentMarkdown = replaceSavDefaultInsideText(rawMarkdown || '');
      if (!contentMarkdown.trim() && rawHtml) {
        contentMarkdown = replaceSavDefaultInsideText(htmlFallbackToMarkdown(rawHtml));
      }
      if (!contentMarkdown.trim()) {
        contentMarkdown = rawExcerpt || title;
      }

      const excerpt =
        rawExcerpt ||
        contentMarkdown
          .replace(/```[\s\S]*?```/g, ' ')
          .replace(/[#>*_`[\]()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220);

      // Media JSON & Buttons JSON
      const mediaRaw = extractXmlValue(findPrefixedTag(item, 'mediaJson'));
      const mediaList = normalizeMediaItems(replaceSavDefaultInsideText(mediaRaw));
      const mediaJsonStr = JSON.stringify(mediaList);

      const buttonsRaw = extractXmlValue(findPrefixedTag(item, 'buttonsJson'));
      const buttonRows = normalizeButtonRows(buttonsRaw);
      const buttonsJsonStr = JSON.stringify(buttonRows);

      // Cover Image & Video Cover resolution
      const savCoverImageRaw = extractXmlValue(findPrefixedTag(item, 'coverImage')).trim();
      const mediaThumbRaw = String(findPrefixedTag(item, 'thumbnail', 'media')?.['@_url'] || '').trim();
      const enclosureUrl = String(item.enclosure?.['@_url'] || '').trim();
      const enclosureType = String(item.enclosure?.['@_type'] || '').trim().toLowerCase();

      const firstPhotoMedia = mediaList.find((m) => m.type === 'photo' && m.url)?.url || '';
      const coverImage = normalizeBlogCoverImage(
        savCoverImageRaw ||
          mediaThumbRaw ||
          (enclosureType.startsWith('image/') ? enclosureUrl : '') ||
          firstPhotoMedia
      );

      const savCoverVideoRaw = sanitizeSafeUrl(
        extractXmlValue(findPrefixedTag(item, 'coverVideo')).trim(),
        true
      );
      const enclosureVideo =
        enclosureType.startsWith('video/') ? sanitizeSafeUrl(enclosureUrl, true) : '';
      const firstPlayableVideo =
        mediaList.find((m) => m.type === 'video' && !m.tooLarge && m.url)?.url || '';
      const coverVideoUrl = savCoverVideoRaw || enclosureVideo || firstPlayableVideo || '';

      // Metadata & SEO
      const savCategory = extractXmlValue(findPrefixedTag(item, 'category')).trim();
      const rssCategory = Array.isArray(item.category)
        ? extractXmlValue(item.category[0]).trim()
        : extractXmlValue(item.category).trim();
      const category = savCategory || rssCategory || 'Новости ИИ';

      const savAuthorName = extractXmlValue(findPrefixedTag(item, 'authorName')).trim();
      const dcCreator = extractXmlValue(findPrefixedTag(item, 'creator', 'dc')).trim();
      const authorRaw = extractXmlValue(item.author).trim();
      const authorName = savAuthorName || dcCreator || authorRaw || 'SAV AI';
      const authorRole = extractXmlValue(findPrefixedTag(item, 'authorRole')).trim();

      const readMinutes = Number(extractXmlValue(findPrefixedTag(item, 'readTimeMinutes')));
      const readingTime = readMinutes > 0 ? readMinutes : estimateReadingTime(contentMarkdown);

      const seoTitle = extractXmlValue(findPrefixedTag(item, 'seoTitle')).trim() || title;
      const seoDescription = extractXmlValue(findPrefixedTag(item, 'seoDescription')).trim() || excerpt;
      const seoKeywords = extractXmlValue(findPrefixedTag(item, 'seoKeywords')).trim();
      const telegramPostUrl = sanitizeSafeUrl(
        extractXmlValue(findPrefixedTag(item, 'telegramPostUrl')).trim(),
        false
      );
      const telegramChannel = extractXmlValue(findPrefixedTag(item, 'telegramChannel')).trim();

      const savPublishedAt = extractXmlValue(findPrefixedTag(item, 'publishedAt')).trim();
      const parsedPublishedMs = Date.parse(savPublishedAt || pubDateRaw || incomingUpdatedAt);
      const createdAt = !isNaN(parsedPublishedMs) && parsedPublishedMs > 0 ? parsedPublishedMs : Date.now();
      const parsedUpdatedMs = Date.parse(incomingUpdatedAt);
      const updatedAt = !isNaN(parsedUpdatedMs) && parsedUpdatedMs > 0 ? parsedUpdatedMs : Date.now();

      const tagsArr = Array.from(
        new Set(
          [category, ...seoKeywords.split(',').map((s) => s.trim())]
            .filter(Boolean)
            .slice(0, 8)
        )
      );

      if (existing) {
        await queryRun(
          `UPDATE blog_posts SET
            title = $1,
            excerpt = $2,
            content_markdown = $3,
            cover_image = $4,
            cover_image_url = $5,
            cover_video_url = $6,
            category = $7,
            tags = $8::jsonb,
            seo_title = $9,
            seo_description = $10,
            seo_keywords = $11,
            author_name = $12,
            author_role = $13,
            reading_time = $14,
            external_updated_at = $15,
            source_url = $16,
            telegram_post_url = $17,
            telegram_channel = $18,
            media_json = $19,
            buttons_json = $20,
            updated_at = $21
          WHERE id = $22`,
          [
            title,
            excerpt,
            contentMarkdown,
            coverImage,
            coverImage,
            coverVideoUrl,
            category,
            JSON.stringify(tagsArr),
            seoTitle,
            seoDescription,
            seoKeywords,
            authorName,
            authorRole,
            readingTime,
            incomingUpdatedAt,
            linkVal,
            telegramPostUrl,
            telegramChannel,
            mediaJsonStr,
            buttonsJsonStr,
            updatedAt,
            existing.id
          ]
        );
        updated++;
      } else {
        const savSlug = extractXmlValue(findPrefixedTag(item, 'slug')).trim();
        let candidateSlug = slugifyCyrillic(savSlug || title);
        if (usedSlugs.has(candidateSlug)) {
          let counter = 2;
          while (usedSlugs.has(`${candidateSlug}-${counter}`)) counter++;
          candidateSlug = `${candidateSlug}-${counter}`;
        }
        usedSlugs.add(candidateSlug);

        const safeIdSuffix = slugifyCyrillic(externalId).slice(0, 48);
        const newId = `rss_${safeIdSuffix}_${Math.random().toString(36).slice(2, 6)}`;

        await queryRun(
          `INSERT INTO blog_posts (
            id, slug, title, excerpt, content_markdown,
            cover_image, cover_image_url, cover_video_url,
            category, tags, seo_title, seo_description, seo_keywords,
            canonical_url, author_name, author_role, reading_time,
            published, views_count, external_id, external_updated_at,
            source_url, telegram_post_url, telegram_channel,
            media_json, buttons_json, is_pinned, pinned_order, pinned_at,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10::jsonb, $11, $12, $13,
            $14, $15, $16, $17,
            TRUE, 0, $18, $19,
            $20, $21, $22,
            $23, $24, FALSE, 0, NULL,
            $25, $26
          )
          ON CONFLICT (external_id) DO NOTHING`,
          [
            newId,
            candidateSlug,
            title,
            excerpt,
            contentMarkdown,
            coverImage,
            coverImage,
            coverVideoUrl,
            category,
            JSON.stringify(tagsArr),
            seoTitle,
            seoDescription,
            seoKeywords,
            `/blog/${candidateSlug}`,
            authorName,
            authorRole,
            readingTime,
            externalId,
            incomingUpdatedAt,
            linkVal,
            telegramPostUrl,
            telegramChannel,
            mediaJsonStr,
            buttonsJsonStr,
            createdAt,
            updatedAt
          ]
        );
        byExternalId.set(externalId, { id: newId, external_id: externalId, external_updated_at: incomingUpdatedAt });
        added++;
      }
    }

    const result: SavRssSyncResult = {
      added,
      updated,
      skipped,
      totalParsed: rawItems.length,
      sourceDomain: domain,
      sourceUrl: url,
      syncedAt: Date.now()
    };
    lastSyncStats = result;
    console.log(
      `[SAV RSS Sync] ${domain}: added=${added}, updated=${updated}, skipped=${skipped}, total=${rawItems.length}`
    );
    return result;
  } catch (err: any) {
    lastSyncError = err?.message || 'RSS sync error';
    console.error('[SAV RSS Sync Error]', err);
    throw err;
  } finally {
    isSyncInProgress = false;
  }
}
