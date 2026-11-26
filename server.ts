import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import dotenv from 'dotenv';
import {
  initializeDatabase,
  ensureBlogTableAndSeed,
  getPublishedBlogPostsPaginated,
  queryGet,
  queryRun,
  syncSavRssFeed
} from './src/db';
import { registerFilesAndSystemRoutes } from './src/server/routes/filesAndSystem';
import { registerUsersAndElementsRoutes } from './src/server/routes/usersAndElements';
import { registerAdminAndConfigRoutes } from './src/server/routes/adminAndConfig';
import {
  registerPaymentsAndMailingRoutes,
  sendWeeklyInactiveReminders
} from './src/server/routes/paymentsAndMailing';
import { registerBlogRoutes } from './src/server/features/blogRoutes';
import { registerPushRoutes } from './src/server/features/pushRoutes';
import {
  registerSeoRoutes,
  resolveSiteOrigin,
  injectSeoMetaIntoHtml
} from './src/server/features/seoRoutes';

if (dns.setDefaultResultOrder) {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch (e) {
    console.warn('Could not set dns default result order:', e);
  }
}

dotenv.config();

async function startServer() {
  try {
    await initializeDatabase();
    void ensureBlogTableAndSeed()
      .then(() => getPublishedBlogPostsPaginated({ offset: 0, limit: 20 }))
      .catch(() => {});
  } catch (err) {
    console.error('[PostgreSQL] Initialization warning:', err);
  }

  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Global body-parser error handler to ensure JSON error responses instead of HTML 413/500
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('[Express Body Parser Error]', err);
      return res.status(err.status || 400).json({
        error:
          err.type === 'entity.too.large'
            ? 'Размер загружаемого файла слишком велик (превышен лимит 100MB).'
            : `Ошибка обработки запроса: ${err.message}`
      });
    }
    next();
  });

  // Dynamic SEO endpoints (/sitemap.xml, /rss.xml, /robots.txt, /llms.txt, /yandex-tableau.json, /browserconfig.xml)
  registerSeoRoutes(app);

  // Modular API routes backed by ProTalk PostgreSQL (aihim2)
  registerFilesAndSystemRoutes(app);
  registerUsersAndElementsRoutes(app);
  registerAdminAndConfigRoutes(app);
  registerPaymentsAndMailingRoutes(app);
  registerBlogRoutes(app);
  registerPushRoutes(app);

  // Production / Preview vs Dev middleware detection
  const isCompiledCjs =
    (typeof __filename !== 'undefined' && __filename.endsWith('server.cjs')) ||
    Boolean(process.argv[1]?.endsWith('server.cjs'));
  const isProduction = process.env.NODE_ENV === 'production' || isCompiledCjs;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        watch: isHmrDisabled ? { ignored: ['**/*'] } : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const localDir = typeof __dirname !== 'undefined' ? __dirname : cwdDist;
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html')) ? cwdDist : localDir;

    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('push-sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('.html')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.get('*', async (req, res) => {
      if (/\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|map|css|js|webmanifest)$/i.test(req.path || '')) {
        return res.status(404).send('Not found');
      }
      const origin = resolveSiteOrigin(req);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

      try {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, 'utf8');
          html = await injectSeoMetaIntoHtml(html, origin, req.path || '/');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        }
      } catch (err) {
        console.error('Error reading index.html:', err);
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Hourly scheduler for Express-side Telegram weekly inactive reminders
  // (SQL cron tasks and daily 06:00 MSK JSON backups run natively on ProTalk PostgreSQL)
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
  setInterval(async () => {
    try {
      const job = await queryGet<{
        name: string;
        status: string;
        nextRun: number | null;
      }>("SELECT * FROM system_cron_jobs WHERE name = 'WeeklyInactiveReminders'");
      if (!job || job.status === 'disabled') return;
      const now = Date.now();
      if (job.nextRun && now < job.nextRun) return;

      await queryRun("UPDATE system_cron_jobs SET status = 'running', lastrun = $1 WHERE name = $2", [now, job.name]);
      try {
        await sendWeeklyInactiveReminders({ forceAll: false, daysInactive: 7 });
        await queryRun(
          "UPDATE system_cron_jobs SET status = 'idle', executionscount = COALESCE(executionscount, 0) + 1, nextrun = $1 WHERE name = $2",
          [now + SEVEN_DAYS_MS, job.name]
        );
      } catch (cronErr) {
        await queryRun("UPDATE system_cron_jobs SET status = 'idle' WHERE name = $1", [job.name]).catch(() => {});
        throw cronErr;
      }
    } catch (e) {
      console.error('[Cron WeeklyInactiveReminders] Warning:', e);
    }
  }, ONE_HOUR_MS);

  // Automatic SAV AI RSS 2.0 blog sync: initial run 10s after start, then every 10 minutes
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  setTimeout(() => {
    syncSavRssFeed({ limit: 100 }).catch((err) => {
      console.warn('[SAV RSS Initial Sync] Warning:', err?.message || err);
    });
  }, 10000);
  setInterval(() => {
    syncSavRssFeed({ limit: 100 }).catch((err) => {
      console.warn('[SAV RSS Scheduled Sync] Warning:', err?.message || err);
    });
  }, TEN_MINUTES_MS);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server running on port ${PORT} [${isProduction ? 'production' : 'development'}] (PostgreSQL: aihim2)`
    );
  });
}

startServer();
