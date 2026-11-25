import { queryAll, queryRun } from '../core';
import type { User, Transaction } from '../types';
import { getTransactionType } from './transactions';

export type { User };

export function normalizeUserRecord(u: any): any {
  if (!u || typeof u !== 'object') return u;
  const strId = String(u.id ?? '');
  const lastActiveTs =
    typeof u.lastActive === 'number'
      ? u.lastActive
      : (typeof u.lastactive === 'number' ? u.lastactive : Date.now());
  const formattedActiveDate =
    u.lastActiveDate ??
    u.lastactivedate ??
    new Date(lastActiveTs).toISOString().replace('T', ' ').substring(0, 19);

  return {
    id: strId,
    username: u.username ?? `@id${strId}`,
    fullName: u.fullName ?? u.fullname ?? 'Алхимик',
    avatar: u.avatar ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
    role: u.role ?? 'user',
    email: u.email ?? null,
    password: u.password ?? null,
    balance_start: u.balance_start ?? 1000,
    balance_time: typeof u.balance_time === 'number' && !isNaN(u.balance_time) ? u.balance_time : (Number(u.balance_time) || 0),
    balance_ref: u.balance_ref ?? 0,
    balance_pay: u.balance_pay ?? 0,
    balance_admin: u.balance_admin ?? 0,
    balance: u.balance ?? 1000,
    discoveredCount: typeof u.discoveredCount === 'number' ? u.discoveredCount : (typeof u.discoveredcount === 'number' ? u.discoveredcount : 8),
    status: u.status ?? 'active',
    level: typeof u.level === 'number' ? u.level : 1,
    registrationDate: typeof u.registrationDate === 'number' ? u.registrationDate : (typeof u.registrationdate === 'number' ? u.registrationdate : Date.now()),
    lastActive: lastActiveTs,
    lastActiveDate: formattedActiveDate,
    nextReminderAt: u.nextReminderAt ?? u.nextreminderat ?? null,
    lastLoginAt: u.lastLoginAt ?? u.lastloginat ?? null,
    updatedAt: u.updatedAt ?? u.updatedat ?? null,
    referredById: u.referredById ?? u.referredbyid ?? null,
    referredByUsername: u.referredByUsername ?? u.referredbyusername ?? null
  };
}

export async function recalculateUserBalancesFromTransactions(user: any): Promise<any> {
  if (!user || !user.id) return user;
  const uid = String(user.id);

  try {
    const userTxs = await queryAll<Transaction>(
      `SELECT * FROM transactions WHERE CAST(userid AS TEXT) = $1 AND (LOWER(status) = 'success' OR LOWER(status) = 'completed')`,
      [uid]
    );

    let bStart = 0;
    let bPay = 0;
    let bRef = 0;
    let bAdmin = 0;
    let hasStartTx = false;

    for (const tx of userTxs) {
      const tType = getTransactionType(tx);
      const amt = Number(tx.amount) || 0;

      if (tType === 'start') {
        bStart += amt;
        hasStartTx = true;
      } else if (tType === 'pay') {
        bPay += amt;
      } else if (tType === 'ref') {
        bRef += amt;
      } else if (tType === 'admin') {
        bAdmin += amt;
      }
    }

    const oldStart = Number(user.balance_start) || 0;
    const oldPay = Number(user.balance_pay) || 0;
    const oldRef = Number(user.balance_ref) || 0;
    const oldAdmin = Number(user.balance_admin) || 0;
    const oldBal = Number(user.balance) || 0;

    if (!hasStartTx && uid !== 'guest_demo') {
      const startTx: Transaction = {
        id: `TX-START-${uid}`,
        userId: uid,
        username: user.username || `@id${uid}`,
        fullName: user.fullName || 'Алхимик',
        amount: 1000,
        price: 0,
        timestamp: user.registrationDate || Date.now() - 86400000,
        status: 'success',
        type: 'start'
      };
      await queryRun(
        `INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type, tg_notified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [startTx.id, startTx.userId, startTx.username, startTx.fullName, startTx.amount, startTx.price, startTx.timestamp, startTx.status, startTx.type],
        { skipTxNotify: true }
      );
      bStart = 1000;
    }

    const bTime = Number(user.balance_time) || 0;
    const newBalance = bStart + bTime + bRef + bPay + bAdmin;

    user.balance_start = bStart;
    user.balance_pay = bPay;
    user.balance_ref = bRef;
    user.balance_admin = bAdmin;
    user.balance = newBalance;

    if (
      oldBal !== newBalance ||
      oldStart !== bStart ||
      oldPay !== bPay ||
      oldRef !== bRef ||
      oldAdmin !== bAdmin
    ) {
      await queryRun(
        `UPDATE users SET balance = $1, balance_start = $2, balance_pay = $3, balance_ref = $4, balance_admin = $5 WHERE CAST(id AS TEXT) = $6`,
        [newBalance, bStart, bPay, bRef, bAdmin, uid],
        { skipTxNotify: true }
      );
    }

    return user;
  } catch (e) {
    console.error(`[recalculateUserBalancesFromTransactions] Error for user ${uid}:`, e);
    return user;
  }
}

export async function recalculateAllUserBalances(): Promise<void> {
  const users = await queryAll<any>('SELECT * FROM users');
  const validUsers = users.filter(u => u && u.id && u.id !== 'guest_demo');
  const BATCH_SIZE = 5;
  for (let i = 0; i < validUsers.length; i += BATCH_SIZE) {
    const batch = validUsers.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(user => recalculateUserBalancesFromTransactions(user)));
  }
}
