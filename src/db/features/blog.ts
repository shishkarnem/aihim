import { queryAll, queryGet, queryRun } from '../core';
import { INITIAL_BLOG_POSTS } from './blogSeedData';

export const SAV_DEFAULT_FALLBACK_IMAGE =
  'https://file.pro-talk.ru/tgf/GgMpJwQ9JCkYKglyGHQMJH0GOjgMOTE_BA9wETwiCzYmBQ95AyhoBSJLMhgZEyQdKwssKyoEUnQKdGsEfDonABIYETY4NRQmEV9uZlUAaA11VQJrCjgDAzkkAVczLRouDiMXfQxTNBdFGT8aIyw2ZyIcIQsIKjIuHhtsBXZSBGZ5T3FP.png';

export const AIHIM_DEFAULT_COVER = '/file/53/og_banner_1200x630.jpg';

export function normalizeBlogCoverImage(rawUrl?: string | null): string {
  const val = String(rawUrl || '').trim();
  if (
    !val ||
    val === SAV_DEFAULT_FALLBACK_IMAGE ||
    val.includes('GgMpJwQ9JCkYKglyGHQMJH0GOjgMOTE_BA9wETwiCzYmBQ95Ayho')
  ) {
    return AIHIM_DEFAULT_COVER;
  }
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(val)) {
    return AIHIM_DEFAULT_COVER;
  }
  if (/^(https?:\/\/|\/(?!\/))/i.test(val)) {
    return val;
  }
  return AIHIM_DEFAULT_COVER;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_markdown: string;
  cover_image: string;
  cover_image_url: string;
  cover_video_url: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  author_name: string;
  author_role: string;
  reading_time: number;
  published: boolean;
  views_count: number;
  external_id: string | null;
  external_updated_at: string;
  source_url: string;
  telegram_post_url: string;
  telegram_channel: string;
  media_json: string;
  buttons_json: string;
  is_pinned: boolean;
  pinned_order: number;
  pinned_at: number | null;
  created_at: number;
  updated_at: number;
}

const CYR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'shh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

export function slugifyCyrillic(input: string): string {
  const lower = String(input || '').trim().toLowerCase();
  let translit = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    translit += CYR_MAP[ch] !== undefined ? CYR_MAP[ch] : ch;
  }
  return (
    translit
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || `article-${Date.now()}`
  );
}

export function estimateReadingTime(markdown: string): number {
  const words = String(markdown || '')
    .replace(/[#>*_`[\]()-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 160));
}

function toJsonString(val: any, fallback: string): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed || fallback;
  }
  if (val && typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function mapBlogRow(row: any): BlogPost {
  const tags = Array.isArray(row?.tags)
    ? row.tags
    : typeof row?.tags === 'string'
      ? (() => {
          try {
            const p = JSON.parse(row.tags);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];

  const safeCoverImage = normalizeBlogCoverImage(row.cover_image_url || row.cover_image);

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title || ''),
    excerpt: String(row.excerpt || ''),
    content_markdown: String(row.content_markdown || ''),
    cover_image: safeCoverImage,
    cover_image_url: safeCoverImage,
    cover_video_url: String(row.cover_video_url || '').trim(),
    category: String(row.category || 'Алхимия'),
    tags,
    seo_title: String(row.seo_title || row.title || ''),
    seo_description: String(row.seo_description || row.excerpt || ''),
    seo_keywords: String(row.seo_keywords || ''),
    canonical_url: String(row.canonical_url || ''),
    author_name: String(row.author_name || 'Редакция AIhim'),
    author_role: String(row.author_role || ''),
    reading_time: Number(row.reading_time) || 3,
    published: row.published !== false && row.published !== 0 && row.published !== 'false',
    views_count: Number(row.views_count) || 0,
    external_id: row.external_id ? String(row.external_id) : null,
    external_updated_at: String(row.external_updated_at || ''),
    source_url: String(row.source_url || ''),
    telegram_post_url: String(row.telegram_post_url || ''),
    telegram_channel: String(row.telegram_channel || ''),
    media_json: toJsonString(row.media_json, '[]'),
    buttons_json: toJsonString(row.buttons_json, '[]'),
    is_pinned: row.is_pinned === true || row.is_pinned === 1 || row.is_pinned === 'true',
    pinned_order: Number(row.pinned_order) || 0,
    pinned_at: row.pinned_at !== null && row.pinned_at !== undefined ? Number(row.pinned_at) : null,
    created_at: Number(row.created_at) || Date.now(),
    updated_at: Number(row.updated_at) || Date.now()
  };
}

let blogSchemaReady = false;
let blogInitPromise: Promise<void> | null = null;

export async function ensureBlogTableAndSeed(): Promise<void> {
  if (blogSchemaReady) return;
  if (blogInitPromise) return blogInitPromise;

  blogInitPromise = (async () => {
    await queryRun(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        excerpt TEXT DEFAULT '',
        content_markdown TEXT NOT NULL,
        cover_image TEXT DEFAULT '${AIHIM_DEFAULT_COVER}',
        cover_image_url TEXT DEFAULT '${AIHIM_DEFAULT_COVER}',
        cover_video_url TEXT DEFAULT '',
        category TEXT DEFAULT 'Алхимия',
        tags JSONB DEFAULT '[]'::jsonb,
        seo_title TEXT DEFAULT '',
        seo_description TEXT DEFAULT '',
        seo_keywords TEXT DEFAULT '',
        canonical_url TEXT DEFAULT '',
        author_name TEXT DEFAULT 'Редакция AIhim',
        author_role TEXT DEFAULT '',
        reading_time INTEGER DEFAULT 4,
        published BOOLEAN DEFAULT TRUE,
        views_count INTEGER DEFAULT 0,
        external_id TEXT UNIQUE,
        external_updated_at TEXT DEFAULT '',
        source_url TEXT DEFAULT '',
        telegram_post_url TEXT DEFAULT '',
        telegram_channel TEXT DEFAULT '',
        media_json TEXT DEFAULT '[]',
        buttons_json TEXT DEFAULT '[]',
        is_pinned BOOLEAN DEFAULT FALSE,
        pinned_order INTEGER DEFAULT 0,
        pinned_at BIGINT DEFAULT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);

    const alterStatements = [
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS external_updated_at TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT '${AIHIM_DEFAULT_COVER}'`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_video_url TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS telegram_post_url TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS telegram_channel TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT ''`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS media_json TEXT DEFAULT '[]'`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS buttons_json TEXT DEFAULT '[]'`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS pinned_order INTEGER DEFAULT 0`,
      `ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS pinned_at BIGINT DEFAULT NULL`
    ];

    for (const ddl of alterStatements) {
      await queryRun(ddl).catch(() => {});
    }

    if (INITIAL_BLOG_POSTS.length > 0) {
      const values: any[] = [];
      const rowPlaceholders: string[] = [];
      let idx = 1;
      for (const post of INITIAL_BLOG_POSTS) {
        rowPlaceholders.push(
          `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, TRUE, 0, $${idx++}, $${idx++})`
        );
        values.push(
          post.id,
          post.slug,
          post.title,
          post.excerpt,
          post.content_markdown,
          post.cover_image,
          post.cover_image,
          post.category,
          JSON.stringify(post.tags),
          post.seo_title,
          post.seo_description,
          post.seo_keywords,
          `/blog/${post.slug}`,
          post.author_name,
          post.reading_time,
          post.created_at,
          post.created_at
        );
      }

      await queryRun(
        `INSERT INTO blog_posts (
          id, slug, title, excerpt, content_markdown, cover_image, cover_image_url, category, tags,
          seo_title, seo_description, seo_keywords, canonical_url, author_name,
          reading_time, published, views_count, created_at, updated_at
        ) VALUES ${rowPlaceholders.join(', ')}
        ON CONFLICT (slug) DO NOTHING`,
        values
      );
    }

    blogSchemaReady = true;
  })().catch((err) => {
    blogInitPromise = null;
    throw err;
  });

  return blogInitPromise;
}

const BLOG_ORDER_SQL =
  'COALESCE(is_pinned, FALSE) DESC, CASE WHEN COALESCE(is_pinned, FALSE) THEN COALESCE(pinned_order, 0) ELSE 0 END ASC, COALESCE(pinned_at, 0) DESC, created_at DESC';

export async function getPublishedBlogPosts(options: {
  q?: string;
  category?: string;
  limit?: number;
} = {}): Promise<BlogPost[]> {
  const rows = await queryAll<any>(
    `SELECT * FROM blog_posts WHERE COALESCE(published, TRUE) = TRUE ORDER BY ${BLOG_ORDER_SQL}`
  );
  let posts = rows.map(mapBlogRow);

  if (options.category && options.category !== 'Все') {
    const cat = options.category.trim().toLowerCase();
    posts = posts.filter((p) => p.category.toLowerCase() === cat);
  }
  if (options.q && options.q.trim()) {
    const q = options.q.trim().toLowerCase();
    posts = posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.seo_keywords.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.content_markdown.toLowerCase().includes(q)
    );
  }
  if (options.limit && options.limit > 0) {
    posts = posts.slice(0, options.limit);
  }
  return posts;
}

export async function getPublishedBlogPostsPaginated(options: {
  q?: string;
  category?: string;
  offset?: number;
  limit?: number;
} = {}): Promise<{
  posts: BlogPost[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
  categories: string[];
  pinnedCount: number;
}> {
  const rows = await queryAll<any>(
    `SELECT * FROM blog_posts WHERE COALESCE(published, TRUE) = TRUE ORDER BY ${BLOG_ORDER_SQL}`
  );
  const allPublished = rows.map(mapBlogRow);

  const catSet = new Set<string>(['Все']);
  let pinnedCount = 0;
  for (const p of allPublished) {
    if (p.category) catSet.add(p.category);
    if (p.is_pinned) pinnedCount++;
  }

  let filtered = allPublished;
  if (options.category && options.category !== 'Все') {
    const cat = options.category.trim().toLowerCase();
    filtered = filtered.filter((p) => p.category.toLowerCase() === cat);
  }
  if (options.q && options.q.trim()) {
    const q = options.q.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.seo_keywords.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.content_markdown.toLowerCase().includes(q)
    );
  }

  const safeOffset = Math.max(0, Number(options.offset) || 0);
  const safeLimit = Math.min(Math.max(1, Number(options.limit) || 20), 20);
  const slice = filtered.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + slice.length;

  return {
    posts: slice,
    total: filtered.length,
    hasMore: nextOffset < filtered.length,
    nextOffset,
    categories: Array.from(catSet),
    pinnedCount
  };
}

export async function getAllBlogPostsAdmin(): Promise<BlogPost[]> {
  const rows = await queryAll<any>(`SELECT * FROM blog_posts ORDER BY ${BLOG_ORDER_SQL}`);
  return rows.map(mapBlogRow);
}

export async function getBlogPostBySlug(
  slug: string,
  incrementViews = false
): Promise<BlogPost | null> {
  const row = await queryGet<any>('SELECT * FROM blog_posts WHERE slug = $1', [slug]);
  if (!row) return null;
  if (incrementViews) {
    await queryRun(
      'UPDATE blog_posts SET views_count = COALESCE(views_count, 0) + 1 WHERE slug = $1',
      [slug]
    ).catch(() => {});
    row.views_count = (Number(row.views_count) || 0) + 1;
  }
  return mapBlogRow(row);
}

export async function upsertBlogPost(
  input: Partial<BlogPost> & { title: string; content_markdown: string }
): Promise<BlogPost> {
  const now = Date.now();
  const id = (input.id && String(input.id).trim()) || `blog_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const rawSlug = input.slug && String(input.slug).trim() ? input.slug : input.title;
  const slug = slugifyCyrillic(rawSlug);
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const readingTime = Number(input.reading_time) || estimateReadingTime(input.content_markdown);
  const excerpt =
    String(input.excerpt || '').trim() ||
    String(input.content_markdown || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);

  const existing = await queryGet<any>(
    'SELECT id, created_at, views_count, is_pinned, pinned_order, pinned_at, external_id, external_updated_at FROM blog_posts WHERE id = $1',
    [id]
  );
  const createdAt = existing?.created_at ? Number(existing.created_at) : Number(input.created_at) || now;
  const canonicalUrl = String(input.canonical_url || `/blog/${slug}`).trim();
  const safeCoverImage = normalizeBlogCoverImage(input.cover_image_url || input.cover_image);

  await queryRun(
    `INSERT INTO blog_posts (
      id, slug, title, excerpt, content_markdown, cover_image, cover_image_url, cover_video_url,
      category, tags, seo_title, seo_description, seo_keywords, canonical_url,
      author_name, author_role, reading_time, published, views_count,
      is_pinned, pinned_order, pinned_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10::jsonb, $11, $12, $13, $14,
      $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      content_markdown = EXCLUDED.content_markdown,
      cover_image = EXCLUDED.cover_image,
      cover_image_url = EXCLUDED.cover_image_url,
      cover_video_url = EXCLUDED.cover_video_url,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description,
      seo_keywords = EXCLUDED.seo_keywords,
      canonical_url = EXCLUDED.canonical_url,
      author_name = EXCLUDED.author_name,
      author_role = EXCLUDED.author_role,
      reading_time = EXCLUDED.reading_time,
      published = EXCLUDED.published,
      updated_at = EXCLUDED.updated_at`,
    [
      id,
      slug,
      input.title.trim(),
      excerpt,
      input.content_markdown,
      safeCoverImage,
      safeCoverImage,
      String(input.cover_video_url || '').trim(),
      String(input.category || 'Алхимия').trim(),
      JSON.stringify(tags),
      String(input.seo_title || input.title).trim(),
      String(input.seo_description || excerpt).trim(),
      String(input.seo_keywords || tags.join(', ')).trim(),
      canonicalUrl,
      String(input.author_name || 'Редакция AIhim').trim(),
      String(input.author_role || '').trim(),
      readingTime,
      input.published !== false,
      Number(existing?.views_count) || 0,
      Boolean(existing?.is_pinned ?? input.is_pinned),
      Number(existing?.pinned_order ?? input.pinned_order) || 0,
      existing?.pinned_at ?? input.pinned_at ?? null,
      createdAt,
      now
    ]
  );

  const saved = await queryGet<any>('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return mapBlogRow(saved);
}

export async function pinBlogPost(id: string, pinned: boolean): Promise<BlogPost> {
  const existing = await queryGet<any>('SELECT * FROM blog_posts WHERE id = $1', [id]);
  if (!existing) {
    throw new Error('Статья не найдена');
  }

  if (pinned) {
    const pinnedRows = await queryAll<any>(
      'SELECT id, pinned_order FROM blog_posts WHERE COALESCE(is_pinned, FALSE) = TRUE AND id <> $1',
      [id]
    );
    if (pinnedRows.length >= 10) {
      throw new Error('Можно закрепить не более 10 статей. Сначала открепите одну из закреплённых.');
    }
    const maxOrder = pinnedRows.reduce((max, r) => Math.max(max, Number(r.pinned_order) || 0), 0);
    const nextOrder = existing.is_pinned ? Number(existing.pinned_order) || maxOrder + 1 : maxOrder + 1;
    await queryRun(
      'UPDATE blog_posts SET is_pinned = TRUE, pinned_order = $1, pinned_at = $2 WHERE id = $3',
      [nextOrder, Number(existing.pinned_at) || Date.now(), id]
    );
  } else {
    await queryRun(
      'UPDATE blog_posts SET is_pinned = FALSE, pinned_order = 0, pinned_at = NULL WHERE id = $1',
      [id]
    );
  }

  const updated = await queryGet<any>('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return mapBlogRow(updated);
}

export async function movePinnedBlogPost(id: string, direction: 'up' | 'down'): Promise<void> {
  const pinnedRows = await queryAll<any>(
    `SELECT id, pinned_order FROM blog_posts WHERE COALESCE(is_pinned, FALSE) = TRUE ORDER BY ${BLOG_ORDER_SQL}`
  );
  const idx = pinnedRows.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) return;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= pinnedRows.length) return;

  const temp = pinnedRows[idx];
  pinnedRows[idx] = pinnedRows[swapIdx];
  pinnedRows[swapIdx] = temp;

  for (let i = 0; i < pinnedRows.length; i++) {
    await queryRun('UPDATE blog_posts SET pinned_order = $1 WHERE id = $2', [i + 1, pinnedRows[i].id]);
  }
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  const res = await queryRun('DELETE FROM blog_posts WHERE id = $1', [id]);
  return res.changes > 0;
}
