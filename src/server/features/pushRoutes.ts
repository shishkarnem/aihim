import type express from 'express';
import {
  getOrCreateVapidKeys,
  upsertPushSubscription,
  updatePushPreferencesForUser,
  removePushSubscription,
  getUserPushStatus,
  sendWebPushToUser,
  DEFAULT_PUSH_PREFS
} from '../../db';

export function registerPushRoutes(app: express.Express) {
  app.get('/api/push/vapid-public-key', async (_req, res) => {
    try {
      const { publicKey } = await getOrCreateVapidKeys();
      res.json({ publicKey });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/push/status', async (req, res) => {
    try {
      const userId = String(req.query.userId || '').trim();
      if (!userId) {
        return res.json({
          subscribed: false,
          totalDevices: 0,
          activeDevices: 0,
          preferences: { ...DEFAULT_PUSH_PREFS },
          devices: []
        });
      }
      const status = await getUserPushStatus(userId);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { userId, subscription, deviceLabel, platform, preferences } = req.body || {};
      if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: 'Некорректные данные подписки Web Push' });
      }
      const record = await upsertPushSubscription({
        userId: String(userId),
        endpoint: String(subscription.endpoint),
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
        userAgent: String(req.headers['user-agent'] || ''),
        deviceLabel: deviceLabel || 'Устройство',
        platform: platform || 'web',
        prefs: preferences
      });
      res.json({ success: true, subscription: record });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/preferences', async (req, res) => {
    try {
      const { userId, preferences, enabled, endpoint } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'Не указан userId' });
      }
      await updatePushPreferencesForUser(String(userId), preferences || {}, enabled, endpoint);
      const status = await getUserPushStatus(String(userId));
      res.json({ success: true, status });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (!endpoint) {
        return res.status(400).json({ error: 'Не указан endpoint' });
      }
      await removePushSubscription(String(endpoint));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/test', async (req, res) => {
    try {
      const { userId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'Войдите в профиль, чтобы отправить тестовое уведомление' });
      }
      const result = await sendWebPushToUser(String(userId), 'updates', {
        title: 'AIhim — Пуш-уведомления работают',
        body: 'Ваш алхимический верстак на связи! Уведомления о пополнении энергии, рефералах и новых статьях активированы.',
        url: '/profile',
        tag: 'aihim-test-push'
      });
      res.json({ success: result.sent > 0, ...result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
