import type { Spell } from '../data/spells';
import type { ReminderTemplate } from '../types';

export type { Spell, ReminderTemplate };

export interface User {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  role: string;
  email?: string;
  password?: string;
  balance: number;
  balance_start?: number;
  balance_time?: number;
  balance_ref?: number;
  balance_pay?: number;
  balance_admin?: number;
  discoveredCount: number;
  status: string;
  level: number;
  registrationDate: number;
  lastActive: number;
  lastLoginAt?: number | string;
  updatedAt?: number | string;
  remindersEnabled?: boolean;
  lastReminderAt?: number;
  nextReminderAt?: number;
  referredById?: string;
  referredByUsername?: string;
  referrals?: string[];
}

export interface MailingLog {
  id: string;
  timestamp: number;
  recipientId: string;
  recipientName?: string;
  recipientUsername?: string;
  messageText: string;
  status: 'success' | 'failed';
  errorMsg?: string | null;
}

export interface Transaction {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  amount: number;
  price: number;
  timestamp: number;
  status: string;
  type?: 'start' | 'pay' | 'admin' | 'ref' | string;
  reason?: string;
  comment?: string;
}

export interface AiLog {
  id: string;
  userId: string;
  username: string;
  elementA: string;
  elementB: string;
  layer: number;
  tokensUsed: number;
  costRub: number;
  timestamp: number;
  status: string;
  prompt: string;
  response: string;
}

export interface SystemCronJob {
  name: string;
  schedule: string;
  description?: string;
  lastRun: number | null;
  nextRun: number | null;
  status: string;
  executionsCount: number;
}

export interface UserElement {
  id: string;
  userId: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  type: string;
  state: string;
  complexity: number;
  parents?: [string, string];
  discoveredAt: number;
  isMutation?: boolean;
  temperature: number;
  targetTemperature: number;
  stability: number;
  essences: string[];
  realityLevel: number;
  isFavorite?: boolean;
}

export interface ArcanaLink {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  sortOrder: number;
}

export interface PromptSettings {
  id?: string;
  elementPrompt: string;
  systemPrompt: string;
}
