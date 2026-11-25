import type express from 'express';
import JSZip from 'jszip';
import {
  queryAll,
  queryGet,
  queryRun,
  callProTalkDbApi,
  normalizeFileRow,
  normalizeFolderRow,
  recalculateAllUserBalances,
  getAppVersionFromDb
} from '../../db';
import { sendWeeklyInactiveReminders, sendDatabaseBackupToTelegram } from './paymentsAndMailing';

const ALLOWED_TABLES = [
  'users', 'transactions', 'ai_logs', 'system_cron_jobs', 'discovered_elements',
  'arcana_links', 'arcana_config', 'prompt_settings', 'spells', 'protalk_config',
  'telegram_bot_config', 'robokassa_config', 'reminder_templates', 'mailing_logs',
  'file_folders', 'file_storage', 'blog_posts', 'web_push_config', 'push_subscriptions'
];

const JSONB_COLUMNS = new Set(['parents', 'essences', 'requiredessences', 'referrals', 'config_json', 'tags', 'prefs_json']);
const CONFIG_JSON_TABLES = new Set(['arcana_config', 'protalk_config', 'telegram_bot_config', 'robokassa_config']);
const INTEGER_BOOL_COLUMNS = new Set(['remindersenabled', 'isfavorite', 'ismutation', 'isforbidden']);
const NULLABLE_NUMERIC_COLUMNS = new Set([
  'lastactive', 'registrationdate', 'lastreminderat', 'nextreminderat', 'lastloginat', 'updatedat',
  'timestamp', 'discoveredat', 'lastrun', 'nextrun', 'executionscount', 'discoveredcount', 'level',
  'balance', 'balance_start', 'balance_time', 'balance_ref', 'balance_pay', 'balance_admin',
  'amount', 'price', 'layer', 'tokensused', 'costrub', 'complexity', 'temperature', 'targettemperature',
  'stability', 'realitylevel', 'sortorder', 'targetrealitylayer', 'basepower', 'manacost',
  'cooldownseconds', 'unlocklevel', 'size_bytes', 'folder_id', 'parent_id', 'created_at',
  'updated_at', 'reading_time', 'views_count', 'pinned_order', 'pinned_at'
]);

function getConflictKey(table: string): string {
  if (table === 'system_cron_jobs') return 'name';
  return 'id';
}

function mapRowForPg(table: string, rawRow: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    const lk = k.toLowerCase();
    if (table === 'file_storage') {
      if (lk === 'name' || lk === 'filename') {
        mapped.filename = v;
        continue;
      }
      if (lk === 'original_url' || lk === 'url') {
        mapped.url = v;
        continue;
      }
      if (lk === 'file_size' || lk === 'size_bytes') {
        mapped.size_bytes = Number(v) || 0;
        continue;
      }
    }
    mapped[lk] = v;
  }

  for (const col of Object.keys(mapped)) {
    if (INTEGER_BOOL_COLUMNS.has(col) && typeof mapped[col] === 'boolean') {
      mapped[col] = mapped[col] ? 1 : 0;
    }
    if (mapped[col] === '' && NULLABLE_NUMERIC_COLUMNS.has(col)) {
      mapped[col] = null;
    }
  }

  if (table === 'system_cron_jobs') {
    if (mapped.status === 'running') {
      mapped.status = 'idle';
    }
    if (mapped.name === 'DailyDatabaseBackup' && mapped.schedule === '0 3 * * *') {
      mapped.schedule = '0 6 * * *';
    }
  }

  if (table === 'transactions') {
    mapped.tg_notified = true;
  }

  if (table === 'file_storage') {
    if (mapped.size_bytes === undefined || mapped.size_bytes === null) mapped.size_bytes = 0;
    if (!mapped.size_formatted) {
      mapped.size_formatted = `${(Number(mapped.size_bytes) / 1024).toFixed(1)} KB`;
    }
    if (mapped.preserve_alpha === undefined || mapped.preserve_alpha === null) {
      mapped.preserve_alpha = String(mapped.mime_type || '').includes('png');
    } else {
      mapped.preserve_alpha = Boolean(mapped.preserve_alpha);
    }
  }
  return mapped;
}

function formatPgColumnValue(col: string, val: any): any {
  if (val === null || val === undefined || val === 'NULL' || (val === '' && NULLABLE_NUMERIC_COLUMNS.has(col))) {
    return null;
  }
  if (INTEGER_BOOL_COLUMNS.has(col) && typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  if (JSONB_COLUMNS.has(col)) {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'NULL') {
        return col === 'config_json' ? '{}' : '[]';
      }
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch {
        return JSON.stringify(val);
      }
    }
    return JSON.stringify(val);
  }
  return typeof val === 'object' ? JSON.stringify(val) : val;
}

async function mergeExistingConfigRows(table: string, rows: Record<string, any>[]): Promise<Record<string, any>[]> {
  if (!CONFIG_JSON_TABLES.has(table) || rows.length === 0) return rows;
  const existingRows = await queryAll<any>(`SELECT id, config_json FROM ${table}`).catch(() => []);
  const existingMap = new Map<string, Record<string, any>>();
  for (const er of existingRows) {
    if (!er || !er.id) continue;
    let parsed: any = er.config_json;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      existingMap.set(String(er.id), parsed);
    }
  }

  return rows.map(r => {
    const idKey = String(r.id || 'default');
    const existingCfg = existingMap.get(idKey);
    if (!existingCfg || r.config_json === undefined) return r;
    let incomingCfg: any = r.config_json;
    if (typeof incomingCfg === 'string') {
      try { incomingCfg = JSON.parse(incomingCfg); } catch { incomingCfg = null; }
    }
    if (incomingCfg && typeof incomingCfg === 'object' && !Array.isArray(incomingCfg)) {
      return { ...r, config_json: { ...existingCfg, ...incomingCfg } };
    }
    return r;
  });
}

async function upsertPgRowsBatch(table: string, rawRows: Record<string, any>[], chunkSize = 30): Promise<number> {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return 0;
  const conflictCol = getConflictKey(table);
  const isIdentityTable = table === 'file_folders' || table === 'file_storage';

  let mappedRows = rawRows
    .filter(r => r && typeof r === 'object')
    .map(r => mapRowForPg(table, r));

  if (mappedRows.length === 0) return 0;

  if (CONFIG_JSON_TABLES.has(table)) {
    mappedRows = await mergeExistingConfigRows(table, mappedRows);
  }

  if (table === 'file_folders') {
    mappedRows.sort((a, b) => {
      const pa = a.parent_id === null || a.parent_id === undefined ? 0 : 1;
      const pb = b.parent_id === null || b.parent_id === undefined ? 0 : 1;
      return pa - pb;
    });
  }

  // Group rows by identical valid column sets so multi-row INSERT preserves exact columns
  const groups = new Map<string, { columns: string[]; rows: Record<string, any>[] }>();
  for (const row of mappedRows) {
    const columns = Object.keys(row).filter(c => /^[a-z_][a-z0-9_]*$/.test(c)).sort();
    if (columns.length === 0) continue;
    const sig = `${columns.join('|')}#${isIdentityTable && row.id !== undefined && row.id !== null && row.id !== '' ? '1' : '0'}`;
    if (!groups.has(sig)) {
      groups.set(sig, { columns, rows: [] });
    }
    groups.get(sig)!.rows.push(row);
  }

  let processedCount = 0;

  for (const { columns, rows } of groups.values()) {
    const hasExplicitId = isIdentityTable && rows[0]?.id !== undefined && rows[0]?.id !== null && rows[0]?.id !== '';
    const updateCols = columns.filter(c => c !== conflictCol);
    const updateClause = updateCols.length > 0
      ? `DO UPDATE SET ${updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`
      : 'DO NOTHING';
    const overridingClause = (isIdentityTable && hasExplicitId) ? 'OVERRIDING SYSTEM VALUE ' : '';

    for (let i = 0; i < rows.length; i += chunkSize) {
      const rawChunk = rows.slice(i, i + chunkSize);
      // Deduplicate within batch on conflictCol to avoid PG "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const dedupedMap = new Map<string, Record<string, any>>();
      const noKeyRows: Record<string, any>[] = [];
      for (const item of rawChunk) {
        const keyVal = item[conflictCol];
        if (keyVal !== undefined && keyVal !== null && keyVal !== '') {
          dedupedMap.set(String(keyVal), item);
        } else {
          noKeyRows.push(item);
        }
      }
      const chunk = [...dedupedMap.values(), ...noKeyRows];
      if (chunk.length === 0) continue;

      const values: any[] = [];
      const rowPlaceholders: string[] = [];
      let paramIdx = 1;

      for (const row of chunk) {
        const phs: string[] = [];
        for (const col of columns) {
          const pos = `$${paramIdx++}`;
          if (JSONB_COLUMNS.has(col)) phs.push(`${pos}::jsonb`);
          else if (col === 'created_at' && isIdentityTable) phs.push(`${pos}::timestamptz`);
          else phs.push(pos);
          values.push(formatPgColumnValue(col, row[col]));
        }
        rowPlaceholders.push(`(${phs.join(', ')})`);
      }

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) ${overridingClause}VALUES ${rowPlaceholders.join(', ')} ON CONFLICT (${conflictCol}) ${updateClause}`;
      await queryRun(sql, values, { skipTxNotify: true });
      processedCount += chunk.length;
    }
  }

  return processedCount;
}

async function upsertPgRow(table: string, rawRow: Record<string, any>): Promise<void> {
  await upsertPgRowsBatch(table, [rawRow], 1);
}

async function finalizeRestoreState(): Promise<void> {
  await queryRun("SELECT setval(pg_get_serial_sequence('file_folders', 'id'), COALESCE((SELECT MAX(id) FROM file_folders), 1), true)").catch(() => {});
  await queryRun("SELECT setval(pg_get_serial_sequence('file_storage', 'id'), COALESCE((SELECT MAX(id) FROM file_storage), 1), true)").catch(() => {});

  await recalculateAllUserBalances();
  await queryRun(`
    UPDATE users
    SET discoveredcount = (SELECT COUNT(*) FROM discovered_elements WHERE userid = users.id),
        level = GREATEST(1, FLOOR((SELECT COUNT(*) FROM discovered_elements WHERE userid = users.id) / 10.0)::int + 1)
    WHERE EXISTS (SELECT 1 FROM discovered_elements WHERE userid = users.id)
  `);
}

export function registerFilesAndSystemRoutes(app: express.Express) {
  app.get('/api/health', async (req, res) => {
    try {
      await queryGet('SELECT 1 AS ok');
      res.json({ status: 'ok', database: 'PostgreSQL (aihim2)' });
    } catch (err) {
      res.status(500).json({ status: 'error', error: (err as Error).message });
    }
  });

  // --- ProTalk Cloud File Store & Gallery Routes ---
  const fileMetaCache = new Map<string, { file: any; expiresAt: number }>();
  const fileDataCache = new Map<string, { buffer: Buffer; contentType: string; expiresAt: number }>();
  const inFlightFileFetches = new Map<string, Promise<{ buffer: Buffer; contentType: string } | null>>();
  const MAX_CACHED_FILE_BYTES = 1.5 * 1024 * 1024;
  const MAX_CACHED_FILE_ITEMS = 60;

  app.get(['/file/:id', '/file/:id/:filename'], async (req, res) => {
    try {
      const param = req.params.id;
      const now = Date.now();

      const dataCached = fileDataCache.get(param);
      if (dataCached && dataCached.expiresAt > now) {
        res.setHeader('Content-Type', dataCached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(dataCached.buffer);
      }

      const cached = fileMetaCache.get(param);
      let file = cached && cached.expiresAt > now ? cached.file : null;

      if (!file) {
        let rawFile: any;
        if (/^\d+$/.test(param)) {
          rawFile = await queryGet<any>('SELECT * FROM file_storage WHERE id = $1', [parseInt(param, 10)]);
        } else {
          rawFile = await queryGet<any>('SELECT * FROM file_storage WHERE file_key = $1', [param]);
        }

        file = rawFile ? normalizeFileRow(rawFile) : null;
        if (file && file.original_url) {
          if (fileMetaCache.size > 500) fileMetaCache.clear();
          fileMetaCache.set(param, { file, expiresAt: now + 10 * 60 * 1000 });
        }
      }

      if (!file || !file.original_url) {
        return res.status(404).send('File not found');
      }

      let fetchPromise = inFlightFileFetches.get(param);
      if (!fetchPromise) {
        fetchPromise = (async () => {
          try {
            const fileRes = await fetch(file.original_url, { signal: AbortSignal.timeout(15000) });
            if (!fileRes.ok) return null;
            const contentType = fileRes.headers.get('content-type') || file.mime_type || 'application/octet-stream';
            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > 0 && buffer.length <= MAX_CACHED_FILE_BYTES) {
              if (fileDataCache.size >= MAX_CACHED_FILE_ITEMS) {
                const oldestKey = fileDataCache.keys().next().value;
                if (oldestKey) fileDataCache.delete(oldestKey);
              }
              fileDataCache.set(param, {
                buffer,
                contentType,
                expiresAt: Date.now() + 30 * 60 * 1000
              });
            }
            return { buffer, contentType };
          } catch {
            return null;
          } finally {
            inFlightFileFetches.delete(param);
          }
        })();
        inFlightFileFetches.set(param, fetchPromise);
      }

      const payload = await fetchPromise;
      if (!payload) {
        return res.redirect(file.original_url);
      }

      res.setHeader('Content-Type', payload.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(payload.buffer);
    } catch (err) {
      console.error('File proxy error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/admin/files', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const { folder_id, search } = req.query;
      let query = 'SELECT * FROM file_storage';
      const params: any[] = [];
      const conditions: string[] = [];

      if (folder_id === 'null' || folder_id === 'root') {
        conditions.push('folder_id IS NULL');
      } else if (folder_id) {
        params.push(Number(folder_id));
        conditions.push(`folder_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`filename ILIKE $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY id DESC';

      const files = await queryAll<any>(query, params);
      res.json(files.map(normalizeFileRow));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/admin/files/register', async (req, res) => {
    try {
      const { name, original_url, mime_type, file_size, folder_id } = req.body;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let fileKey = '';
      for (let i = 0; i < 8; i++) fileKey += chars.charAt(Math.floor(Math.random() * chars.length));

      const sizeBytes = Number(file_size) || 0;
      const sizeFormatted = `${(sizeBytes / 1024).toFixed(1)} KB`;
      const preserveAlpha = String(mime_type || 'image/png').includes('png');

      // Never pass id on INSERT for GENERATED ALWAYS AS IDENTITY table
      const insertRes = await queryRun(
        `INSERT INTO file_storage (file_key, filename, url, mime_type, size_bytes, size_formatted, preserve_alpha, folder_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [fileKey, name || 'Без названия', original_url, mime_type || 'image/png', sizeBytes, sizeFormatted, preserveAlpha, folder_id || null]
      );

      const created = insertRes.rows?.[0] || (await queryGet<any>('SELECT * FROM file_storage WHERE file_key = $1', [fileKey]));
      res.json(normalizeFileRow(created));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.patch('/api/admin/files/:id/move', async (req, res) => {
    try {
      const { folder_id } = req.body;
      await queryRun('UPDATE file_storage SET folder_id = $1 WHERE id = $2', [folder_id || null, Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/admin/files/:id', async (req, res) => {
    try {
      const { name, folder_id, mime_type } = req.body;
      const runRes = await queryRun(
        'UPDATE file_storage SET filename = $1, folder_id = $2, mime_type = $3 WHERE id = $4 RETURNING *',
        [name, folder_id || null, mime_type, Number(req.params.id)]
      );
      fileMetaCache.delete(String(req.params.id));
      const updated = runRes.rows?.[0] || (await queryGet<any>('SELECT * FROM file_storage WHERE id = $1', [Number(req.params.id)]));
      res.json(normalizeFileRow(updated));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/admin/files/:id', async (req, res) => {
    try {
      fileMetaCache.delete(String(req.params.id));
      await queryRun('DELETE FROM file_storage WHERE id = $1', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/admin/file-folders', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const folders = await queryAll<any>('SELECT * FROM file_folders ORDER BY name ASC');
      res.json(folders.map(normalizeFolderRow));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/admin/file-folders', async (req, res) => {
    try {
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Название папки обязательно' });
      const runRes = await queryRun('INSERT INTO file_folders (name, color) VALUES ($1, $2) RETURNING *', [name, color || '#b45309']);
      res.json({ success: true, folder: runRes.rows?.[0] ? normalizeFolderRow(runRes.rows[0]) : null });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/admin/file-folders/:id', async (req, res) => {
    try {
      const folderId = Number(req.params.id);
      await queryRun('UPDATE file_storage SET folder_id = NULL WHERE folder_id = $1', [folderId]);
      await queryRun('DELETE FROM file_folders WHERE id = $1', [folderId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // --- PostgreSQL System Admin Endpoints ---
  const TABLE_ORDER_BY: Record<string, string> = {
    users: 'lastactive DESC NULLS LAST, id ASC',
    transactions: 'timestamp DESC NULLS LAST, id ASC',
    ai_logs: 'timestamp DESC NULLS LAST, id ASC',
    mailing_logs: 'timestamp DESC NULLS LAST, id ASC',
    discovered_elements: 'discoveredat DESC NULLS LAST, id ASC',
    file_storage: 'id DESC',
    file_folders: 'id DESC',
    arcana_links: 'sortorder ASC, id ASC',
    spells: 'unlocklevel ASC, name ASC',
    system_cron_jobs: 'name ASC'
  };

  app.get('/api/system-admin/tables', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const tables = await queryAll<{ name: string }>(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      );
      res.json({ tables: tables.map(t => t.name) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/system-admin/data/:tableName', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const { tableName } = req.params;
      if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }
      const orderClause = TABLE_ORDER_BY[tableName] ? ` ORDER BY ${TABLE_ORDER_BY[tableName]}` : ' ORDER BY id ASC';
      const rows = await queryAll<any>(`SELECT * FROM ${tableName}${orderClause}`);
      res.json({ rows });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/system-admin/triggers', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const pgTriggers = await callProTalkDbApi<any[]>('/triggers');
      const formatted = (Array.isArray(pgTriggers) ? pgTriggers : []).map((t: any) => ({
        name: t.name,
        tbl_name: t.table,
        schema: t.schema || 'public',
        timing: t.timing,
        events: t.events,
        functionName: t.functionName,
        sql: t.definition || t.functionBody || '',
        functionBody: t.functionBody || '',
        enabled: t.enabled !== false
      }));
      res.json({ triggers: formatted });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/system-admin/triggers', async (req, res) => {
    try {
      const { name, schema = 'public', table, timing = 'AFTER', events = ['INSERT'], plpgsqlBody } = req.body;
      if (!name || !table || !plpgsqlBody) {
        return res.status(400).json({ error: 'Укажите name, table и plpgsqlBody триггера' });
      }
      const result = await callProTalkDbApi('/triggers', {
        method: 'POST',
        body: { name, schema, table, timing, events, plpgsqlBody }
      });
      res.json({ success: true, triggers: result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/system-admin/triggers/:table/:name', async (req, res) => {
    try {
      const { table, name } = req.params;
      await callProTalkDbApi(`/triggers/public/${encodeURIComponent(table)}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/system-admin/cron-jobs', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const jobs = await queryAll<any>('SELECT * FROM system_cron_jobs ORDER BY name ASC');
      let remoteCron: any[] = [];
      try {
        const resRemote = await callProTalkDbApi<any[]>('/cron');
        if (Array.isArray(resRemote)) remoteCron = resRemote;
      } catch {}

      const merged = jobs.map(j => {
        const remote = remoteCron.find(r => r.name === j.name);
        return {
          ...j,
          remoteId: remote?.id || null,
          remoteEnabled: remote?.enabled ?? true,
          remoteLastStatus: remote?.lastStatus || null
        };
      });
      res.json({ jobs: merged, remoteCron });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/system-admin/update-cron', async (req, res) => {
    try {
      const { name, schedule, description, status } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing cron job name' });

      const existing = await queryGet<any>('SELECT * FROM system_cron_jobs WHERE name = $1', [name]);
      if (existing) {
        await queryRun(
          'UPDATE system_cron_jobs SET schedule = $1, description = $2, status = $3 WHERE name = $4',
          [schedule || existing.schedule, description || existing.description, status || existing.status, name]
        );
      } else {
        await queryRun(
          'INSERT INTO system_cron_jobs (name, schedule, description, status, lastrun, nextrun, executionscount) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [name, schedule || '*/1 * * * *', description || 'Пользовательская крон задача', status || 'idle', Date.now(), Date.now() + 60000, 0]
        );
      }

      try {
        const remoteCron = await callProTalkDbApi<any[]>('/cron');
        const match = Array.isArray(remoteCron) ? remoteCron.find(r => r.name === name) : null;
        if (match && schedule) {
          await callProTalkDbApi('/cron', {
            method: 'POST',
            body: {
              id: match.id,
              name: match.name,
              cronExpression: schedule,
              actionType: match.actionType,
              actionPayload: match.actionPayload,
              enabled: status !== 'disabled'
            }
          });
        }
      } catch {}

      res.json({ success: true, message: `Крон задача ${name} успешно обновлена` });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/system-admin/run-cron/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const job = await queryGet<{ name: string }>('SELECT * FROM system_cron_jobs WHERE name = $1', [name]);
      if (!job) {
        return res.status(404).json({ error: 'Cron job not found' });
      }

      await queryRun("UPDATE system_cron_jobs SET status = 'running', lastrun = $1 WHERE name = $2", [Date.now(), name]);
      let cronResult: any = null;

      if (name === 'EnergyRegenBackground') {
        const r = await queryRun("UPDATE users SET balance = balance + 10, balance_time = COALESCE(balance_time, 0) + 10 WHERE status = 'active' AND balance < 1000000");
        cronResult = { updatedUsers: r.changes };
      } else if (name === 'DailyDatabaseBackup') {
        let protalkBackup: any = null;
        try {
          protalkBackup = await callProTalkDbApi('/auto-backup/run', { method: 'POST' });
        } catch (e: any) {
          protalkBackup = { warning: e?.message };
        }
        const tgRes = await sendDatabaseBackupToTelegram();
        cronResult = { protalkBackup, telegram: tgRes };
      } else if (name === 'WeeklyInactiveReminders' || name === 'InactiveUserReminderWeekly') {
        const force = req.body?.force !== undefined ? req.body.force : true;
        cronResult = await sendWeeklyInactiveReminders({ forceAll: force, daysInactive: 7 });
      } else if (name === 'CleanStaleLogs') {
        const cutoff = Date.now() - 90 * 86400 * 1000;
        const r = await queryRun('DELETE FROM ai_logs WHERE timestamp < $1', [cutoff]);
        cronResult = { deletedLogs: r.changes };
      }

      await queryRun(
        "UPDATE system_cron_jobs SET status = 'idle', executionscount = COALESCE(executionscount, 0) + 1, nextrun = $1 WHERE name = $2",
        [Date.now() + 60000, name]
      );

      res.json({ success: true, message: `Cron job ${name} executed successfully!`, data: cronResult });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/system-admin/query', async (req, res) => {
    try {
      const { sql, params = [], userRole } = req.body;
      if (userRole && userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
      }
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ error: 'Missing SQL query' });
      }

      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      const isSelect = normalized.startsWith('select') || normalized.startsWith('with');
      if (isSelect) {
        const rows = await queryAll<any>(sql, params);
        res.json({ success: true, rows });
      } else {
        const result = await queryRun(sql, params);
        res.json({ success: true, result });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/bulk-delete', async (req, res) => {
    try {
      const { table, primaryKey, keys } = req.body;
      if (!table || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ error: 'Укажите имя таблицы и массив ключей для удаления' });
      }
      if (!ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: `Таблица "${table}" не разрешена для массового удаления.` });
      }

      const pk = (primaryKey || 'id').toLowerCase();
      const placeholders = keys.map((_: any, i: number) => `$${i + 1}`).join(', ');
      const typedKeys = (table === 'file_storage' || table === 'file_folders') && pk === 'id'
        ? keys.map((k: any) => Number(k))
        : keys.map((k: any) => String(k));

      if (table === 'users') {
        await queryRun(`DELETE FROM users WHERE ${pk} IN (${placeholders})`, typedKeys);
        await queryRun(`DELETE FROM discovered_elements WHERE userid IN (${placeholders})`, typedKeys);
        await queryRun(`DELETE FROM transactions WHERE userid IN (${placeholders})`, typedKeys);
        await queryRun(`DELETE FROM ai_logs WHERE userid IN (${placeholders})`, typedKeys);
        await queryRun(`DELETE FROM mailing_logs WHERE recipientid IN (${placeholders})`, typedKeys);
      } else {
        await queryRun(`DELETE FROM ${table} WHERE ${pk} IN (${placeholders})`, typedKeys);
      }

      res.json({ success: true, count: keys.length, message: `Успешно удалено ${keys.length} записей из таблицы ${table}` });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/export-csv', async (req, res) => {
    try {
      const table = String(req.query.table || '');
      if (!table || !ALLOWED_TABLES.includes(table)) {
        return res.status(400).send('Не указана или не разрешена таблица для экспорта.');
      }

      const rows = await queryAll<any>(`SELECT * FROM ${table}`);
      if (!rows || rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${table}_${Date.now()}.csv"`);
        return res.send('\uFEFFid\n');
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [headers.join(',')];
      for (const row of rows) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        });
        csvLines.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${table}_${Date.now()}.csv"`);
      res.send('\uFEFF' + csvLines.join('\n'));
    } catch (err) {
      res.status(500).send((err as Error).message);
    }
  });

  app.get('/api/admin/export-zip', async (req, res) => {
    try {
      const zip = new JSZip();
      for (const table of ALLOWED_TABLES) {
        const rows = await queryAll<any>(`SELECT * FROM ${table}`);
        if (!rows || rows.length === 0) {
          zip.file(`${table}.csv`, '\uFEFFid\n');
          continue;
        }
        const headers = Object.keys(rows[0]);
        const csvLines = [headers.join(',')];
        for (const row of rows) {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '""';
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          });
          csvLines.push(values.join(','));
        }
        zip.file(`${table}.csv`, '\uFEFF' + csvLines.join('\n'));
      }
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="database_all_tables_${Date.now()}.zip"`);
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).send('Ошибка экспорта ZIP: ' + (err as Error).message);
    }
  });

  app.get('/api/admin/export-json-backup', async (req, res) => {
    try {
      const appVer = await getAppVersionFromDb().catch(() => '1.32');
      const backupData: Record<string, any> = {
        meta: {
          app: 'AiHim Alchimia',
          version: `v${appVer}`,
          database: 'aihim2',
          exportedAt: Date.now(),
          exportedAtISO: new Date().toISOString()
        },
        tables: {}
      };

      for (const table of ALLOWED_TABLES) {
        const rows = await queryAll<any>(`SELECT * FROM ${table}`);
        backupData.tables[table] = rows || [];
      }

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aihim_db_backup_${dateStr}.json"`);
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
      res.status(500).json({ error: 'Ошибка экспорта JSON: ' + (err as Error).message });
    }
  });

  app.post('/api/admin/restore-json-backup', async (req, res) => {
    try {
      let { backupData, backupUrl, table: requestedTable, selectedTable, skipPostSync } = req.body || {};

      if (backupUrl && typeof backupUrl === 'string' && backupUrl.trim()) {
        const trimmedUrl = backupUrl.trim();
        if (!/^https?:\/\//i.test(trimmedUrl)) {
          return res.status(400).json({ error: 'Некорректная ссылка на бэкап: должен использоваться http:// или https://' });
        }
        const remoteRes = await fetch(trimmedUrl, { headers: { Accept: 'application/json, text/plain, */*' } });
        if (!remoteRes.ok) {
          return res.status(400).json({ error: `Не удалось скачать файл бэкапа по ссылке (HTTP ${remoteRes.status})` });
        }
        const rawText = await remoteRes.text();
        try {
          backupData = JSON.parse(rawText.replace(/^\uFEFF/, '').trim());
        } catch {
          return res.status(400).json({ error: 'Скачанный по ссылке файл не является корректным JSON' });
        }
      } else if (typeof backupData === 'string') {
        const trimmed = backupData.replace(/^\uFEFF/, '').trim();
        if (/^https?:\/\/\S+$/i.test(trimmed)) {
          const remoteRes = await fetch(trimmed, { headers: { Accept: 'application/json, text/plain, */*' } });
          if (!remoteRes.ok) {
            return res.status(400).json({ error: `Не удалось скачать файл бэкапа по ссылке (HTTP ${remoteRes.status})` });
          }
          const rawText = await remoteRes.text();
          try {
            backupData = JSON.parse(rawText.replace(/^\uFEFF/, '').trim());
          } catch {
            return res.status(400).json({ error: 'Скачанный по ссылке файл не является корректным JSON' });
          }
        } else {
          try {
            backupData = JSON.parse(trimmed);
          } catch {
            return res.status(400).json({ error: 'Ошибка синтаксиса JSON в загруженном файле бэкапа' });
          }
        }
      }

      if (!backupData) {
        return res.status(400).json({ error: 'Некорректный формат данных бэкапа JSON' });
      }

      let tablesObj: Record<string, any> = {};
      if (Array.isArray(backupData)) {
        const targetTable = (requestedTable && ALLOWED_TABLES.includes(requestedTable)) ? requestedTable : (selectedTable || 'ai_logs');
        tablesObj[targetTable] = backupData;
      } else if (typeof backupData === 'object') {
        if (backupData.tables && typeof backupData.tables === 'object') tablesObj = backupData.tables;
        else if (backupData.data && Array.isArray(backupData.data)) tablesObj[requestedTable || selectedTable || 'ai_logs'] = backupData.data;
        else tablesObj = backupData;
      } else {
        return res.status(400).json({ error: 'Неподдерживаемый формат JSON данных' });
      }

      let totalTablesRestored = 0;
      let totalRowsRestored = 0;

      // Ensure file_folders restores before file_storage due to FK
      const orderedEntries = Object.entries(tablesObj).sort(([a], [b]) => {
        if (a === 'file_folders') return -1;
        if (b === 'file_folders') return 1;
        return 0;
      });

      for (const [table, rows] of orderedEntries) {
        if (!ALLOWED_TABLES.includes(table) || !Array.isArray(rows) || rows.length === 0) continue;
        totalTablesRestored++;
        const restored = await upsertPgRowsBatch(table, rows as Record<string, any>[], 30);
        totalRowsRestored += restored;
      }

      if (!skipPostSync) {
        await finalizeRestoreState();
      }

      res.json({
        success: true,
        message: `Восстановление бэкапа успешно выполнено! Обработано таблиц: ${totalTablesRestored}, обновлено/добавлено записей: ${totalRowsRestored}`,
        totalTablesRestored,
        totalRowsRestored
      });
    } catch (err) {
      res.status(500).json({ error: 'Сбой при восстановлении бэкапа: ' + (err as Error).message });
    }
  });

  app.post('/api/admin/restore-json-finalize', async (_req, res) => {
    try {
      await finalizeRestoreState();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка финальной синхронизации после восстановления: ' + (err as Error).message });
    }
  });

  app.post('/api/admin/import-csv', async (req, res) => {
    try {
      const { table, csvData } = req.body;
      if (!table || !csvData) {
        return res.status(400).json({ error: 'Передайте имя таблицы и данные для импорта' });
      }
      if (!ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: `Таблица "${table}" не разрешена для импорта.` });
      }

      const trimmedData = String(csvData).replace(/^\uFEFF/, '').trim();
      if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
        try {
          const parsedJson = JSON.parse(trimmedData);
          const rowsToImport = Array.isArray(parsedJson)
            ? parsedJson
            : (parsedJson.tables?.[table] || parsedJson[table] || parsedJson.data || []);

          if (!Array.isArray(rowsToImport) || rowsToImport.length === 0) {
            return res.status(400).json({ error: 'JSON файл не содержит массивов записей для импорта' });
          }

          const successCount = await upsertPgRowsBatch(table, rowsToImport, 30);
          return res.json({ success: true, count: successCount, message: `Успешно импортировано/обновлено ${successCount} записей в таблице ${table} (из JSON)` });
        } catch {}
      }

      const parseCSV = (str: string): string[][] => {
        const rows: string[][] = [];
        let currRow: string[] = [];
        let currField = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const next = str[i + 1];
          if (char === '"') {
            if (inQuotes && next === '"') { currField += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            currRow.push(currField);
            currField = '';
          } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            currRow.push(currField);
            if (currRow.some(f => f.trim().length > 0)) rows.push(currRow);
            currRow = [];
            currField = '';
          } else {
            currField += char;
          }
        }
        if (currField || currRow.length > 0) {
          currRow.push(currField);
          if (currRow.some(f => f.trim().length > 0)) rows.push(currRow);
        }
        return rows;
      };

      const parsedRows = parseCSV(trimmedData);
      if (parsedRows.length < 2) {
        return res.status(400).json({ error: 'CSV файл не содержит строк с данными' });
      }

      const rawHeaders = parsedRows[0];
      const columns = rawHeaders.map(c => c.trim().replace(/^["']|["']$/g, '').trim()).filter(Boolean);
      if (columns.length === 0) {
        return res.status(400).json({ error: 'В CSV файле не найдено корректных заголовков столбцов' });
      }

      const rowObjects: Record<string, any>[] = [];
      for (const row of parsedRows.slice(1)) {
        if (!row || row.every(v => String(v).trim() === '')) continue;
        const rowObj: Record<string, any> = {};
        columns.forEach((col, i) => {
          rowObj[col] = row[i] !== undefined ? row[i] : null;
        });
        rowObjects.push(rowObj);
      }

      const successCount = await upsertPgRowsBatch(table, rowObjects, 30);

      res.json({ success: true, count: successCount, message: `Успешно импортировано/обновлено ${successCount} записей в таблице ${table}` });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
