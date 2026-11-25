import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
  Send,
  Smartphone,
  Sparkles,
  Zap,
  Users,
  Newspaper,
  Clock
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export interface PushPrefsState {
  energy: boolean;
  transactions: boolean;
  referrals: boolean;
  blog: boolean;
  reminders: boolean;
  updates: boolean;
}

const DEFAULT_PREFS: PushPrefsState = {
  energy: true,
  transactions: true,
  referrals: true,
  blog: true,
  reminders: true,
  updates: true
};

const PREF_ITEMS: Array<{
  key: keyof PushPrefsState;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    key: 'energy',
    title: 'Энергия и начисления от системы',
    desc: 'Уведомления о начислении подарочной и бонусной энергии AiHim.',
    icon: Zap
  },
  {
    key: 'transactions',
    title: 'Пополнения и покупки пакетов',
    desc: 'Моментальное подтверждение оплаты и зачисления баланса на аккаунт.',
    icon: CheckCircle2
  },
  {
    key: 'referrals',
    title: 'Рефералы и награды за учеников',
    desc: 'Оповещения, когда по вашей ссылке регистрируется новый алхимик.',
    icon: Users
  },
  {
    key: 'blog',
    title: 'Новые статьи и рецепты в блоге',
    desc: 'Выход новых гайдов, разборов механик и секретных рецептов AIhim.',
    icon: Newspaper
  },
  {
    key: 'reminders',
    title: 'Напоминания лаборатории',
    desc: 'Мягкие напоминания вернуться к незавершённым экспериментам и кузне.',
    icon: Clock
  },
  {
    key: 'updates',
    title: 'Системные обновления и события',
    desc: 'Анонсы новых слоёв реальности, акций и тестовые пуш-уведомления.',
    icon: Sparkles
  }
];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationsCardProps {
  userId?: string;
  onOpenAuthModal?: () => void;
}

export const PushNotificationsCard: React.FC<PushNotificationsCardProps> = ({
  userId,
  onOpenAuthModal
}) => {
  const { isInstalled, isIOS } = usePWAInstall();
  const isGuest = !userId || userId === 'guest_demo';

  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [prefs, setPrefs] = useState<PushPrefsState>(DEFAULT_PREFS);
  const [subscribed, setSubscribed] = useState(false);
  const [activeDevices, setActiveDevices] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const isSup =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setSupported(isSup);
    if (isSup) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/push/status?userId=${encodeURIComponent(String(userId))}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSubscribed(Boolean(data.subscribed));
        setActiveDevices(Number(data.activeDevices) || 0);
        if (data.preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
        }
      } catch {
        // ignore status error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isGuest]);

  const detectDeviceLabel = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'iPhone (PWA / Safari)';
    if (/iPad/i.test(ua)) return 'iPad (PWA / Safari)';
    if (/Android/i.test(ua)) return 'Android смартфон';
    if (/Mac/i.test(ua)) return 'Mac браузер';
    if (/Windows/i.test(ua)) return 'Windows браузер';
    return 'Веб-браузер';
  };

  const subscribeCurrentDevice = async () => {
    if (isGuest) {
      onOpenAuthModal?.();
      return;
    }
    if (!supported) {
      setErrorMsg(
        isIOS && !isInstalled
          ? 'На iPhone сначала установите AIhim на экран «Домой» через меню Safari «Поделиться», затем откройте приложение с рабочего стола.'
          : 'Этот браузер не поддерживает Web Push. Попробуйте Chrome, Safari (из установленного PWA) или Яндекс Браузер.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setErrorMsg('Доступ к уведомлениям отклонён в настройках браузера. Разрешите уведомления для сайта и попробуйте снова.');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData.publicKey) {
        throw new Error('Не удалось получить публичный ключ сервера для пуш-уведомлений');
      }

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(keyData.publicKey);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer
        });
      }

      const subJson = sub.toJSON();
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subJson,
          deviceLabel: detectDeviceLabel(),
          platform: isIOS ? 'ios-pwa' : /Android/i.test(navigator.userAgent) ? 'android' : 'desktop',
          preferences: prefs
        })
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Ошибка сохранения подписки на сервере');
      }

      setSubscribed(true);
      setActiveDevices((prev) => Math.max(1, prev));
      setStatusMsg('Мобильные пуш-уведомления успешно подключены для этого устройства.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось включить пуш-уведомления');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeCurrentDevice = async () => {
    setLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
      }
      setSubscribed(false);
      setActiveDevices((prev) => Math.max(0, prev - 1));
      setStatusMsg('Пуш-уведомления на этом устройстве отключены.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка при отключении');
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = async (key: keyof PushPrefsState) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);
    if (isGuest) return;
    try {
      await fetch('/api/push/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          preferences: nextPrefs
        })
      });
      setStatusMsg('Настройки категорий уведомлений сохранены.');
    } catch {
      setErrorMsg('Не удалось сохранить настройку на сервере.');
    }
  };

  const handleSendTestPush = async () => {
    if (isGuest) {
      onOpenAuthModal?.();
      return;
    }
    setTesting(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Тестовое уведомление отправлено на устройства (${data.sent} шт.).`);
      } else {
        setErrorMsg(
          'Активных устройств для доставки не найдено. Сначала нажмите «Включить пуш-уведомления» выше.'
        );
      }
    } catch {
      setErrorMsg('Сетевая ошибка при отправке тестового пуша.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sepia/30 bg-transparent backdrop-blur-md p-5 sm:p-6 shadow-md space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sepia/15 pb-4">
        <div className="min-w-0">
          <h3 className="text-[19px] font-gothic font-bold text-sepia flex items-center gap-2 flex-wrap">
            <BellRing size={20} className="text-gold shrink-0" />
            <span>Пуш-уведомления на телефон и ПК</span>
          </h3>
          <p className="text-[14px] text-sepia/85 mt-1 leading-relaxed">
            Получайте мгновенные системные оповещения прямо на экран блокировки устройства — даже когда вкладка браузера или Telegram закрыты.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1.5 rounded-xl border text-[14px] font-bold ${
              subscribed
                ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-900'
                : 'border-sepia/25 bg-transparent text-sepia/80'
            }`}
          >
            {subscribed
              ? `Активно (${activeDevices} устр.)`
              : permission === 'denied'
                ? 'Заблокировано в браузере'
                : 'Не подключено'}
          </span>
        </div>
      </div>

      {/* Explanation block: why push & recommendation to install PWA */}
      <div className="rounded-xl border border-gold/40 bg-transparent p-4 space-y-2.5 text-[14px] text-sepia leading-relaxed">
        <div className="font-bold flex items-center gap-2 text-[15px] text-sepia">
          <Info size={18} className="text-gold shrink-0" />
          <span>Зачем нужны пуш-уведомления и почему желательно установить приложение</span>
        </div>
        <p className="text-sepia/90">
          Пуш-уведомления работают наряду с Telegram-сообщениями и мгновенно показывают на экране устройства: зачисление энергии и бонусов, приход нового реферала, выход свежих статей в журнале и важные напоминания от вашей кузни.
        </p>
        <div className="flex items-start gap-2 pt-1 text-sepia/90">
          <Smartphone size={18} className="text-gold shrink-0 mt-0.5" />
          <span>
            <strong>Рекомендация:</strong> желательно установить иконку AIhim на рабочий стол (PWA). На Android это даёт максимально стабильную доставку без выгрузки вкладки, а на <strong>iPhone и iPad (iOS 16.4+)</strong> системные пуш-уведомления работают <strong>только после установки приложения на экран «Домой»</strong> и запуска с этой иконки.
          </span>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-600/40 bg-emerald-500/10 text-emerald-950 text-[14px] font-semibold">
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl border border-rose-600/40 bg-rose-500/10 text-rose-950 text-[14px] font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        {isGuest ? (
          <button
            type="button"
            onClick={() => onOpenAuthModal?.()}
            className="px-5 py-3 rounded-xl bg-gold/90 hover:bg-gold text-ink font-gothic font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bell size={18} />
            <span>Войти для подключения уведомлений</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={subscribeCurrentDevice}
              className="px-5 py-3 rounded-xl bg-gold/90 hover:bg-gold text-ink font-gothic font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
              <span>{subscribed ? 'Обновить подписку этого устройства' : 'Включить пуш-уведомления'}</span>
            </button>

            {subscribed && (
              <>
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleSendTestPush}
                  className="px-4 py-3 rounded-xl border border-gold/50 bg-transparent hover:bg-gold/15 text-sepia font-bold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Проверить (тестовый пуш)</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={unsubscribeCurrentDevice}
                  className="px-4 py-3 rounded-xl border border-sepia/30 bg-transparent hover:bg-rose-500/10 text-sepia/85 font-semibold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <BellOff size={16} />
                  <span>Отключить на этом устройстве</span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Category toggles */}
      <div className="space-y-3 pt-2">
        <div className="text-[15px] font-bold text-sepia">
          Какие пуш-уведомления присылать на устройство:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PREF_ITEMS.map((item) => {
            const Icon = item.icon;
            const enabled = prefs[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => togglePreference(item.key)}
                className={`text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer bg-transparent ${
                  enabled
                    ? 'border-gold/50 shadow-xs'
                    : 'border-sepia/20 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon size={18} className={enabled ? 'text-gold shrink-0 mt-0.5' : 'text-sepia/50 shrink-0 mt-0.5'} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-sepia break-words">{item.title}</div>
                    <div className="text-[14px] text-sepia/75 mt-0.5 leading-snug break-words">{item.desc}</div>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 border ${
                    enabled
                      ? 'bg-gold/85 border-gold'
                      : 'bg-sepia/15 border-sepia/30'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-parchment shadow transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
