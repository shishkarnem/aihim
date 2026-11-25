import crypto from 'crypto';
import * as webpushNs from 'web-push';
import { queryAll, queryGet, queryRun } from '../core';

const webpush = ((webpushNs as any).default || webpushNs) as typeof webpushNs;

export interface PushPreferences {
  energy: boolean;
  transactions: boolean;
  referrals: boolean;
  blog: boolean;
  reminders: boolean;
  updates: boolean;
}

export const DEFAULT_PUSH_PREFS: PushPreferences = {
  energy: true,
  transactions: true,
  referrals: true,
  blog: true,
  reminders: true,
  updates: true
};

export interface PushSubscriptionRecord {
  id: string;
  userid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  device_label: string;
  platform: string;
  prefs_json: PushPreferences;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export type PushCategory = keyof PushPreferences;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
}

let vapidConfigured = false;

export async function ensurePushTables() {
  await queryRun(`
    CREATE TABLE IF NOT EXISTS web_push_config (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'mailto:support@aihim.ru',
      updated_at BIGINT NOT NULL
    )
  `);

  await queryRun(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      userid TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT DEFAULT '',
      device_label TEXT DEFAULT 'Устройство',
      platform TEXT DEFAULT 'web',
      prefs_json JSONB DEFAULT '{"energy":true,"transactions":true,"referrals":true,"blog":true,"reminders":true,"updates":true}'::jsonb,
      enabled BOOLEAN DEFAULT TRUE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
}

export async function getOrCreateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
}> {
  await ensurePushTables();
  const row = await queryGet<any>('SELECT * FROM web_push_config WHERE id = $1', ['default']);

  let publicKey = row?.public_key;
  let privateKey = row?.private_key;
  const subject = row?.subject || 'mailto:support@aihim.ru';

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    await queryRun(
      `INSERT INTO web_push_config (id, public_key, private_key, subject, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      ['default', publicKey, privateKey, subject, Date.now()]
    );
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }

  return { publicKey, privateKey, subject };
}

function normalizePrefs(raw: any): PushPreferences {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  return {
    energy: obj?.energy !== false,
    transactions: obj?.transactions !== false,
    referrals: obj?.referrals !== false,
    blog: obj?.blog !== false,
    reminders: obj?.reminders !== false,
    updates: obj?.updates !== false
  };
}

function mapSubRow(row: any): PushSubscriptionRecord {
  return {
    id: String(row.id),
    userid: String(row.userid),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    user_agent: String(row.user_agent || ''),
    device_label: String(row.device_label || 'Устройство'),
    platform: String(row.platform || 'web'),
    prefs_json: normalizePrefs(row.prefs_json),
    enabled: row.enabled !== false && row.enabled !== 0 && row.enabled !== 'false',
    created_at: Number(row.created_at) || Date.now(),
    updated_at: Number(row.updated_at) || Date.now()
  };
}

function hashEndpoint(endpoint: string): string {
  return 'sub_' + crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 28);
}

export async function upsertPushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  deviceLabel?: string;
  platform?: string;
  prefs?: Partial<PushPreferences>;
}): Promise<PushSubscriptionRecord> {
  await ensurePushTables();
  const now = Date.now();
  const id = hashEndpoint(params.endpoint);
  const prefs = normalizePrefs({ ...DEFAULT_PUSH_PREFS, ...(params.prefs || {}) });

  await queryRun(
    `INSERT INTO push_subscriptions (
      id, userid, endpoint, p256dh, auth, user_agent, device_label, platform,
      prefs_json, enabled, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, TRUE, $10, $11)
    ON CONFLICT (endpoint) DO UPDATE SET
      userid = EXCLUDED.userid,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      device_label = EXCLUDED.device_label,
      platform = EXCLUDED.platform,
      prefs_json = EXCLUDED.prefs_json,
      enabled = TRUE,
      updated_at = EXCLUDED.updated_at`,
    [
      id,
      String(params.userId),
      params.endpoint,
      params.p256dh,
      params.auth,
      String(params.userAgent || '').slice(0, 400),
      String(params.deviceLabel || 'Мобильный или ПК браузер').slice(0, 120),
      String(params.platform || 'web').slice(0, 40),
      JSON.stringify(prefs),
      now,
      now
    ]
  );

  const row = await queryGet<any>('SELECT * FROM push_subscriptions WHERE endpoint = $1', [params.endpoint]);
  return mapSubRow(row);
}

export async function updatePushPreferencesForUser(
  userId: string,
  prefs: Partial<PushPreferences>,
  enabled?: boolean,
  endpoint?: string
) {
  await ensurePushTables();
  const normalized = normalizePrefs({ ...DEFAULT_PUSH_PREFS, ...prefs });
  const now = Date.now();

  if (endpoint) {
    await queryRun(
      `UPDATE push_subscriptions
       SET prefs_json = $1::jsonb, enabled = COALESCE($2, enabled), updated_at = $3
       WHERE userid = $4 AND endpoint = $5`,
      [JSON.stringify(normalized), enabled === undefined ? null : enabled, now, String(userId), endpoint]
    );
  } else {
    await queryRun(
      `UPDATE push_subscriptions
       SET prefs_json = $1::jsonb, enabled = COALESCE($2, enabled), updated_at = $3
       WHERE userid = $4`,
      [JSON.stringify(normalized), enabled === undefined ? null : enabled, now, String(userId)]
    );
  }
}

export async function removePushSubscription(endpoint: string) {
  await ensurePushTables();
  await queryRun('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

export async function getUserPushStatus(userId: string) {
  await ensurePushTables();
  const rows = await queryAll<any>(
    'SELECT * FROM push_subscriptions WHERE userid = $1 ORDER BY updated_at DESC',
    [String(userId)]
  );
  const subs = rows.map(mapSubRow);
  const activeSubs = subs.filter((s) => s.enabled);
  const latest = activeSubs[0] || subs[0];

  return {
    subscribed: activeSubs.length > 0,
    totalDevices: subs.length,
    activeDevices: activeSubs.length,
    preferences: latest ? latest.prefs_json : { ...DEFAULT_PUSH_PREFS },
    devices: subs.map((s) => ({
      id: s.id,
      deviceLabel: s.device_label,
      platform: s.platform,
      enabled: s.enabled,
      updatedAt: s.updated_at,
      endpoint: s.endpoint
    }))
  };
}

async function deliverPushToSubscription(sub: PushSubscriptionRecord, payload: PushPayload): Promise<boolean> {
  await getOrCreateVapidKeys();
  const pushData = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/file/41/pwa_icon_192x192.png',
    badge: payload.badge || '/file/40/pwa_icon_96x96.png',
    image: payload.image,
    tag: payload.tag || 'aihim-push'
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      pushData
    );
    return true;
  } catch (err: any) {
    const statusCode = Number(err?.statusCode);
    if (statusCode === 404 || statusCode === 410) {
      await queryRun('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]).catch(() => {});
    } else {
      console.warn(`[WebPush] Failed to deliver to ${sub.id} (${statusCode || err?.message})`);
    }
    return false;
  }
}

export async function sendWebPushToUser(
  userId: string,
  category: PushCategory,
  payload: PushPayload
): Promise<{ sent: number; total: number }> {
  try {
    await ensurePushTables();
    const rows = await queryAll<any>(
      'SELECT * FROM push_subscriptions WHERE userid = $1 AND enabled = TRUE',
      [String(userId)]
    );
    const subs = rows
      .map(mapSubRow)
      .filter((s) => s.prefs_json[category] !== false);

    let sent = 0;
    for (const sub of subs) {
      const ok = await deliverPushToSubscription(sub, payload);
      if (ok) sent++;
    }
    return { sent, total: subs.length };
  } catch (e) {
    console.warn('[WebPush User Error]', e);
    return { sent: 0, total: 0 };
  }
}

export async function sendWebPushBroadcast(
  category: PushCategory,
  payload: PushPayload
): Promise<{ sent: number; total: number }> {
  try {
    await ensurePushTables();
    const rows = await queryAll<any>('SELECT * FROM push_subscriptions WHERE enabled = TRUE');
    const subs = rows
      .map(mapSubRow)
      .filter((s) => s.prefs_json[category] !== false);

    let sent = 0;
    for (const sub of subs) {
      const ok = await deliverPushToSubscription(sub, payload);
      if (ok) sent++;
    }
    return { sent, total: subs.length };
  } catch (e) {
    console.warn('[WebPush Broadcast Error]', e);
    return { sent: 0, total: 0 };
  }
}
