import React, { useState, useMemo } from 'react';
import { AlchemyElement, Rarity } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hammer, 
  Thermometer, 
  Zap, 
  Shield, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  AlertCircle, 
  Search, 
  Heart, 
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  X,
  Info
} from 'lucide-react';
import { ForgeSparks } from '../components/Animations';
import { ElementCard } from '../components/ElementCard';
import { RARITY_COLORS, STABILITY_TAP_COST, MAINTENANCE_TAP_AIHIM_COST, translateEssence, calculateRank } from '../constants';
import { cn } from '../lib/utils';
import { ElementDetailsModal } from '../components/ElementDetailsModal';
import { ParchmentContainerFrame } from '../components/ParchmentContainerFrame';

interface MaintenanceProps {
  elements: AlchemyElement[];
  setElements: React.Dispatch<React.SetStateAction<AlchemyElement[]>>;
  initialElementId?: string | null;
  onClearInitial?: () => void;
  aihim: number;
  setAihim: React.Dispatch<React.SetStateAction<number>>;
  onOpenShop: () => void;
  onToggleFavorite: (id: string) => void;
  regenTimer: number;
  isSyncingBalance?: boolean;
  onAddToAtelier?: (element: AlchemyElement) => void;
}

export const Maintenance: React.FC<MaintenanceProps> = ({ 
  elements, 
  setElements, 
  initialElementId, 
  onClearInitial, 
  aihim, 
  setAihim,
  onOpenShop,
  onToggleFavorite,
  regenTimer,
  isSyncingBalance,
  onAddToAtelier
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'stability' | 'temperature'>('stability');
  const [selectedId, setSelectedId] = useState<string | null>(initialElementId || null);
  const [tapCount, setTapCount] = useState(0);
  const [tempTapCount, setTempTapCount] = useState(0);
  const [tapAmount, setTapAmount] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState<0 | 1 | 2>(0);
  const [unstableFilter, setUnstableFilter] = useState<0 | 1 | 2>(0);
  const [tempFilter, setTempFilter] = useState<0 | 1 | 2>(0);
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'All'>('All');
  const [isAnvilActive, setIsAnvilActive] = useState(false);
  const [detailsElement, setDetailsElement] = useState<AlchemyElement | null>(null);
  const [isLevelInfoOpen, setIsLevelInfoOpen] = useState(false);

  const { currentRank, level, levelTarget, progressToNextRank, nextRank } = useMemo(() => {
    const validElementsCount = elements.filter(e => e !== null).length;
    return calculateRank(validElementsCount);
  }, [elements]);

  React.useEffect(() => {
    if (initialElementId) {
      setSelectedId(initialElementId);
      // Use setTimeout to defer the state update to the next tick,
      // avoiding the "Cannot update a component while rendering a different component" warning.
      setTimeout(() => {
        onClearInitial?.();
      }, 0);
    }
  }, [initialElementId, onClearInitial]);

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      if (!el) return false;
      
      const matchesSearch = 
        el.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        el.rarity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        el.type.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const matchesRarity = rarityFilter === 'All' || el.rarity === rarityFilter;
      if (!matchesRarity) return false;

      const isFav = !!el.isFavorite;
      const isUnstable = (el.stability ?? 100) < 80;
      const isTemp = (el.temperature ?? 0) < (el.targetTemperature ?? 0) - 200;

      const matchesFavorite = favoriteFilter === 0 ? true : (favoriteFilter === 1 ? isFav : !isFav);
      const matchesUnstable = unstableFilter === 0 ? true : (unstableFilter === 1 ? isUnstable : !isUnstable);
      const matchesTemp = tempFilter === 0 ? true : (tempFilter === 1 ? isTemp : !isTemp);

      return matchesFavorite && matchesUnstable && matchesTemp;
    }).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });
  }, [elements, searchQuery, favoriteFilter, rarityFilter, unstableFilter, tempFilter]);

  const selectedElement = useMemo(() => 
    elements.find(e => e && e.id === selectedId),
    [elements, selectedId]
  );

  React.useEffect(() => {
    setTapCount(0);
    setTempTapCount(0);
  }, [selectedId]);

  const clicksRequired = selectedElement ? (STABILITY_TAP_COST[selectedElement.rarity] || 1) : 1;

  const handleTap = (type: 'heat' | 'cool' | 'stability' = 'stability') => {
    if (!selectedElement) return;
    const clickCost = tapAmount; // cost per click = tapAmount AiHim
    if (aihim < clickCost) return;

    if (type === 'stability') {
      if ((selectedElement.stability ?? 100) >= 100) return;
      
      setAihim(prev => prev - clickCost);
      const nextCount = tapCount + 1;

      if (nextCount >= clicksRequired) {
        setTapCount(0);
        const stabilityGain = tapAmount * level;
        setElements(current => {
          const updated = current.map(el => 
            (el && el.id === selectedElement.id) 
              ? { ...el, stability: Math.min(100, (el.stability ?? 100) + stabilityGain) }
              : el
          );
          localStorage.setItem('aihim_elements', JSON.stringify(updated));
          localStorage.setItem('alchimia_discovered_elements', JSON.stringify(updated));
          return updated;
        });
      } else {
        setTapCount(nextCount);
      }
    } else {
      setAihim(prev => prev - clickCost);
      const nextTempCount = tempTapCount + 1;
      const tempStep = tapAmount * level;

      if (nextTempCount >= clicksRequired) {
        setTempTapCount(0);
        if (type === 'heat') {
          setElements(current => {
            const updated = current.map(el => 
              (el && el.id === selectedElement.id) 
                ? { ...el, temperature: Math.min(1000, (el.temperature ?? 0) + tempStep) }
                : el
            );
            localStorage.setItem('aihim_elements', JSON.stringify(updated));
            localStorage.setItem('alchimia_discovered_elements', JSON.stringify(updated));
            return updated;
          });
        } else if (type === 'cool') {
          setElements(current => {
            const updated = current.map(el => 
              (el && el.id === selectedElement.id) 
                ? { ...el, temperature: Math.max(-273, (el.temperature ?? 0) - tempStep) }
                : el
            );
            localStorage.setItem('aihim_elements', JSON.stringify(updated));
            localStorage.setItem('alchimia_discovered_elements', JSON.stringify(updated));
            return updated;
          });
        }
      } else {
        setTempTapCount(nextTempCount);
      }
    }
  };

  const handleAnvilClick = () => {
    if (!selectedElement || (selectedElement.stability ?? 100) >= 100) return;
    const clickCost = tapAmount;
    if (aihim < clickCost) return;
    if (isAnvilActive) return;
    
    handleTap('stability');
    setIsAnvilActive(true);
    setTimeout(() => setIsAnvilActive(false), 150);
  };

  const handleTempChange = (delta: number) => {
    if (!selectedElement) return;
    setElements(current => {
      const updated = current.map(el => 
        (el && el.id === selectedElement.id) 
          ? { ...el, temperature: Math.max(-100, Math.min(1000, (el.temperature ?? 0) + delta)) }
          : el
      );
      localStorage.setItem('aihim_elements', JSON.stringify(updated));
      localStorage.setItem('alchimia_discovered_elements', JSON.stringify(updated));
      return updated;
    });
  };

  const selectNextLowStabilityElement = () => {
    // Find elements with low stability (stability < 80%) in the list
    let lowStabilityList = elements.filter(el => el && (el.stability ?? 100) < 80);
    
    // Fallback: if there are none < 80%, check for < 100%
    if (lowStabilityList.length === 0) {
      lowStabilityList = elements.filter(el => el && (el.stability ?? 100) < 100);
    }

    if (lowStabilityList.length === 0) return;

    // We want to find the next one after the current selectedId
    const currentIndex = lowStabilityList.findIndex(el => el.id === selectedId);
    let nextElement;
    if (currentIndex === -1 || currentIndex === lowStabilityList.length - 1) {
      // Loop back to the first one
      nextElement = lowStabilityList[0];
    } else {
      nextElement = lowStabilityList[currentIndex + 1];
    }

    if (nextElement) {
      setSelectedId(nextElement.id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Level Info Modal */}
      <AnimatePresence>
        {isLevelInfoOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md parchment-card p-5 bg-parchment border-gold/40 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setIsLevelInfoOpen(false)}
                className="absolute top-3 right-3 text-sepia/60 hover:text-sepia p-1 rounded-full hover:bg-gold/10 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 border-b border-sepia/20 pb-3">
                <div className="p-2 bg-gold/10 rounded-lg text-gold border border-gold/30">
                  <Info size={20} />
                </div>
                <h3 className="font-gothic text-lg text-gold uppercase tracking-widest">
                  Закалка и Уровень
                </h3>
              </div>
              <p className="text-sm md:text-base text-sepia leading-relaxed font-serif italic">
                Чем выше уровень, тем меньше тапов требуется в кузне, и больше энергии добавляется в минуту.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsLevelInfoOpen(false)}
                  className="px-4 py-1.5 bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:bg-gold/80 transition-colors"
                >
                  Понятно
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Hero Stage for Forge: Balance on Top-Left, Rank & Level on Top-Right */}
      <div className="relative w-full flex flex-col items-center justify-center pt-2 pb-2 mb-1 min-h-[120px] md:min-h-[150px]">
        
        {/* Top-Left Overlay: Regeneration Timer */}
        <div className="absolute top-0 left-0 flex flex-col items-start gap-1 z-20 bg-transparent max-w-[48%]">
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-sepia uppercase tracking-wider">
            <RefreshCw size={14} className={`text-gold shrink-0 ${isSyncingBalance ? 'animate-spin text-amber-600 font-bold' : 'animate-spin-slow'}`} />
            <span>+{10 * level} через {regenTimer}с</span>
          </div>
          {isSyncingBalance && (
            <span className="text-[10px] text-amber-700 font-mono font-bold animate-pulse flex items-center gap-1">
              <span>⚡</span> Начисление в БД...
            </span>
          )}
        </div>

        {/* Center Grand Logo */}
        <motion.img 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          src="/file/1/aihim.png" 
          alt="AIhim Grand Logo" 
          className="h-24 md:h-32 object-contain drop-shadow-2xl z-10 my-1 pointer-events-none"
        />

        {/* Top-Right Overlay: Level & Rank */}
        <div className="absolute top-0 right-0 flex flex-col items-end gap-1.5 z-20 bg-transparent max-w-[48%] text-right">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <div className="text-[10px] md:text-[11px] uppercase font-bold text-gold tracking-wider leading-none">
                Ранг: {currentRank.name}
              </div>
              <div className="text-[13px] md:text-[16px] font-gothic text-sepia tracking-wider font-bold leading-tight mt-0.5 flex items-center gap-1">
                <span>Уровень {level}</span>
                <button
                  onClick={() => setIsLevelInfoOpen(true)}
                  className="p-0.5 text-gold/80 hover:text-gold transition-colors rounded-full hover:bg-gold/10"
                  title="Информация об Уровне"
                >
                  <Info size={13} />
                </button>
              </div>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gold/10 flex items-center justify-center text-lg md:text-xl border border-gold/30 shrink-0">
              <span className="element-icon-filter">{currentRank.icon}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="flex flex-col gap-6">
        {/* Inventory Section (Now at the top) */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-gold/5 p-3 rounded-2xl border border-gold/25 shadow-xs">
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles size={18} className="text-gold shrink-0" />
              <h2 className="text-lg md:text-xl font-gothic tracking-widest text-sepia font-bold uppercase">
                ДОСТУПНЫЕ ЭЛЕМЕНТЫ
              </h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {/* Progress Bar Item */}
              <div className="flex items-center gap-2 bg-parchment/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gold/30 shadow-xs shrink-0">
                <span className="text-[12px] font-bold text-[#704214] uppercase tracking-wider whitespace-nowrap">
                  Прогресс: <span className="text-gold font-mono">{elements.length} / {levelTarget}</span>
                </span>
                <div className="w-20 sm:w-28 h-2.5 bg-sepia/20 rounded-full overflow-hidden border border-gold/30">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (elements.length / levelTarget) * 100)}%` }}
                    className="h-full bg-gold"
                  />
                </div>
              </div>
            
              <div className="relative flex-1 md:w-56 min-w-[110px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia/40" size={14} />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 sm:pl-9 pr-6 sm:pr-7 py-1.5 sm:py-2 bg-parchment/65 backdrop-blur-sm border border-sepia/20 rounded-full focus:border-gold outline-none text-xs font-serif italic text-sepia"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sepia/40 hover:text-sepia"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              
              <select
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value as any)}
                className="bg-parchment/65 backdrop-blur-sm border border-sepia/20 rounded-full px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs outline-none focus:border-gold cursor-pointer text-sepia font-serif max-w-[105px] sm:max-w-[125px] md:max-w-none truncate shrink-0"
              >
                <option value="All">Все редкости</option>
                <option value="Обычный">Обычный</option>
                <option value="Редкий">Редкий</option>
                <option value="Эпический">Эпический</option>
                <option value="Легендарный">Легендарный</option>
                <option value="Мифический">Мифический</option>
                <option value="Божественный">Божественный</option>
                <option value="Вечный">Вечный</option>
                <option value="Космический">Космический</option>
                <option value="Изначальный">Изначальный</option>
                <option value="Трансцендентный">Трансцендентный</option>
                <option value="Запретный">Запретный</option>
              </select>

              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => setFavoriteFilter(((favoriteFilter + 1) % 3) as 0 | 1 | 2)}
                  title={favoriteFilter === 0 ? "Эфирные Узы: Все элементы" : favoriteFilter === 1 ? "Эфирные Узы: Только совпадения (+Избранное)" : "Эфирные Узы: Исключить совпадения (-Избранное)"}
                  className={cn(
                    "p-1.5 sm:p-2 md:px-2.5 text-xs rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-sm relative",
                    favoriteFilter === 0 && "bg-parchment/65 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    favoriteFilter === 1 && "bg-red-500/15 border-red-500/60 text-red-600 shadow-[0_0_10px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30 font-semibold",
                    favoriteFilter === 2 && "bg-red-950/20 border-red-700/70 text-red-700 shadow-inner ring-1 ring-red-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <Heart size={15} className={favoriteFilter === 1 ? "fill-red-500 text-red-500" : favoriteFilter === 2 ? "text-red-700 opacity-60" : ""} />
                    {favoriteFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {favoriteFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-red-700 bg-red-100 rounded-full px-1 border border-red-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="hidden lg:inline text-xs font-serif ml-1.5">
                    {favoriteFilter === 0 ? "Узы" : favoriteFilter === 1 ? "+Узы" : "-Узы"}
                  </span>
                </button>

                <button 
                  onClick={() => setUnstableFilter(((unstableFilter + 1) % 3) as 0 | 1 | 2)}
                  title={unstableFilter === 0 ? "Распад: Все элементы" : unstableFilter === 1 ? "Распад: Только нестабильные (+Распад)" : "Распад: Исключить нестабильные (-Распад)"}
                  className={cn(
                    "p-1.5 sm:p-2 md:px-2.5 text-xs rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-sm relative",
                    unstableFilter === 0 && "bg-parchment/65 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    unstableFilter === 1 && "bg-amber-500/15 border-amber-500/60 text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30 font-semibold",
                    unstableFilter === 2 && "bg-amber-950/20 border-amber-700/70 text-amber-700 shadow-inner ring-1 ring-amber-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <ShieldAlert size={15} className={unstableFilter === 1 ? "text-amber-600" : unstableFilter === 2 ? "text-amber-700 opacity-60" : ""} />
                    {unstableFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {unstableFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-amber-800 bg-amber-100 rounded-full px-1 border border-amber-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="hidden lg:inline text-xs font-serif ml-1.5">
                    {unstableFilter === 0 ? "Распад" : unstableFilter === 1 ? "+Распад" : "-Распад"}
                  </span>
                </button>

                <button 
                  onClick={() => setTempFilter(((tempFilter + 1) % 3) as 0 | 1 | 2)}
                  title={tempFilter === 0 ? "Термо: Все элементы" : tempFilter === 1 ? "Термо: Только аномалии (+Термо)" : "Термо: Исключить аномалии (-Термо)"}
                  className={cn(
                    "p-1.5 sm:p-2 md:px-2.5 text-xs rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-sm relative",
                    tempFilter === 0 && "bg-parchment/65 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    tempFilter === 1 && "bg-cyan-500/15 border-cyan-500/60 text-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/30 font-semibold",
                    tempFilter === 2 && "bg-cyan-950/20 border-cyan-700/70 text-cyan-700 shadow-inner ring-1 ring-cyan-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <Thermometer size={15} className={tempFilter === 1 ? "text-cyan-600" : tempFilter === 2 ? "text-cyan-700 opacity-60" : ""} />
                    {tempFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {tempFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-cyan-800 bg-cyan-100 rounded-full px-1 border border-cyan-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="hidden lg:inline text-xs font-serif ml-1.5">
                    {tempFilter === 0 ? "Термо" : tempFilter === 1 ? "+Термо" : "-Термо"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="parchment-card p-0 relative z-10 overflow-hidden bg-sepia/[0.02] shadow-inner">
            <ParchmentContainerFrame />
            <div className="p-4 md:p-6 h-[300px] md:h-[400px] !overflow-y-auto custom-scrollbar touch-pan-y relative z-10">
              {filteredElements.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pb-10 justify-items-center">
                  {filteredElements.map(el => (
                    <ElementCard 
                      key={el.id} 
                      element={el} 
                      isSelected={selectedId === el.id}
                      onToggleFavorite={onToggleFavorite}
                      onClick={() => {
                        setDetailsElement(el);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sepia/40 italic font-serif">
                  Ничего не найдено в свитках...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Forge Table Section (Now at the bottom) */}
        <div className="mt-4 flex flex-col items-center gap-4">
          <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-sepia/20 to-transparent opacity-50" />
          
          <div 
            className="relative flex flex-col items-center justify-start gap-4 pt-16 md:pt-24 pb-8 md:pb-12 px-4 md:px-8 w-full max-w-5xl !overflow-visible bg-no-repeat bg-center bg-cover border-4 border-gold/20 rounded-[2rem] md:rounded-[3rem] min-h-[980px] md:min-h-0 aspect-auto md:aspect-[16/10] transition-all duration-500 mx-auto shadow-2xl"
            style={{ 
              backgroundImage: "url('/file/3/kuznya.png')",
            }}
          >
            <div className="absolute inset-0 bg-ink/20 rounded-[2rem] md:rounded-[3rem] pointer-events-none" />
            
            <div className="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 bg-parchment/60 backdrop-blur-sm px-6 md:px-12 py-2 md:py-4 border-2 border-ink/90 rounded-full text-[10px] md:text-sm uppercase tracking-[0.2em] md:tracking-[0.5em] font-black text-ink z-20 whitespace-nowrap flex items-center gap-2 md:gap-4">
              <Hammer className="w-4 h-4 md:w-8 md:h-8 text-gold" />
              КУЗНЕЧНЫЙ ГОРН
            </div>

            <div className="relative z-10 flex flex-col items-center gap-4 md:gap-8 w-full max-w-4xl">
              {/* Mode Switcher and Add to Table Button */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4 md:-mt-4">
                <div className="flex bg-parchment/40 backdrop-blur-md p-1 rounded-full border border-gold/40">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('stability')}
                    className={`px-6 py-2 rounded-full text-xs uppercase font-bold tracking-widest transition-all ${
                      activeSubTab === 'stability' ? 'bg-gold text-white shadow-lg' : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    Стабильность
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('temperature')}
                    className={`px-6 py-2 rounded-full text-xs uppercase font-bold tracking-widest transition-all ${
                      activeSubTab === 'temperature' ? 'bg-gold text-white shadow-lg' : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    Температура
                  </button>
                </div>

                {selectedElement && onAddToAtelier && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onAddToAtelier(selectedElement)}
                    className="hidden md:flex px-6 py-2 bg-gold hover:bg-gold/90 text-white font-gothic text-xs uppercase tracking-widest rounded-full items-center gap-2 shadow-glow border border-gold/50 transition-all font-bold"
                  >
                    <Sparkles size={12} className="text-white animate-pulse" />
                    На стол трансмутации
                  </motion.button>
                )}
              </div>

              <AnimatePresence mode="wait">
                {selectedElement ? (
                  <motion.div
                    key={selectedElement.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center w-full max-w-4xl"
                  >
                    {activeSubTab === 'stability' ? (
                      <div className="flex flex-col items-center gap-4 md:gap-8 w-full">
                        {/* DESKTOP VERSION */}
                        <div className="hidden md:flex relative flex-col items-center justify-center min-h-[450px] w-full">
                          {/* Element Card and Slider - Responsive layout */}
                          <div className="absolute left-0 lg:left-4 xl:left-10 top-0 z-20 flex flex-col items-center items-start scale-100 w-auto">
                            <div className="opacity-90 hover:opacity-100 transition-opacity w-[192px] h-[252px] flex items-center justify-center">
                              <ElementCard element={selectedElement} className="w-full h-full" forgeMode={true} />
                            </div>
                            
                            {/* Tap Amount Slider */}
                            <div className="mt-4 bg-parchment/90 backdrop-blur-sm p-3 rounded-lg border-2 border-ink/90 w-52 shadow-xl">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">Расход</span>
                                <span className="text-[14px] font-bold text-gold font-['Courier_New']">{tapAmount} AiHim / кл.</span>
                              </div>
                              <input 
                                type="range"
                                min="1"
                                max="10"
                                value={tapAmount}
                                onChange={(e) => setTapAmount(parseInt(e.target.value))}
                                className="w-full h-1 accent-gold cursor-pointer"
                              />
                              <div className="flex justify-between text-[14px] text-sepia/50 mt-1 uppercase font-bold font-['Courier_New']">
                                <span>{1 * level}%</span>
                                <span>Макс: {10 * level}%</span>
                              </div>
                              <div className="mt-2 pt-1 border-t border-sepia/10 text-center flex flex-col gap-0.5">
                                <p className="text-[14px] uppercase font-bold text-gold">При клике: +{tapAmount * level}% стабильности</p>
                              </div>
                            </div>
                          </div>

                          {/* The Anvil Sprites - Centered and Raised */}
                          <div className="relative z-10 flex flex-col items-center -mt-16">
                            <div className="relative">
                              <motion.div
                                className="relative cursor-pointer select-none group w-72 aspect-square flex items-center justify-center"
                                onClick={handleAnvilClick}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {/* Background Glow Animation */}
                                <motion.div
                                  className="absolute inset-0 bg-gold/20 blur-3xl rounded-full -z-10"
                                  animate={{ 
                                    scale: [1, 1.3, 1],
                                    opacity: [0.1, 0.4, 0.1]
                                  }}
                                  transition={{ 
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />

                                <AnimatePresence initial={false}>
                                  {!isAnvilActive ? (
                                    <motion.div
                                      key="anvil-idle"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.08 }}
                                      className="absolute inset-0 flex items-center justify-center"
                                    >
                                      <img 
                                        src="/file/6/nakvalnia2.png" 
                                        alt="Anvil Idle" 
                                        className="w-full h-auto pointer-events-none drop-shadow-[0_0_20px_rgba(201,163,67,0.4)]"
                                        referrerPolicy="no-referrer"
                                      />
                                      {/* Idle Pulsing Sparkles */}
                                      <motion.div
                                        className="absolute inset-0 -z-10"
                                        animate={{ 
                                          opacity: [0.2, 0.5, 0.2],
                                          scale: [0.9, 1.1, 0.9]
                                        }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                      >
                                        <div className="w-full h-full bg-gold/5 blur-3xl rounded-full" />
                                      </motion.div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="anvil-active"
                                      initial={{ opacity: 0, scale: 1.1 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.04 }}
                                      className="absolute inset-0 flex items-center justify-center"
                                    >
                                      <img 
                                        src="/file/5/nakvalnia.png" 
                                        alt="Anvil Strike" 
                                        className="w-full h-auto pointer-events-none drop-shadow-[0_0_30px_rgba(201,163,67,0.7)]"
                                        referrerPolicy="no-referrer"
                                      />
                                      <ForgeSparks active={isAnvilActive} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>

                              {/* Next element switch button */}
                              <button
                                type="button"
                                onClick={selectNextLowStabilityElement}
                                className="absolute -right-20 top-1/2 -translate-y-1/2 w-12 h-12 bg-gold hover:bg-gold/90 text-white border-2 border-ink rounded-full shadow-glow transition-all active:scale-95 flex items-center justify-center group/btn z-30"
                                title="Следующий элемент с низкой стабильностью"
                              >
                                <ChevronRight size={28} className="text-white group-hover/btn:translate-x-0.5 transition-transform" />
                              </button>
                            </div>

                            {/* Info Block Under Sprites */}
                            <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-md px-4">
                              {/* Progress bar above UKREPLENIE */}
                              <div className="bg-parchment/90 backdrop-blur-md p-3 rounded-xl border-2 border-ink/90 w-full shadow-lg">
                                <div className="flex justify-between items-center w-full text-[14px] uppercase font-bold text-sepia/80 font-['Courier_New'] mb-1">
                                  <span>Кликов до эффекта:</span>
                                  <span className="text-gold">{tapCount} / {clicksRequired}</span>
                                </div>
                                <div className="w-full bg-sepia/20 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-gold h-full transition-all duration-200"
                                    style={{ width: `${(tapCount / clicksRequired) * 100}%` }}
                                  />
                                </div>
                              </div>

                              <div className="bg-parchment/90 backdrop-blur-md p-3 rounded-xl border-2 border-ink/90 text-center shadow-2xl w-full -mt-4">
                                <h3 className="font-gothic text-lg text-sepia mb-1 tracking-widest">УКРЕПЛЕНИЕ</h3>
                                <div className="flex flex-col gap-1">
                                  <p className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">
                                    Стабильность: {selectedElement.stability ?? 100}%
                                  </p>
                                  <p className="text-[14px] uppercase font-bold text-gold tracking-widest mt-0.5">
                                    Норма: 80%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* MOBILE VERSION */}
                        <div className="flex md:hidden flex-col items-center gap-5 w-full !overflow-visible">
                          {/* 1. Сначала карточка элемента */}
                          <div className="opacity-95 hover:opacity-100 transition-opacity w-[156px] h-[194px] flex items-center justify-center shrink-0">
                            <ElementCard element={selectedElement} className="w-full h-full" forgeMode={true} />
                          </div>

                          {/* 2. Затем Картинка активная наковальни */}
                          <div className="relative z-10 flex flex-col items-center">
                            <div className="relative">
                              <motion.div
                                className="relative cursor-pointer select-none group w-64 aspect-square flex items-center justify-center"
                                onClick={handleAnvilClick}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {/* Background Glow Animation */}
                                <motion.div
                                  className="absolute inset-0 bg-gold/20 blur-3xl rounded-full -z-10"
                                  animate={{ 
                                    scale: [1, 1.3, 1],
                                    opacity: [0.1, 0.4, 0.1]
                                  }}
                                  transition={{ 
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />

                                <AnimatePresence initial={false}>
                                  {!isAnvilActive ? (
                                    <motion.div
                                      key="anvil-idle-mobile"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.08 }}
                                      className="absolute inset-0 flex items-center justify-center"
                                    >
                                      <img 
                                        src="/file/6/nakvalnia2.png" 
                                        alt="Anvil Idle" 
                                        className="w-full h-auto pointer-events-none drop-shadow-[0_0_20px_rgba(201,163,67,0.4)]"
                                        referrerPolicy="no-referrer"
                                      />
                                      <motion.div
                                        className="absolute inset-0 -z-10"
                                        animate={{ 
                                          opacity: [0.2, 0.5, 0.2],
                                          scale: [0.9, 1.1, 0.9]
                                        }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                      >
                                        <div className="w-full h-full bg-gold/5 blur-3xl rounded-full" />
                                      </motion.div>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="anvil-active-mobile"
                                      initial={{ opacity: 0, scale: 1.1 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.04 }}
                                      className="absolute inset-0 flex items-center justify-center"
                                    >
                                      <img 
                                        src="/file/5/nakvalnia.png" 
                                        alt="Anvil Strike" 
                                        className="w-full h-auto pointer-events-none drop-shadow-[0_0_30px_rgba(201,163,67,0.7)]"
                                        referrerPolicy="no-referrer"
                                      />
                                      <ForgeSparks active={isAnvilActive} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>

                              {/* Next element switch button on mobile */}
                              <button
                                type="button"
                                onClick={selectNextLowStabilityElement}
                                className="absolute -right-10 top-1/2 -translate-y-1/2 w-10 h-10 bg-gold hover:bg-gold/90 text-white border border-ink rounded-full shadow-glow transition-all active:scale-95 flex items-center justify-center z-30"
                                title="Следующий элемент с низкой стабильностью"
                              >
                                <ChevronRight size={24} className="text-white" />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar above UKREPLENIE on Mobile */}
                          <div className="bg-parchment/90 backdrop-blur-md p-3 rounded-xl border-2 border-ink/90 w-[320px] shadow-lg shrink-0">
                            <div className="flex justify-between items-center w-full text-[14px] uppercase font-bold text-sepia/80 font-['Courier_New'] mb-1">
                              <span>Кликов до эффекта:</span>
                              <span className="text-gold">{tapCount} / {clicksRequired}</span>
                            </div>
                            <div className="w-full bg-sepia/20 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-gold h-full transition-all duration-200"
                                style={{ width: `${(tapCount / clicksRequired) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* 3. Затем блок Укрепление с показом текущего процента */}
                          <div className="bg-parchment/90 backdrop-blur-md p-4 rounded-xl border-2 border-ink/90 text-center shadow-2xl w-[320px] shrink-0">
                            <h3 className="font-gothic text-[14px] text-sepia mb-1 tracking-widest font-black uppercase">УКРЕПЛЕНИЕ</h3>
                            <div className="flex flex-col gap-1">
                              <p className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">
                                Стабильность: {selectedElement.stability ?? 100}%
                              </p>
                              <p className="text-[14px] uppercase font-bold text-gold tracking-widest mt-0.5">
                                Норма: 80%
                              </p>
                            </div>
                          </div>

                          {/* 4. Затем Калькулятор Расход */}
                          <div className="bg-parchment/95 backdrop-blur-sm p-4 rounded-xl border-2 border-ink/90 w-[320px] shadow-xl shrink-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">Расход</span>
                              <span className="text-[14px] font-bold text-gold font-['Courier_New']">{tapAmount} AiHim / кл.</span>
                            </div>
                            <input 
                              type="range"
                              min="1"
                              max="10"
                              value={tapAmount}
                              onChange={(e) => setTapAmount(parseInt(e.target.value))}
                              className="w-full h-1 accent-gold cursor-pointer"
                            />
                            <div className="flex justify-between text-[14px] text-sepia/50 mt-1 uppercase font-bold font-['Courier_New']">
                              <span>{1 * level}%</span>
                              <span>Макс: {10 * level}%</span>
                            </div>
                            <div className="mt-2 pt-1 border-t border-sepia/10 text-center flex flex-col gap-0.5">
                              <p className="text-[14px] uppercase font-bold text-gold">При клике: +{tapAmount * level}% стабильности</p>
                            </div>
                          </div>

                          {/* 5. Затем кнопка На стол Трансмутации */}
                          {selectedElement && onAddToAtelier && (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => onAddToAtelier(selectedElement)}
                              className="w-[320px] py-3.5 bg-gold hover:bg-gold/90 text-white font-gothic text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-glow border border-gold/50 transition-all font-bold shrink-0"
                            >
                              <Sparkles size={12} className="text-white animate-pulse" />
                              На стол трансмутации
                            </motion.button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 w-full">
                        <div className="relative">
                          <div className="absolute -inset-4 bg-gold/20 blur-2xl rounded-full animate-pulse" />
                          <div className="opacity-90 hover:opacity-100 transition-opacity w-[192px] h-[252px] flex items-center justify-center mx-auto relative z-10">
                            <ElementCard element={selectedElement} className="w-full h-full" forgeMode={true} />
                          </div>
                          
                          {/* Tap Amount Slider */}
                          <div className="mt-8 md:mt-12 bg-parchment/60 backdrop-blur-sm p-4 rounded-xl border border-ink/90 w-full">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">Шаг температуры</span>
                              <span className="text-[14px] font-bold text-gold font-['Courier_New']">{tapAmount * level}°C ({tapAmount} AiHim / кл.)</span>
                            </div>
                            <input 
                              type="range"
                              min="1"
                              max="10"
                              value={tapAmount}
                              onChange={(e) => setTapAmount(parseInt(e.target.value))}
                              className="w-full accent-gold cursor-pointer"
                            />
                            <div className="flex justify-between text-[14px] text-sepia/50 mt-1 uppercase font-bold font-['Courier_New']">
                              <span>{1 * level}°C</span>
                              <span>Макс: {10 * level}°C</span>
                            </div>
                            <div className="mt-2 pt-1 border-t border-sepia/10 text-center flex flex-col gap-0.5">
                              <p className="text-[14px] uppercase font-bold text-gold">При клике: ±{tapAmount * level}°C</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center md:items-start gap-6 w-full max-w-sm">
                          <div className="w-full flex flex-col gap-4">
                            <div className="bg-parchment/60 backdrop-blur-sm p-3 rounded-xl border border-ink/90 text-center md:text-left">
                              <h3 className="font-gothic text-lg text-sepia mb-1">ТЕРМОКОНТРОЛЬ</h3>
                              <div className="flex flex-col gap-1">
                                <p className="text-[14px] uppercase font-bold text-sepia/60 tracking-widest">
                                  Текущая: {selectedElement.temperature ?? 0}°C
                                </p>
                                <p className="text-[14px] uppercase font-bold text-gold tracking-widest">
                                  Норма: {selectedElement.targetTemperature ?? 0}°C
                                </p>
                              </div>
                            </div>

                            {/* Progress bar above HEAT & COOL buttons */}
                            <div className="bg-parchment/60 backdrop-blur-sm p-3 rounded-xl border border-ink/90 w-full -mt-2.5">
                              <div className="flex justify-between items-center w-full text-[14px] uppercase font-bold text-sepia/80 font-['Courier_New'] mb-1">
                                <span>Кликов до эффекта:</span>
                                <span className="text-gold">{tempTapCount} / {clicksRequired}</span>
                              </div>
                              <div className="w-full bg-sepia/20 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-gold h-full transition-all duration-200"
                                  style={{ width: `${(tempTapCount / clicksRequired) * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex gap-4 w-full">
                              <motion.button
                                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(220, 38, 38, 0.4)" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleTap('heat')}
                                disabled={aihim < tapAmount}
                                className={`flex-1 py-4 rounded-2xl font-gothic text-lg md:text-xl tracking-[0.2em] transition-all duration-500 border-2 backdrop-blur-sm flex flex-col items-center justify-center gap-1 ${
                                  aihim >= tapAmount
                                    ? 'bg-red-600/60 text-white border-ink/90 cursor-pointer' 
                                    : 'bg-parchment/40 text-ink/40 border-ink/30 cursor-not-allowed'
                                }`}
                              >
                                <ArrowUp size={20} />
                                <span className="font-black">НАГРЕВ</span>
                              </motion.button>

                              <motion.button
                                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(37, 99, 235, 0.4)" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleTap('cool')}
                                disabled={aihim < tapAmount}
                                className={`flex-1 py-4 rounded-2xl font-gothic text-lg md:text-xl tracking-[0.2em] transition-all duration-500 border-2 backdrop-blur-sm flex flex-col items-center justify-center gap-1 ${
                                  aihim >= tapAmount
                                    ? 'bg-blue-600/60 text-white border-ink/90 cursor-pointer' 
                                    : 'bg-parchment/40 text-ink/40 border-ink/30 cursor-not-allowed'
                                }`}
                              >
                                <ArrowDown size={20} />
                                <span className="font-black">ОХЛАД</span>
                              </motion.button>
                            </div>
                            
                            {selectedElement && onAddToAtelier && (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onAddToAtelier(selectedElement)}
                                className="md:hidden w-full py-3 bg-gold hover:bg-gold/90 text-white font-gothic text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-glow border border-gold/50 transition-all font-bold"
                              >
                                <Sparkles size={12} className="text-white animate-pulse" />
                                На стол трансмутации
                              </motion.button>
                            )}
                            
                            <div className="p-3 bg-parchment/40 backdrop-blur-sm rounded-lg border border-ink/40 flex items-center gap-2">
                              <AlertCircle size={16} className="text-gold shrink-0" />
                              <p className="text-[14px] text-ink/80 leading-tight uppercase font-bold">
                                Синтез невозможен при разнице температур более 200°C.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-gold/40 flex items-center justify-center mb-4">
                      <Sparkles size={40} className="text-gold/40 animate-pulse" />
                    </div>
                    <p className="font-gothic text-xl text-sepia-900 tracking-widest text-center">
                      ВЫБЕРИТЕ СУЩНОСТЬ <br /> ДЛЯ РАБОТЫ В ГОРНЕ
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Decorative Alchemical Symbols */}
            <div className="absolute bottom-6 left-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜔</div>
            <div className="absolute bottom-6 right-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜂</div>
            <div className="absolute top-6 left-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜃</div>
            <div className="absolute top-6 right-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜁</div>
          </div>

          {/* Separate Block Below (Unlinked with Forge image background) */}
          <div className="mt-8 flex flex-col items-center gap-2 text-center px-6 py-4 bg-parchment/60 backdrop-blur-sm rounded-xl border border-ink/90 shadow-lg w-full max-w-xl z-10 mx-auto">
            <div className="flex items-center gap-2 text-ink justify-center">
              <Hammer size={16} className="animate-pulse text-gold" />
              <p className="text-[14px] md:text-[16px] uppercase tracking-[0.1em] md:tracking-[0.2em] font-black">
                {activeSubTab === 'stability' ? 'Укрепление Структуры' : 'Термическая Настройка'}
              </p>
              <Hammer size={16} className="animate-pulse text-gold" />
            </div>
            <p className="text-[12px] md:text-[14px] uppercase tracking-widest text-ink/60 font-medium italic">
              {activeSubTab === 'stability' 
                ? 'Восстановите целостность элемента для безопасного синтеза' 
                : 'Поддерживайте идеальный баланс температур для Великого Делания'}
            </p>
          </div>
        </div>
      </div>

      {detailsElement && (
        <ElementDetailsModal 
          element={detailsElement} 
          onClose={() => setDetailsElement(null)} 
          onMaintenance={(element) => {
            if (!element) return;
            setSelectedId(element.id);
            setTapCount(0);
            setDetailsElement(null);
          }}
          onUse={onAddToAtelier ? (element) => {
            onAddToAtelier(element);
            setDetailsElement(null);
          } : undefined}
        />
      )}
    </div>
  );
};
