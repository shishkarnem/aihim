import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'push-sw.js',
          'yandex-tableau.json',
          'browserconfig.xml',
          'robots.txt',
          'llms.txt',
        ],
        manifest: {
          id: '/',
          name: 'AIhim — Симулятор алхимии на базе ИИ',
          short_name: 'AIhim',
          description:
            'Интерактивный симулятор алхимии с нейросетью: соединяйте стихии, закаляйте элементы в кузне, произносите слова силы и открывайте 12 слоёв реальности.',
          start_url: '/?source=pwa',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#F5F2ED',
          background_color: '#F5F2ED',
          lang: 'ru',
          dir: 'ltr',
          categories: ['games', 'entertainment', 'education'],
          icons: [
            {
              src: '/file/40/pwa_icon_96x96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/file/41/pwa_icon_192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/file/42/pwa_icon_512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/file/43/pwa_icon_maskable_512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/file/53/og_banner_1200x630.jpg',
              sizes: '1200x630',
              type: 'image/jpeg',
              form_factor: 'wide',
              label: 'Алхимическая лаборатория AIhim',
            },
            {
              src: '/file/42/pwa_icon_512x512.png',
              sizes: '512x512',
              type: 'image/png',
              label: 'Иконка и мобильный интерфейс AIhim',
            },
          ],
          shortcuts: [
            {
              name: 'Журнал и блог алхимика',
              short_name: 'Блог',
              url: '/blog',
              icons: [{ src: '/file/40/pwa_icon_96x96.png', sizes: '96x96', type: 'image/png' }],
            },
            {
              name: 'Профиль и уведомления',
              short_name: 'Профиль',
              url: '/profile',
              icons: [{ src: '/file/40/pwa_icon_96x96.png', sizes: '96x96', type: 'image/png' }],
            },
            {
              name: 'Колесо Аркан',
              short_name: 'Арканы',
              url: '/arcana',
              icons: [{ src: '/file/40/pwa_icon_96x96.png', sizes: '96x96', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          importScripts: ['/push-sw.js'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/sitemap\.xml$/,
            /^\/rss\.xml$/,
            /^\/robots\.txt$/,
            /^\/llms\.txt$/,
            /^\/yandex-tableau\.json$/,
            /^\/browserconfig\.xml$/,
            /^\/file\//,
          ],
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp|svg|woff2)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'aihim-media-cache',
                expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 3600 },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // File watching & HMR updates are disabled in AI Studio via DISABLE_HMR env var
      // without setting hmr: false (which causes Vite 6 middlewareMode to connect to :24678).
      watch: process.env.DISABLE_HMR === 'true' ? { ignored: ['**/*'] } : undefined,
    },
  };
});
