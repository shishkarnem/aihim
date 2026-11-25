import type express from 'express';
import crypto from 'crypto';
import {
  queryAll,
  queryGet,
  queryRun,
  getSpellsFromDb,
  getProTalkConfig,
  getTelegramBotConfig,
  seedBasicElementsForUser,
  recalculateUserBalancesFromTransactions
} from '../../db';

function verifyTelegramWebAppData(telegramInitData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get('hash');
    if (!hash || !botToken) return false;

    urlParams.delete('hash');
    const dataCheckArr: string[] = [];
    for (const [key, val] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${val}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (err) {
    console.error('Telegram hash verification error:', err);
    return false;
  }
}

function parseJSONFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        return JSON.parse(text.substring(startIdx, endIdx + 1));
      } catch {}
    }
    throw new Error('Could not parse JSON from ProTalk response: ' + text);
  }
}

async function getOrCreateReferrer(cleanRefId: string | null) {
  if (!cleanRefId || cleanRefId === 'null' || cleanRefId.trim() === '') return null;
  const refId = cleanRefId.trim();
  let referrer = await queryGet<any>('SELECT * FROM users WHERE id = $1', [refId]);
  if (!referrer) {
    const isGodAdmin = refId === '169262990';
    const role = isGodAdmin ? 'admin' : 'user';
    const fullName = isGodAdmin ? 'Dr.White' : 'Алхимик Наставник';
    const username = isGodAdmin ? '@shishkarnem' : `@id${refId}`;
    const avatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop';
    const initialBal = isGodAdmin ? 5000000 : 1000;
    const level = isGodAdmin ? 10 : 1;
    const now = Date.now();
    const formattedActiveDate = new Date(now + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    try {
      await queryRun(
        'INSERT INTO users (id, username, fullname, avatar, role, balance, discoveredcount, status, level, registrationdate, lastactive, lastactivedate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING',
        [refId, username, fullName, avatar, role, initialBal, 8, 'active', level, now, now, formattedActiveDate]
      );
      await seedBasicElementsForUser(refId);
      referrer = await queryGet<any>('SELECT * FROM users WHERE id = $1', [refId]);
    } catch (e) {
      console.error('[Referral] Error auto-creating referrer user:', e);
    }
  }
  return referrer;
}

async function processReferralLink(referredUserId: string, referrerId: string) {
  if (!referredUserId || !referrerId || String(referredUserId) === String(referrerId)) return null;

  const referredUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [referredUserId]);
  if (!referredUser) return null;

  const referrer = await getOrCreateReferrer(referrerId);
  if (!referrer) return null;

  const refUsername = referrer.username || `@id${referrer.id}`;
  if (String(referredUser.referredById) !== String(referrer.id) || referredUser.referredByUsername !== refUsername) {
    await queryRun('UPDATE users SET referredbyid = $1, referredbyusername = $2 WHERE id = $3', [
      referrer.id,
      refUsername,
      referredUserId
    ]);
  }

  const txId = `TX-REF-${referrer.id}-${referredUserId}`;
  const existingTx = await queryGet<any>('SELECT * FROM transactions WHERE id = $1', [txId]);
  if (existingTx) return referrer;

  const referrerLevel = referrer.level || 1;
  const bonus = 100000 * referrerLevel;

  await queryRun(
    'INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [txId, referrer.id, refUsername, referrer.fullName || 'Алхимик', bonus, 0, Date.now(), 'success', 'ref']
  );

  const refObj = await queryGet<any>('SELECT * FROM users WHERE id = $1', [referrer.id]);
  if (refObj) {
    await recalculateUserBalancesFromTransactions(refObj);
  }
  return referrer;
}

export function registerUsersAndElementsRoutes(app: express.Express) {
  app.get('/api/users', async (req, res) => {
    try {
      const users = await queryAll<any>('SELECT * FROM users');
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      let user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      if (!user) {
        const isGodAdmin = id === '169262990';
        const fullName = isGodAdmin ? 'Dr.White' : 'Алхимик Telegram';
        const username = isGodAdmin ? '@shishkarnem' : `@id${id}`;
        const avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop';
        const role = isGodAdmin ? 'admin' : 'user';
        const level = isGodAdmin ? 10 : 1;
        const now = Date.now();
        const formattedActiveDate = new Date(now + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await queryRun(
          'INSERT INTO users (id, username, fullname, avatar, role, balance, discoveredcount, status, level, registrationdate, lastactive, lastactivedate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [id, username, fullName, avatar, role, 1000, 8, 'active', level, now, now, formattedActiveDate]
        );
        await seedBasicElementsForUser(id);
        user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      }

      const isLite = req.query.lite === '1' || req.query.lite === 'true';
      if (isLite) {
        const knownCount = req.query.knownCount !== undefined ? Number(req.query.knownCount) : -1;
        const countRes = await queryGet<{ count: number }>(
          'SELECT COUNT(*) as count FROM discovered_elements WHERE userid = $1',
          [id]
        );
        const dbCount = Number(countRes?.count || 0);
        let elements: any[] | undefined;
        if (dbCount === 0) {
          await seedBasicElementsForUser(id);
          elements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]);
        } else if (knownCount >= 0 && dbCount !== knownCount) {
          elements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]);
        }
        return res.json({ user, elements, elementsCount: dbCount });
      }

      let [elements, referrals, userTransactions, userAiLogs] = await Promise.all([
        queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]),
        queryAll<any>('SELECT * FROM users WHERE referredbyid = $1 AND id <> $1', [id]),
        queryAll<any>('SELECT * FROM transactions WHERE userid = $1 ORDER BY timestamp DESC', [id]),
        queryAll<any>('SELECT * FROM ai_logs WHERE userid = $1 ORDER BY timestamp DESC LIMIT 100', [id])
      ]);

      if (elements.length === 0) {
        await seedBasicElementsForUser(id);
        elements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]);
      }

      const referrer =
        user.referredById && String(user.referredById) !== String(id)
          ? await getOrCreateReferrer(String(user.referredById))
          : null;

      let needsRefresh = false;
      const hasStartBonus = userTransactions.some((t: any) => t.id && String(t.id).includes('START'));
      if (!hasStartBonus && user.registrationDate) {
        const startTxId = `TX-START-${id}`;
        await queryRun(
          'INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type, tg_notified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE) ON CONFLICT (id) DO NOTHING',
          [startTxId, id, user.username || `@id${id}`, user.fullName || 'Алхимик', 1000, 0, user.registrationDate || Date.now() - 86400000, 'success', 'start'],
          { skipTxNotify: true }
        );
        needsRefresh = true;
      }

      const existingTxIds = new Set(userTransactions.map((t: any) => String(t.id)));
      for (const refUser of referrals) {
        const expectedTxId = `TX-REF-${id}-${refUser.id}`;
        if (!existingTxIds.has(expectedTxId) || !refUser.referredByUsername) {
          await processReferralLink(refUser.id, id);
          needsRefresh = true;
        }
      }

      if (needsRefresh) {
        [user, userTransactions] = await Promise.all([
          queryGet<any>('SELECT * FROM users WHERE id = $1', [id]),
          queryAll<any>('SELECT * FROM transactions WHERE userid = $1 ORDER BY timestamp DESC', [id])
        ]);
      }

      res.json({ user, elements, referrals, referrer, transactions: userTransactions, aiLogs: userAiLogs });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Missing user ID' });

      await queryRun('DELETE FROM users WHERE id = $1', [id]);
      await queryRun('DELETE FROM discovered_elements WHERE userid = $1', [id]);
      await queryRun('DELETE FROM transactions WHERE userid = $1', [id]);
      await queryRun('DELETE FROM ai_logs WHERE userid = $1', [id]);
      await queryRun('DELETE FROM mailing_logs WHERE recipientid = $1', [id]);

      res.json({ success: true, message: `Пользователь ${id} и все его элементы успешно удалены из БД` });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/:id/reset-universe', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'Missing user ID' });

      await queryRun('DELETE FROM discovered_elements WHERE userid = $1', [id]);
      await seedBasicElementsForUser(id);
      await queryRun('UPDATE users SET discoveredcount = 8, level = 1 WHERE id = $1', [id]);

      const elements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]);
      res.json({ success: true, message: 'Вселенная пользователя успешно сброшена до базовых 8 элементов', elements });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/login-email', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Введите адрес почты и пароль' });
      }

      const cleanInput = String(email).trim().toLowerCase();
      const cleanPassword = String(password).trim();
      const users = await queryAll<any>('SELECT * FROM users');

      const user = users.find((u: any) => {
        const uEmail = u.email ? String(u.email).trim().toLowerCase() : '';
        const uUsername = u.username ? String(u.username).trim().toLowerCase().replace(/^@/, '') : '';
        const uId = String(u.id || '').trim();
        const inputClean = cleanInput.replace(/^@/, '');
        const matchesIdentifier = uEmail === cleanInput || uUsername === inputClean || uId === cleanInput;
        const matchesPass = String(u.password || '').trim() === cleanPassword;
        return matchesIdentifier && matchesPass;
      });

      if (!user) {
        return res.status(401).json({
          error: 'Пользователь с такой почтой и паролем не найден. Проверьте правильность ввода почты и пароля.'
        });
      }

      await seedBasicElementsForUser(user.id);
      const elements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [user.id]);
      res.json({ success: true, user, elements });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/update-credentials', async (req, res) => {
    try {
      const { userId, email, password } = req.body;
      if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });
      if (!email || !password) return res.status(400).json({ error: 'Введите почту и пароль' });

      const strId = String(userId);
      const cleanEmail = String(email).trim().toLowerCase();

      const user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [strId]);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден в базе данных' });
      }

      const allUsers = await queryAll<any>('SELECT * FROM users');
      const existingOwner = allUsers.find(
        (u: any) => String(u.id) !== strId && u.email && String(u.email).trim().toLowerCase() === cleanEmail
      );

      if (existingOwner) {
        return res.status(400).json({ error: 'Пользователь с такой почтой уже существует' });
      }

      await queryRun('UPDATE users SET email = $1, password = $2 WHERE id = $3', [cleanEmail, String(password), strId]);
      const updatedUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [strId]);

      res.json({ success: true, message: 'Почта и пароль успешно привязаны для входа с сайта aihim.ru', user: updatedUser });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/telegram-login', async (req, res) => {
    try {
      const { id, username, first_name, last_name, photo_url, startParam, initData } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing Telegram user ID' });

      if (initData) {
        const botConfig = await getTelegramBotConfig();
        const activeToken = botConfig?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
        const isValidHash = verifyTelegramWebAppData(initData, activeToken);
        console.log(`[Telegram Auth] HMAC SHA-256 verification for user ${id}: ${isValidHash}`);
      }

      const strId = String(id);
      let user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [strId]);
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'Алхимик Telegram';
      const formattedUsername = username ? (username.startsWith('@') ? username : `@${username}`) : `@id${strId}`;
      const avatar = photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop';
      const cleanRefId = startParam ? String(startParam).replace(/^ref_?|^user_?/i, '').trim() : null;
      const now = Date.now();

      if (user) {
        await queryRun(
          "UPDATE users SET fullname = $1, username = $2, avatar = $3, status = 'active', lastactive = $4, lastloginat = $5, updatedat = $6 WHERE id = $7",
          [fullName, formattedUsername, avatar, now, String(now), String(now), strId]
        );
        await queryRun(
          'UPDATE transactions SET username = $1, fullname = $2 WHERE CAST(userid AS TEXT) = $3',
          [formattedUsername, fullName, strId],
          { skipTxNotify: true }
        );
        if (cleanRefId && cleanRefId !== strId) {
          await processReferralLink(strId, cleanRefId);
        }
        await seedBasicElementsForUser(strId);
        user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [strId]);
      } else {
        const role = strId === '169262990' ? 'admin' : 'user';
        await queryRun(
          "INSERT INTO users (id, username, fullname, avatar, role, balance, discoveredcount, status, level, registrationdate, lastactive, lastloginat, updatedat) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING",
          [strId, formattedUsername, fullName, avatar, role, 1000, 8, 1, now, now, String(now), String(now)]
        );
        await queryRun(
          "INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', 'start') ON CONFLICT (id) DO NOTHING",
          [`TX-START-${strId}`, strId, formattedUsername, fullName, 1000, 0, now]
        );
        if (cleanRefId && cleanRefId !== strId) {
          await processReferralLink(strId, cleanRefId);
        }
        await seedBasicElementsForUser(strId);
        user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [strId]);
      }

      let referrerUser = null;
      if (user && user.referredById) {
        referrerUser = await getOrCreateReferrer(String(user.referredById));
      }

      res.json({ success: true, user, referrer: referrerUser });
    } catch (err) {
      console.error('[Telegram Login Error]', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/:id/sync', async (req, res) => {
    try {
      const { id } = req.params;
      const { balance, deltaBalance, discoveredCount, role, status, fullName, username, avatar, referredById, startParam, elements = [] } = req.body;

      let existingUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      const paramRef = startParam || referredById;
      const cleanRefId = paramRef ? String(paramRef).replace(/^ref_?|^user_?/i, '').trim() : null;

      if (existingUser) {
        const targetFullName = fullName && !fullName.includes('COALESCE') ? fullName : existingUser.fullName;
        const targetUsername = username && !username.includes('COALESCE') ? username : existingUser.username;
        const targetAvatar = avatar || existingUser.avatar;

        if (cleanRefId && cleanRefId !== id) {
          await processReferralLink(id, cleanRefId);
          existingUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
        }

        existingUser = await recalculateUserBalancesFromTransactions(existingUser);
        const finalStatus = (existingUser.status === 'banned' || status === 'banned') ? 'active' : (status || existingUser.status || 'active');

        const adminDelta = req.body.adminDelta !== undefined ? Number(req.body.adminDelta) : 0;
        const adminReason = req.body.adminReason || req.body.reason || 'Корректировка администратором';
        if (adminDelta !== 0) {
          const nowTs = Date.now();
          await queryRun(
            "INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', 'admin', $8)",
            [`TX-ADMIN-${nowTs}-${Math.floor(Math.random() * 10000)}`, String(id), targetUsername, targetFullName, adminDelta, 0, nowTs, adminReason]
          );
          existingUser = await recalculateUserBalancesFromTransactions(existingUser);
        } else if (req.body.overrideBalance === true && balance !== undefined && !isNaN(Number(balance))) {
          const currentTotal = (Number(existingUser.balance_start) || 0) + (Number(existingUser.balance_time) || 0) + (Number(existingUser.balance_ref) || 0) + (Number(existingUser.balance_pay) || 0) + (Number(existingUser.balance_admin) || 0);
          const diff = Number(balance) - currentTotal;
          if (diff !== 0) {
            const nowTs = Date.now();
            await queryRun(
              "INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', 'admin', $8)",
              [`TX-ADMIN-${nowTs}-${Math.floor(Math.random() * 10000)}`, String(id), targetUsername, targetFullName, diff, 0, nowTs, adminReason]
            );
            existingUser = await recalculateUserBalancesFromTransactions(existingUser);
          }
        }

        let targetBalanceTime = Number(existingUser.balance_time) || 0;
        if (deltaBalance !== undefined && !isNaN(Number(deltaBalance)) && Number(deltaBalance) !== 0) {
          targetBalanceTime += Number(deltaBalance);
        }

        const targetBalanceStart = Number(existingUser.balance_start) || 0;
        const targetBalanceRef = Number(existingUser.balance_ref) || 0;
        const targetBalancePay = Number(existingUser.balance_pay) || 0;
        const targetBalanceAdmin = Number(existingUser.balance_admin) || 0;
        const targetBalance = targetBalanceStart + targetBalanceTime + targetBalanceRef + targetBalancePay + targetBalanceAdmin;

        const nowTs = Date.now();
        const formattedActiveDate = new Date(nowTs).toISOString().replace('T', ' ').substring(0, 19);
        const calcDiscovered = elements && Array.isArray(elements) && elements.length > 0 ? elements.length : (discoveredCount ?? existingUser.discoveredCount ?? 8);
        const calcLevel = Math.max(1, Math.floor(calcDiscovered / 10) + 1);

        await queryRun(
          'UPDATE users SET balance = $1, balance_start = $2, balance_time = $3, balance_ref = $4, balance_pay = $5, balance_admin = $6, discoveredcount = $7, level = $8, role = $9, status = $10, fullname = $11, username = $12, avatar = $13, lastactive = $14, lastactivedate = $15 WHERE id = $16',
          [targetBalance, targetBalanceStart, targetBalanceTime, targetBalanceRef, targetBalancePay, targetBalanceAdmin, calcDiscovered, calcLevel, role ?? existingUser.role, finalStatus, targetFullName, targetUsername, targetAvatar, nowTs, formattedActiveDate, id]
        );
        if (targetUsername !== existingUser.username || targetFullName !== existingUser.fullName) {
          await queryRun(
            'UPDATE transactions SET username = $1, fullname = $2 WHERE CAST(userid AS TEXT) = $3',
            [targetUsername, targetFullName, id],
            { skipTxNotify: true }
          );
        }
      } else {
        const now = Date.now();
        const formattedActiveDate = new Date(now).toISOString().replace('T', ' ').substring(0, 19);
        const initDiscovered = discoveredCount ?? 8;
        const initLevel = Math.max(1, Math.floor(initDiscovered / 10) + 1);
        const initStart = req.body.balance_start !== undefined ? Number(req.body.balance_start) : 1000;
        const initTime = req.body.balance_time ? Number(req.body.balance_time) : 0;
        const initRef = req.body.balance_ref ? Number(req.body.balance_ref) : 0;
        const initPay = req.body.balance_pay ? Number(req.body.balance_pay) : 0;
        const initAdmin = req.body.balance_admin ? Number(req.body.balance_admin) : 0;
        const initBalance = initStart + initTime + initRef + initPay + initAdmin;

        await queryRun(
          'INSERT INTO users (id, username, fullname, avatar, role, balance, balance_start, balance_time, balance_ref, balance_pay, balance_admin, discoveredcount, status, level, registrationdate, lastactive, lastactivedate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT (id) DO NOTHING',
          [
            id,
            username || `@user_${id}`,
            fullName || 'Алхимик',
            avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
            role || 'user',
            initBalance, initStart, initTime, initRef, initPay, initAdmin,
            initDiscovered, status || 'active', initLevel, now, now, formattedActiveDate
          ]
        );

        await queryRun(
          "INSERT INTO transactions (id, userid, username, fullname, amount, price, timestamp, status, type) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', 'start') ON CONFLICT (id) DO NOTHING",
          [`TX-START-${id}`, id, username || `@user_${id}`, fullName || 'Алхимик', 1000, 0, now]
        );
        await seedBasicElementsForUser(id);
        if (cleanRefId && cleanRefId !== id) {
          await processReferralLink(id, cleanRefId);
        }
      }

      if (elements && Array.isArray(elements) && elements.length > 0) {
        const dedupedMap = new Map<string, any>();
        for (const el of elements) {
          if (el && el.id && el.name) {
            dedupedMap.set(String(el.id), el);
          }
        }
        const uniqueIncoming = Array.from(dedupedMap.values());
        const CHUNK_SIZE = 40;
        for (let i = 0; i < uniqueIncoming.length; i += CHUNK_SIZE) {
          const chunk = uniqueIncoming.slice(i, i + CHUNK_SIZE);
          const values: any[] = [];
          const rowPlaceholders: string[] = [];
          let idx = 1;
          for (const el of chunk) {
            rowPlaceholders.push(
              `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++})`
            );
            values.push(
              el.id,
              id,
              el.name,
              el.description || '',
              el.icon || '',
              el.rarity || 'Обычный',
              el.type || 'Материя',
              el.state || 'Твердое',
              el.complexity || 1,
              el.parents ? JSON.stringify(el.parents) : null,
              el.discoveredAt || Date.now(),
              el.isMutation ? 1 : 0,
              el.temperature ?? 0,
              el.targetTemperature ?? 0,
              el.stability ?? 100,
              el.essences ? JSON.stringify(el.essences) : '[]',
              el.realityLevel ?? 1,
              el.isFavorite ? 1 : 0
            );
          }
          await queryRun(
            `INSERT INTO discovered_elements (
              id, userid, name, description, icon, rarity, type, state, complexity, parents, discoveredat, ismutation, temperature, targettemperature, stability, essences, realitylevel, isfavorite
            ) VALUES ${rowPlaceholders.join(', ')}
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              icon = EXCLUDED.icon,
              rarity = EXCLUDED.rarity,
              type = EXCLUDED.type,
              state = EXCLUDED.state,
              complexity = EXCLUDED.complexity,
              parents = EXCLUDED.parents,
              temperature = EXCLUDED.temperature,
              targettemperature = EXCLUDED.targettemperature,
              stability = EXCLUDED.stability,
              essences = EXCLUDED.essences,
              realitylevel = EXCLUDED.realitylevel,
              isfavorite = EXCLUDED.isfavorite`,
            values
          );
        }
      }

      if (req.body.lightweight === true && (!elements || elements.length === 0)) {
        const finalUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
        return res.json({ success: true, message: 'User synced successfully!', user: finalUser });
      }

      const allUserElements = await queryAll<any>('SELECT * FROM discovered_elements WHERE userid = $1', [id]);
      const realDiscoveredCount = allUserElements.length;
      const realLevel = Math.max(1, Math.floor(realDiscoveredCount / 10) + 1);
      await queryRun('UPDATE users SET discoveredcount = $1, level = $2 WHERE id = $3', [realDiscoveredCount, realLevel, id]);

      const finalUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      res.json({ success: true, message: 'User synced successfully!', user: finalUser, elements: allUserElements });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/users/:id/timer-bonus', async (req, res) => {
    try {
      const { id } = req.params;
      const user = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const calcDiscovered = user.discoveredCount || 8;
      const calcLevel = user.level || (Math.floor(calcDiscovered / 10) + 1);
      const bonus = 10 * calcLevel;
      const newTime = (user.balance_time ?? 0) + bonus;
      const bStart = user.balance_start ?? 1000;
      const bRef = user.balance_ref ?? 0;
      const bPay = user.balance_pay ?? 0;
      const bAdmin = user.balance_admin ?? 0;
      const newTotalBalance = bStart + newTime + bRef + bPay + bAdmin;

      const nowTs = Date.now();
      const formattedActiveDate = new Date(nowTs).toISOString().replace('T', ' ').substring(0, 19);

      await queryRun(
        'UPDATE users SET balance = $1, balance_time = $2, lastactive = $3, lastactivedate = $4 WHERE id = $5',
        [newTotalBalance, newTime, nowTs, formattedActiveDate, id]
      );

      const updatedUser = await queryGet<any>('SELECT * FROM users WHERE id = $1', [id]);
      res.json({ success: true, user: updatedUser, addedBonus: bonus });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/generate-element', async (req, res) => {
    try {
      const {
        elementA,
        elementB,
        existingElements,
        worldPhase,
        discoveredLaws,
        currentLayer,
        availableLayers,
        spells = [],
        userId
      } = req.body;

      if (userId && userId !== 'guest_demo') {
        queryRun('UPDATE users SET lastactive = $1 WHERE id = $2', [Date.now(), userId]).catch(() => {});
      }

      const RARITIES = [
        'Обычный', 'Редкий', 'Эпический', 'Легендарный', 'Мифический',
        'Божественный', 'Вечный', 'Космический', 'Изначальный', 'Трансцендентный', 'Запретный'
      ];

      const idxA = RARITIES.indexOf(elementA.rarity || 'Обычный');
      const idxB = RARITIES.indexOf(elementB.rarity || 'Обычный');

      let targetRarityIndex = 0;
      if (idxA === idxB) {
        const rand = Math.random();
        if (rand < 0.35) targetRarityIndex = idxA + 1;
        else if (rand < 0.90) targetRarityIndex = idxA;
        else targetRarityIndex = Math.max(0, idxA - 1);
      } else {
        const maxIdx = Math.max(idxA, idxB);
        const minIdx = Math.min(idxA, idxB);
        const rand = Math.random();
        if (rand < 0.60) targetRarityIndex = maxIdx;
        else if (rand < 0.90) targetRarityIndex = Math.round((maxIdx + minIdx) / 2);
        else targetRarityIndex = maxIdx + 1;
      }

      targetRarityIndex = Math.max(0, Math.min(RARITIES.length - 1, targetRarityIndex));
      let targetRarity = RARITIES[targetRarityIndex];

      const hasAnomaly = elementA.type === 'Аномалия' || elementB.type === 'Аномалия';
      if (targetRarity === 'Запретный' && !hasAnomaly) {
        targetRarity = 'Трансцендентный';
      }

      const mutationProbability = hasAnomaly ? 0.25 : 0.08;
      const isMutation = Math.random() < mutationProbability;

      const dbSpells = await getSpellsFromDb();
      const detailedSpells = (spells || []).map((spellName: string) => {
        const found = dbSpells.find(s => s.name.toLowerCase() === spellName.trim().toLowerCase());
        if (found) {
          return `- Заклинание: "${found.name}" (Перевод: ${found.translation})\n    * Описание действия: ${found.description}\n    * Алхимическая категория: ${found.category}`;
        }
        return `- Заклинание: "${spellName}"`;
      });

      const existingNamesList = Array.isArray(existingElements)
        ? existingElements.map((e: any) => e?.name).filter(Boolean)
        : [];
      const existingNamesStr = existingNamesList.join(', ');

      const prompt = `
[Данные для трансмутации]
- Фаза мира: ${worldPhase === 'day' ? 'ДЕНЬ' : 'НОЧЬ'}
- Текущий слой реальности: ${currentLayer ? `${currentLayer.level} - ${currentLayer.name}` : '1 - Физический'}
- Правила слоя: ${currentLayer ? currentLayer.rules : 'Базовые законы материи.'}
- Доступные слои для открытия: ${availableLayers?.map((l: any) => `${l.level} - ${l.name}`).join(', ') || '1 - Физический'}

- Открытые законы мироздания:
${discoveredLaws && discoveredLaws.length > 0
  ? discoveredLaws.map((l: any) => `  * ${l.name}: ${l.detail}`).join('\n')
  : '  * Законы еще не познаны.'}

- Ингредиент 1: ${elementA.name}
  * Редкость: ${elementA.rarity}
  * Тип: ${elementA.type}
  * Состояние: ${elementA.state}
  * Температура: ${elementA.temperature}°C (Требуемая: ${elementA.targetTemperature}°C)
  * Стабильность: ${elementA.stability}%
  * Сущности: ${elementA.essences?.join(', ') || 'нет'}
  * Слой: ${elementA.realityLevel}

- Ингредиент 2: ${elementB.name}
  * Редкость: ${elementB.rarity}
  * Тип: ${elementB.type}
  * Состояние: ${elementB.state}
  * Температура: ${elementB.temperature}°C (Требуемая: ${elementB.targetTemperature}°C)
  * Стабильность: ${elementB.stability}%
  * Сущности: ${elementB.essences?.join(', ') || 'нет'}
  * Слой: ${elementB.realityLevel}

[УЖЕ ОТКРЫТЫЕ ЭЛЕМЕНТЫ ПОЛЬЗОВАТЕЛЯ - КАТЕГОРИЧЕСКИ НЕ СОЗДАВАТЬ ПОВТОРНО!]
Список названий элементов, которые уже открыты у данного игрока (${existingNamesList.length} шт.):
[${existingNamesStr || 'Базовые первоэлементы'}]

ПРАВИЛА УНИКАЛЬНОСТИ НАЗВАНИЙ И СОЗДАНИЯ:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО создавать элемент с названием, которое уже содержится в списке выше!
2. Если рецепт или комбинация ведет к уже открытому элементу, НЕ СОЗДАВАЙ ЕГО ПОВТОРНО. Вместо этого создай НОВЫЙ похожий элемент (родственную сущность, следующую эволюционную ступень или иную форму той же стихии).
3. Если создать новый похожий элемент логически невозможно из-за тупика, СОЗДАЙ АНОМАЛИЮ согласно Закону Аномалий!

${hasAnomaly ? `
[АКТИВИРОВАН ЗАКОН АНОМАЛИЙ И ЗАКОН ЗАПРЕТОВ!]
В трансмутации непосредственно используется ИНГРЕДИЕНТ-АНОМАЛИЯ (${elementA.type === 'Аномалия' ? elementA.name : ''} ${elementB.type === 'Аномалия' ? elementB.name : ''})!
Нейросеть ДОЛЖНА ВЕРНУТЬ аномальный, метафизически нестабильный или редкий результат (тип "Аномалия" или Запретная/Мифическая/Космическая редкость)!` : ''}

[ТРЕБОВАНИЯ К РЕЗУЛЬТАТУ СИНТЕЗА]
- ТРЕБУЕМАЯ РЕДКОСТЬ: ${targetRarity}
- СТАТУС МУТАЦИИ: ${isMutation ? 'ДА (ОБЯЗАТЕЛЬНО сделай результат необычным, живым, аномальным, или эфирным сущностным)' : 'НЕТ'}
- РЕАЛЬНОСТЬ (realityLevel) для нового элемента: выбери один из доступных слоев: ${availableLayers?.map((l: any) => l.level).join(', ') || '1'}
- НАЗВАНИЕ ЭЛЕМЕНТА (поле "name"): строго 1 или 2 слова на русском языке!

[АКТИВНЫЕ СЛОВА СИЛЫ (ЗАКЛИНАНИЯ)]
${detailedSpells && detailedSpells.length > 0
  ? `Игрок применил следующие заклинания на латыни:\n${detailedSpells.join('\n')}`
  : 'Заклинания не были наложены.'}

Проведи трансмутацию согласно правилам и верни результат строго в формате JSON.
`;

      const pConfig = await getProTalkConfig();
      const activeBotId = Number(pConfig.botId || process.env.PROTALK_BOT_ID || 71164);
      const activeBotToken = pConfig.botToken || process.env.PROTALK_BOT_TOKEN || '';
      const activeApiUrl = (pConfig.apiUrl || 'https://eu1.api.pro-talk.ru/api/v1.0').replace(/\/$/, '');

      const activeChatId = String(req.body.telegramId || req.body.userId || `guest_${Date.now()}`);

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
          message: prompt
        })
      });

      if (!sendRes.ok) {
        throw new Error(`Failed to send message to ProTalk: ${sendRes.statusText}`);
      }

      const TIMEOUT_MS = 90000;
      const POLL_INTERVAL_MS = 3000;
      const start = Date.now();
      let replyMessage: string | null = null;
      let rawPollData: any = null;

      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
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
            rawPollData = pollData;
            break;
          }
        }
      }

      let logUsername = req.body.username;
      const effectiveUserId = req.body.userId || 'guest_demo';
      if (!logUsername || logUsername === '@demo_guest' || logUsername === 'demo') {
        if (effectiveUserId !== 'guest_demo') {
          const userRow = await queryGet<any>('SELECT username, fullname FROM users WHERE id = $1', [effectiveUserId]);
          if (userRow) {
            logUsername = userRow.username || `@id${effectiveUserId}`;
          }
        }
      }
      if (!logUsername) logUsername = '@demo_guest';

      if (!replyMessage) {
        const tokensEst = Math.round(prompt.length / 3);
        await queryRun(
          'INSERT INTO ai_logs (id, userid, username, elementa, elementb, layer, tokensused, costrub, timestamp, status, prompt, response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
          [`LOG-${Date.now()}`, effectiveUserId, logUsername, elementA.name, elementB.name, currentLayer?.level || 1, tokensEst, tokensEst * (300 / 10000000), Date.now(), 'failed', prompt, 'Timeout / Error from ProTalk']
        );
        throw new Error('Timeout: ответ от ProTalk не получен за отведенное время.');
      }

      const parsedData = parseJSONFromText(replyMessage);
      if (parsedData && parsedData.element) {
        parsedData.element.rarity = targetRarity;
        parsedData.isMutation = isMutation;
      }

      let protalkTokens = 0;
      if (rawPollData) {
        if (typeof rawPollData.tokens_total === 'number' && rawPollData.tokens_total > 0) {
          protalkTokens = rawPollData.tokens_total;
        } else if (rawPollData.tokens_in_source !== undefined || rawPollData.tokens_out_source !== undefined) {
          protalkTokens = (Number(rawPollData.tokens_in_source) || 0) + (Number(rawPollData.tokens_out_source) || 0);
        } else if (typeof rawPollData.total_tokens === 'number' && rawPollData.total_tokens > 0) {
          protalkTokens = rawPollData.total_tokens;
        } else if (rawPollData.data && typeof rawPollData.data.tokens_total === 'number') {
          protalkTokens = rawPollData.data.tokens_total;
        } else if (rawPollData.usage && typeof rawPollData.usage.total_tokens === 'number') {
          protalkTokens = rawPollData.usage.total_tokens;
        }
      }

      let tokensUsed = protalkTokens;
      if (!tokensUsed || tokensUsed <= 0) {
        tokensUsed = Math.round((prompt || '').length / 3) + Math.round((replyMessage || '').length / 3);
      }

      await queryRun(
        'INSERT INTO ai_logs (id, userid, username, elementa, elementb, layer, tokensused, costrub, timestamp, status, prompt, response) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [`LOG-${Date.now()}`, effectiveUserId, logUsername, elementA.name, elementB.name, currentLayer?.level || 1, tokensUsed, tokensUsed * (300 / 10000000), Date.now(), 'success', prompt, replyMessage]
      );

      res.json(parsedData);
    } catch (error) {
      console.error('ProTalk generation failed:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
