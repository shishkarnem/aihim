import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlchemyElement, Rarity, ArcanaLink } from '../types';
import { Sparkles, Zap, Shield, Eye, Globe, Thermometer, Contrast, Leaf, Hourglass, X, Info, ExternalLink, Youtube, Send, MessageSquare } from 'lucide-react';
import { REALITY_LAYERS, HIDDEN_LAWS, calculateRank, INITIAL_ELEMENTS, RANKS, RARITY_DETAILS, RARITY_COLORS, ELEMENT_TYPE_DETAILS, ESSENCE_DETAILS, translateEssence, RARITY_ORDER, calculateRarityChances } from '../constants';
import { DynamicIcon } from '../lib/icons';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ArcanaProps {
  onReset: () => void;
  elements: AlchemyElement[];
  aihim: number;
  setAihim: React.Dispatch<React.SetStateAction<number>>;
}

const LAYER_ICONS: Record<number, any> = {
  1: Shield,
  2: Zap,
  3: Sparkles,
  4: Eye,
  5: Globe,
};

const LAW_ICONS: Record<string, any> = {
  Thermometer,
  Contrast,
  Leaf,
  Hourglass,
  Shield,
  X,
  Zap,
  Sparkles,
  Globe,
};

export const Arcana: React.FC<ArcanaProps> = ({ onReset, elements, aihim, setAihim }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<any>(null);
  const [selectedLayer, setSelectedLayer] = useState<any>(null);
  const [selectedRank, setSelectedRank] = useState<any>(null);
  const [selectedRarity, setSelectedRarity] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [selectedEssence, setSelectedEssence] = useState<any>(null);
  const [rarityA, setRarityA] = useState<string>(RARITY_ORDER[0]);
  const [rarityB, setRarityB] = useState<string>(RARITY_ORDER[0]);
  const validElements = elements.filter(e => e !== null);
  const maxReality = Math.max(1, ...validElements.map(e => e.realityLevel || 1));
  const totalElements = validElements.length;

  const { currentRank, nextRank, progressToNextRank } = calculateRank(totalElements);
  const [showRankTooltip, setShowRankTooltip] = useState(false);
  const [arcanaConfig, setArcanaConfig] = useState<any>(null);

  const [arcanaLinks, setArcanaLinks] = useState<ArcanaLink[]>([
    { id: 'link-rent-rop', title: '🏢 Управляющая компания РентРОП', description: 'Управляющая компания РентРОП', url: 'https://rent-rop.com/', icon: 'Globe' },
    { id: 'link-rr-support', title: '💬 Чат Техподдержки RR', description: 'Чат Техподдержки RR', url: 'https://t.me/+Eiaf4wdjSwthYmVi', icon: 'MessageSquare' },
    { id: 'link-rr-hr', title: '🤖 Робот Рекрутер RR', description: 'Робот Рекрутер для автоматизации найма', url: 'https://hr-rr.ru/', icon: 'Bot' },
    { id: '1', title: '🤖 SAV AI', description: 'Новости про нейросети и ИИ', url: 'https://t.me/SAV_AI', icon: 'Send' },
    { id: '2', title: '👨‍💻 Doctor White', description: 'Разработчик приложения', url: 'https://t.me/shishkarnem', icon: 'MessageSquare' },
    { id: '3', title: '🛒 Спаситель Продаж', description: 'Заказать разработку ИИ', url: 'https://t.me/SAV_AIbot', icon: 'Zap' },
    { id: '4', title: '🤝 ИИ-Гренландия', description: 'Партнёрская программа', url: 'https://t.me/SAVPartnerBot', icon: 'Globe' },
    { id: '5', title: '🎬 Нейросети для бизнеса', description: 'YouTube канал с прямыми эфирами', url: 'https://www.youtube.com/@SAVAILife', icon: 'Youtube' }
  ]);

  useEffect(() => {
    fetch('/api/arcana/links')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.links) && data.links.length > 0) {
          setArcanaLinks(data.links);
        }
      })
      .catch(err => console.error('Failed to load arcana links:', err));

    fetch('/api/arcana/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.config) {
          setArcanaConfig(data.config);
        }
      })
      .catch(err => console.error('Failed to load arcana config:', err));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-8 text-[14px]"
    >
      {/* Alchemist Rank Section */}
      <div className="parchment-card p-6 border-gold/40 bg-gold/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl rotate-12">
          <span className="element-icon-filter">{currentRank.icon}</span>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full border-4 border-gold/30 flex items-center justify-center bg-parchment shadow-xl overflow-hidden relative shrink-0">
            <div className="absolute inset-0 bg-gold/5" />
            <span className="text-5xl relative z-10 drop-shadow-[0_0_2px_rgba(0,0,0,0.3)] element-icon-filter">{currentRank.icon}</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold">Ваш Текущий Ранг</div>
            <h2 className="font-gothic text-3xl tracking-widest text-sepia">{currentRank.name}</h2>
            <p className="text-[14px] italic text-sepia/80 mt-1">{currentRank.desc}</p>
            
            <div className="mt-4 space-y-1 relative">
              <div className="flex justify-between text-[14px] uppercase font-bold tracking-widest text-sepia/70">
                <div className="flex items-center gap-1 cursor-help" onMouseEnter={() => setShowRankTooltip(true)} onMouseLeave={() => setShowRankTooltip(false)}>
                  <span>Прогресс Познания</span>
                  <Info size={14} />
                </div>
                <span>{totalElements} / {nextRank ? nextRank.min : '∞'}</span>
              </div>
              <div className="h-2 w-full bg-sepia/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNextRank}%` }}
                  className="h-full bg-gold shadow-[0_0_10px_rgba(201,163,67,0.5)]"
                />
              </div>

              <AnimatePresence>
                {showRankTooltip && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-full left-0 mb-2 p-3 bg-ink text-[14px] text-white rounded-xl shadow-xl z-50 w-64 border border-gold/20"
                  >
                    Ваш ранг алхимика растет по мере открытия новых элементов. Каждый новый ранг открывает доступ к более сложным трансмутациям.
                  </motion.div>
                )}
              </AnimatePresence>

              {nextRank && (
                <p className="text-[14px] text-sepia/60 italic mt-1 font-bold">
                  До ранга "{nextRank.name}" осталось открыть {nextRank.min - totalElements} элементов
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Laws */}
      <div className="parchment-card p-6 space-y-6">
        <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">Законы Мироздания</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HIDDEN_LAWS.map((law) => {
            return (
              <div 
                key={law.id} 
                onClick={() => setSelectedLaw(law)}
                className="flex items-center gap-4 p-3.5 rounded border transition-all bg-gold/5 border-gold/20 cursor-pointer hover:bg-gold/10"
              >
                <div className="p-2.5 rounded-full bg-gold/10 text-gold shrink-0">
                  {React.createElement(LAW_ICONS[law.icon] || Sparkles, { size: 22 })}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-[14px] block">{law.name}</span>
                  <p className="text-[14px] italic opacity-80 mt-0.5">{law.desc}</p>
                </div>
                <Info size={16} className="text-gold/60 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Element Types & Essences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="parchment-card p-6 space-y-6">
          <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">Типы Элементов</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(ELEMENT_TYPE_DETAILS).map(([type, details]) => {
              const count = validElements.filter(e => e.type === type).length;
              return (
                <motion.div
                  key={type}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setSelectedType({ name: type, ...details })}
                  className="p-3 rounded-lg border border-gold/20 bg-gold/5 cursor-pointer hover:bg-gold/10 transition-all flex flex-col items-center text-center gap-1"
                >
                  <span className="text-[14px] font-bold uppercase tracking-wider text-gold">{type}</span>
                  <div className="text-[14px] font-mono text-sepia/70 font-bold">{count}</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="parchment-card p-6 space-y-6">
          <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">Сущности (Эссенции)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(ESSENCE_DETAILS).map(([essence, details]) => {
              const count = validElements.filter(e => e.essences?.includes(essence as any)).length;
              return (
                <motion.div
                  key={essence}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setSelectedEssence({ name: essence, ...details })}
                  className="p-3 rounded-lg border border-gold/20 bg-gold/5 cursor-pointer hover:bg-gold/10 transition-all flex flex-col items-center text-center gap-1"
                >
                  <span className="text-[14px] font-bold uppercase tracking-wider text-gold">{translateEssence(essence as any)}</span>
                  <div className="text-[14px] font-mono text-sepia/70 font-bold">{count}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rarity Levels */}
      <div className="parchment-card p-6 space-y-6">
        <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">Иерархия Редкости</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.keys(RARITY_DETAILS).map((rarity) => {
            const count = validElements.filter(e => e && e.rarity === rarity).length;
            return (
              <motion.div
                key={rarity}
                whileHover={{ scale: 1.05, y: -2 }}
                onClick={() => setSelectedRarity({ name: rarity, ...RARITY_DETAILS[rarity] })}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all flex flex-col items-center text-center gap-1 shadow-sm",
                  RARITY_COLORS[rarity as Rarity] || "bg-sepia/5 border-sepia/10"
                )}
              >
                <span className="text-[14px] font-bold uppercase tracking-tight truncate w-full">{rarity}</span>
                <div className="text-[14px] font-mono opacity-80 font-bold">{count}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rarity Calculator */}
      <div className="parchment-card p-6 space-y-6">
        <div className="text-center space-y-1">
          <h3 className="font-gothic text-xl tracking-widest text-gold uppercase">Калькулятор Редкости</h3>
          <p className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">Прогноз вероятности трансмутации</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 items-center justify-center bg-gold/5 p-6 rounded-2xl border border-gold/10">
          <div className="flex flex-col gap-2 w-full md:w-56">
            <label className="text-[14px] uppercase font-bold text-gold tracking-widest text-center">Элемент A</label>
            <select 
              value={rarityA} 
              onChange={(e) => setRarityA(e.target.value)}
              className="bg-parchment border border-gold/20 rounded-lg p-3 text-[14px] font-bold text-sepia outline-none focus:border-gold shadow-inner appearance-none cursor-pointer text-center"
            >
              {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="text-gold font-gothic text-3xl animate-pulse">+</div>
          <div className="flex flex-col gap-2 w-full md:w-56">
            <label className="text-[14px] uppercase font-bold text-gold tracking-widest text-center">Элемент B</label>
            <select 
              value={rarityB} 
              onChange={(e) => setRarityB(e.target.value)}
              className="bg-parchment border border-gold/20 rounded-lg p-3 text-[14px] font-bold text-sepia outline-none focus:border-gold shadow-inner appearance-none cursor-pointer text-center"
            >
              {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-sepia/5 rounded-xl border border-sepia/10 overflow-hidden shadow-inner">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gold/10 border-b border-gold/20">
                <th className="p-4 text-[14px] uppercase font-bold text-gold tracking-widest">Редкость Результата</th>
                <th className="p-4 text-[14px] uppercase font-bold text-gold tracking-widest text-right">Вероятность</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(calculateRarityChances(rarityA, rarityB))
                .sort((a, b) => RARITY_ORDER.indexOf(b[0]) - RARITY_ORDER.indexOf(a[0]))
                .map(([rarity, chance]) => (
                <tr key={rarity} className="border-b border-sepia/5 last:border-0 hover:bg-gold/5 transition-colors">
                  <td className="p-4">
                    <span className={cn(
                      "text-[14px] font-bold uppercase px-3 py-1 rounded-full border shadow-sm",
                      RARITY_COLORS[rarity as Rarity] || "bg-sepia/5 border-sepia/10"
                    )}>
                      {rarity}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 h-2 bg-sepia/10 rounded-full overflow-hidden hidden sm:block">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${chance}%` }}
                          className="h-full bg-gold"
                        />
                      </div>
                      <span className="font-mono text-[14px] font-bold text-sepia w-12 text-right">{chance}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gold/5 p-4 rounded-lg border border-gold/20">
          <p className="text-[14px] text-sepia/80 italic text-center leading-relaxed font-serif">
            <Sparkles size={14} className="inline mr-1 text-gold" />
            Закон Редкости гласит: соединение двух элементов одинаковой высокой редкости дает максимальный шанс на прорыв к следующему уровню материи. Смешивание разных уровней обычно приводит к усреднению результата.
          </p>
        </div>
      </div>

      {/* Rank Hierarchy */}
      <div className="parchment-card p-6 space-y-6">
        <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">ИЕРАРХИЯ ПОЗНАНИЯ</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {RANKS.map((rank, idx) => {
            const isCurrent = currentRank.name === rank.name;
            const isUnlocked = totalElements >= rank.min;
            
            return (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => setSelectedRank(rank)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center gap-3 relative overflow-hidden",
                  isCurrent 
                    ? 'bg-gold/10 border-gold/40 text-gold shadow-[0_0_15px_rgba(201,163,67,0.2)]' 
                    : isUnlocked 
                      ? 'bg-parchment/40 border-sepia/20 text-sepia hover:bg-parchment/60 hover:border-gold/30' 
                      : 'bg-sepia/5 border-sepia/10 opacity-60 grayscale italic text-sepia/60'
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-2xl border",
                  isCurrent ? "bg-gold/20 border-gold/30" : "bg-sepia/5 border-sepia/10"
                )}>
                  <span className="element-icon-filter">{rank.icon}</span>
                </div>
                <div>
                  <div className="text-[14px] uppercase font-bold tracking-widest opacity-80 mb-1">Ранг {idx + 1}</div>
                  <div className="text-[14px] font-bold uppercase tracking-wider leading-tight">{rank.name}</div>
                </div>
                <div className="text-[14px] font-mono opacity-70 mt-auto font-bold">
                  {rank.levels} Ур.
                </div>
                {isCurrent && (
                  <div className="absolute top-2 right-2">
                    <Sparkles size={14} className="text-gold animate-pulse" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reality Layers */}
      <div className="parchment-card p-6 space-y-6">
        <h3 className="font-gothic text-xl tracking-widest text-gold text-center uppercase">Слои Реальности</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {REALITY_LAYERS.map((layer) => {
            const layerElements = elements.filter(e => 
              e && e.realityLevel === layer.level && 
              !INITIAL_ELEMENTS.some(ie => ie && ie.id === e.id)
            ).length;
            const isUnlocked = maxReality >= layer.level;
            let isAvailable = isUnlocked;
            if (!isUnlocked && layer.level === maxReality + 1) {
              const prevLayerNewElements = elements.filter(e => 
                e && e.realityLevel === layer.level - 1 && 
                !INITIAL_ELEMENTS.some(ie => ie && ie.id === e.id)
              ).length;
              if (layer.level === 2) isAvailable = prevLayerNewElements >= 10;
              if (layer.level === 3) isAvailable = prevLayerNewElements >= 15 && elements.some(e => e && e.essences?.includes('life'));
              if (layer.level === 4) isAvailable = prevLayerNewElements >= 25;
              if (layer.level === 5) isAvailable = prevLayerNewElements >= 50;
            }
            const LayerIcon = LAYER_ICONS[layer.level] || Shield;
            return (
              <motion.div 
                key={layer.level} 
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedLayer(layer)}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden",
                  isUnlocked 
                    ? 'bg-gold/5 border-gold/30 text-sepia' 
                    : isAvailable 
                      ? 'bg-parchment/40 border-gold/20 text-sepia/80' 
                      : 'bg-sepia/5 border-sepia/10 opacity-60 grayscale'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "p-2 rounded-lg border",
                    isUnlocked ? "bg-gold/20 border-gold/30 text-gold" : "bg-sepia/5 border-sepia/10 text-sepia/40"
                  )}>
                    <LayerIcon size={20} />
                  </div>
                  <span className="text-[14px] font-mono opacity-70 font-bold">#{layer.level}</span>
                </div>
                <div>
                  <div className="font-bold text-[14px] uppercase tracking-wider truncate">{layer.name}</div>
                  <p className="text-[14px] italic opacity-80 line-clamp-2 mt-1">
                    {isAvailable ? layer.desc : 'Слой заблокирован'}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-auto pt-2 border-t border-sepia/5">
                  <span className="text-[14px] uppercase font-bold tracking-tight text-gold">{layerElements} новых</span>
                  <Info size={14} className="text-gold/60" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rank Modal */}
      <AnimatePresence>
        {selectedRank && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedRank(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="parchment-card max-w-md w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedRank(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center text-5xl border border-gold/20 shadow-xl">
                  <span className="element-icon-filter">{selectedRank.icon}</span>
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Ранг Алхимика</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia uppercase">{selectedRank.name}</h2>
                  <div className="text-[14px] font-mono text-gold mt-1 font-bold">Уровни: {selectedRank.levels}</div>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <div className="space-y-4 text-left w-full">
                  <div>
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Суть Ранга</h4>
                    <p className="text-[14px] text-sepia italic">{selectedRank.desc}</p>
                  </div>
                  <div className="bg-sepia/5 p-4 rounded border border-sepia/10">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Info size={14} /> Подробности</h4>
                    <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedRank.detail}</p>
                  </div>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <p className="text-[14px] text-sepia/60 uppercase tracking-widest font-bold">Требуется элементов: {selectedRank.min}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Law Modal */}
      <AnimatePresence>
        {selectedLaw && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedLaw(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="parchment-card max-w-md w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedLaw(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center text-gold border border-gold/20">
                  {React.createElement(LAW_ICONS[selectedLaw.icon] || Sparkles, { size: 40 })}
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Закон Мироздания</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia break-words leading-tight">{selectedLaw.name}</h2>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <p className="text-sepia italic leading-relaxed text-[14px]">"{selectedLaw.desc}"</p>
                <div className="bg-gold/5 p-4 rounded border border-gold/20 text-left">
                  <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Sparkles size={14} /> Тайное Знание</h4>
                  <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedLaw.detail}</p>
                </div>
                <p className="text-[14px] text-sepia/60 uppercase tracking-widest font-bold">Этот закон теперь влияет на ваши трансмутации</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reality Layer Modal */}
      <AnimatePresence>
        {selectedLayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedLayer(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="parchment-card max-w-md w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedLayer(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-sepia/5 flex items-center justify-center text-gold border border-gold/20">
                  {React.createElement(LAYER_ICONS[selectedLayer.level] || Shield, { size: 40 })}
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Слой Реальности {selectedLayer.level}</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia uppercase">{selectedLayer.name}</h2>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <div className="space-y-4 text-left w-full">
                  <div>
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Суть Слоя</h4>
                    <p className="text-[14px] text-sepia italic">{selectedLayer.desc}</p>
                  </div>
                  <div className="bg-sepia/5 p-4 rounded border border-sepia/10">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Sparkles size={14} /> Законы Слоя</h4>
                    <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedLayer.rules}</p>
                  </div>
                  <div className="pt-2">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Как открыть</h4>
                    <p className="text-[14px] text-sepia/80 font-bold uppercase tracking-wider">{selectedLayer.unlock}</p>
                  </div>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <p className="text-[14px] text-sepia/60 uppercase tracking-widest font-bold">Познание слоев открывает путь к высшей алхимии</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rarity Modal */}
      <AnimatePresence>
        {selectedRarity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedRarity(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn(
                "parchment-card max-w-md w-full p-8 relative border-2",
                RARITY_COLORS[selectedRarity.name as Rarity] || "border-gold/40"
              )}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedRarity(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center text-gold border shadow-xl",
                  RARITY_COLORS[selectedRarity.name as Rarity] || "bg-gold/10 border-gold/20"
                )}>
                  <Sparkles size={40} />
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Уровень Редкости</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia uppercase">{selectedRarity.name}</h2>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <div className="space-y-4 text-left w-full">
                  <div>
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Описание</h4>
                    <p className="text-[14px] text-sepia italic">{selectedRarity.desc}</p>
                  </div>
                  <div className="bg-sepia/5 p-4 rounded border border-sepia/10">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Info size={14} /> Правила и Свойства</h4>
                    <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedRarity.rules}</p>
                  </div>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <p className="text-[14px] text-sepia/60 uppercase tracking-widest font-bold">Редкость определяет ценность и сложность элемента</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Type Modal */}
      <AnimatePresence>
        {selectedType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedType(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="parchment-card max-w-md w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedType(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center text-gold border border-gold/20 shadow-xl">
                  <Globe size={40} />
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Тип Элемента</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia uppercase">{selectedType.name}</h2>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <div className="space-y-4 text-left w-full">
                  <div>
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Описание</h4>
                    <p className="text-[14px] text-sepia italic">{selectedType.desc}</p>
                  </div>
                  <div className="bg-sepia/5 p-4 rounded border border-sepia/10">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Info size={14} /> Влияние на Игру</h4>
                    <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedType.influence}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Essence Modal */}
      <AnimatePresence>
        {selectedEssence && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
            onClick={() => setSelectedEssence(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 0 }}
              className="parchment-card max-w-md w-full p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedEssence(null)} className="absolute top-4 right-4 text-sepia/60 hover:text-sepia"><X size={22} /></button>
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center text-gold border border-gold/20 shadow-xl">
                  <Zap size={40} />
                </div>
                <div>
                  <div className="text-[14px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Сущность (Эссенция)</div>
                  <h2 className="font-gothic text-xl md:text-3xl tracking-widest text-sepia uppercase">{translateEssence(selectedEssence.name)}</h2>
                </div>
                <div className="w-full h-px bg-sepia/10" />
                <div className="space-y-4 text-left w-full">
                  <div>
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-1">Описание</h4>
                    <p className="text-[14px] text-sepia italic">{selectedEssence.desc}</p>
                  </div>
                  <div className="bg-sepia/5 p-4 rounded border border-sepia/10">
                    <h4 className="text-[14px] uppercase font-bold tracking-widest text-gold mb-2 flex items-center gap-2"><Info size={14} /> Влияние на Синтез</h4>
                    <p className="text-[14px] text-sepia/90 leading-relaxed">{selectedEssence.influence}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dangerous Manipulations & Community Links */}
      <div className="parchment-card p-8 space-y-8">
        <div className="text-center space-y-2">
          <h3 className="font-gothic text-xl tracking-widest text-gold uppercase">Ссылки и сообщество</h3>
          <p className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">Присоединяйтесь к нашему пути</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {arcanaLinks.map((link, idx) => (
            <a 
              key={link.id || idx} 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={cn(
                "flex items-center gap-4 p-4 bg-gold/5 border border-gold/20 rounded-xl hover:bg-gold/10 transition-all group",
                idx === arcanaLinks.length - 1 && arcanaLinks.length % 2 !== 0 && "sm:col-span-2"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold group-hover:scale-110 transition-transform shrink-0">
                <DynamicIcon name={link.icon} size={20} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-sepia flex items-center gap-1">{link.title} <ExternalLink size={12} /></div>
                <div className="text-[14px] text-sepia/70 font-bold uppercase tracking-tight">{link.description}</div>
              </div>
            </a>
          ))}
        </div>

        <div className="pt-8 border-t border-sepia/10">
          <h3 className="font-gothic text-xl tracking-widest text-red-900/60 uppercase text-center mb-6">Опасные Манипуляции</h3>
          <div className="max-w-xs mx-auto space-y-4">
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 border border-red-900/40 text-red-900 hover:bg-red-900/10 transition-all rounded-xl font-bold uppercase tracking-widest text-[14px] shadow-md active:scale-95 cursor-pointer"
            >
              Сбросить Вселенную
            </button>

            <p className="text-[14px] opacity-70 italic text-center font-bold">Путь алхимика бесконечен...</p>
          </div>
        </div>

        {/* Reset Universe Warning Modal */}
        <AnimatePresence>
          {showResetConfirm && (
            <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md parchment-card p-6 border-2 border-red-800 text-sepia shadow-2xl relative"
              >
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                  ⚠️
                </div>
                <h3 className="font-gothic text-xl text-red-900 text-center uppercase tracking-wider mb-2 font-bold">
                  Подтверждение Сброса Вселенной
                </h3>
                <div className="space-y-3 text-[14px] text-sepia/90 my-4 leading-relaxed bg-red-50/50 p-4 rounded-xl border border-red-200">
                  <p className="font-bold text-red-950">Вы уверены, что хотите выполнить полный сброс?</p>
                  <ul className="list-disc list-inside space-y-1 text-[14px]">
                    <li>Из базы данных будут удалены все открытые элементы вашего аккаунта.</li>
                    <li>Кэш текущих элементов, слой реальности и ваш уровень будут сброшены до базовых 8 элементов.</li>
                    <li className="font-bold text-emerald-800">Ваш текущий баланс Энергии AiHim сохранится полностью!</li>
                  </ul>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 bg-sepia/10 hover:bg-sepia/20 text-sepia text-[14px] font-bold uppercase rounded transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={async () => {
                      setShowResetConfirm(false);
                      await onReset();
                      window.location.reload();
                    }}
                    className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white text-[14px] font-bold uppercase tracking-wider rounded shadow transition-all active:scale-95"
                  >
                    Да, Сбросить Вселенную
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
