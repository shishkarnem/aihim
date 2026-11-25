import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, MessageCircle, ArrowRight, Smartphone, ShieldCheck } from 'lucide-react';

export const TelegramRedirect: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-xl parchment-card p-8 md:p-12 text-center flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden border-2 border-gold/40"
      >
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gold/5 rounded-full -translate-x-16 -translate-y-16" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-gold/5 rounded-full translate-x-24 translate-y-24" />

        <div className="w-20 h-20 bg-gold/15 rounded-full flex items-center justify-center text-gold border-2 border-gold/30 shadow-xl relative z-10 animate-pulse">
          <MessageCircle size={40} className="fill-current text-gold" />
        </div>

        <div className="flex flex-col gap-2 relative z-10">
          <div className="text-[10px] uppercase font-bold text-gold tracking-[0.4em]">Священный Синод AIhim</div>
          <h1 className="font-gothic text-3xl md:text-4xl text-sepia tracking-widest uppercase">МАГИЧЕСКИЙ ПОРТАЛ</h1>
        </div>

        <div className="h-px w-24 bg-gold/30 relative z-10" />

        <p className="font-serif italic text-sepia/80 text-sm md:text-base leading-relaxed max-w-md relative z-10">
          "Каждый истинный Алхимик куёт свою судьбу в тишине эфира. Ваш прогресс, баланс энергии и списки учеников вечно хранятся в чертогах Telegram."
        </p>

        <div className="bg-white/60 backdrop-blur-sm p-5 rounded-2xl border border-sepia/15 text-left flex flex-col gap-3 max-w-md w-full relative z-10">
          <h4 className="text-xs font-bold text-sepia uppercase tracking-widest flex items-center gap-2">
            <Smartphone size={14} className="text-gold" />
            Что даёт версия в Telegram?
          </h4>
          <ul className="text-xs text-sepia/70 space-y-2 list-none p-0">
            <li className="flex items-start gap-2">
              <span className="text-gold">✦</span>
              <span><strong>Полное сохранение прогресса</strong> между устройствами и сессиями</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold">✦</span>
              <span><strong>Реферальная система</strong> — 100 000 AiHim × уровень наставника за друга</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gold">✦</span>
              <span><strong>Глобальные рейтинги</strong> лучших алхимиков мира в реальном времени</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm relative z-10 mt-2">
          <a
            href="https://t.me/AI_HimBot/app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-gold hover:bg-gold-light text-ink rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all"
          >
            <MessageCircle size={16} className="fill-current" />
            Запустить в Telegram
            <ArrowRight size={14} />
          </a>

          <a
            href="/"
            className="w-full py-2.5 text-sepia/60 hover:text-sepia text-[10px] uppercase tracking-widest font-bold border border-sepia/20 hover:border-gold hover:bg-gold/5 rounded transition-all flex items-center justify-center gap-1"
          >
            Продолжить в браузере (Демо-режим)
          </a>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-sepia/40 font-mono mt-4 relative z-10">
          <ShieldCheck size={12} />
          <span>Безопасная аутентификация через Telegram WebApp</span>
        </div>
      </motion.div>
    </div>
  );
};
