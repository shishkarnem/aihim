import type { BlogArticleItem } from '../BlogListPage';

export interface CachedBlogListEntry {
  posts: BlogArticleItem[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
  categories: string[];
  updatedAt: number;
}

interface CachedArticleEntry {
  post: BlogArticleItem;
  updatedAt: number;
}

export interface SavedBlogScrollState {
  y: number;
  slug: string;
}

const LIST_STORAGE_KEY = 'aihim_blog_list_cache_v3';
const ARTICLE_STORAGE_KEY = 'aihim_blog_articles_cache_v3';
const SCROLL_STORAGE_KEY = 'aihim_blog_scroll_v3';
const LEGACY_STORAGE_KEYS = [
  'aihim_blog_list_cache_v1',
  'aihim_blog_articles_cache_v1',
  'aihim_blog_scroll_v1',
  'aihim_blog_list_cache_v2',
  'aihim_blog_articles_cache_v2',
  'aihim_blog_scroll_v2'
];
const LIST_FRESH_MS = 5 * 60 * 1000;
const LIST_STORAGE_TTL_MS = 30 * 60 * 1000;
const ARTICLE_FRESH_MS = 5 * 60 * 1000;
const ARTICLE_STORAGE_TTL_MS = 60 * 60 * 1000;
const MAX_STORED_LIST_ITEMS = 100;
const MAX_STORED_ARTICLES = 24;

const listMemoryCache = new Map<string, CachedBlogListEntry>();
const articleMemoryCache = new Map<string, CachedArticleEntry>();
const inFlightArticlePrefetch = new Map<string, Promise<BlogArticleItem | null>>();
const listScrollMemory = new Map<string, SavedBlogScrollState>();
let storageHydrated = false;

function makeListKey(category: string, q: string): string {
  return `${(category || 'Все').trim()}::${(q || '').trim().toLowerCase()}`;
}

function dedupePostsById(items: BlogArticleItem[]): BlogArticleItem[] {
  const seen = new Set<string>();
  const out: BlogArticleItem[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function hydrateFromStorageOnce(): void {
  if (storageHydrated || typeof window === 'undefined') return;
  storageHydrated = true;
  const now = Date.now();

  for (const oldKey of LEGACY_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(oldKey);
      window.sessionStorage.removeItem(oldKey);
    } catch {
      // ignore
    }
  }

  try {
    const rawList = window.localStorage.getItem(LIST_STORAGE_KEY);
    if (rawList) {
      const parsed = JSON.parse(rawList) as Record<string, CachedBlogListEntry>;
      if (parsed && typeof parsed === 'object') {
        for (const [k, entry] of Object.entries(parsed)) {
          if (entry && Array.isArray(entry.posts) && entry.posts.length > 0 && now - (entry.updatedAt || 0) < LIST_STORAGE_TTL_MS) {
            const posts = dedupePostsById(entry.posts);
            listMemoryCache.set(k, {
              ...entry,
              posts,
              nextOffset: Math.max(Number(entry.nextOffset) || 0, posts.length)
            });
          }
        }
      }
    }
  } catch {
    // ignore corrupted storage
  }

  try {
    const rawArticles = window.localStorage.getItem(ARTICLE_STORAGE_KEY);
    if (rawArticles) {
      const parsed = JSON.parse(rawArticles) as CachedArticleEntry[];
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry?.post?.slug && now - (entry.updatedAt || 0) < ARTICLE_STORAGE_TTL_MS) {
            articleMemoryCache.set(entry.post.slug, entry);
          }
        }
      }
    }
  } catch {
    // ignore corrupted storage
  }
}

function persistListCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const defaultKey = makeListKey('Все', '');
    const out: Record<string, CachedBlogListEntry> = {};
    const defaultEntry = listMemoryCache.get(defaultKey);
    if (defaultEntry && defaultEntry.posts.length > 0) {
      const slimPosts = defaultEntry.posts
        .slice(0, MAX_STORED_LIST_ITEMS)
        .map((p) => (p.content_markdown ? { ...p, content_markdown: '' } : p));
      out[defaultKey] = {
        ...defaultEntry,
        posts: slimPosts,
        nextOffset: Math.max(Number(defaultEntry.nextOffset) || 0, slimPosts.length),
        hasMore: slimPosts.length < defaultEntry.total ? true : defaultEntry.hasMore
      };
    }
    window.localStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(out));
  } catch {
    // ignore quota errors
  }
}

function persistArticleCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = Array.from(articleMemoryCache.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_STORED_ARTICLES);
    window.localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // ignore quota errors
  }
}

export function getCachedBlogList(
  category: string,
  q: string
): { entry: CachedBlogListEntry; isFresh: boolean } | null {
  hydrateFromStorageOnce();
  const key = makeListKey(category, q);
  const entry = listMemoryCache.get(key);
  if (!entry || !entry.posts.length) return null;
  const age = Date.now() - entry.updatedAt;
  if (age >= LIST_STORAGE_TTL_MS) {
    listMemoryCache.delete(key);
    return null;
  }
  return { entry, isFresh: age < LIST_FRESH_MS };
}

export function setCachedBlogList(
  category: string,
  q: string,
  entry: Omit<CachedBlogListEntry, 'updatedAt'>
): void {
  hydrateFromStorageOnce();
  if (!entry.posts || entry.posts.length === 0) return;
  const key = makeListKey(category, q);
  if (listMemoryCache.size > 24 && !listMemoryCache.has(key)) {
    const firstKey = listMemoryCache.keys().next().value;
    if (firstKey) listMemoryCache.delete(firstKey);
  }
  const dedupedPosts = dedupePostsById(entry.posts);
  listMemoryCache.set(key, {
    ...entry,
    posts: dedupedPosts,
    nextOffset: Math.max(Number(entry.nextOffset) || 0, dedupedPosts.length),
    updatedAt: Date.now()
  });
  if (key === makeListKey('Все', '')) {
    persistListCache();
  }
}

export function getCachedBlogArticle(
  slug: string
): { post: BlogArticleItem; isFresh: boolean } | null {
  hydrateFromStorageOnce();
  const entry = articleMemoryCache.get(slug);
  if (!entry) return null;
  const age = Date.now() - entry.updatedAt;
  if (age >= ARTICLE_STORAGE_TTL_MS) {
    articleMemoryCache.delete(slug);
    return null;
  }
  return { post: entry.post, isFresh: age < ARTICLE_FRESH_MS };
}

export function setCachedBlogArticle(post: BlogArticleItem): void {
  if (!post?.slug) return;
  hydrateFromStorageOnce();
  articleMemoryCache.set(post.slug, {
    post,
    updatedAt: Date.now()
  });
  persistArticleCache();
}

export function getCachedRelatedArticles(excludeSlug: string, count = 3): BlogArticleItem[] {
  hydrateFromStorageOnce();
  const defaultList = listMemoryCache.get(makeListKey('Все', ''));
  if (!defaultList?.posts?.length) return [];
  return defaultList.posts.filter((p) => p.slug !== excludeSlug).slice(0, count);
}

export function prefetchBlogPost(slug: string): void {
  if (!slug) return;
  const existing = getCachedBlogArticle(slug);
  if (existing?.isFresh) return;
  if (inFlightArticlePrefetch.has(slug)) return;

  const promise = fetch(`/api/blog/posts/${encodeURIComponent(slug)}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.post) {
        setCachedBlogArticle(data.post);
        return data.post as BlogArticleItem;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inFlightArticlePrefetch.delete(slug);
    });

  inFlightArticlePrefetch.set(slug, promise);
}

export function invalidateClientBlogCache(): void {
  listMemoryCache.clear();
  articleMemoryCache.clear();
  listScrollMemory.clear();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LIST_STORAGE_KEY);
      window.localStorage.removeItem(ARTICLE_STORAGE_KEY);
      window.sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function getCurrentScrollY(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.scrollingElement?.scrollTop || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );
}

export function scrollPageToY(y: number): void {
  if (typeof window === 'undefined') return;
  const target = Math.max(0, Math.round(y));
  window.scrollTo({ top: target, left: 0, behavior: 'auto' });
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = target;
  }
  if (document.documentElement) {
    document.documentElement.scrollTop = target;
  }
  if (document.body) {
    document.body.scrollTop = target;
  }
}

export function saveBlogScrollPosition(
  category: string,
  q: string,
  y: number,
  slug?: string
): void {
  if (typeof window === 'undefined') return;
  const key = makeListKey(category, q);
  const prev = getSavedBlogScrollState(category, q);
  const safeY = Math.max(0, Math.round(y));
  const nextState: SavedBlogScrollState = {
    y: safeY,
    slug: slug !== undefined ? slug : prev.slug
  };
  listScrollMemory.set(key, nextState);
  try {
    const raw = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, SavedBlogScrollState>) : {};
    parsed[key] = nextState;
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

export function getSavedBlogScrollState(category: string, q: string): SavedBlogScrollState {
  const key = makeListKey(category, q);
  const mem = listScrollMemory.get(key);
  if (mem) return mem;
  if (typeof window === 'undefined') return { y: 0, slug: '' };
  try {
    const raw = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return { y: 0, slug: '' };
    const parsed = JSON.parse(raw) as Record<string, SavedBlogScrollState | number>;
    const val = parsed?.[key];
    if (typeof val === 'number' && val >= 0) {
      const state = { y: val, slug: '' };
      listScrollMemory.set(key, state);
      return state;
    }
    if (val && typeof val === 'object') {
      const state = {
        y: Math.max(0, Number(val.y) || 0),
        slug: typeof val.slug === 'string' ? val.slug : ''
      };
      listScrollMemory.set(key, state);
      return state;
    }
  } catch {
    // ignore
  }
  return { y: 0, slug: '' };
}

export function getSavedBlogScrollPosition(category: string, q: string): number {
  return getSavedBlogScrollState(category, q).y;
}

