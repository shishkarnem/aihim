import { queryGet, queryRun, setTxNotifyHook } from '../core';
import type { Transaction, User, MailingLog, AiLog } from '../types';
import { getTelegramBotConfig, sendTelegramApiMessage } from '../settings/configs';
import { recalculateUserBalancesFromTransactions } from './users';

export type { Transaction, MailingLog, AiLog };

export function getTransactionType(tx: any): 'start' | 'pay' | 'admin' | 'ref' {
  if (tx && tx.type && ['start', 'pay', 'admin', 'ref'].includes(String(tx.type).toLowerCase())) {
    return String(tx.type).toLowerCase() as any;
  }
  const tid = String(tx?.id || '');
  if (tid.includes('START')) return 'start';
  if (tid.includes('REF')) return 'ref';
  if (tid.includes('ADMIN')) return 'admin';
  if (tid.startsWith('inv_') || tid.includes('PAY') || tid.startsWith('TX-100') || Number(tx?.price) > 0) return 'pay';
  return 'admin';
}

export async function sendTelegramAdminTxNotification(tx: Transaction) {
  try {
    if (!tx?.id) return;

    // Atomically claim notification right in PostgreSQL so no duplicate/replay can ever fire
    const claimRes = await queryRun(
      `UPDATE transactions
       SET tg_notified = TRUE
       WHERE id = $1
         AND COALESCE(tg_notified, FALSE) = FALSE
         AND LOWER(COALESCE(status, '')) IN ('success', 'completed')
       RETURNING *`,
      [tx.id],
      { skipTxNotify: true }
    );
    const claimedTx = claimRes.rows?.[0] as Transaction | undefined;
    if (!claimedTx) {
      return;
    }

    const ADMIN_TELEGRAM_ID = '169262990';
    const botConfig = await getTelegramBotConfig();
    const botToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';

    if (!botToken) {
      console.warn('[Telegram Notify] No botToken found in DB or env, skipping admin notification.');
      return;
    }

    // Allow Telegram login & profile sync to complete
    await new Promise(r => setTimeout(r, 3500));

    const freshTx = (await queryGet<Transaction>('SELECT * FROM transactions WHERE id = $1', [tx.id])) || claimedTx;
    const userRecord = await queryGet<User>('SELECT * FROM users WHERE id = $1', [freshTx.userId]);

    const currentFullName = userRecord?.fullName || freshTx.fullName || tx.fullName;
    const currentUsername = userRecord?.username || freshTx.username || tx.username;

    const amtNum = Number(freshTx.amount) || 0;
    const formattedAmount = (amtNum >= 0 ? '+' : '') + amtNum.toLocaleString('ru-RU') + ' AiHim';
    const userLabel = currentFullName
      ? `${currentFullName} (${currentUsername || `@id${freshTx.userId}`})`
      : (currentUsername || `Пользователь #${freshTx.userId}`);
    const timeFormatted = new Date(freshTx.timestamp || Date.now()).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

    let title = '⚡ НОВАЯ ТРАНЗАКЦИЯ';
    const tid = String(freshTx.id || '');
    const txType = freshTx.type || getTransactionType(freshTx);

    if (txType === 'start' || tid.includes('START')) {
      title = '🎁 СТАРТОВЫЙ БОНУС (1 000 AiHim)';
    } else if (txType === 'ref' || tid.includes('REF')) {
      title = '👥 РЕФЕРАЛЬНОЕ НАЧИСЛЕНИЕ';
    } else if (txType === 'admin' || tid.includes('ADMIN')) {
      title = '🛠 КОРРЕКТИРОВКА АДМИНИСТРАТОРА';
    } else if (txType === 'pay' || tid.startsWith('inv_') || tid.includes('PAY') || tid.startsWith('TX-100')) {
      title = '💳 ОПЛАТА / ПОПОЛНЕНИЕ';
    }

    const commentText = (freshTx.reason || freshTx.comment) ? `\n💬 Комментарий: ${freshTx.reason || freshTx.comment}` : '';

    const message = `${title}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 Пользователь: ${userLabel}\n` +
      `🆔 ID Пользователя: ${freshTx.userId}\n` +
      `🏷 Тип баланса: ${txType}\n` +
      `💰 Сумма: ${formattedAmount}\n` +
      (Number(freshTx.price) > 0 ? `💵 Стоимость: ${Number(freshTx.price).toLocaleString('ru-RU')} ₽\n` : '') +
      `🕒 Время (МСК): ${timeFormatted}\n` +
      `📊 Статус: ${freshTx.status || 'success'}\n` +
      `🔖 TxID: ${freshTx.id}` +
      commentText;

    const rawTargetChatIds = [ADMIN_TELEGRAM_ID];
    const userTgId = (userRecord as any)?.telegramId || userRecord?.id;
    if (userTgId && String(userTgId).trim()) {
      rawTargetChatIds.push(String(userTgId).trim());
    } else if (freshTx.userId && !isNaN(Number(freshTx.userId))) {
      rawTargetChatIds.push(String(freshTx.userId).trim());
    }

    const targetChatIds = Array.from(new Set(rawTargetChatIds.filter(Boolean)));

    for (const chatId of targetChatIds) {
      try {
        const res = await sendTelegramApiMessage({
          chatId,
          text: message,
          botToken,
          apiBaseUrl: botConfig?.apiBaseUrl,
          replyMarkup: {
            inline_keyboard: [[{ text: 'Открыть Играть', url: 'https://t.me/AI_HimBot/app' }]]
          }
        });
        if (!res.ok) {
          console.warn(`[Telegram Tx Notify] Notice for chatId ${chatId}: ${res.description}`);
        }
      } catch (e) {
        console.warn(`[Telegram Tx Notify] Exception sending to chatId ${chatId}:`, e);
      }
    }

    // Deliver mobile Web Push to subscriber devices based on their preferences
    if (freshTx.userId) {
      try {
        const { sendWebPushToUser } = await import('../features/push');
        const pushCategory = txType === 'ref' ? 'referrals' : txType === 'pay' ? 'transactions' : 'energy';
        const pushTitle =
          txType === 'ref'
            ? 'Реферальный бонус AIhim'
            : txType === 'pay'
              ? 'Пополнение энергии AIhim'
              : 'Начисление энергии AIhim';
        const pushBody = `${formattedAmount}${freshTx.reason ? ` — ${freshTx.reason}` : ''}`;
        await sendWebPushToUser(String(freshTx.userId), pushCategory, {
          title: pushTitle,
          body: pushBody,
          url: '/profile',
          tag: `tx-${freshTx.id}`
        });
      } catch (pushErr) {
        console.warn('[WebPush Tx Notify] Warning:', pushErr);
      }
    }
  } catch (err) {
    console.warn('[Telegram Notify] Notice sending notification:', err);
  }
}

export async function runTriggersForInsertTransaction(tx: Transaction) {
  if (!tx?.id || (tx as any).tg_notified) return;
  const user = await queryGet<User>('SELECT * FROM users WHERE id = $1', [tx.userId]);
  if (user) {
    const txTs = Number(tx.timestamp) || Date.now();
    const curLastActive = Number(user.lastActive) || 0;
    if (txTs > curLastActive) {
      await queryRun('UPDATE users SET lastactive = $1 WHERE id = $2', [txTs, tx.userId], { skipTxNotify: true });
    }
    await recalculateUserBalancesFromTransactions(user);
  }
  await sendTelegramAdminTxNotification(tx);
}

setTxNotifyHook(runTriggersForInsertTransaction);
