import type express from 'express';
import {
  queryAll,
  queryGet,
  queryRun,
  getDbData,
  saveArcanaLinks,
  saveArcanaConfig,
  savePromptSettings,
  DEFAULT_PROMPT_SETTINGS,
  getSpellsFromDb,
  saveSpellToDb,
  deleteSpellFromDb,
  resetSpellsInDb,
  getProTalkConfig,
  saveProTalkConfig,
  getTelegramBotConfig,
  saveTelegramBotConfig,
  saveRobokassaConfig,
  getReminderTemplatesFromDb,
  saveReminderTemplatesToDb,
  getTransactionType,
  recalculateUserBalancesFromTransactions,
  getAppVersionFromDb,
  saveAppVersionToDb
} from '../../db';

export function registerAdminAndConfigRoutes(app: express.Express) {
  app.get('/api/app-version', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const version = await getAppVersionFromDb();
      res.json({ success: true, version });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/app-version', async (req, res) => {
    try {
      const { version } = req.body || {};
      if (!version || !String(version).trim()) {
        return res.status(400).json({ error: 'Укажите номер версии' });
      }
      const saved = await saveAppVersionToDb(String(version));
      res.json({ success: true, version: saved, message: `Версия приложения обновлена до v${saved}` });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
  app.get('/api/arcana/links', async (req, res) => {
    try {
      const data = await getDbData();
      res.json({ links: data.arcana_links || [] });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/arcana/links', async (req, res) => {
    try {
      const { links } = req.body;
      if (!Array.isArray(links)) {
        return res.status(400).json({ error: 'links must be an array' });
      }
      await saveArcanaLinks(links);
      res.json({ success: true, message: 'Ссылки и Сообщество успешно сохранены' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/arcana/config', async (req, res) => {
    try {
      const data = await getDbData();
      res.json({ config: data.arcana_config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/arcana/config', async (req, res) => {
    try {
      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ error: 'config missing' });
      }
      await saveArcanaConfig(config);
      res.json({ success: true, message: 'Конфигурация арканов и калькуляции успешно сохранена' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/spells', async (req, res) => {
    try {
      const spells = await getSpellsFromDb();
      res.json({ spells });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/spells', async (req, res) => {
    try {
      const spell = req.body;
      if (!spell || !spell.id || !spell.name) {
        return res.status(400).json({ error: 'Missing required spell parameters' });
      }
      await saveSpellToDb(spell);
      res.json({ success: true, message: 'Заклинание успешно сохранено в базе данных' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/spells/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteSpellFromDb(id);
      res.json({ success: true, message: 'Заклинание успешно удалено из базы данных' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/spells/reset', async (req, res) => {
    try {
      const spells = await resetSpellsInDb();
      res.json({ success: true, spells, message: 'Базовые заклинания успешно восстановлены в базе данных' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/reminder-templates', async (req, res) => {
    try {
      const templates = await getReminderTemplatesFromDb();
      res.json({ templates });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/reminder-templates', async (req, res) => {
    try {
      const { templates } = req.body;
      if (!Array.isArray(templates)) {
        return res.status(400).json({ error: 'templates must be an array' });
      }
      await saveReminderTemplatesToDb(templates);
      res.json({ success: true, message: 'Шаблоны напоминаний успешно сохранены в БД', templates });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/prompt-settings', async (req, res) => {
    try {
      const data = await getDbData();
      const ps = data.prompt_settings || DEFAULT_PROMPT_SETTINGS;
      if (!ps.id) ps.id = 'default';
      res.json({
        success: true,
        elementPrompt: ps.elementPrompt,
        systemPrompt: ps.systemPrompt,
        settings: ps
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/prompt-settings', async (req, res) => {
    try {
      const { elementPrompt, systemPrompt } = req.body;
      await savePromptSettings({
        id: 'default',
        elementPrompt: elementPrompt || '',
        systemPrompt: systemPrompt || ''
      });
      res.json({ success: true, message: 'Промпты ИИ-трансмутации и бота успешно сохранены' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const handleGetBotSettings = async (req: express.Request, res: express.Response) => {
    try {
      const config = await getTelegramBotConfig();
      res.json({ config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  const handlePostBotSettings = async (req: express.Request, res: express.Response) => {
    try {
      const config = req.body;
      await saveTelegramBotConfig(config);
      if (config.robokassaMerchantLogin !== undefined || config.robokassaPass1 !== undefined || config.robokassaReceiptItemName !== undefined) {
        await saveRobokassaConfig({
          merchantLogin: config.robokassaMerchantLogin,
          password1: config.robokassaPass1,
          password2: config.robokassaPass2,
          isTest: config.robokassaIsTest,
          receiptItemName: config.robokassaReceiptItemName,
          receiptTax: config.robokassaReceiptTax
        });
      }
      res.json({ success: true, message: 'Настройки Telegram Бота и HASH сохранены в БД', config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  };

  app.get('/api/admin/bot-settings', handleGetBotSettings);
  app.get('/api/admin/telegram-bot-config', handleGetBotSettings);
  app.post('/api/admin/bot-settings', handlePostBotSettings);
  app.post('/api/admin/telegram-bot-config', handlePostBotSettings);

  app.get('/api/admin/protalk-config', async (req, res) => {
    try {
      const config = await getProTalkConfig();
      res.json({ config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/protalk-config', async (req, res) => {
    try {
      const { botId, botToken, apiUrl } = req.body;
      const current = await getProTalkConfig();
      const config = {
        botId: (botId !== undefined && botId !== '') ? String(botId) : (current.botId || process.env.PROTALK_BOT_ID || ''),
        botToken: (botToken !== undefined && botToken !== '') ? String(botToken) : (current.botToken || process.env.PROTALK_BOT_TOKEN || ''),
        apiUrl: apiUrl || current.apiUrl || 'https://eu1.api.pro-talk.ru/api/v1.0'
      };
      await saveProTalkConfig(config);
      res.json({ success: true, message: 'Настройки ProTalk (Bot Token & Bot ID) успешно сохранены в базе данных', config });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/protalk/restart', async (req, res) => {
    try {
      const { userId, telegramId } = req.body;
      const pConfig = await getProTalkConfig();
      const activeBotId = Number(pConfig.botId || process.env.PROTALK_BOT_ID || 71164);
      const activeBotToken = pConfig.botToken || process.env.PROTALK_BOT_TOKEN || '';
      const activeApiUrl = (pConfig.apiUrl || 'https://eu1.api.pro-talk.ru/api/v1.0').replace(/\/$/, '');

      const activeChatId = String(telegramId || userId || `guest_${Date.now()}`);

      const sendRes = await fetch(`${activeApiUrl}/send_message_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: activeBotId,
          bot_token: activeBotToken,
          bot_chat_id: activeChatId,
          chat_id: activeChatId,
          user_id: activeChatId,
          telegram_id: activeChatId,
          message: '/restart'
        })
      });

      if (!sendRes.ok) {
        throw new Error(`Failed to send /restart command to ProTalk: ${sendRes.statusText}`);
      }

      const TIMEOUT_MS = 25000;
      const POLL_INTERVAL_MS = 2000;
      const start = Date.now();
      let replyMessage = null;

      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const pollRes = await fetch(`${activeApiUrl}/get_last_reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bot_id: activeBotId,
              bot_token: activeBotToken,
              bot_chat_id: activeChatId,
              chat_id: activeChatId,
              user_id: activeChatId,
              telegram_id: activeChatId
            })
          });

          if (pollRes.ok) {
            const pollData: any = await pollRes.json();
            if (pollData && (pollData.message || pollData.reply)) {
              replyMessage = pollData.message || pollData.reply;
              break;
            }
          }
        } catch {}
      }

      res.json({ success: true, message: 'Команда /restart успешно отправлена в ProTalk', replyMessage });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/ai-logs', async (req, res) => {
    try {
      const logs = await queryAll<any>('SELECT * FROM ai_logs ORDER BY timestamp DESC LIMIT 300');
      res.json({ success: true, logs });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/ai-logs', async (req, res) => {
    try {
      const { id, userId, username, elementA, elementB, layer, tokensUsed, costRub, timestamp, status, prompt, response } = req.body;
      const logId = id || `LOG-${Date.now()}`;
      const now = timestamp || Date.now();
      const TOKEN_COST_RATIO = 300 / 10000000;
      const tokens = Number(tokensUsed) || 0;
      const cost = costRub !== undefined ? Number(costRub) : tokens * TOKEN_COST_RATIO;

      await queryRun(
        `INSERT INTO ai_logs (id, userid, username, elementa, elementb, layer, tokensused, costrub, timestamp, status, prompt, response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, response = EXCLUDED.response`,
        [logId, String(userId || 'guest_demo'), username || '@demo_guest', elementA || 'Огонь', elementB || 'Вода', Number(layer) || 1, tokens, cost, now, status || 'success', prompt || '', response || '']
      );

      const logs = await queryAll<any>('SELECT * FROM ai_logs ORDER BY timestamp DESC LIMIT 300');
      res.json({ success: true, logs });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/transactions', async (req, res) => {
    try {
      const transactions = await queryAll<any>('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 300');
      res.json({ success: true, transactions });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/transactions', async (req, res) => {
    try {
      const { id, userId, username, fullName, amount, price, timestamp, status, type, reason, comment } = req.body;
      const txId = id || `TX-${Date.now()}`;
      const now = timestamp || Date.now();
      const numAmount = Number(amount) || 0;
      const txType = type || getTransactionType({ id: txId, price });
      const reasonVal = reason || comment || null;

      const existingTx = await queryGet<any>('SELECT status, tg_notified FROM transactions WHERE id = $1', [txId]);
      const alreadyCompleted =
        existingTx &&
        (String(existingTx.status).toLowerCase() === 'success' || String(existingTx.status).toLowerCase() === 'completed');

      await queryRun(
        `INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, amount = EXCLUDED.amount, price = EXCLUDED.price, reason = EXCLUDED.reason`,
        [txId, String(userId), username || '', fullName || 'Алхимик', numAmount, Number(price) || 0, now, status || 'success', txType, reasonVal],
        { skipTxNotify: Boolean(alreadyCompleted || existingTx?.tg_notified) }
      );

      const userObj = await queryGet<any>('SELECT * FROM users WHERE id = $1', [String(userId)]);
      if (userObj) {
        await recalculateUserBalancesFromTransactions(userObj);
      }

      const transactions = await queryAll<any>('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 300');
      res.json({ success: true, transactions });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/mailing-logs', async (req, res) => {
    try {
      const logs = await queryAll<any>('SELECT * FROM mailing_logs ORDER BY timestamp DESC');
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/mailing-logs', async (req, res) => {
    try {
      const { id, timestamp, recipientId, recipientName, recipientUsername, messageText, status, errorMsg } = req.body;
      if (!recipientId || !messageText) {
        return res.status(400).json({ error: 'Missing recipientId or messageText' });
      }
      const logId = id || `log_${Date.now()}_${recipientId}_${Math.random().toString(36).substring(2, 6)}`;
      const now = timestamp || Date.now();
      await queryRun(
        'INSERT INTO mailing_logs (id, timestamp, recipientid, recipientname, recipientusername, messagetext, status, errormsg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [logId, now, String(recipientId), recipientName || '', recipientUsername || '', messageText, status || 'success', errorMsg || null]
      );
      res.json({ success: true, id: logId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/admin/toggle-reminders', async (req, res) => {
    try {
      const { userId, remindersEnabled } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await queryRun('UPDATE users SET remindersenabled = $1 WHERE id = $2', [remindersEnabled ? 1 : 0, String(userId)]);
      res.json({ success: true, message: 'Настройки напоминаний обновлены' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
