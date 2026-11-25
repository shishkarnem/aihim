import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlchemyElement, AppUser } from '../types';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, User, Zap, Trophy, BookOpen, History, ShieldAlert, Check, Key, Globe, Mail, Lock, Loader2, Copy, Users, ExternalLink, Gift, UserCheck } from 'lucide-react';
import { calculateRank } from '../constants';
import { ElementDetailsModal } from '../components/ElementDetailsModal';
import { UserAvatar } from '../components/UserAvatar';
import { NeurosphereLoader } from '../components/ui/NeurosphereLoader';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { PushNotificationsCard } from '../components/pwa/PushNotificationsCard';

interface ProfileProps {
  elements: AlchemyElement[];
  history: Array<{
    elementA: AlchemyElement;
    elementB: AlchemyElement;
    result: AlchemyElement;
    timestamp: number;
    isNew: boolean;
  }>;
  aihim: number;
  topUpHistory?: Array<{ amount: number; price: number; timestamp: number }>;
  onOpenShop?: () => void;
  currentUser?: AppUser;
  onOpenAuthModal?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ 
  elements, 
  history, 
  aihim, 
  topUpHistory = [], 
  onOpenShop,
  currentUser,
  onOpenAuthModal,
}) => {
  const [selectedHistoryElement, setSelectedHistoryElement] = useState<AlchemyElement | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'transmutations' | 'topups'>('transmutations');

  const [webEmail, setWebEmail] = useState(currentUser?.email || '');
  const [webPassword, setWebPassword] = useState('');
  const [webConfirmPassword, setWebConfirmPassword] = useState('');
  const [webAuthLoading, setWebAuthLoading] = useState(false);
  const [webAuthError, setWebAuthError] = useState<string | null>(null);
  const [webAuthSuccess, setWebAuthSuccess] = useState<string | null>(null);

  const [referralsList, setReferralsList] = useState<AppUser[]>([]);
  const [referrerUser, setReferrerUser] = useState<AppUser | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [dbAiLogs, setDbAiLogs] = useState<any[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(() => Boolean(currentUser?.id && currentUser.id !== 'guest_demo'));

  useEffect(() => {
    if (currentUser?.email) {
      setWebEmail(currentUser.email);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest_demo') {
      setIsLoadingProfile(false);
      return;
    }
    let cancelled = false;

    const loadProfileData = async (attempt = 1): Promise<void> => {
      if (attempt === 1 && !cancelled) {
        setIsLoadingProfile(true);
      }
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(String(currentUser.id))}`, { cache: 'no-store' });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          if (attempt < 3 && (res.status >= 500 || contentType.includes('text/html'))) {
            await new Promise(r => setTimeout(r, 450 * attempt));
            if (!cancelled) return loadProfileData(attempt + 1);
            return;
          }
          throw new Error(`Profile API HTTP ${res.status}`);
        }

        const data = await res.json();
        if (cancelled || !data) return;

        if (Array.isArray(data.referrals)) {
          setReferralsList(data.referrals.filter((u: any) => String(u.referredById) === String(currentUser.id) && String(u.id) !== String(currentUser.id)));
        }
        if (data.referrer) {
          setReferrerUser(data.referrer);
        } else if (data.user?.referredById && String(data.user.referredById) !== String(currentUser.id)) {
          try {
            const refRes = await fetch(`/api/users/${encodeURIComponent(String(data.user.referredById))}`, { cache: 'no-store' });
            const refCt = refRes.headers.get('content-type') || '';
            if (refRes.ok && refCt.includes('application/json')) {
              const refData = await refRes.json();
              if (!cancelled && refData?.user) setReferrerUser(refData.user);
            }
          } catch (_) {}
        }
        if (Array.isArray(data.transactions)) setDbTransactions(data.transactions);
        if (Array.isArray(data.aiLogs)) setDbAiLogs(data.aiLogs);
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching profile referral data:', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfileData();
    const onRefresh = () => { loadProfileData(); };
    window.addEventListener('alchimia:refresh_user', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('alchimia:refresh_user', onRefresh);
    };
  }, [currentUser?.id, currentUser?.referredById]);

  const displayHistory = useMemo(() => {
    if (dbAiLogs && dbAiLogs.length > 0) {
      return dbAiLogs.map(log => {
        let parsedRes: any = null;
        if (log.response && typeof log.response === 'string') {
          const cleanStr = log.response.trim();
          try {
            parsedRes = JSON.parse(cleanStr);
          } catch (_) {
            const codeBlockMatch = cleanStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (codeBlockMatch && codeBlockMatch[1]) {
              try { parsedRes = JSON.parse(codeBlockMatch[1].trim()); } catch (_) {}
            }
            if (!parsedRes) {
              const startIdx = cleanStr.indexOf('{');
              const endIdx = cleanStr.lastIndexOf('}');
              if (startIdx !== -1 && endIdx > startIdx) {
                try { parsedRes = JSON.parse(cleanStr.slice(startIdx, endIdx + 1)); } catch (_) {}
              }
            }
          }
        }

        const elemObj = parsedRes?.element || parsedRes;
        const rawResponseStr = typeof log.response === 'string' ? log.response.trim() : '';
        const fallbackName = (rawResponseStr && !rawResponseStr.startsWith('{') && !rawResponseStr.includes('```')) 
          ? rawResponseStr 
          : 'Созданный Элемент';

        const resElemName = elemObj?.name || fallbackName;
        const resElemIcon = elemObj?.icon || '✨';
        const resElemRarity = elemObj?.rarity || 'Обычный';
        const resElemDesc = elemObj?.description || 'Новый элемент, открытый в процессе трансмутации.';

        const foundElem = elements.find(e => e.name.toLowerCase() === String(resElemName).toLowerCase());

        return {
          elementA: { name: log.elementA || 'Элемент A', icon: '🔮', rarity: 'Обычный' } as AlchemyElement,
          elementB: { name: log.elementB || 'Элемент B', icon: '⚡', rarity: 'Обычный' } as AlchemyElement,
          result: foundElem || {
            id: String(resElemName).toLowerCase().replace(/\s+/g, '-'),
            name: resElemName,
            icon: resElemIcon,
            rarity: resElemRarity,
            description: resElemDesc,
            discoveredAt: log.timestamp,
          } as AlchemyElement,
          timestamp: log.timestamp,
          isNew: true,
        };
      });
    }
    return history;
  }, [dbAiLogs, elements, history]);

  const displayTopUpHistory = useMemo(() => {
    if (dbTransactions && dbTransactions.length > 0) {
      return dbTransactions.map(tx => {
        let label = 'Пополнение';
        let subtitle = 'Энергетический пакет';
        const txIdStr = String(tx.id || '');
        const txDescStr = String(tx.description || '');
        const txTypeStr = String(tx.type || '');
        const txTypeLower = txTypeStr.toLowerCase();
        const txPrice = Number(tx.price) || 0;
        const txAmount = Number(tx.amount) || 0;
        const txComment = tx.comment || tx.reason || '';

        if (txPrice > 0 || txTypeLower === 'pay' || txIdStr.startsWith('inv_')) {
          label = 'Пополнение магазина';
          subtitle = txPrice > 0 ? `Энергетический пакет (${txPrice} ₽)` : (txComment || 'Покупка энергии');
        } else if (txIdStr.includes('START') || txTypeLower === 'start' || txDescStr.includes('Стартовый')) {
          label = 'Стартовый бонус';
          subtitle = 'Приветственная энергия 1 000 AiHim';
        } else if (
          txIdStr.includes('REF') ||
          txTypeLower === 'ref' ||
          txDescStr.includes('Реферальн') ||
          txTypeStr.includes('Реферальн') ||
          (txAmount >= 100000 && txPrice === 0 && !txIdStr.includes('ADMIN') && !txIdStr.includes('EDIT'))
        ) {
          label = 'Реферальный бонус';
          let studentLabel = '';
          const refMatch = txIdStr.match(/^TX-REF-[^-]+-(.+)$/);
          if (refMatch && refMatch[1]) {
            const matchedStudent = referralsList.find(r => String(r.id) === String(refMatch[1]));
            if (matchedStudent) {
              studentLabel = matchedStudent.username || matchedStudent.fullName || `ID: ${matchedStudent.id}`;
            } else {
              studentLabel = `ID: ${refMatch[1]}`;
            }
          }
          subtitle = studentLabel
            ? `За ученика ${studentLabel}`
            : (txComment || 'Реферальная программа');
        } else if (
          txIdStr.includes('EDIT') ||
          txIdStr.includes('ADMIN') ||
          txTypeLower === 'admin' ||
          txDescStr.includes('администратор') ||
          txTypeStr.includes('Корректировка') ||
          (txPrice === 0 && txAmount !== 1000)
        ) {
          label = txAmount >= 0 ? 'Админ-начисление' : 'Админ-списание';
          subtitle = txComment || 'Корректировка баланса';
        } else {
          label = txAmount >= 0 ? 'Начисление' : 'Списание';
          subtitle = txComment || txDescStr || txTypeStr || 'Операция с балансом';
        }

        const rawStatus = String(tx.status || '').toLowerCase();
        const isSuccess = rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'paid' || rawStatus === 'ok';

        return {
          amount: txAmount,
          price: txPrice,
          timestamp: Number(tx.timestamp) || Date.now(),
          label,
          subtitle,
          status: isSuccess ? 'success' : 'failed'
        };
      });
    }
    return topUpHistory.map(t => ({
      amount: t.amount,
      price: t.price || 0,
      timestamp: t.timestamp,
      label: t.price > 0 ? 'Пополнение' : 'Бонус',
      subtitle: 'Энергетический пакет',
      status: 'success'
    }));
  }, [dbTransactions, topUpHistory, referralsList]);

  const handleSaveWebAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.id === 'guest_demo') {
      setWebAuthError('Для связывания почты и пароля войдите через Telegram.');
      return;
    }
    const cleanEmail = webEmail.trim();
    if (!cleanEmail) {
      setWebAuthError('Укажите адрес электронной почты');
      return;
    }
    if (!webPassword) {
      setWebAuthError('Укажите новый пароль');
      return;
    }
    if (webPassword !== webConfirmPassword) {
      setWebAuthError('Пароли не совпадают! Проверьте ввод повторного пароля.');
      return;
    }

    setWebAuthLoading(true);
    setWebAuthError(null);
    setWebAuthSuccess(null);

    try {
      const res = await fetch('/api/users/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email: cleanEmail,
          password: webPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось привязать почту и пароль');
      }

      setWebAuthSuccess(data.message || 'Почта и пароль успешно привязаны к вашей учетной записи!');
      setWebPassword('');
      setWebConfirmPassword('');
      if (currentUser) {
        currentUser.email = cleanEmail;
        currentUser.password = webPassword;
      }
    } catch (err: any) {
      setWebAuthError(err.message || 'Ошибка сохранения настроек авторизации');
    } finally {
      setWebAuthLoading(false);
    }
  };

  const { currentRank, level, levelTarget, progressToNextRank, nextRank } = useMemo(() => {
    return calculateRank(elements.length);
  }, [elements.length]);

  const totalReferralBonusEarned = useMemo(() => {
    const refTxs = dbTransactions.filter(tx => {
      const tId = String(tx.id || '');
      const tType = String(tx.type || '').toLowerCase();
      const rawStatus = String(tx.status || '').toLowerCase();
      const isOk = !rawStatus || rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'paid' || rawStatus === 'ok';
      return isOk && (tType === 'ref' || tId.includes('REF'));
    });
    if (refTxs.length > 0) {
      return refTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    }
    return referralsList.length * 100000 * level;
  }, [dbTransactions, referralsList.length, level]);

  const user = useMemo<AppUser>(() => {
    if (currentUser) return currentUser;
    return {
      id: 'guest_demo',
      username: '@demo_guest',
      fullName: 'Демо Гость',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
      role: 'demo',
      balance: aihim,
      discoveredCount: elements.length,
      status: 'active',
      level,
      registrationDate: Date.now(),
      lastActive: Date.now()
    };
  }, [currentUser, aihim, elements.length, level]);

  const isGuest = user.id === 'guest_demo';

  const refLink = currentUser ? `https://t.me/AI_HimBot/app?startapp=${currentUser.id}` : '';

  const handleCopyRefLink = () => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-8 pb-12 text-[14px]"
    >
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center mt-2">
        <div className="w-24 h-24 rounded-2xl bg-gold/10 border-2 border-gold/30 flex items-center justify-center text-5xl shadow-xl relative group overflow-hidden shrink-0">
          <User size={48} className="text-gold/40 absolute -bottom-2 -right-2 rotate-12 group-hover:scale-110 transition-transform" />
          <span className="relative z-10 element-icon-filter">{currentRank.icon}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[14px] uppercase font-bold text-gold tracking-[0.2em]">Мастер Алхимии</div>
          <h1 className="text-4xl font-gothic tracking-widest text-sepia">{currentRank.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-widest text-sepia/70">
              <Trophy size={16} className="text-gold" />
              Уровень {level}
            </div>
            <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-widest text-sepia/70">
              <Zap size={16} className="text-gold" />
              {aihim.toLocaleString()} AiHim
            </div>
            {currentUser?.role === 'admin' && (
              <Link 
                to="/admin" 
                className="px-3 py-1 bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-600 hover:to-gold text-ink font-gothic tracking-[0.2em] text-[14px] rounded border border-gold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 uppercase font-bold"
              >
                <ShieldAlert size={14} />
                Кабинет "Бог"
              </Link>
            )}
          </div>
        </div>
      </div>

      {!isGuest && isLoadingProfile && (
        <div className="parchment-card bg-transparent border border-gold/25 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm flex items-center justify-center">
          <NeurosphereLoader label="Загрузка" size="md" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="parchment-card p-6 bg-gold/5 border-gold/20 flex flex-col gap-2">
          <div className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest flex items-center gap-2">
            <BookOpen size={16} />
            Открыто Элементов
          </div>
          <div className="text-3xl font-gothic text-sepia">{elements.length} / {levelTarget}</div>
          <div className="w-full h-2 bg-sepia/10 rounded-full overflow-hidden mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(elements.length / levelTarget) * 100}%` }}
              className="h-full bg-gold"
            />
          </div>
        </div>

        <div className="parchment-card p-6 bg-gold/5 border-gold/20 flex flex-col gap-2">
          <div className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest flex items-center gap-2">
            <Sparkles size={16} />
            Прогресс Ранга
          </div>
          <div className="text-3xl font-gothic text-sepia">{Math.floor(progressToNextRank)}%</div>
          <div className="w-full h-2 bg-sepia/10 rounded-full overflow-hidden mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressToNextRank}%` }}
              className="h-full bg-gold shadow-[0_0_10px_rgba(201,163,67,0.5)]"
            />
          </div>
          <div className="text-[14px] font-bold text-gold/80 mt-1">
            До {nextRank?.name || 'Предела'}: {nextRank ? nextRank.min - elements.length : 0} элементов
          </div>
        </div>

        <div className="parchment-card p-6 bg-gold/5 border-gold/20 flex flex-col gap-2">
          <div className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest flex items-center gap-2">
            <History size={16} />
            Всего Трансмутаций
          </div>
          <div className="text-3xl font-gothic text-sepia">{history.length}</div>
          <div className="text-[14px] font-bold text-sepia/60 mt-1 italic">
            Ваш путь записан в веках
          </div>
        </div>
      </div>

      {/* Balance & Top-up Card */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-6 bg-parchment/60 backdrop-blur-md rounded-2xl border-2 border-ink shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20 shadow-[0_0_20px_rgba(201,163,67,0.1)] shrink-0">
            <Zap size={32} className="text-gold" />
          </div>
          <div className="flex flex-col">
            <div className="text-[14px] uppercase font-bold text-gold tracking-widest mb-1">Ваш Баланс Энергии</div>
            <div className="text-3xl font-gothic tracking-widest text-gold">{aihim.toLocaleString()} AiHim</div>
            <div className="text-[14px] text-sepia/70 font-bold tracking-wide mt-1">
              Энергия используется для ковки, трансмутации и укрепления элементов
            </div>
          </div>
        </div>
        
        {onOpenShop && (
          <button 
            onClick={onOpenShop}
            className="w-full md:w-auto px-8 py-4 bg-gold text-ink font-bold text-[14px] uppercase tracking-widest rounded-xl hover:bg-gold-light transition-all shadow-[0_0_20px_rgba(201,163,67,0.3)] active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Zap size={16} className="fill-current" />
            Пополнить Энергию
          </button>
        )}
      </div>

      {/* User Telegram Profile Info Block (ONLY for Registered Users, hidden for guest_demo) */}
      {!isGuest && (
        <div className="parchment-card p-6 bg-gold/5 border-gold/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar 
              src={user.avatar} 
              alt={user.fullName} 
              size="xl" 
              className="filter sepia-[0.25] contrast-105 border-2 border-gold/40 shadow-xl"
            />
            <div className="flex flex-col">
              <div className="text-[14px] uppercase font-bold text-gold tracking-wider flex items-center gap-1.5">
                <UserCheck size={16} className="text-emerald-500" />
                Telegram Profile (АЛХИМИК TELEGRAM)
              </div>
              <h2 className="text-2xl font-gothic text-sepia font-bold">{user.fullName}</h2>
              <div className="flex items-center gap-2 mt-1">
                {user.username && (
                  <a 
                    href={`https://t.me/${user.username.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-mono font-bold text-gold hover:underline flex items-center gap-1"
                  >
                    {user.username.startsWith('@') ? user.username : `@${user.username}`}
                    <ExternalLink size={12} />
                  </a>
                )}
                <span className="text-[14px] font-mono text-sepia/60">| ID: {user.id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 text-[14px] font-bold uppercase tracking-wider shrink-0">
            <Check size={16} />
            Статус Аккаунта Верифицирован
          </div>
        </div>
      )}

      {/* Referral Program Section (ONLY for Registered Users, hidden for guest_demo) */}
      {!isGuest && (
        <div className="parchment-card p-6 bg-gold/5 border-gold/30 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-sepia/10 pb-4">
            <div>
              <h3 className="text-xl font-gothic text-gold uppercase tracking-widest flex items-center gap-2">
                <Users size={22} className="text-gold" />
                РЕФЕРАЛЬНАЯ ПРОГРАММА
              </h3>
              <p className="text-[14px] text-sepia/80 italic mt-1">
                Условия начисления: <strong>{(100000 * level).toLocaleString()} AiHim</strong> (100 000 × Ваш уровень) за каждого приглашенного ученика по вашей реферальной ссылке.
              </p>
            </div>
          </div>

          {/* Referral Link Copy Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-parchment/80 p-3 rounded-xl border border-sepia/20">
            <div className="flex-1 w-full text-[14px] font-mono text-sepia/90 truncate px-2 select-all">
              {refLink}
            </div>
            <button
              onClick={handleCopyRefLink}
              className="w-full sm:w-auto px-5 py-2.5 bg-gold hover:bg-gold-light text-ink font-gothic text-[14px] uppercase font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              {copiedLink ? <Check size={16} className="text-emerald-900" /> : <Copy size={16} />}
              {copiedLink ? 'Скопировано!' : 'Скопировать ссылку'}
            </button>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gold/10 rounded-xl border border-gold/20 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold uppercase tracking-widest text-sepia/70">Количество приглашенных</div>
                <div className="text-2xl font-gothic text-gold font-bold">{referralsList.length}</div>
              </div>
              <Users size={28} className="text-gold/40" />
            </div>

            <div className="p-4 bg-gold/10 rounded-xl border border-gold/20 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold uppercase tracking-widest text-sepia/70">Сумма бонусов за всех</div>
                <div className="text-2xl font-gothic text-gold font-bold">
                  +{(referralsList.length * 100000 * level).toLocaleString()} AiHim
                </div>
              </div>
              <Gift size={28} className="text-gold/40" />
            </div>
          </div>

          {/* Referred By (Mentor) */}
          {(referrerUser || user.referredById || user.referredByUsername) && (
            <div className="p-4 bg-gold/10 rounded-xl border border-gold/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <UserAvatar 
                  src={referrerUser?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop'} 
                  alt={referrerUser?.fullName || 'Наставник'} 
                  size="md" 
                  className="filter sepia-[0.25] contrast-105 border border-gold/40 shadow"
                />
                <div>
                  <div className="text-[12px] uppercase font-bold text-gold tracking-widest flex items-center gap-1.5">
                    <UserCheck size={14} className="text-gold" />
                    Ваш Наставник (Кто вас пригласил)
                  </div>
                  <div className="text-[17px] font-gothic text-sepia font-bold">
                    {referrerUser?.fullName || 'Пригласивший Алхимик'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[13px]">
                    {(referrerUser?.username || user.referredByUsername) && (
                      <a 
                        href={`https://t.me/${(referrerUser?.username || user.referredByUsername || '').replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-gold hover:underline flex items-center gap-1 font-bold"
                      >
                        @{ (referrerUser?.username || user.referredByUsername || '').replace('@', '') }
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <span className="font-mono text-sepia/70">
                      | Telegram ID: {referrerUser?.id || user.referredById}
                    </span>
                    {referrerUser?.level && (
                      <span className="px-2 py-0.5 bg-gold/20 rounded text-[11px] font-bold text-gold uppercase tracking-wider">
                        Уровень {referrerUser.level}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List of Invited Referrals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[14px] font-bold uppercase tracking-wider text-sepia/90 flex items-center gap-2">
                <Users size={16} className="text-gold" />
                Список приглашенных учеников ({referralsList.length})
              </h4>
              <span className="text-[12px] text-sepia/60 italic font-mono">
                Итого бонусов: +{totalReferralBonusEarned.toLocaleString()} AiHim
              </span>
            </div>

            {isLoadingProfile && referralsList.length === 0 ? (
              <div className="py-6 flex items-center justify-center bg-transparent">
                <NeurosphereLoader label="Загрузка" size="sm" />
              </div>
            ) : referralsList.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {referralsList.map((refUser, idx) => (
                  <div key={refUser.id || idx} className="p-3 bg-white/80 rounded-xl border border-sepia/15 hover:border-gold/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        src={refUser.avatar} 
                        alt={refUser.fullName} 
                        size="md" 
                        className="filter sepia-[0.25] contrast-105 border border-gold/30"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-sepia">{refUser.fullName || 'Новый Алхимик'}</span>
                          <span className="text-[14px] px-2.5 py-0.5 bg-gold/15 text-gold font-bold rounded-full">
                            Уровень {refUser.level || 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[14px]">
                          {refUser.username ? (
                            <a 
                              href={`https://t.me/${refUser.username.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-gold hover:underline flex items-center gap-1 font-bold"
                            >
                              {refUser.username.startsWith('@') ? refUser.username : `@${refUser.username}`}
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="font-mono text-sepia/60">Без логина</span>
                          )}
                          <span className="font-mono text-sepia/60">
                            | ID: {refUser.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-sepia/10">
                      <div className="text-[15px] font-gothic text-amber-800 font-bold">
                        +{(100000 * level).toLocaleString()} AiHim
                      </div>
                      <div className="text-[14px] text-sepia/60 font-mono">
                        {refUser.registrationDate ? new Date(refUser.registrationDate).toLocaleDateString() : 'Зарегистрирован'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-transparent rounded-xl border border-dashed border-sepia/20 text-center text-[14px] text-sepia/60 italic space-y-1">
                <Gift size={28} className="mx-auto text-gold/40 mb-2" />
                <div>У вас пока нет приглашенных учеников по вашей ссылке.</div>
                <div className="text-[14px]">Скопируйте реферальную ссылку выше и отправьте друзьям!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile PWA Install & Device Push Notifications */}
      <div className="space-y-5 mt-2">
        <PWAInstallButton />
        <PushNotificationsCard userId={currentUser?.id} onOpenAuthModal={onOpenAuthModal} />
      </div>

      {/* Web Credentials Setup Section (aihim.ru) - ONLY for Registered Users (hidden for guest_demo) */}
      {!isGuest && (
        <div className="parchment-card p-6 bg-gold/5 border-gold/30 mt-2 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-sepia/10 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-gothic text-gold uppercase tracking-wider flex items-center gap-2">
                <Globe size={20} className="text-gold" />
                Доступ через сайт aihim.ru
              </h3>
              <p className="text-[14px] text-sepia/80 italic mt-0.5">
                Укажите почту и пароль, чтобы войти в вашу личную алхимическую лабораторию из любого браузера по адресу aihim.ru
              </p>
            </div>
            <div className="px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-[14px] font-bold uppercase tracking-wider text-gold shrink-0">
              {currentUser?.email ? `Привязана: ${currentUser.email}` : 'Почта еще не привязана'}
            </div>
          </div>

          {webAuthError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[14px] font-bold">
              {webAuthError}
            </div>
          )}
          {webAuthSuccess && (
            <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded text-sky-900 text-[14px] font-bold flex items-center gap-2">
              <Check size={18} />
              {webAuthSuccess}
            </div>
          )}

          <form onSubmit={handleSaveWebAuth} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[14px] font-bold uppercase tracking-wider text-sepia/90 flex items-center gap-1">
                <Mail size={14} className="text-gold" />
                Электронная почта (Email) <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                value={webEmail}
                onChange={(e) => setWebEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 bg-white/80 border border-sepia/30 rounded focus:border-gold outline-none text-[14px] text-sepia"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[14px] font-bold uppercase tracking-wider text-sepia/90 flex items-center gap-1">
                <Lock size={14} className="text-gold" />
                Новый пароль <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={webPassword}
                onChange={(e) => setWebPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white/80 border border-sepia/30 rounded focus:border-gold outline-none text-[14px] text-sepia"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[14px] font-bold uppercase tracking-wider text-sepia/90 flex items-center gap-1">
                <Lock size={14} className="text-gold" />
                Повторите пароль <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={webConfirmPassword}
                onChange={(e) => setWebConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white/80 border border-sepia/30 rounded focus:border-gold outline-none text-[14px] text-sepia"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                disabled={webAuthLoading}
                className="px-6 py-2.5 bg-gold hover:bg-gold-light text-ink font-gothic tracking-widest text-[14px] uppercase font-bold rounded shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {webAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                Сохранить почту и пароль
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full Width Section with Tab Switcher for Chronicle & Transactions */}
      <div className="w-full mt-4 flex flex-col gap-6">
        {/* Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-sepia/20 pb-3 w-full">
          <button
            type="button"
            onClick={() => setActiveHistoryTab('transmutations')}
            className={`px-5 py-3 font-gothic tracking-wider text-sm font-semibold rounded-xl transition-all flex items-center justify-center sm:justify-start gap-2.5 whitespace-nowrap cursor-pointer ${
              activeHistoryTab === 'transmutations'
                ? 'bg-amber-800 text-amber-50 shadow-md border border-amber-900/30'
                : 'bg-parchment/80 text-sepia/80 hover:text-sepia hover:bg-parchment border border-sepia/20'
            }`}
          >
            <History size={18} className={activeHistoryTab === 'transmutations' ? 'text-amber-200' : 'text-amber-800'} />
            <span>Хроника трансмутаций ({displayHistory.length})</span>
          </button>

          {!isGuest && (
            <button
              type="button"
              onClick={() => setActiveHistoryTab('topups')}
              className={`px-5 py-3 font-gothic tracking-wider text-sm font-semibold rounded-xl transition-all flex items-center justify-center sm:justify-start gap-2.5 whitespace-nowrap cursor-pointer ${
                activeHistoryTab === 'topups'
                  ? 'bg-amber-800 text-amber-50 shadow-md border border-amber-900/30'
                  : 'bg-parchment/80 text-sepia/80 hover:text-sepia hover:bg-parchment border border-sepia/20'
              }`}
            >
              <Zap size={18} className={activeHistoryTab === 'topups' ? 'text-amber-200' : 'text-amber-800'} />
              <span>История пополнений ({displayTopUpHistory.length})</span>
            </button>
          )}
        </div>

        {/* Tab Content 1: Chronicle of Transmutations */}
        {activeHistoryTab === 'transmutations' && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
              <h2 className="text-lg font-gothic tracking-widest flex items-center gap-2 text-sepia uppercase font-bold">
                <History className="text-amber-700" size={20} />
                Хроника ваших алхимических трансмутаций
              </h2>
              <span className="text-xs text-sepia/60 font-mono hidden sm:inline-block">
                Всего записей: {displayHistory.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar w-full">
              {displayHistory.map((entry, i) => (
                <motion.div
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => setSelectedHistoryElement(entry.result)}
                  className="p-4 rounded-2xl border border-sepia/20 hover:border-amber-500/50 transition-all group cursor-pointer w-full bg-amber-50/60 hover:bg-amber-100/60 shadow-xs hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
                    {/* Time & Formula */}
                    <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                      <div className="text-xs font-bold text-sepia/70 font-mono px-2.5 py-1 bg-white/90 rounded-lg border border-sepia/15 shrink-0 shadow-xs">
                        {new Date(entry.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap text-sm sm:text-base">
                        <span className="font-bold text-sepia group-hover:text-amber-900 transition-colors truncate max-w-[130px] sm:max-w-none">{entry.elementA.name}</span>
                        <span className="text-sepia/50 font-black">+</span>
                        <span className="font-bold text-sepia group-hover:text-amber-900 transition-colors truncate max-w-[130px] sm:max-w-none">{entry.elementB.name}</span>
                      </div>
                    </div>

                    <div className="hidden sm:block shrink-0">
                      <ArrowRight size={18} className="text-sepia/40 group-hover:text-amber-700 transition-colors" />
                    </div>

                    {/* Result */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-sepia/15">
                      <div className="text-left sm:text-right">
                        <div className="text-base font-gothic text-amber-900 flex items-center gap-1.5 sm:justify-end font-bold">
                          {entry.isNew && <Sparkles size={14} className="animate-pulse text-amber-600" />}
                          {entry.result.name}
                        </div>
                        <div className="text-[11px] uppercase tracking-wider font-bold text-sepia/70">{entry.result.rarity}</div>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-white/90 border border-sepia/25 flex items-center justify-center text-2xl shadow-xs group-hover:scale-110 transition-transform shrink-0">
                        <span className="element-icon-filter">{entry.result.icon}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {displayHistory.length === 0 && (
                <div className="p-12 text-center text-sepia/60 italic border border-dashed border-sepia/20 rounded-2xl bg-amber-50/40 text-sm">
                  <BookOpen size={48} className="mx-auto mb-3 opacity-40 text-amber-800" />
                  Эксперименты еще не записаны. Начните свой путь в Ателье.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Top-Up History */}
        {activeHistoryTab === 'topups' && !isGuest && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
              <h2 className="text-lg font-gothic tracking-widest flex items-center gap-2 text-sepia uppercase font-bold">
                <Zap size={20} className="text-amber-700" />
                История операций с балансом и пополнений
              </h2>
              <span className="text-xs text-sepia/60 font-mono hidden sm:inline-block">
                Всего операций: {displayTopUpHistory.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar w-full">
              {displayTopUpHistory.map((entry, i) => (
                <motion.div
                  key={`${entry.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="p-4 rounded-2xl border border-sepia/20 hover:border-amber-500/50 transition-all w-full bg-amber-50/60 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
                    {/* Date & Label */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto min-w-0">
                      <div className="text-xs font-bold text-sepia/70 font-mono px-2.5 py-1 bg-white/90 rounded-lg border border-sepia/15 shrink-0 shadow-xs">
                        {new Date(entry.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${entry.status === 'failed' ? 'bg-rose-500' : (entry.amount >= 0 ? 'bg-emerald-500' : 'bg-amber-500')} animate-pulse`} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-sepia/90 uppercase tracking-wider truncate">{entry.label}</div>
                          <div className="text-xs text-sepia/60 font-medium truncate">{entry.subtitle}</div>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Status */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-sepia/15">
                      <div className="text-left sm:text-right">
                        <div className="text-base font-gothic text-amber-900 font-bold">
                          {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()} AiHim
                        </div>
                        <div className="text-xs font-mono font-semibold text-sepia/70">
                          {entry.price ? `${entry.price} ₽` : '0 ₽'}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shrink-0 shadow-2xs ${
                        entry.status === 'success' 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                          : 'bg-rose-50 border-rose-300 text-rose-800'
                      }`}>
                        {entry.status === 'success' ? '✓ Зачислено' : '❌ Сбой'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isLoadingProfile && displayTopUpHistory.length === 0 ? (
                <div className="py-8 flex items-center justify-center bg-transparent">
                  <NeurosphereLoader label="Загрузка" size="sm" />
                </div>
              ) : displayTopUpHistory.length === 0 ? (
                <div className="p-12 text-center text-sepia/60 italic border border-dashed border-sepia/20 rounded-2xl bg-transparent text-[14px]">
                  <Zap size={48} className="mx-auto mb-3 opacity-40 text-amber-800" />
                  История пополнений пуста. Пополните баланс в магазине.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Element Detail Modal */}
      <ElementDetailsModal 
        element={selectedHistoryElement} 
        onClose={() => setSelectedHistoryElement(null)} 
      />
    </motion.div>
  );
};
