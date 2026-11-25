import type express from 'express';
import { getPublishedBlogPosts, getBlogPostBySlug } from '../../db';

export function resolveSiteOrigin(req: express.Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostRaw = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.get('host') || 'aihim.ru';
  const host = String(hostRaw).split(',')[0].trim();

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoRaw = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol || 'https';
  const proto = String(protoRaw).split(',')[0].trim();

  if (host.includes('localhost') || host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  return `https://${host}`;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function injectSeoMetaIntoHtml(
  html: string,
  origin: string,
  pathname: string
): Promise<string> {
  const cleanPath = pathname.split('?')[0] || '/';
  let out = html
    .replace(/https:\/\/aihim\.ru/g, origin)
    .replace(/content="\/file\//g, `content="${origin}/file/`);

  try {
    if (cleanPath === '/blog') {
      const title = 'Журнал алхимика AIhim — Статьи, рецепты и гайды по алхимии ИИ';
      const desc =
        'Полезные статьи о нейросетевой алхимии AIhim: гайды для новичков, секретные слова силы, 12 слоёв реальности, кузня, PWA и советы от мастеров.';
      const img = `${origin}/file/53/og_banner_1200x630.jpg`;
      out = out
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtmlAttr(desc)}" />`)
        .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${origin}/blog" />`)
        .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${origin}/blog" />`)
        .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`)
        .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtmlAttr(desc)}" />`)
        .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${img}" />`);
    } else if (cleanPath.startsWith('/blog/')) {
      const slug = cleanPath.replace('/blog/', '').replace(/\/$/, '');
      const post = await getBlogPostBySlug(slug, false);
      if (post) {
        const pageUrl = `${origin}/blog/${post.slug}`;
        const rawCover = (post.cover_image_url || post.cover_image || '/file/53/og_banner_1200x630.jpg').trim();
        const safeCover = /\.(mp4|webm|mov)(\?.*)?$/i.test(rawCover) ? '/file/53/og_banner_1200x630.jpg' : rawCover;
        const coverUrl = safeCover.startsWith('http')
          ? safeCover
          : `${origin}${safeCover.startsWith('/') ? '' : '/'}${safeCover}`;
        const title = post.seo_title || `${post.title} — Блог AIhim`;
        const desc = post.seo_description || post.excerpt;
        const keywords = post.seo_keywords || post.tags.join(', ');

        const articleLd = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: post.title,
          description: desc,
          image: [coverUrl],
          datePublished: new Date(post.created_at).toISOString(),
          dateModified: new Date(post.updated_at || post.created_at).toISOString(),
          author: { '@type': 'Person', name: post.author_name },
          publisher: {
            '@type': 'Organization',
            name: 'AIhim (ООО «РентРоп»)',
            logo: { '@type': 'ImageObject', url: `${origin}/file/42/pwa_icon_512x512.png` }
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
          keywords
        });

        out = out
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`)
          .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtmlAttr(desc)}" />`)
          .replace(/<meta name="keywords" content="[^"]*" \/>/, `<meta name="keywords" content="${escapeHtmlAttr(keywords)}" />`)
          .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${pageUrl}" />`)
          .replace(/<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="article" />`)
          .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${pageUrl}" />`)
          .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`)
          .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtmlAttr(desc)}" />`)
          .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${coverUrl}" />`)
          .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`)
          .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtmlAttr(desc)}" />`)
          .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${coverUrl}" />`)
          .replace(
            '</head>',
            `<script type="application/ld+json">${articleLd}</script>\n  </head>`
          );
      }
    }
  } catch (err) {
    console.warn('[SEO HTML Inject] Warning:', err);
  }

  return out;
}

export function registerSeoRoutes(app: express.Express) {
  app.get('/yandex-tableau.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      version: '1.0',
      api_version: 2,
      layout: {
        logo: '/file/49/yandex_tableau_160x160.png',
        color: '#F5F2ED',
        show_title: true
      }
    });
  });

  app.get('/browserconfig.xml', (_req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/file/48/yandex_120x120.png"/>
      <square150x150logo src="/file/50/mstile_150x150.png"/>
      <wide310x150logo src="/file/51/mstile_310x150.png"/>
      <square310x310logo src="/file/52/mstile_310x310.png"/>
      <TileColor>#F5F2ED</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`);
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolveSiteOrigin(req);
    const hostOnly = origin.replace(/^https?:\/\//, '');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *
Allow: /
Allow: /blog
Allow: /blog/
Allow: /rate
Allow: /arcana
Allow: /oferta
Disallow: /admin
Disallow: /system-admin
Disallow: /api/

User-agent: Yandex
Allow: /
Allow: /blog
Allow: /blog/
Disallow: /admin
Disallow: /system-admin
Disallow: /api/
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid /

User-agent: Googlebot
Allow: /
Allow: /blog
Allow: /blog/
Disallow: /admin
Disallow: /system-admin
Disallow: /api/

User-agent: GPTBot
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: OAI-SearchBot
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: ChatGPT-User
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: PerplexityBot
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: ClaudeBot
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: Anthropic-AI
Allow: /
Allow: /blog
Allow: /llms.txt

User-agent: Google-Extended
Allow: /
Allow: /blog
Allow: /llms.txt

Host: ${hostOnly}
Sitemap: ${origin}/sitemap.xml
`);
  });

  app.get('/llms.txt', async (req, res) => {
    const origin = resolveSiteOrigin(req);
    let postLines = '';
    try {
      const posts = await getPublishedBlogPosts();
      postLines = posts
        .map((p) => `- [${p.title}](${origin}/blog/${p.slug}): ${p.excerpt}`)
        .join('\n');
    } catch {
      postLines = `- [Журнал алхимика AIhim](${origin}/blog)`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(`# AIhim (Айхим) — Интерактивный симулятор алхимии на базе искусственного интеллекта

> AIhim — веб-приложение, PWA и Telegram Mini App (@AI_HimBot), в котором игроки объединяют первоэлементы, управляют температурой в кузне, произносят латинские слова силы и открывают уникальные соединения, генерируемые нейросетью.

## Основные разделы
- [Главная лаборатория AIhim](${origin}/): Алхимический верстак для синтеза стихий, первоматерии и редких аномалий.
- [Журнал и блог алхимика](${origin}/blog): Статьи и руководства по алхимии ИИ, слоям реальности и заклинаниям.
- [Колесо Аркан](${origin}/arcana): Система арканических связей и модификаторов синтеза.
- [Тарифы и рейтинг](${origin}/rate): Пакеты энергии AiHim и таблица лидеров.
- [Профиль и мобильное приложение PWA](${origin}/profile): Личный кабинет, установка на Android/iPhone и пуш-уведомления.
- [Публичная оферта](${origin}/oferta): Правовые условия использования сервиса.
- [XML-карта сайта](${origin}/sitemap.xml) и [RSS-лента](${origin}/rss.xml)

## Статьи блога AIhim
${postLines}
`);
  });

  app.get('/sitemap.xml', async (req, res) => {
    const origin = resolveSiteOrigin(req);
    const nowIso = new Date().toISOString();
    const staticRoutes = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/blog', changefreq: 'daily', priority: '0.9' },
      { loc: '/arcana', changefreq: 'weekly', priority: '0.8' },
      { loc: '/rate', changefreq: 'daily', priority: '0.8' },
      { loc: '/profile', changefreq: 'weekly', priority: '0.7' },
      { loc: '/oferta', changefreq: 'monthly', priority: '0.4' }
    ];

    let blogUrls = '';
    try {
      const posts = await getPublishedBlogPosts();
      blogUrls = posts
        .map((post) => {
          const lastMod = new Date(post.updated_at || post.created_at).toISOString();
          const coverUrl = post.cover_image.startsWith('http')
            ? post.cover_image
            : `${origin}${post.cover_image.startsWith('/') ? '' : '/'}${post.cover_image}`;
          return `  <url>
    <loc>${escapeXml(`${origin}/blog/${post.slug}`)}</loc>
    <lastmod>${escapeXml(lastMod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
    <image:image>
      <image:loc>${escapeXml(coverUrl)}</image:loc>
      <image:title>${escapeXml(post.title)}</image:title>
    </image:image>
  </url>`;
        })
        .join('\n');
    } catch {
      blogUrls = '';
    }

    const staticXml = staticRoutes
      .map(
        (r) => `  <url>
    <loc>${escapeXml(`${origin}${r.loc}`)}</loc>
    <lastmod>${escapeXml(nowIso)}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
      )
      .join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticXml}
${blogUrls}
</urlset>
`);
  });

  app.get('/rss.xml', async (req, res) => {
    const origin = resolveSiteOrigin(req);
    let itemsXml = '';
    try {
      const posts = await getPublishedBlogPosts();
      itemsXml = posts
        .map((post) => {
          const link = `${origin}/blog/${post.slug}`;
          const coverUrl = post.cover_image.startsWith('http')
            ? post.cover_image
            : `${origin}${post.cover_image.startsWith('/') ? '' : '/'}${post.cover_image}`;
          const pubDate = new Date(post.created_at).toUTCString();
          return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <author>support@aihim.ru (${escapeXml(post.author_name)})</author>
      <description>${escapeXml(post.excerpt || post.seo_description)}</description>
      <enclosure url="${escapeXml(coverUrl)}" type="image/jpeg" length="180000" />
    </item>`;
        })
        .join('\n');
    } catch {
      itemsXml = '';
    }

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Журнал алхимика AIhim</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Статьи, руководства, секретные рецепты и новости нейросетевого симулятора алхимии AIhim.</description>
    <language>ru-ru</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <image>
      <url>${escapeXml(`${origin}/file/41/pwa_icon_192x192.png`)}</url>
      <title>Журнал алхимика AIhim</title>
      <link>${escapeXml(`${origin}/blog`)}</link>
    </image>
${itemsXml}
  </channel>
</rss>
`);
  });
}
