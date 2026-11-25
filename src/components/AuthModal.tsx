import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, CheckCircle2, ShieldCheck, LogOut, ExternalLink, Sparkles, Loader2, UserPlus } from 'lucide-react';
import { AppUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSelectUser: (user: AppUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Заполните поле электронной почты и пароля');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/users/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Пользователь с такой почтой и паролем не найден');
      }

      if (data && data.user) {
        localStorage.setItem('alchimia_active_user_id', data.user.id.toString());
        onSelectUser(data.user);
        setSuccessMessage(`Успешный вход: ${data.user.fullName || data.user.email}`);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Ошибка входа по почте и паролю');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alchimia_active_user_id');
    localStorage.removeItem('aihim_admin_users');
    const guestUser: AppUser = {
      id: 'guest_demo',
      username: '@demo_guest',
      fullName: 'Демо Гость',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
      role: 'demo',
      balance: 1000,
      discoveredCount: 8,
      status: 'active',
      level: 1,
      registrationDate: Date.now(),
      lastActive: Date.now()
    };
    onSelectUser(guestUser);
    setSuccessMessage('Сессия очищена. Переход в Демо-режим');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[5000] overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex min-h-screen items-start sm:items-center justify-center my-0">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg parchment-card p-4 sm:p-8 shadow-[0_0_50px_rgba(201,163,67,0.3)] border-2 border-gold text-sepia my-auto relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-sepia/40 hover:text-sepia p-1 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center mx-auto mb-2 sm:mb-3 text-gold">
              <ShieldCheck size={30} />
            </div>
            <h2 className="font-gothic text-xl sm:text-2xl text-gold uppercase tracking-widest">
              Вход на сайт aihim.ru
            </h2>
            <p className="text-[16px] font-serif italic text-sepia/70 mt-1">
              Авторизация только для зарегистрированных пользователей
            </p>
          </div>

          {/* Registration Block moved to TOP - Styled in App Alchemy Gold Theme */}
          <div className="mb-5 p-4 rounded-lg bg-gold/10 border border-gold/40 text-sepia shadow-inner">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/50 flex items-center justify-center text-gold shrink-0">
                <UserPlus size={20} />
              </div>
              <div className="flex-1 space-y-1.5 w-full">
                <div className="font-bold text-[14px] sm:text-sm text-gold uppercase tracking-wider">
                  Нет аккаунта? Регистрация в Telegram
                </div>
                <p className="text-[16px] text-sepia/80 leading-relaxed">
                  Регистрация новых алхимиков выполняется исключительно через Telegram Bot и Mini App:
                </p>
                <div className="pt-1 w-full">
                  <a
                    href="https://t.me/AI_HimBot/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-light text-ink font-bold text-[12px] uppercase tracking-wider rounded transition-all shadow-md active:scale-95"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .54-1.43.53-.47-.01-1.37-.26-2.05-.48-.83-.27-1.49-.42-1.43-.88.03-.24.38-.49 1.04-.75 4.08-1.77 6.81-2.94 8.19-3.51 3.9-1.63 4.71-1.91 5.24-1.92.12 0 .37.03.54.17.14.12.18.28.2.42-.02.07-.02.19-.04.32z"/>
                    </svg>
                    <span>Зарегистрироваться в Telegram Bot</span>
                    <ExternalLink size={13} className="shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-bold text-center">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-xs font-bold text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={16} />
              {successMessage}
            </div>
          )}

          {/* Current Active Account Box */}
          <div className="mb-5 p-3.5 sm:p-4 rounded-lg bg-gold/5 border border-gold/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
              <img
                src={currentUser.avatar}
                alt="Avatar"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-gold/40 object-cover grayscale sepia shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col min-w-0">
                <div className="text-[12px] uppercase font-bold text-gold tracking-wider">Текущая сессия</div>
                <div className="font-bold text-[16px] text-sepia truncate">{currentUser.fullName}</div>
                <div className="text-[12px] font-mono text-sepia/60 truncate">
                  {currentUser.email || currentUser.username} (ID: {currentUser.id})
                </div>
              </div>
            </div>

            {currentUser.id !== 'guest_demo' ? (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold uppercase tracking-wider rounded transition-all shrink-0 flex items-center gap-1"
                title="Очистить сессию и перейти в Демо"
              >
                <LogOut size={12} />
                Выйти
              </button>
            ) : (
              <span className="px-2 py-1 bg-gold/10 border border-gold/30 rounded text-[9px] font-bold text-gold uppercase tracking-widest shrink-0">
                Демо
              </span>
            )}
          </div>

          {/* Form to login by Email & Password */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[12px] font-bold uppercase tracking-wider text-sepia/80 flex items-center gap-1.5">
                <Mail size={13} className="text-gold" />
                Адрес электронной почты (Email) <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                className="w-full px-3 py-2 bg-white/80 border border-sepia/30 rounded focus:border-gold outline-none text-[16px] text-sepia placeholder:text-sepia/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-bold uppercase tracking-wider text-sepia/80 flex items-center gap-1.5">
                <Lock size={13} className="text-gold" />
                Пароль <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-white/80 border border-sepia/30 rounded focus:border-gold outline-none text-[16px] text-sepia placeholder:text-sepia/30"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className="w-full py-3 bg-gold text-ink font-gothic tracking-[0.2em] uppercase font-bold text-xs sm:text-sm rounded shadow-lg hover:bg-gold-light active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Проверка в Базе...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Войти на сайт
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
