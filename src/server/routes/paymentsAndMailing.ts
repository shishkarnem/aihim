import type express from 'express';
import crypto from 'crypto';
import dns from 'dns';
import {
  queryAll,
  queryGet,
  queryRun,
  getTelegramBotConfig,
  sendTelegramApiMessage,
  sendTelegramApiDocument,
  getRobokassaConfig,
  saveRobokassaConfig,
  buildRobokassaReceipt,
  getReminderTemplatesFromDb,
  recalculateUserBalancesFromTransactions,
  getAppVersionFromDb
} from '../../db';

export async function sendWeeklyInactiveReminders(options: { forceAll?: boolean; daysInactive?: number } = {}) {
  const forceAll = !!options.forceAll;
  const daysInactive = options.daysInactive || 7;
  const now = Date.now();
  const SEVEN_DAYS_MS = daysInactive * 24 * 3600 * 1000;

  const botConfig = await getTelegramBotConfig();
  const activeToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const dbTemplates = await getReminderTemplatesFromDb();

  const allUsers = await queryAll<any>('SELECT * FROM users');
  const candidateUsers = allUsers.filter((u: any) => {
    if (!u.id || u.id === 'guest_demo') return false;
    if (u.status === 'banned' || u.status === 'bot_blocked') return false;
    if (u.remindersEnabled === false || u.remindersEnabled === 0) return false;

    if (forceAll) return true;

    const activeTs = typeof u.lastActive === 'number' ? u.lastActive : (u.lastActive ? new Date(u.lastActive).getTime() : 0);
    const loginTs = typeof u.lastLoginAt === 'number' ? u.lastLoginAt : (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0);
    const updatedTs = typeof u.updatedAt === 'number' ? u.updatedAt : (u.updatedAt ? new Date(u.updatedAt).getTime() : 0);
    const lastActiveMs = Math.max(activeTs || 0, loginTs || 0, updatedTs || 0);
    const isInactive = (now - lastActiveMs >= SEVEN_DAYS_MS) || u.status === 'inactive';
    const lastReminderMs = typeof u.lastReminderAt === 'number' ? u.lastReminderAt : (u.lastReminderAt ? new Date(u.lastReminderAt).getTime() : 0);
    const reminderDue = (now - lastReminderMs >= SEVEN_DAYS_MS);

    return isInactive && reminderDue;
  });

  if (candidateUsers.length === 0) {
    return {
      success: true,
      message: 'Нет подходящих пользователей для отправки напоминаний.',
      sentCount: 0,
      failedCount: 0,
      totalCandidates: 0,
      results: []
    };
  }

  const results: any[] = [];
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < candidateUsers.length; i++) {
    const user = candidateUsers[i];
    const template = dbTemplates[Math.floor(Math.random() * dbTemplates.length)] || {
      text: '✨ Алхимик, твоя реторта остывает! Вернись в AIhim и продолжи трансмутацию элементов.',
      buttonText: 'Играть в AIhim',
      buttonUrl: 'https://t.me/AI_HimBot/app',
      title: 'Напоминание'
    };

    const btnText = template.buttonText || 'Играть в AIhim';
    const btnUrl = template.buttonUrl || 'https://t.me/AI_HimBot/app';
    const inline_keyboard = [[{ text: btnText, url: btnUrl }]];
    const logId = `cron_${now}_${user.id}_${Math.random().toString(36).substring(2, 6)}`;

    let sentSuccess = false;
    let errorMsg: string | null = null;

    if (activeToken) {
      try {
        const sendRes = await sendTelegramApiMessage({
          chatId: user.id,
          text: template.text,
          botToken: activeToken,
          replyMarkup: { inline_keyboard }
        });
        if (sendRes.ok) {
          sentSuccess = true;
        } else {
          errorMsg = sendRes.errorMsg || sendRes.description;
        }
      } catch (e: any) {
        errorMsg = e?.message || 'Network error';
      }
    } else {
      errorMsg = 'Telegram bot token not configured';
    }

    const nextRemAt = now + (7 * 24 * 3600 * 1000);

    if (sentSuccess) {
      sentCount++;
      await queryRun('UPDATE users SET lastreminderat = $1, nextreminderat = $2 WHERE id = $3', [now, nextRemAt, user.id]);
      await queryRun(
        'INSERT INTO mailing_logs (id, timestamp, recipientid, recipientname, recipientusername, messagetext, status, errormsg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [logId, now, String(user.id), user.fullName || '', user.username || '', template.text, 'success', null]
      );
      try {
        const { sendWebPushToUser } = await import('../../db');
        await sendWebPushToUser(String(user.id), 'reminders', {
          title: template.title || 'Лаборатория AIhim ждёт вас',
          body: template.text,
          url: '/',
          tag: 'aihim-reminder'
        });
      } catch {
        // non-fatal push reminder
      }
    } else {
      failedCount++;
      await queryRun(
        "UPDATE users SET lastreminderat = $1, nextreminderat = $2, status = 'bot_blocked', remindersenabled = 0 WHERE id = $3",
        [now, nextRemAt, user.id]
      );
      await queryRun(
        'INSERT INTO mailing_logs (id, timestamp, recipientid, recipientname, recipientusername, messagetext, status, errormsg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [logId, now, String(user.id), user.fullName || '', user.username || '', template.text, 'failed', errorMsg]
      );
    }

    results.push({
      id: logId,
      timestamp: now,
      recipientId: user.id,
      recipientName: user.fullName || 'Алхимик',
      recipientUsername: user.username || `@id${user.id}`,
      messageText: template.text,
      buttonText: btnText,
      buttonUrl: btnUrl,
      status: sentSuccess ? 'success' : 'failed',
      errorMsg,
      variantTitle: template.title
    });

    if (i < candidateUsers.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    success: true,
    message: `Рассылка неактивным завершена (${sentCount} успешно, ${failedCount} ошибок из ${candidateUsers.length})`,
    sentCount,
    failedCount,
    totalCandidates: candidateUsers.length,
    results
  };
}

export async function sendDatabaseBackupToTelegram(): Promise<{ ok: boolean; message?: string }> {
  try {
    const allowedTables = [
      'users', 'transactions', 'ai_logs', 'system_cron_jobs', 'discovered_elements',
      'arcana_links', 'arcana_config', 'prompt_settings', 'spells', 'protalk_config',
      'telegram_bot_config', 'robokassa_config', 'reminder_templates', 'mailing_logs',
      'file_folders', 'file_storage', 'blog_posts', 'web_push_config', 'push_subscriptions'
    ];

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const mskTimeStr = now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const appVer = await getAppVersionFromDb().catch(() => '1.32');

    const backupData: Record<string, any> = {
      meta: {
        app: 'AiHim Alchimia',
        version: `v${appVer}`,
        database: 'aihim2',
        exportedAt: now.getTime(),
        exportedAtISO: now.toISOString(),
        exportedAtMSK: mskTimeStr
      },
      tables: {}
    };

    let totalRows = 0;
    let tablesWithDataCount = 0;

    for (const table of allowedTables) {
      const rows = await queryAll<any>(`SELECT * FROM ${table}`);
      backupData.tables[table] = rows || [];
      if (rows && rows.length > 0) {
        totalRows += rows.length;
        tablesWithDataCount++;
      }
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const filename = `aihim_pg_backup_${dateStr}.json`;

    const caption = `📦 ЕЖЕДНЕВНЫЙ БЭКАП БАЗЫ ДАННЫХ POSTGRESQL (aihim2)\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📅 Время генерации (МСК): ${mskTimeStr}\n` +
      `💾 Таблиц сохранено: ${allowedTables.length} из ${allowedTables.length} (с данными: ${tablesWithDataCount})\n` +
      `📊 Всего записей в файле: ${totalRows.toLocaleString('ru-RU')}\n` +
      `🏷 Приложение: AIhim Alchimia (PostgreSQL)\n\n` +
      `✨ Полный JSON-слепок всей базы данных. Восстанавливается в 1 клик в /system-admin!`;

    const ADMIN_TELEGRAM_ID = '169262990';
    const res = await sendTelegramApiDocument({
      chatId: ADMIN_TELEGRAM_ID,
      fileData: jsonString,
      filename,
      caption
    });

    return { ok: res.ok, message: res.description || res.errorMsg };
  } catch (err: any) {
    console.error('[Backup Telegram Error]', err);
    return { ok: false, message: err.message };
  }
}

export function registerPaymentsAndMailingRoutes(app: express.Express) {
  app.get('/api/admin/robokassa-config', async (req, res) => {
    try {
      const config = await getRobokassaConfig();
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/robokassa-config', async (req, res) => {
    try {
      const { merchantLogin, password1, password2, isTest, receiptItemName, receiptTax, sno } = req.body;
      const current = await getRobokassaConfig();
      const config = {
        merchantLogin: merchantLogin !== undefined ? merchantLogin : current.merchantLogin,
        password1: password1 !== undefined ? password1 : current.password1,
        password2: password2 !== undefined ? password2 : current.password2,
        isTest: isTest !== undefined ? (isTest ? 1 : 0) : current.isTest,
        receiptItemName: receiptItemName || current.receiptItemName || 'Виртуальная игровая энергия AiHim',
        receiptTax: (receiptTax && receiptTax !== '') ? String(receiptTax) : (current.receiptTax || 'none'),
        sno: sno !== undefined ? String(sno) : (current.sno || '')
      };
      await saveRobokassaConfig(config);
      res.json({ success: true, message: 'Настройки Робокассы сохранены', config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/payments/robokassa/initiate', async (req, res) => {
    try {
      const { userId, payPrice, baseEnergy, packageLabel, email } = req.body;
      if (!userId || !payPrice || !baseEnergy) {
        return res.status(400).json({ error: 'Укажите userId, payPrice и baseEnergy' });
      }

      const user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [String(userId)]);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const userLevel = user.level || 1;
      const totalEnergy = Math.round(baseEnergy * userLevel);
      const numericPrice = Number(payPrice);
      const outSumFormatted = numericPrice.toFixed(2);
      const invId = Math.floor(Date.now() / 1000) % 2000000000;

      const robConfig = await getRobokassaConfig();
      const merchantLogin = robConfig.merchantLogin || process.env.ROBOKASSA_MERCHANT_LOGIN || '';
      const pass1 = robConfig.password1 || process.env.ROBOKASSA_PASS1 || '';
      if (!merchantLogin || !pass1) {
        return res.status(400).json({ error: 'Робокасса не настроена в базе данных' });
      }
      const isTest = robConfig.isTest ? 1 : 0;
      const receiptItemName = robConfig.receiptItemName || 'Виртуальная игровая энергия AiHim';
      const receiptTax = robConfig.receiptTax || 'none';
      const sno = robConfig.sno || '';
      const userEmail = (email || user.email || '').trim();

      const shpEnergy = String(totalEnergy);
      const shpUserId = String(userId);

      const receiptObj = buildRobokassaReceipt(numericPrice, receiptItemName, receiptTax, sno);
      const receiptJson = JSON.stringify(receiptObj);
      const strToHash = `${merchantLogin}:${outSumFormatted}:${invId}:${receiptJson}:${pass1}:Shp_energy=${shpEnergy}:Shp_userId=${shpUserId}`;
      const signature = crypto.createHash('md5').update(strToHash, 'utf8').digest('hex');

      await queryRun(
        'INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          `inv_${invId}`,
          String(userId),
          user.username || `@id${userId}`,
          user.fullName || 'Алхимик',
          totalEnergy,
          numericPrice,
          Date.now(),
          'pending',
          'pay'
        ]
      );

      const description = `Пополнение энергии AiHim (${totalEnergy} AiHim, Пакет ${packageLabel || 'Старт'})`;
      let payUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=${encodeURIComponent(merchantLogin)}&OutSum=${outSumFormatted}&InvId=${invId}&Receipt=${encodeURIComponent(receiptJson)}&Description=${encodeURIComponent(description)}&SignatureValue=${signature}&Shp_energy=${shpEnergy}&Shp_userId=${shpUserId}&Culture=ru`;

      if (userEmail) payUrl += `&Email=${encodeURIComponent(userEmail)}`;
      if (isTest) payUrl += `&IsTest=1`;

      res.json({
        success: true,
        payUrl,
        invId,
        outSum: outSumFormatted,
        totalEnergy,
        receipt: receiptObj,
        isTest
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.all('/api/payments/robokassa/result', async (req, res) => {
    try {
      const params: any = { ...req.query, ...req.body };
      const outSum = params.OutSum || params.out_sum;
      const invId = params.InvId || params.inv_id;
      const signature = (params.SignatureValue || params.crc || '').toString().toLowerCase();
      const shpUserId = params.Shp_userId;
      const shpEnergy = params.Shp_energy;

      if (!outSum || !invId || !signature || !shpUserId || !shpEnergy) {
        return res.status(400).send('ERROR: Missing required Robokassa parameters');
      }

      const robConfig = await getRobokassaConfig();
      const pass2 = robConfig.password2 || process.env.ROBOKASSA_PASS2 || '';
      const strToHash = `${outSum}:${invId}:${pass2}:Shp_energy=${shpEnergy}:Shp_userId=${shpUserId}`;
      const expectedSignature = crypto.createHash('md5').update(strToHash).digest('hex').toLowerCase();

      if (signature !== expectedSignature) {
        return res.status(400).send('ERROR: Invalid MD5 signature');
      }

      const userId = String(shpUserId);
      const energyToAdd = parseInt(String(shpEnergy), 10);

      const updatedRes = await queryRun(
        "UPDATE transactions SET status = 'success' WHERE id = $1 AND LOWER(COALESCE(status, '')) = 'pending' RETURNING *",
        [`inv_${invId}`]
      );
      if (updatedRes.changes > 0) {
        const userObj = await queryGet<any>('SELECT * FROM users WHERE id = $1', [userId]);
        if (userObj) {
          await recalculateUserBalancesFromTransactions(userObj);
        } else {
          await queryRun('UPDATE users SET balance = balance + $1 WHERE id = $2', [energyToAdd, userId]);
        }
      }

      res.send(`OK${invId}`);
    } catch (err) {
      console.error('Robokassa Result URL error:', err);
      res.status(500).send('ERROR: Internal server error processing payment');
    }
  });

  app.get('/api/payments/robokassa/success', async (req, res) => {
    try {
      const invId = req.query.InvId || req.query.inv_id || '';
      if (invId) {
        const updatedRes = await queryRun(
          "UPDATE transactions SET status = 'success' WHERE id = $1 AND LOWER(COALESCE(status, '')) = 'pending' RETURNING *",
          [`inv_${invId}`]
        );
        const tx = updatedRes.rows?.[0];
        if (tx) {
          const userObj = await queryGet<any>('SELECT * FROM users WHERE id = $1', [String(tx.userId)]);
          if (userObj) {
            await recalculateUserBalancesFromTransactions(userObj);
          } else {
            await queryRun('UPDATE users SET balance = balance + $1 WHERE id = $2', [tx.amount, tx.userId]);
          }
        }
      }
      const host = req.get('host');
      const proto = req.get('x-forwarded-proto') || 'https';
      const baseUrl = host ? `${proto}://${host}` : 'https://aihim.ru';
      res.redirect(`${baseUrl}/?payment=success&invId=${invId}`);
    } catch {
      const host = req.get('host');
      const proto = req.get('x-forwarded-proto') || 'https';
      const baseUrl = host ? `${proto}://${host}` : 'https://aihim.ru';
      res.redirect(`${baseUrl}/?payment=success`);
    }
  });

  app.get('/api/payments/robokassa/fail', (req, res) => {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || 'https';
    const baseUrl = host ? `${proto}://${host}` : 'https://aihim.ru';
    res.redirect(`${baseUrl}/?payment=fail`);
  });

  app.post('/api/admin/broadcast/inactive', async (req, res) => {
    try {
      const { daysInactive = 7, force = false } = req.body;
      const result = await sendWeeklyInactiveReminders({ forceAll: force, daysInactive });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/test-send-telegram', async (req, res) => {
    try {
      const { telegramId = '169262990', messageText, buttonText, buttonUrl } = req.body;
      const targetId = String(telegramId || '169262990').trim();
      const botConfig = await getTelegramBotConfig();
      const activeToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';

      if (!messageText || !messageText.trim()) {
        return res.status(400).json({ error: 'Текст сообщения не может быть пустым' });
      }

      const sendRes = await sendTelegramApiMessage({
        chatId: targetId,
        text: messageText.trim(),
        botToken: activeToken,
        replyMarkup: {
          inline_keyboard: [[{ text: buttonText || 'Перейти', url: buttonUrl || 'https://t.me/AI_HimBot/app' }]]
        }
      });

      if (sendRes.ok) {
        res.json({
          success: true,
          message: `Тестовое сообщение успешно отправлено на Telegram ID ${targetId}!`,
          tgResult: sendRes.data || sendRes
        });
      } else {
        res.status(500).json({ error: `Ошибка отправки в Telegram: ${sendRes.errorMsg || sendRes.description}` });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/mass-mail', async (req, res) => {
    try {
      const { messageText, buttonText, buttonUrl, filterType, targetUserIds, userRole } = req.body;
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!messageText || !messageText.trim()) {
        return res.status(400).json({ error: 'Текст сообщения не может быть пустым' });
      }

      let users: any[] = [];
      const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
      const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;

      if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        const placeholders = targetUserIds.map((_: any, i: number) => `$${i + 1}`).join(',');
        const foundUsers = await queryAll<any>(`SELECT * FROM users WHERE id IN (${placeholders})`, targetUserIds.map(String));
        const foundIds = new Set(foundUsers.map(u => String(u.id)));
        users = [...foundUsers];
        for (const tid of targetUserIds) {
          const sId = String(tid);
          if (!foundIds.has(sId)) {
            users.push({ id: sId, fullName: `Пользователь ID: ${sId}`, username: `@id${sId}`, status: 'active' });
          }
        }
      } else if (filterType === 'inactive') {
        users = await queryAll<any>('SELECT * FROM users WHERE lastactive < $1', [sevenDaysAgo]);
      } else if (filterType === 'active') {
        users = await queryAll<any>("SELECT * FROM users WHERE status = 'active'");
      } else if (filterType === 'banned') {
        users = await queryAll<any>("SELECT * FROM users WHERE status = 'banned'");
      } else {
        users = await queryAll<any>('SELECT * FROM users');
      }

      let successCount = 0;
      let errorCount = 0;
      const errorsList: string[] = [];
      const insertedLogs: any[] = [];
      const botCfg = await getTelegramBotConfig();
      const activeBotToken = botCfg?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';

      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const now = Date.now();
        const nextRemAt = now + SEVEN_DAYS_MS;
        const logId = `log_${now}_${u.id}_${Math.random().toString(36).substring(2, 6)}`;
        const chat_id = String(u.id);
        let sentSuccess = false;
        let deliveryError: string | null = null;

        try {
          const sendRes = await sendTelegramApiMessage({
            chatId: chat_id,
            text: messageText.trim(),
            botToken: activeBotToken,
            replyMarkup: {
              inline_keyboard: [[{ text: buttonText || 'Перейти', url: buttonUrl || 'https://t.me/AI_HimBot/app' }]]
            }
          });
          if (sendRes.ok) {
            sentSuccess = true;
          } else {
            const desc = sendRes.description || sendRes.errorMsg || 'Ошибка доставки';
            if (desc.includes('chat not found') || desc.includes('user not found')) {
              deliveryError = `Чат не найден в Telegram (Несуществующий ID: ${chat_id})`;
            } else if (desc.includes('bot was blocked') || desc.includes('blocked')) {
              deliveryError = `Бот заблокирован пользователем (ID: ${chat_id})`;
            } else if (desc.includes('chat deleted')) {
              deliveryError = `Чат удален в Telegram (ID: ${chat_id})`;
            } else {
              deliveryError = desc;
            }
          }
        } catch (tgErr: any) {
          deliveryError = `Ошибка сети при отправке в Telegram: ${tgErr.message}`;
        }

        if (sentSuccess) {
          successCount++;
          await queryRun('UPDATE users SET lastreminderat = $1, nextreminderat = $2 WHERE id = $3', [now, nextRemAt, u.id]);
          const logObj = {
            id: logId, timestamp: now, recipientId: chat_id,
            recipientName: u.fullName || '', recipientUsername: u.username || '',
            messageText: messageText.trim(), status: 'success' as const, errorMsg: null
          };
          await queryRun(
            'INSERT INTO mailing_logs (id, timestamp, recipientid, recipientname, recipientusername, messagetext, status, errormsg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [logObj.id, logObj.timestamp, logObj.recipientId, logObj.recipientName, logObj.recipientUsername, logObj.messageText, logObj.status, logObj.errorMsg]
          );
          insertedLogs.push(logObj);
        } else {
          errorCount++;
          const errMsg = deliveryError || `[Ошибка доставки] ${u.username || u.fullName} (ID: ${u.id})`;
          errorsList.push(errMsg);
          await queryRun("UPDATE users SET lastreminderat = $1, nextreminderat = $2, remindersenabled = 0, status = 'bot_blocked' WHERE id = $3", [now, nextRemAt, u.id]);
          const logObj = {
            id: logId, timestamp: now, recipientId: chat_id,
            recipientName: u.fullName || '', recipientUsername: u.username || '',
            messageText: messageText.trim(), status: 'failed' as const, errorMsg: errMsg
          };
          await queryRun(
            'INSERT INTO mailing_logs (id, timestamp, recipientid, recipientname, recipientusername, messagetext, status, errormsg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [logObj.id, logObj.timestamp, logObj.recipientId, logObj.recipientName, logObj.recipientUsername, logObj.messageText, logObj.status, logObj.errorMsg]
          );
          insertedLogs.push(logObj);
        }

        if (i < users.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      res.json({ success: true, recipientCount: users.length, successCount, errorCount, results: insertedLogs, errors: errorsList });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/send-test-notification', async (req, res) => {
    try {
      const { targetUser = '169262990', message, title, buttonText = 'Открыть Играть', buttonUrl = 'https://t.me/AI_HimBot/app' } = req.body;
      const targetId = String(targetUser || '169262990').trim();
      const fullText = title ? `[ТЕСТ ШАБЛОНА: ${title}]\n\n${message}` : `[ТЕСТОВАЯ РАССЫЛКА]\n\n${message}`;

      const botConfig = await getTelegramBotConfig();
      const activeBotToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
      const sendRes = await sendTelegramApiMessage({
        chatId: targetId,
        text: fullText,
        botToken: activeBotToken,
        replyMarkup: { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
      });

      if (sendRes.ok) {
        res.json({
          success: true,
          message: `Тестовое сообщение успешно отправлено в Telegram (ID: ${targetId})`,
          targetUser: targetId,
          tgResult: sendRes.data || sendRes,
          sentAt: new Date().toISOString()
        });
      } else {
        res.status(500).json({ error: `Ошибка отправки через Telegram API: ${sendRes.errorMsg || sendRes.description}` });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/diagnose-telegram', async (req, res) => {
    const startTime = Date.now();
    const targetChatId = String(req.query.targetChatId || '169262990').trim();
    const botConfig = await getTelegramBotConfig();
    const activeToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    const apiBaseUrl = (botConfig?.apiBaseUrl || process.env.TELEGRAM_API_BASE || 'https://aihim.shishkarnem.workers.dev').trim().replace(/\/+$/, '');
    const maskedToken = activeToken ? `${activeToken.substring(0, 6)}****${activeToken.substring(activeToken.length - 4)}` : 'ОТСУТСТВУЕТ';

    let hostName = 'api.telegram.org';
    try { hostName = new URL(apiBaseUrl).hostname; } catch {}

    let dnsResults: any = null;
    try {
      const lookup = await dns.promises.lookup(hostName, { all: true });
      dnsResults = { host: hostName, addresses: lookup, error: null };
    } catch (dnsErr: any) {
      dnsResults = { host: hostName, addresses: [], error: dnsErr.message || String(dnsErr) };
    }

    let getMeResult: any = null;
    const getMeStart = Date.now();
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const getMeRes = await fetch(`${apiBaseUrl}/bot${activeToken}/getMe`, { signal: controller.signal });
      clearTimeout(tid);
      const getMeData: any = await getMeRes.json().catch(() => ({}));
      getMeResult = {
        ok: getMeRes.ok && getMeData.ok,
        status: getMeRes.status,
        durationMs: Date.now() - getMeStart,
        botInfo: getMeData.result || null,
        description: getMeData.description || null
      };
    } catch (getMeErr: any) {
      getMeResult = {
        ok: false,
        durationMs: Date.now() - getMeStart,
        error: getMeErr.message,
        description: `Ошибка сети при вызове getMe: ${getMeErr.message}`
      };
    }

    let testSendResult: any = null;
    if (targetChatId) {
      const testSendRes = await sendTelegramApiMessage({
        chatId: targetChatId,
        text: `[ДИАГНОСТИКА AIhim]\n\nПроверка отправки сообщений выполнена успешно!\nВремя: ${new Date().toLocaleTimeString('ru-RU')}`,
        botToken: activeToken,
        apiBaseUrl,
        timeoutMs: 10000
      });
      testSendResult = {
        targetChatId,
        ok: testSendRes.ok,
        description: testSendRes.description,
        errorMsg: testSendRes.errorMsg || null,
        data: testSendRes.data || null
      };
    }

    const recentLogs = await queryAll('SELECT * FROM mailing_logs ORDER BY timestamp DESC LIMIT 15');

    res.json({
      success: true,
      timestamp: Date.now(),
      totalDurationMs: Date.now() - startTime,
      config: {
        hasToken: Boolean(activeToken),
        maskedToken,
        apiBaseUrl,
        botUsername: botConfig?.botUsername || '@AI_HimBot'
      },
      dnsLookup: dnsResults,
      getMeTest: getMeResult,
      sendMessageTest: testSendResult,
      recentLogs,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        uptime: Math.floor(process.uptime())
      }
    });
  });
}
