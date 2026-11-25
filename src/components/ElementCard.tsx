import React from 'react';
import { AlchemyElement, Rarity } from '../types';
import { RARITY_COLORS, translateEssence, STABILITY_DECAY_INTERVAL, TEMPERATURE_DECAY_INTERVAL, INITIAL_ELEMENTS } from '../constants';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Thermometer, Shield, Heart } from 'lucide-react';

import { cn } from '../lib/utils';

interface ElementCardProps {
  element: AlchemyElement;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  compact?: boolean;
  isDraggable?: boolean;
  onToggleFavorite?: (id: string) => void;
  rotateIcon?: boolean;
  forgeMode?: boolean;
  codexMode?: boolean;
}

const getRarityTextColor = (rarity: Rarity | undefined) => {
  const r = rarity || 'Обычный';
  switch (r) {
    case 'Обычный': return 'text-slate-900';
    case 'Редкий': return 'text-emerald-950';
    case 'Эпический': return 'text-sky-950';
    case 'Легендарный': return 'text-amber-950';
    case 'Мифический': return 'text-rose-950';
    case 'Божественный': return 'text-orange-950';
    case 'Вечный': return 'text-violet-950';
    case 'Космический': return 'text-pink-950';
    case 'Изначальный': return 'text-white/95';
    case 'Трансцендентный': return 'text-gold';
    case 'Запретный': return 'text-red-100';
    default: return 'text-slate-900';
  }
};

export const getRarityColorHex = (rarity?: Rarity): string => {
  switch (rarity) {
    case 'Обычный': return '#64748b';
    case 'Редкий': return '#10b981';
    case 'Эпический': return '#0284c7';
    case 'Легендарный': return '#d97706';
    case 'Мифический': return '#e11d48';
    case 'Божественный': return '#f97316';
    case 'Вечный': return '#8b5cf6';
    case 'Космический': return '#ec4899';
    case 'Изначальный': return '#a8a29e';
    case 'Трансцендентный': return '#c9a343';
    case 'Запретный': return '#dc2626';
    default: return '#c9a343';
  }
};

export const ElementCard: React.FC<ElementCardProps> = ({ 
  element, 
  onClick, 
  isSelected, 
  className, 
  compact,
  isDraggable,
  onToggleFavorite,
  rotateIcon,
  forgeMode = false,
  codexMode = false
}) => {
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updateTimer = () => {
      if (document.hidden) return;
      const now = Date.now();
      
      const sIntervalMs = (STABILITY_DECAY_INTERVAL[element.rarity] || 60) * 1000;
      const tIntervalMs = (TEMPERATURE_DECAY_INTERVAL[element.rarity] || 60) * 1000;
      
      const lastSDecay = element.lastDecayAt || element.discoveredAt;
      const lastTDecay = element.lastTempDecayAt || element.discoveredAt;
      
      const sRemaining = Math.max(0, Math.ceil((sIntervalMs - (now - lastSDecay)) / 1000));
      const tRemaining = Math.max(0, Math.ceil((tIntervalMs - (now - lastTDecay)) / 1000));
      
      if ((element.stability ?? 100) <= 0) {
        if ((element.temperature ?? 0) <= -273) {
          setTimeLeft(null);
        } else {
          setTimeLeft(tRemaining);
        }
      } else {
        setTimeLeft(Math.min(sRemaining, tRemaining));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [element?.id, element?.lastDecayAt, element?.lastTempDecayAt, element?.discoveredAt, element?.rarity, element?.stability, element?.temperature]);

  const isDarkRarity = (rarity: Rarity) => {
    return ['Изначальный', 'Трансцендентный', 'Запретный'].includes(rarity);
  };

  if (!element) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: element.id,
    disabled: !isDraggable 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDark = isDarkRarity(element.rarity || 'Обычный');

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        if (isDragging) return;
        onClick?.();
      }}
      className={cn(
        "parchment-card cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center text-center",
        isSelected && "ring-2 ring-gold gold-glow scale-105 z-10",
        RARITY_COLORS[element.rarity || 'Обычный'],
        compact ? "p-2 aspect-square" : (codexMode ? "p-4 w-full aspect-[3/4] min-h-[144px]" : "p-4 w-[108px] h-[144px] shrink-0"),
        isDraggable && "touch-pan-y",
        className
      )}
    >
      {compact && timeLeft !== null && (
        <div className="absolute top-0.5 left-0 right-0 flex flex-col items-center z-20">
          <div className={cn(
            "text-[12px] font-mono font-bold leading-none",
            isDark ? "text-white/80" : "text-ink/60"
          )} title="Время до распада">
            {formatTime(timeLeft)}
          </div>
        </div>
      )}

      {!compact && timeLeft !== null && (
        <div className={cn(
          "absolute top-1 left-0 right-0 font-mono font-bold uppercase tracking-widest text-center z-20",
          forgeMode ? "text-[12px]" : "text-[10px]",
          isDark ? "text-white/90" : "text-ink/60"
        )}>
          {formatTime(timeLeft)}
        </div>
      )}

      <div className="flex flex-col items-center justify-center flex-1 w-full py-4">
        <div className="relative mb-1 flex flex-col items-center">
          <div className={cn(
            "flex items-center justify-center rounded-full border border-sepia/20 bg-white/30 shadow-inner overflow-hidden", 
            compact ? "w-8 h-8 text-lg" : "w-14 h-14 text-3xl"
          )}>
            {rotateIcon ? (
              <motion.span 
                animate={{ rotate: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                className="drop-shadow-[0_0_1px_rgba(0,0,0,0.5)] flex items-center justify-center element-icon-filter"
              >
                {element.icon || '❓'}
              </motion.span>
            ) : (
              <span className="drop-shadow-[0_0_1px_rgba(0,0,0,0.5)] element-icon-filter">{element.icon || '❓'}</span>
            )}
          </div>

          {/* Rarity label over the icon on miniature card with size 8 */}
          {!compact && !forgeMode && !codexMode && (
            <div 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider text-center leading-none select-none pointer-events-none whitespace-nowrap z-10"
              style={{ color: '#c9a343' }}
            >
              {element.rarity || 'Обычный'}
            </div>
          )}
        </div>
        
        <h3 className={cn(
          "font-gothic tracking-widest leading-[0.9] px-1", 
          compact ? "text-[6px]" : (codexMode ? "text-[12px]" : (forgeMode ? "text-[12px]" : "text-[9px] font-bold")),
          isDark && "text-white/90"
        )}>
          {element.name || 'Неизвестно'}
        </h3>

        {!compact && (forgeMode || codexMode) && (
          <div className={cn(
            "uppercase tracking-[0.2em] font-bold opacity-40",
            codexMode ? "text-[10px] mt-1" : "text-[9px] mt-1.5",
            isDark && "text-white/60"
          )}>
            {element.rarity || 'Обычный'}
          </div>
        )}
      </div>
      
      {!compact && (
        <div className="absolute bottom-1 left-1 right-1">
          {/* Counters */}
          <div className={cn(
            "flex justify-between w-full px-1 font-mono font-black",
            forgeMode ? "text-[12px]" : "text-[10px]",
            isDark ? "text-white/90" : "text-ink"
          )}>
            <div className="flex flex-col items-start gap-0.5">
              <span className={cn(
                (element.temperature ?? 0) > 100 ? (isDark ? "text-red-400" : "text-red-600") : 
                (element.temperature ?? 0) < 0 ? (isDark ? "text-blue-400" : "text-blue-600") : ""
              )}>
                {Math.round(element.temperature ?? 0)}°C
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span>
                {element.stability ?? 100}%
              </span>
            </div>
          </div>

          {/* Stability Bar */}
          <div className="mt-0.5 w-full h-1 bg-sepia/10 rounded-full overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${element.stability ?? 100}%` }}
              className={cn(
                "h-full transition-colors duration-500",
                (element.stability ?? 100) < 30 ? "bg-red-500" : (element.stability ?? 100) < 70 ? "bg-orange-400" : "bg-gold"
              )}
            />
          </div>
        </div>
      )}

      {/* Favorite Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite?.(element.id);
        }}
        className="absolute top-1 right-1 z-30 p-1 rounded-full hover:bg-white/20 transition-colors"
      >
        <Heart 
          size={compact ? 10 : 14} 
          className={cn(
            "transition-all duration-300",
            element.isFavorite 
              ? "fill-red-500 text-red-500 drop-shadow-[0_0_2px_rgba(239,68,68,0.5)]" 
              : isDark ? "text-white/40" : "text-ink/20"
          )} 
        />
      </button>

      {/* Law Badges */}
      <div className="absolute top-1 left-1 flex flex-col gap-1">
        {(element.temperature ?? 0) < (element.targetTemperature ?? 0) - 200 && (
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            title="Закон Температуры: Слишком холодно!"
            className="p-0.5 bg-blue-500/20 rounded-full border border-blue-500/40"
          >
            <Thermometer size={10} className="text-blue-600" />
          </motion.div>
        )}
        {(element.stability ?? 100) < 80 && (
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            title="Закон Стабильности: Нестабильно!"
            className="p-0.5 bg-red-500/20 rounded-full border border-red-500/40"
          >
            <Shield size={10} className="text-red-600" />
          </motion.div>
        )}
      </div>

      {/* Essence Indicators */}
      {element.essences && element.essences.length > 0 && (
        <div className="absolute bottom-1 left-1 flex gap-1">
          {element.essences.slice(0, 3).map((ess, i) => (
            <div 
              key={i} 
              className={cn(
                "w-2 h-2 rounded-full flex items-center justify-center text-[5px] text-white font-bold",
                ess === 'life' && "bg-green-500",
                ess === 'death' && "bg-gray-800",
                ess === 'chaos' && "bg-purple-500",
                ess === 'order' && "bg-blue-500",
                ess === 'void' && "bg-black",
                ess === 'creation' && "bg-yellow-400",
                ess === 'destruction' && "bg-red-600"
              )} 
              title={translateEssence(ess)}
            >
              {ess[0].toUpperCase()}
            </div>
          ))}
        </div>
      )}
      
      {/* Dynamic SVG Alchemical Frame matching Rarity Color */}
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible" 
        viewBox="0 0 100 140" 
        preserveAspectRatio="none"
      >
        {/* Outer Border */}
        <rect 
          x="2" y="2" width="96" height="136" rx="5" 
          fill="none" 
          stroke={getRarityColorHex(element.rarity)} 
          strokeWidth="1.5" 
          strokeOpacity="0.85" 
          vectorEffect="non-scaling-stroke" 
        />
        {/* Inner Filigree Border */}
        <rect 
          x="4.5" y="4.5" width="91" height="131" rx="3.5" 
          fill="none" 
          stroke={getRarityColorHex(element.rarity)} 
          strokeWidth="0.75" 
          strokeDasharray="3 1.5" 
          strokeOpacity="0.5" 
          vectorEffect="non-scaling-stroke" 
        />

        {/* Alchemical Corner Brackets */}
        <g transform="translate(0, 0)">
          <path d="M2,12 L2,2 L12,2" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx="5" cy="5" r="1.2" fill={getRarityColorHex(element.rarity)} />
        </g>
        <g transform="translate(100, 0) scale(-1, 1)">
          <path d="M2,12 L2,2 L12,2" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx="5" cy="5" r="1.2" fill={getRarityColorHex(element.rarity)} />
        </g>
        <g transform="translate(0, 140) scale(1, -1)">
          <path d="M2,12 L2,2 L12,2" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx="5" cy="5" r="1.2" fill={getRarityColorHex(element.rarity)} />
        </g>
        <g transform="translate(100, 140) scale(-1, -1)">
          <path d="M2,12 L2,2 L12,2" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx="5" cy="5" r="1.2" fill={getRarityColorHex(element.rarity)} />
        </g>

        {/* Top & Bottom Center Symbols */}
        <polygon points="50,1 52,3 50,5 48,3" fill={getRarityColorHex(element.rarity)} opacity="0.9" />
        <polygon points="50,139 52,137 50,135 48,137" fill={getRarityColorHex(element.rarity)} opacity="0.9" />
      </svg>

      {/* Frost Effect */}
      {(element.stability ?? 100) <= 0 && (element.temperature ?? 0) <= -273 && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-inherit">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100/30 via-transparent to-blue-200/30 backdrop-blur-[0.5px]" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:4px_4px]" />
          <div className="absolute inset-0 border-2 border-blue-100/40 rounded-inherit" />
        </div>
      )}
    </motion.div>
  );
};
