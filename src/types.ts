export type Rarity = 
  | 'Обычный' 
  | 'Редкий' 
  | 'Эпический' 
  | 'Легендарный' 
  | 'Мифический' 
  | 'Божественный' 
  | 'Вечный' 
  | 'Космический' 
  | 'Изначальный' 
  | 'Трансцендентный'
  | 'Запретный';
export type ElementType = 'Материя' | 'Энергия' | 'Гибрид' | 'Аномалия';
export type ElementState = 'Твердое' | 'Жидкое' | 'Газ' | 'Плазма' | 'Эфир';
export type Essence = 'life' | 'death' | 'order' | 'chaos' | 'void' | 'creation' | 'destruction';

export type WorldPhase = 'day' | 'night';

export interface AlchemyElement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  type: ElementType;
  state: ElementState;
  complexity: number;
  parents?: [string, string];
  discoveredAt: number;
  isMutation?: boolean;
  
  // Hidden Logic Layer
  temperature: number; // -100 to 1000
  targetTemperature: number; // ideal temperature
  stability: number; // 0-100
  essences: Essence[];
  realityLevel: number; // 1-5 (Physical, Chemical, Biological, Abstract, Cosmic)
  lastDecayAt?: number; // timestamp
  lastTempDecayAt?: number; // timestamp
  isFavorite?: boolean;
}

export interface CombinationResult {
  element: AlchemyElement | null;
  isNew: boolean;
  message?: string;
  isMutation?: boolean;
  isAlmostGuessed?: boolean;
}

export interface AppUser {
  id: string; // Telegram ID
  telegramId?: string;
  username: string; // @shishkarnem etc.
  fullName: string;
  avatar: string;
  role: 'admin' | 'manager' | 'user' | 'demo';
  email?: string;
  password?: string;
  balance: number; // Итоговый баланс AiHim (balance_start + balance_time + balance_ref + balance_pay + balance_admin)
  balance_start?: number; // Стартовый баланс при регистрации (1000 AiHim)
  balance_time?: number; // Начисляется каждую минуту по таймеру
  balance_ref?: number; // Начисляется за привлеченных рефералов
  balance_pay?: number; // Купленный баланс (покупки/топапы)
  balance_admin?: number; // Корректировка админом в БД/CRM (+ или -)
  discoveredCount: number;
  status: 'active' | 'banned' | 'pending' | 'bot_blocked' | 'inactive';
  level: number;
  registrationDate: number; // timestamp
  lastActive: number; // timestamp
  lastActiveDate?: string; // formatted date string (e.g. YYYY-MM-DD HH:mm:ss)
  lastReminderAt?: number; // timestamp of last sent reminder or error attempt
  referredById?: string;
  referredByUsername?: string;
  referrals?: string[]; // IDs of users registered via this user's link
  remindersEnabled?: boolean; // Telegram weekly reminder preference
}

export interface ReminderTemplate {
  id: string;
  title?: string;
  text: string;
  buttonText: string;
  buttonUrl: string;
}

export interface MailingLog {
  id: string;
  timestamp: number;
  recipientCount: number;
  successCount: number;
  errorCount: number;
  messageText: string;
  filterType: string;
  type?: string;
  text?: string;
  sentCount?: number;
  failedCount?: number;
  errors?: string[];
}

export interface BillingTransaction {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  amount: number; // AiHim
  price: number; // Rubles
  timestamp: number;
  status: 'success' | 'failed' | 'pending' | 'completed';
  type?: 'start' | 'pay' | 'admin' | 'ref' | string;
  reason?: string;
  comment?: string;
}

export interface AIRequestLog {
  id: string;
  userId: string;
  username: string;
  elementA: string;
  elementB: string;
  layer: number;
  tokensUsed: number;
  costRub: number;
  timestamp: number;
  status: 'success' | 'error' | 'failed';
  prompt: string;
  response: string;
}

export interface TelegramBotSettings {
  botToken: string;
  botUsername: string;
  registrationEnabled: boolean;
  welcomeMessage: string;
  proTalkToken: string;
  proTalkApiUrl: string;
  employeeId?: string;
  robokassaMerchantLogin?: string;
  robokassaPass1?: string;
  robokassaPass2?: string;
  robokassaIsTest?: boolean;
  robokassaReceiptItemName?: string;
  robokassaReceiptTax?: string;
  robokassaSno?: string;
  inactiveReminderEnabled?: boolean;
  inactiveDaysThreshold?: number;
  inactiveReminderMessage?: string;
}

export interface ArcanaLink {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
}

export interface ArcanaConfig {
  laws: Array<{ id: string; name: string; desc: string; detail: string; icon: string }>;
  elementTypes: Record<string, { desc: string; influence: string }>;
  essences: Record<string, { desc: string; influence: string }>;
  rarities: Record<string, { desc: string; rules: string }>;
  ranks: Array<{ min: number; name: string; levels: string; desc: string; detail: string; icon: string }>;
  realityLayers: Array<{ level: number; name: string; desc: string; rules: string; unlock?: string; reward?: number; conditions?: any }>;
  calculatorChances: Record<string, number>;
}

export interface PromptSettings {
  id?: string;
  elementPrompt: string;
  systemPrompt: string;
}

