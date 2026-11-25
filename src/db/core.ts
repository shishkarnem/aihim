import type { Transaction, User, MailingLog, AiLog, SystemCronJob, UserElement } from './types';
import type { ArcanaLink } from './modules/arcana';
import type { Spell } from './modules/spells';
import {
  type PromptSettings,
  getProTalkConfig,
  getTelegramBotConfig,
  getRobokassaConfig,
  getReminderTemplatesFromDb
} from './settings/configs';

export const PROTALK_DB_URL =
  process.env.PROTALK_DB_URL || 'https://db.pro-talk.ru/api/proxy/query';
export const PROTALK_DB_NAME =
  process.env.PROTALK_DB_NAME || 'aihim2';
export const PROTALK_DB_USER_ID =
  process.env.PROTALK_DB_USER_ID ||
  'eyJydWlkIjoicmVjVFd5eE4xR3JTUGxTeGMiLCJlbWFpbCI6InJlbnRyb3BleHBlcnRAZ21haWwuY29tIn0';
export const PROTALK_DB_API_BASE = `https://db.pro-talk.ru/api/databases/${PROTALK_DB_NAME}`;

const PG_KEY_MAP: Record<string, string> = {
  fullname: 'fullName',
  discoveredcount: 'discoveredCount',
  registrationdate: 'registrationDate',
  lastactive: 'lastActive',
  lastactivedate: 'lastActiveDate',
  lastloginat: 'lastLoginAt',
  updatedat: 'updatedAt',
  remindersenabled: 'remindersEnabled',
  lastreminderat: 'lastReminderAt',
  nextreminderat: 'nextReminderAt',
  referredbyid: 'referredById',
  referredbyusername: 'referredByUsername',
  userid: 'userId',
  elementa: 'elementA',
  elementb: 'elementB',
  tokensused: 'tokensUsed',
  costrub: 'costRub',
  recipientid: 'recipientId',
  recipientname: 'recipientName',
  recipientusername: 'recipientUsername',
  messagetext: 'messageText',
  errormsg: 'errorMsg',
  lastrun: 'lastRun',
  nextrun: 'nextRun',
  executionscount: 'executionsCount',
  discoveredat: 'discoveredAt',
  ismutation: 'isMutation',
  targettemperature: 'targetTemperature',
  realitylevel: 'realityLevel',
  isfavorite: 'isFavorite',
  sortorder: 'sortOrder',
  elementprompt: 'elementPrompt',
  systemprompt: 'systemPrompt',
  elementaltype: 'elementalType',
  targetrealitylayer: 'targetRealityLayer',
  basepower: 'basePower',
  manacost: 'manaCost',
  cooldownseconds: 'cooldownSeconds',
  requiredessences: 'requiredEssences',
  isforbidden: 'isForbidden',
  unlocklevel: 'unlockLevel',
  buttontext: 'buttonText',
  buttonurl: 'buttonUrl'
};

const NUMERIC_KEYS = new Set([
  'registrationDate',
  'lastActive',
  'lastReminderAt',
  'nextReminderAt',
  'timestamp',
  'lastRun',
  'nextRun',
  'discoveredAt',
  'executionsCount',
  'discoveredCount',
  'level',
  'balance',
  'balance_start',
  'balance_time',
  'balance_ref',
  'balance_pay',
  'balance_admin',
  'amount',
  'price',
  'layer',
  'tokensUsed',
  'costRub',
  'complexity',
  'temperature',
  'targetTemperature',
  'stability',
  'realityLevel',
  'isMutation',
  'isFavorite',
  'remindersEnabled',
  'sortOrder',
  'targetRealityLayer',
  'basePower',
  'manaCost',
  'cooldownSeconds',
  'isForbidden',
  'unlockLevel',
  'size_bytes',
  'file_size',
  'folder_id',
  'count',
  'cnt'
]);

export function convertPlaceholders(sql: string): string {
  let out = '';
  let idx = 1;
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inSingle) {
      out += ch;
      if (ch === "'" && next === "'") {
        out += next;
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      out += ch;
      if (ch === '"') inDouble = false;
      continue;
    }

    if (inDollar) {
      out += ch;
      if (ch === '$' && next === '$') {
        out += next;
        i++;
        inDollar = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
    } else if (ch === '"') {
      inDouble = true;
      out += ch;
    } else if (ch === '$' && next === '$') {
      inDollar = true;
      out += '$$';
      i++;
    } else if (ch === '?') {
      out += `$${idx++}`;
    } else {
      out += ch;
    }
  }

  return out;
}

function sanitizeParam(val: any): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

export function normalizePgRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = {};

  for (const rawKey of Object.keys(row)) {
    const mappedKey = PG_KEY_MAP[rawKey] || rawKey;
    let val = row[rawKey];

    if (val === 'NULL') {
      val = null;
    } else if (
      typeof val === 'string' &&
      (val.startsWith('[') || val.startsWith('{'))
    ) {
      try {
        val = JSON.parse(val);
      } catch {
        // leave as string
      }
    } else if (
      NUMERIC_KEYS.has(mappedKey) &&
      typeof val === 'string' &&
      val.trim() !== '' &&
      !isNaN(Number(val))
    ) {
      val = Number(val);
    }

    out[mappedKey] = val;
  }

  return out;
}

export function normalizeFileRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const url = row.url ?? row.original_url ?? '';
  const filename = row.filename ?? row.name ?? 'file';
  const sizeBytes = Number(row.size_bytes ?? row.file_size ?? 0);
  const folderId =
    row.folder_id !== null && row.folder_id !== undefined && row.folder_id !== ''
      ? Number(row.folder_id)
      : null;

  return {
    ...row,
    id: Number(row.id),
    file_key: row.file_key || '',
    name: filename,
    filename,
    original_url: url,
    url,
    mime_type: row.mime_type || 'application/octet-stream',
    file_size: sizeBytes,
    size_bytes: sizeBytes,
    size_formatted: row.size_formatted || `${(sizeBytes / 1024).toFixed(1)} KB`,
    preserve_alpha: row.preserve_alpha !== undefined ? Boolean(row.preserve_alpha) : true,
    folder_id: folderId,
    created_at: row.created_at
  };
}

export function normalizeFolderRow(row: any): any {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    id: Number(row.id),
    name: row.name,
    color: row.color || '#b45309',
    created_at: row.created_at
  };
}

const PG_MAX_CONCURRENCY = 12;
let activePgQueries = 0;
const pgWaitQueue: Array<() => void> = [];

async function withPgSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activePgQueries >= PG_MAX_CONCURRENCY) {
    await new Promise<void>(resolve => pgWaitQueue.push(resolve));
  }
  activePgQueries++;
  try {
    return await fn();
  } finally {
    activePgQueries--;
    const next = pgWaitQueue.shift();
    if (next) next();
  }
}

function isNonRetryableSqlError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('syntax error') ||
    lower.includes('invalid input syntax') ||
    lower.includes('violates') ||
    lower.includes('does not exist') ||
    lower.includes('duplicate key') ||
    lower.includes('cannot affect row a second time') ||
    lower.includes('permission denied')
  );
}

async function executePgQuery(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const pgSql = convertPlaceholders(sql.trim());
  const sanitizedParams = params.map(sanitizeParam);

  return withPgSlot(async () => {
    const maxAttempts = 4;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(PROTALK_DB_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': PROTALK_DB_USER_ID
          },
          body: JSON.stringify({
            database: PROTALK_DB_NAME,
            query: pgSql,
            params: sanitizedParams,
            safeMode: false
          }),
          signal: AbortSignal.timeout(15000)
        });

        const data: any = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          const errMsg = data?.error || data?.message || `PostgreSQL Proxy HTTP ${res.status}`;
          if (res.status === 400 || isNonRetryableSqlError(String(errMsg))) {
            throw new Error(errMsg);
          }
          if (attempt < maxAttempts && (res.status === 429 || res.status >= 500)) {
            await new Promise(r => setTimeout(r, 150 * attempt + Math.floor(Math.random() * 100)));
            continue;
          }
          throw new Error(errMsg);
        }

        const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
        const rowCount = typeof data?.rowCount === 'number' ? data.rowCount : rows.length;
        return { rows, rowCount };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isNonRetryableSqlError(lastError.message) || attempt >= maxAttempts) {
          throw lastError;
        }
        await new Promise(r => setTimeout(r, 150 * attempt + Math.floor(Math.random() * 120)));
      }
    }

    throw lastError || new Error('PostgreSQL proxy query failed');
  });
}

export async function callProTalkDbApi<T = any>(
  subPath: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const url = `${PROTALK_DB_API_BASE}${subPath.startsWith('/') ? subPath : `/${subPath}`}`;
  return withPgSlot(async () => {
    const maxAttempts = 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': PROTALK_DB_USER_ID
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(15000)
        });

        const text = await res.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }

        if (!res.ok) {
          const msg = data?.error || data?.message || `ProTalk DB API HTTP ${res.status}`;
          if (attempt < maxAttempts && (res.status === 429 || res.status >= 500)) {
            await new Promise(r => setTimeout(r, 200 * attempt));
            continue;
          }
          throw new Error(msg);
        }
        return data as T;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= maxAttempts) throw lastError;
        await new Promise(r => setTimeout(r, 200 * attempt));
      }
    }
    throw lastError || new Error('ProTalk DB API failed');
  });
}

export async function queryAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const { rows } = await executePgQuery(sql, params);
  return rows.map(normalizePgRow) as T[];
}

export async function queryGet<T>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let txNotifyHook: ((tx: Transaction) => Promise<void>) | null = null;

export function setTxNotifyHook(hook: (tx: Transaction) => Promise<void>) {
  txNotifyHook = hook;
}

export interface QueryRunOptions {
  skipTxNotify?: boolean;
}

export async function queryRun(
  sql: string,
  params: any[] = [],
  options: QueryRunOptions = {}
): Promise<{ lastID: number; changes: number; rows: any[] }> {
  const { rows, rowCount } = await executePgQuery(sql, params);
  const normalizedRows = rows.map(normalizePgRow);
  const firstId = normalizedRows[0]?.id;
  const res = {
    lastID: typeof firstId === 'number' ? firstId : 0,
    changes: rowCount,
    rows: normalizedRows
  };

  // Trigger Telegram notification ONLY for explicit single-row transaction inserts or status updates
  if (!options.skipTxNotify && txNotifyHook) {
    const trimmedSql = sql.trim();
    const isTxInsert = /^INSERT\s+INTO\s+(?:public\.)?transactions\b/i.test(trimmedSql);
    const isTxStatusUpdate = /^UPDATE\s+(?:public\.)?transactions\b[\s\S]*\bSET\b[\s\S]*\bstatus\b/i.test(trimmedSql);

    if (isTxInsert || isTxStatusUpdate) {
      let candidateTxIds: string[] = [];
      for (const p of params) {
        if (typeof p === 'string' && (p.startsWith('TX') || p.startsWith('inv_'))) {
          candidateTxIds.push(p);
        }
      }
      const matches = sql.match(/['"](TX-[^'"]+|inv_[^'"]+)['"]/gi);
      if (matches) {
        for (const m of matches) {
          candidateTxIds.push(m.replace(/['"]/g, ''));
        }
      }
      candidateTxIds = Array.from(new Set(candidateTxIds));

      // Never trigger mass notifications on multi-row batch inserts
      if (candidateTxIds.length > 0 && candidateTxIds.length <= 3) {
        setTimeout(async () => {
          try {
            for (const txId of candidateTxIds) {
              const tx = await queryGet<Transaction>('SELECT * FROM transactions WHERE id = $1', [txId]);
              const alreadyNotified =
                (tx as any)?.tg_notified === true ||
                (tx as any)?.tg_notified === 'true' ||
                (tx as any)?.tg_notified === 1;
              if (
                tx &&
                (tx.status === 'success' || tx.status === 'completed') &&
                !alreadyNotified &&
                txNotifyHook
              ) {
                await txNotifyHook(tx);
              }
            }
          } catch (e) {
            console.error('[Transaction Hook Trigger Error]', e);
          }
        }, 50);
      }
    }
  }

  return res;
}

export async function initializeDatabase() {
  console.log(`[PostgreSQL] Connecting to ProTalk DB "${PROTALK_DB_NAME}"...`);
  const check = await queryGet<{ count: number }>('SELECT COUNT(*) as count FROM users');

  // Ensure tg_notified column exists on transactions; mark pre-existing rows notified once so they never replay
  try {
    const colCheck = await queryGet<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'tg_notified'"
    );
    if (!colCheck) {
      await executePgQuery('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tg_notified BOOLEAN DEFAULT FALSE');
      await executePgQuery('UPDATE transactions SET tg_notified = TRUE WHERE tg_notified IS NULL OR tg_notified = FALSE');
      console.log('[PostgreSQL] Added transactions.tg_notified column and marked historical transactions as notified.');
    }
  } catch (err) {
    console.warn('[PostgreSQL] tg_notified schema check warning:', (err as Error).message);
  }

  try {
    const { ensureBlogTableAndSeed } = await import('./features/blog');
    await ensureBlogTableAndSeed();
    const { ensurePushTables, getOrCreateVapidKeys } = await import('./features/push');
    await ensurePushTables();
    await getOrCreateVapidKeys();
  } catch (err) {
    console.warn('[PostgreSQL] Blog/Push init warning:', (err as Error).message);
  }

  console.log(`[PostgreSQL] Connected to "${PROTALK_DB_NAME}". Users count: ${check?.count ?? 0}`);
}

export async function getDbData() {
  const [
    users,
    transactions,
    ai_logs,
    mailing_logs,
    system_cron_jobs,
    discovered_elements,
    arcana_links,
    arcana_config_row,
    prompt_settings_row,
    spells,
    file_folders_raw,
    file_storage_raw,
    protalk_config,
    telegram_bot_config,
    robokassa_config,
    reminder_templates
  ] = await Promise.all([
    queryAll<User>('SELECT * FROM users'),
    queryAll<Transaction>('SELECT * FROM transactions'),
    queryAll<AiLog>('SELECT * FROM ai_logs'),
    queryAll<MailingLog>('SELECT * FROM mailing_logs'),
    queryAll<SystemCronJob>('SELECT * FROM system_cron_jobs'),
    queryAll<UserElement>('SELECT * FROM discovered_elements'),
    queryAll<ArcanaLink>('SELECT * FROM arcana_links ORDER BY sortorder ASC'),
    queryGet<any>('SELECT config_json FROM arcana_config WHERE id = $1', ['default']),
    queryGet<PromptSettings>('SELECT * FROM prompt_settings WHERE id = $1', ['default']),
    queryAll<Spell>('SELECT * FROM spells'),
    queryAll<any>('SELECT * FROM file_folders ORDER BY name ASC'),
    queryAll<any>('SELECT * FROM file_storage ORDER BY id DESC'),
    getProTalkConfig(),
    getTelegramBotConfig(),
    getRobokassaConfig(),
    getReminderTemplatesFromDb()
  ]);

  const arcana_config = arcana_config_row?.config_json
    ? (typeof arcana_config_row.config_json === 'string'
        ? JSON.parse(arcana_config_row.config_json)
        : arcana_config_row.config_json)
    : null;

  return {
    users,
    transactions,
    ai_logs,
    mailing_logs,
    system_cron_jobs,
    discovered_elements,
    arcana_links,
    arcana_config,
    prompt_settings: prompt_settings_row,
    spells,
    file_folders: file_folders_raw.map(normalizeFolderRow),
    file_storage: file_storage_raw.map(normalizeFileRow),
    protalk_config,
    telegram_bot_config,
    robokassa_config,
    reminder_templates
  };
}
