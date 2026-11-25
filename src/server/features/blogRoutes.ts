import type express from 'express';
import {
  ensureBlogTableAndSeed,
  getPublishedBlogPostsPaginated,
  getAllBlogPostsAdmin,
  getBlogPostBySlug,
  upsertBlogPost,
  deleteBlogPost,
  pinBlogPost,
  movePinnedBlogPost,
  syncSavRssFeed,
  getSavRssSyncStatus,
  sendWebPushBroadcast,
  slugifyCyrillic
} from '../../db';

export function registerBlogRoutes(app: express.Express) {
  app.get('/api/blog/posts', async (req, res) => {
    try {
      await ensureBlogTableAndSeed();
      const showAll = req.query.all === '1' || req.query.all === 'true';
      if (showAll) {
        const posts = await getAllBlogPostsAdmin();
        const pinnedCount = posts.filter((p) => p.is_pinned).length;
        return res.json({
          posts,
          pinnedCount,
          maxPinned: 10,
          syncStatus: getSavRssSyncStatus()
        });
      }

      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;

      const result = await getPublishedBlogPostsPaginated({ q, category, offset, limit });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/blog/posts/:slug', async (req, res) => {
    try {
      await ensureBlogTableAndSeed();
      const track = req.query.track === '1' || req.query.track === 'true';
      const post = await getBlogPostBySlug(req.params.slug, track);
      if (!post) {
        return res.status(404).json({ error: 'Статья не найдена' });
      }
      res.json({ post });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/blog/sync-rss', async (req, res) => {
    try {
      const limit = Number(req.body?.limit) || 100;
      const category = typeof req.body?.category === 'string' ? req.body.category : undefined;
      const stats = await syncSavRssFeed({ limit, category });
      res.json({ success: true, ...stats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/blog/sync-rss/status', (_req, res) => {
    res.json(getSavRssSyncStatus());
  });

  app.post('/api/blog/posts/:id/pin', async (req, res) => {
    try {
      await ensureBlogTableAndSeed();
      const pinned = Boolean(req.body?.pinned);
      const post = await pinBlogPost(req.params.id, pinned);
      res.json({ success: true, post });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/blog/posts/:id/move-pin', async (req, res) => {
    try {
      await ensureBlogTableAndSeed();
      const direction = req.body?.direction === 'down' ? 'down' : 'up';
      await movePinnedBlogPost(req.params.id, direction);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/blog/slugify', (req, res) => {
    const title = String(req.body?.title || '');
    res.json({ slug: slugifyCyrillic(title) });
  });

  app.post('/api/blog/posts', async (req, res) => {
    try {
      await ensureBlogTableAndSeed();
      const body = req.body || {};
      if (!body.title || !body.content_markdown) {
        return res.status(400).json({ error: 'Заполните заголовок и текст статьи в формате Markdown' });
      }
      const post = await upsertBlogPost(body);

      let pushResult: { sent: number; total: number } | null = null;
      if (body.notifySubscribers && post.published) {
        pushResult = await sendWebPushBroadcast('blog', {
          title: `Новая статья в блоге: ${post.title}`,
          body: post.excerpt || 'Читайте новое руководство по алхимии в AIhim.',
          url: `/blog/${post.slug}`,
          image: post.cover_image || undefined,
          tag: `blog-${post.slug}`
        });
      }

      res.json({ success: true, post, pushResult });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/blog/posts/:slug/push', async (req, res) => {
    try {
      const post = await getBlogPostBySlug(req.params.slug, false);
      if (!post) {
        return res.status(404).json({ error: 'Статья не найдена' });
      }
      const result = await sendWebPushBroadcast('blog', {
        title: `Журнал AIhim: ${post.title}`,
        body: post.excerpt || 'Откройте новую статью в блоге алхимика.',
        url: `/blog/${post.slug}`,
        tag: `blog-${post.slug}`
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/blog/posts/:id', async (req, res) => {
    try {
      const deleted = await deleteBlogPost(req.params.id);
      res.json({ success: true, deleted });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
