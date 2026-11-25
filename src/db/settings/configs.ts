import { DEFAULT_PROMPT_SETTINGS } from '../../constants';
import type { ReminderTemplate } from '../../types';
import { queryAll, queryGet, queryRun } from '../core';
import type { PromptSettings } from '../types';

export { DEFAULT_PROMPT_SETTINGS };
export type { PromptSettings, ReminderTemplate };

export async function savePromptSettings(settings: PromptSettings) {
  await queryRun(
    `INSERT INTO prompt_settings (id, elementprompt, systemprompt)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       elementprompt = EXCLUDED.elementprompt,
       systemprompt = EXCLUDED.systemprompt`,
    ['default', settings.elementPrompt, settings.systemPrompt]
  );
}

let appVersionColumnEnsured = false;

async function ensureAppVersionColumn() {
  if (appVersionColumnEnsured) return;
  try {
    await queryRun("ALTER TABLE prompt_settings ADD COLUMN IF NOT EXISTS appversion TEXT DEFAULT '1.32'");
    appVersionColumnEnsured = true;
  } catch {
    // ignore if already present
  }
}

export function normalizeVersionValue(raw?: string | null): string {
  const cleaned = String(raw || '').trim().replace(/^v/i, '');
  return cleaned || '1.32';
}

export async function getAppVersionFromDb(): Promise<string> {
  await ensureAppVersionColumn();
  const row = await queryGet<any>('SELECT appversion FROM prompt_settings WHERE id = $1', ['default']);
  if (row?.appversion) {
    return normalizeVersionValue(row.appversion);
  }
  return '1.32';
}

export async function saveAppVersionToDb(version: string): Promise<string> {
  await ensureAppVersionColumn();
  const normalized = normalizeVersionValue(version);
  const existing = await queryGet<any>('SELECT id FROM prompt_settings WHERE id = $1', ['default']);
  if (existing) {
    await queryRun('UPDATE prompt_settings SET appversion = $1 WHERE id = $2', [normalized, 'default']);
  } else {
    await queryRun(
      'INSERT INTO prompt_settings (id, elementprompt, systemprompt, appversion) VALUES ($1, $2, $3, $4)',
      ['default', DEFAULT_PROMPT_SETTINGS.elementPrompt, DEFAULT_PROMPT_SETTINGS.systemPrompt, normalized]
    );
  }
  return normalized;
}

export async function getProTalkConfig() {
  const row = await queryGet<any>('SELECT config_json FROM protalk_config WHERE id = $1', ['default']);
  if (!row || !row.config_json) {
    return {
      botId: process.env.PROTALK_BOT_ID || '',
      botToken: process.env.PROTALK_BOT_TOKEN || '',
      apiUrl: process.env.PROTALK_API_URL || 'https://eu1.api.pro-talk.ru/api/v1.0'
    };
  }
  return typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
}

export async function saveProTalkConfig(config: any) {
  await queryRun(
    `INSERT INTO protalk_config (id, config_json)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
    ['default', JSON.stringify(config)]
  );
}

export function cleanTelegramBaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim().replace(/\/+$/, '');
  if (url.endsWith('/bot')) {
    url = url.substring(0, url.length - 4);
  }
  return url.replace(/\/+$/, '');
}

export async function getTelegramBotConfig() {
  const row = await queryGet<any>('SELECT config_json FROM telegram_bot_config WHERE id = $1', ['default']);
  if (!row || !row.config_json) {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      botUsername: '@AI_HimBot',
      apiBaseUrl: process.env.TELEGRAM_API_BASE || 'https://aihim.shishkarnem.workers.dev',
      secondaryApiBaseUrl: 'https://eu1.account.dialog.ai.atiks.org',
      registrationEnabled: true,
      welcomeMessage: '',
      inactiveReminderEnabled: true,
      inactiveDaysThreshold: 7,
      inactiveReminderMessage: ''
    };
  }
  const parsed = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
  if (!parsed.apiBaseUrl || parsed.apiBaseUrl === 'https://api.telegram.org') {
    parsed.apiBaseUrl = process.env.TELEGRAM_API_BASE || 'https://aihim.shishkarnem.workers.dev';
  }
  return parsed;
}

export async function sendTelegramApiMessage(options: {
  chatId: string | number;
  text: string;
  replyMarkup?: any;
  botToken?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}) {
  const config = await getTelegramBotConfig();
  const token = options.botToken || config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const rawBase = options.apiBaseUrl || config?.apiBaseUrl || process.env.TELEGRAM_API_BASE || 'https://aihim.shishkarnem.workers.dev';
  const primaryBaseUrl = cleanTelegramBaseUrl(rawBase);
  const timeoutMs = options.timeoutMs || 10000;

  if (!token) {
    return { ok: false, description: 'Токен Telegram бота не настроен', errorMsg: 'Токен Telegram бота не настроен' };
  }

  const urlsToTry = [primaryBaseUrl];
  if (config?.secondaryApiBaseUrl && config.secondaryApiBaseUrl.trim()) {
    const sec = cleanTelegramBaseUrl(config.secondaryApiBaseUrl);
    if (!urlsToTry.includes(sec)) {
      urlsToTry.push(sec);
    }
  }

  let lastError: any = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${baseUrl}/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(options.chatId),
          text: options.text,
          reply_markup: options.replyMarkup
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        return { ok: true, data, description: 'Успешно отправлено', usedBaseUrl: baseUrl };
      }
      const desc = data?.description || `HTTP ${res.status} ${res.statusText}`;
      lastError = { ok: false, description: desc, errorMsg: `[Telegram API] ${desc}`, data };
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        return lastError;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      let msg = err?.name === 'AbortError'
        ? `Таймаут подключения (${timeoutMs}ms) к ${baseUrl}`
        : (err?.message || String(err));
      if (err?.cause) {
        const causeStr = typeof err.cause === 'object'
          ? (err.cause.code || err.cause.message || JSON.stringify(err.cause))
          : String(err.cause);
        msg += ` [Причина: ${causeStr}]`;
      }
      lastError = { ok: false, description: msg, errorMsg: `Ошибка сети при отправке в Telegram: ${msg}`, error: err };
    }
  }

  return lastError;
}

export async function sendTelegramApiDocument(options: {
  chatId: string | number;
  fileData: Buffer | Uint8Array | string;
  filename: string;
  caption?: string;
  botToken?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}) {
  const config = await getTelegramBotConfig();
  const token = options.botToken || config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const rawBase = options.apiBaseUrl || config?.apiBaseUrl || process.env.TELEGRAM_API_BASE || 'https://aihim.shishkarnem.workers.dev';
  const primaryBaseUrl = cleanTelegramBaseUrl(rawBase);
  const timeoutMs = options.timeoutMs || 30000;

  if (!token) {
    return { ok: false, description: 'Токен Telegram бота не настроен', errorMsg: 'Токен Telegram бота не настроен' };
  }

  const urlsToTry = [primaryBaseUrl];
  if (config?.secondaryApiBaseUrl && config.secondaryApiBaseUrl.trim()) {
    const sec = cleanTelegramBaseUrl(config.secondaryApiBaseUrl);
    if (!urlsToTry.includes(sec)) {
      urlsToTry.push(sec);
    }
  }

  let lastError: any = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${baseUrl}/bot${token}/sendDocument`;

      const formData = new FormData();
      formData.append('chat_id', String(options.chatId));
      if (options.caption) {
        formData.append('caption', options.caption);
      }

      let fileBlob: Blob;
      if (typeof options.fileData === 'string') {
        fileBlob = new Blob([options.fileData], { type: 'application/json; charset=utf-8' });
      } else {
        fileBlob = new Blob([options.fileData as any], { type: 'application/octet-stream' });
      }

      formData.append('document', fileBlob, options.filename);

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        return { ok: true, data, description: 'Файл бэкапа успешно отправлен в Telegram', usedBaseUrl: baseUrl };
      }
      const desc = data?.description || `HTTP ${res.status} ${res.statusText}`;
      lastError = { ok: false, description: desc, errorMsg: `[Telegram API] ${desc}`, data };
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        return lastError;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = err?.name === 'AbortError'
        ? `Таймаут подключения (${timeoutMs}ms) к ${baseUrl}`
        : (err?.message || String(err));
      lastError = { ok: false, description: msg, errorMsg: `Ошибка сети при отправке файла в Telegram: ${msg}`, error: err };
    }
  }

  return lastError;
}

export async function saveTelegramBotConfig(config: any) {
  const cleanConfig = { ...config };
  delete cleanConfig.proTalkToken;
  delete cleanConfig.proTalkApiUrl;
  delete cleanConfig.employeeId;
  await queryRun(
    `INSERT INTO telegram_bot_config (id, config_json)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
    ['default', JSON.stringify(cleanConfig)]
  );
}

export async function getReminderTemplatesFromDb(): Promise<ReminderTemplate[]> {
  return queryAll<ReminderTemplate>('SELECT * FROM reminder_templates ORDER BY id ASC');
}

export async function saveReminderTemplatesToDb(templates: ReminderTemplate[]) {
  await queryRun('DELETE FROM reminder_templates');
  for (const r of templates) {
    await queryRun(
      `INSERT INTO reminder_templates (id, title, text, buttontext, buttonurl)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         text = EXCLUDED.text,
         buttontext = EXCLUDED.buttontext,
         buttonurl = EXCLUDED.buttonurl`,
      [r.id, r.title, r.text, r.buttonText, r.buttonUrl]
    );
  }
}

export interface RobokassaReceiptItem {
  name: string;
  quantity: number;
  sum: number;
  cost?: number;
  tax: string;
  payment_method?: string;
  payment_object?: string;
}

export interface RobokassaReceipt {
  sno?: string;
  items: RobokassaReceiptItem[];
}

export function buildRobokassaReceipt(
  numericPrice: number,
  itemName = 'Виртуальная игровая энергия AiHim',
  tax = 'none',
  sno?: string
): RobokassaReceipt {
  const priceFormatted = Number(Number(numericPrice).toFixed(2));
  const activeTax = (tax && tax.trim() !== '' && tax.trim() !== 'none_omit') ? tax.trim() : 'none';

  const item: RobokassaReceiptItem = {
    name: itemName || 'Виртуальная игровая энергия AiHim',
    quantity: 1,
    sum: priceFormatted,
    cost: priceFormatted,
    tax: activeTax,
    payment_method: 'full_payment',
    payment_object: 'service'
  };

  const receipt: RobokassaReceipt = { items: [item] };
  if (sno && sno.trim() !== '') {
    receipt.sno = sno.trim();
  }
  return receipt;
}

export async function getRobokassaConfig() {
  const row = await queryGet<any>('SELECT config_json FROM robokassa_config WHERE id = $1', ['default']);
  if (!row || !row.config_json) {
    return {
      id: 'default',
      merchantLogin: process.env.ROBOKASSA_MERCHANT_LOGIN || '',
      password1: process.env.ROBOKASSA_PASS1 || '',
      password2: process.env.ROBOKASSA_PASS2 || '',
      isTest: 0,
      receiptItemName: 'Виртуальная игровая энергия AiHim',
      receiptTax: 'none',
      sno: ''
    };
  }
  const parsed = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
  if (!parsed.receiptItemName) {
    parsed.receiptItemName = 'Виртуальная игровая энергия AiHim';
  }
  if (!parsed.receiptTax || parsed.receiptTax === '') {
    parsed.receiptTax = 'none';
  }
  return parsed;
}

export async function saveRobokassaConfig(config: any) {
  const current = await getRobokassaConfig();
  const cleanConfig = {
    id: 'default',
    merchantLogin: config.merchantLogin ?? current.merchantLogin ?? '',
    password1: config.password1 ?? current.password1 ?? '',
    password2: config.password2 ?? current.password2 ?? '',
    isTest: (config.isTest === 1 || config.isTest === '1' || config.isTest === true) ? 1 : 0,
    receiptItemName: config.receiptItemName || current.receiptItemName || 'Виртуальная игровая энергия AiHim',
    receiptTax: (config.receiptTax && config.receiptTax !== '') ? String(config.receiptTax) : 'none',
    sno: config.sno !== undefined ? String(config.sno) : (current.sno || '')
  };
  await queryRun(
    `INSERT INTO robokassa_config (id, config_json)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
    ['default', JSON.stringify(cleanConfig)]
  );
}
