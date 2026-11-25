import {
  AppUser,
  BillingTransaction,
  AIRequestLog,
  TelegramBotSettings,
  ReminderTemplate,
  MailingLog
} from '../types';

// Формула стоимости ИИ: 10 млн токенов = 300 рублей -> 1 токен = 0.00003 рублей
export const TOKEN_COST_RATIO = 300 / 10000000;

export const EMPTY_BOT_SETTINGS: TelegramBotSettings = {
  botToken: '',
  botUsername: '@AI_HimBot',
  registrationEnabled: true,
  welcomeMessage: '',
  proTalkToken: '',
  proTalkApiUrl: 'https://eu1.api.pro-talk.ru/api/v1.0',
  employeeId: '',
  robokassaMerchantLogin: '',
  robokassaPass1: '',
  robokassaPass2: '',
  robokassaIsTest: true,
  robokassaReceiptItemName: 'Виртуальная игровая энергия AiHim',
  robokassaReceiptTax: 'none',
  inactiveReminderEnabled: true,
  inactiveDaysThreshold: 7,
  inactiveReminderMessage: ''
};

// Хелперы локального кэша (основным источником правды является PostgreSQL API)
export const getAdminUsers = (): AppUser[] => {
  try {
    const saved = localStorage.getItem('aihim_admin_users');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid cache
  }
  return [];
};

export const saveAdminUsers = (users: AppUser[]) => {
  localStorage.setItem('aihim_admin_users', JSON.stringify(users));
};

export const getAdminTransactions = (): BillingTransaction[] => {
  try {
    const saved = localStorage.getItem('aihim_admin_transactions');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid cache
  }
  return [];
};

export const saveAdminTransactions = (txs: BillingTransaction[]) => {
  localStorage.setItem('aihim_admin_transactions', JSON.stringify(txs));
};

export const getAdminLogs = (): AIRequestLog[] => {
  try {
    const saved = localStorage.getItem('aihim_admin_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid cache
  }
  return [];
};

export const saveAdminLogs = (logs: AIRequestLog[]) => {
  localStorage.setItem('aihim_admin_logs', JSON.stringify(logs));
};

export const getBotSettings = (): TelegramBotSettings => {
  try {
    const saved = localStorage.getItem('aihim_bot_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...EMPTY_BOT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore invalid cache
  }
  return EMPTY_BOT_SETTINGS;
};

export const saveBotSettings = (settings: TelegramBotSettings) => {
  localStorage.setItem('aihim_bot_settings', JSON.stringify(settings));
};

// Функция регистрации/синхронизации пользователя из Телеграм строго по ID
export const registerTelegramUser = (
  telegramUser: {
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
  },
  referredById?: string
): AppUser => {
  const users = getAdminUsers();
  const strId = telegramUser.id.toString();
  const existing = users.find((u) => u.id === strId);

  const firstName = telegramUser.first_name || telegramUser.firstName || '';
  const lastName = telegramUser.last_name || telegramUser.lastName || '';
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    existing?.fullName ||
    'Алхимик Telegram';
  const rawUsername = telegramUser.username || '';
  const username = rawUsername
    ? rawUsername.startsWith('@')
      ? rawUsername
      : `@${rawUsername}`
    : existing?.username || `@id${strId}`;
  const avatar =
    telegramUser.photo_url ||
    telegramUser.photoUrl ||
    existing?.avatar ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop';

  const cleanRefId = referredById
    ? String(referredById).replace(/^ref_?|^user_?/i, '').trim()
    : undefined;

  if (existing) {
    existing.lastActive = Date.now();
    if (fullName) existing.fullName = fullName;
    if (username) existing.username = username;
    if (avatar) existing.avatar = avatar;

    if (
      cleanRefId &&
      cleanRefId !== existing.id &&
      (!existing.referredById || String(existing.referredById) === 'null')
    ) {
      existing.referredById = cleanRefId;
      existing.referredByUsername = `@id${cleanRefId}`;
      const referrer = users.find((u) => u.id === cleanRefId);
      if (referrer) {
        existing.referredById = referrer.id;
        existing.referredByUsername = referrer.username || `@id${referrer.id}`;
      }
    }

    saveAdminUsers(users);
    return existing;
  }

  const newUser: AppUser = {
    id: strId,
    username,
    fullName,
    avatar,
    role: strId === '169262990' ? 'admin' : 'user',
    balance_start: 1000,
    balance_time: 0,
    balance_ref: 0,
    balance_pay: 0,
    balance_admin: 0,
    balance: 1000,
    discoveredCount: 8,
    status: 'active',
    level: 1,
    registrationDate: Date.now(),
    lastActive: Date.now()
  };

  if (cleanRefId && cleanRefId !== newUser.id) {
    newUser.referredById = cleanRefId;
    newUser.referredByUsername = `@id${cleanRefId}`;
    const referrer = users.find((u) => u.id === cleanRefId);
    if (referrer) {
      newUser.referredById = referrer.id;
      newUser.referredByUsername = referrer.username || `@id${referrer.id}`;
    }
  }

  users.push(newUser);
  saveAdminUsers(users);
  return newUser;
};

export const getReminderTemplates = (): ReminderTemplate[] => {
  try {
    const saved = localStorage.getItem('aihim_reminder_templates');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid cache
  }
  return [];
};

export const saveReminderTemplates = (templates: ReminderTemplate[]) => {
  localStorage.setItem('aihim_reminder_templates', JSON.stringify(templates));
};

export const getMailingLogs = (): MailingLog[] => {
  try {
    const saved = localStorage.getItem('aihim_mailing_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore invalid cache
  }
  return [];
};

export const saveMailingLogs = (logs: MailingLog[]) => {
  localStorage.setItem('aihim_mailing_logs', JSON.stringify(logs));
};
