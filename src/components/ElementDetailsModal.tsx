import React from 'react';
import { AlchemyElement } from '../types';
import { translateEssence, RARITY_COLORS, STABILITY_DECAY_INTERVAL, TEMPERATURE_DECAY_INTERVAL } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Hammer, Thermometer, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRarityColorHex } from './ElementCard';

interface ElementDetailsModalProps {
  element: AlchemyElement | null;
  onClose: () => void;
  onUse?: (element: AlchemyElement) => void;
  onMaintenance?: (element: AlchemyElement) => void;
}

export const ElementDetailsModal: React.FC<ElementDetailsModalProps> = ({ element, onClose, onUse, onMaintenance }) => {
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!element) return;
    
    const updateTimer = () => {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!element) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={cn(
            "relative w-full max-w-md max-h-[90vh] parchment-card flex flex-col shadow-2xl gold-glow overflow-hidden",
            RARITY_COLORS[element.rarity || 'Обычный']
          )}
        >
          {/* Dynamic Rarity SVG Frame for Modal */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible" 
            viewBox="0 0 320 480" 
            preserveAspectRatio="none"
          >
            {/* Outer Border */}
            <rect 
              x="3" y="3" width="314" height="474" rx="14" 
              fill="none" 
              stroke={getRarityColorHex(element.rarity)} 
              strokeWidth="2.5" 
              strokeOpacity="0.9" 
              vectorEffect="non-scaling-stroke" 
            />
            {/* Inner Filigree Line */}
            <rect 
              x="8" y="8" width="304" height="464" rx="10" 
              fill="none" 
              stroke={getRarityColorHex(element.rarity)} 
              strokeWidth="1" 
              strokeDasharray="6 3" 
              strokeOpacity="0.6" 
              vectorEffect="non-scaling-stroke" 
            />

            {/* Corner Alchemical Brackets */}
            {/* Top-Left */}
            <g transform="translate(0, 0)">
              <path d="M3,28 L3,14 Q3,3 14,3 L28,3" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="3.5" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="1.5" fill={getRarityColorHex(element.rarity)} />
            </g>
            {/* Top-Right */}
            <g transform="translate(320, 0) scale(-1, 1)">
              <path d="M3,28 L3,14 Q3,3 14,3 L28,3" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="3.5" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="1.5" fill={getRarityColorHex(element.rarity)} />
            </g>
            {/* Bottom-Left */}
            <g transform="translate(0, 480) scale(1, -1)">
              <path d="M3,28 L3,14 Q3,3 14,3 L28,3" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="3.5" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="1.5" fill={getRarityColorHex(element.rarity)} />
            </g>
            {/* Bottom-Right */}
            <g transform="translate(320, 480) scale(-1, -1)">
              <path d="M3,28 L3,14 Q3,3 14,3 L28,3" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="3.5" fill="none" stroke={getRarityColorHex(element.rarity)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx="14" cy="14" r="1.5" fill={getRarityColorHex(element.rarity)} />
            </g>

            {/* Top & Bottom Center Alchemical Diamonds */}
            <g transform="translate(160, 3)">
              <polygon points="0,-2 6,4 0,10 -6,4" fill={getRarityColorHex(element.rarity)} />
              <circle cx="0" cy="4" r="1.5" fill="#ffffff" />
            </g>
            <g transform="translate(160, 477)">
              <polygon points="0,-2 6,4 0,10 -6,4" fill={getRarityColorHex(element.rarity)} />
              <circle cx="0" cy="4" r="1.5" fill="#ffffff" />
            </g>
          </svg>

          {/* Frost Effect */}
          {(element.stability ?? 100) <= 0 && (element.temperature ?? 0) <= -273 && (
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-inherit">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-transparent to-blue-200/40 backdrop-blur-[1px]" />
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_white_2px,_transparent_2px)] bg-[size:8px_8px]" />
              <div className="absolute inset-0 border-4 border-blue-100/50 rounded-inherit" />
            </div>
          )}

          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors z-10"
          >
            <X size={24} />
          </button>

          {timeLeft !== null && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[12px] font-mono text-ink/60 font-bold uppercase tracking-widest">
              Цикл: {formatTime(timeLeft)}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-20 h-20 rounded-full border-2 border-gold/40 flex items-center justify-center bg-white/40 shadow-xl mb-3",
                  RARITY_COLORS[element.rarity || 'Обычный']
                )}>
                  <span className="text-5xl drop-shadow-[0_0_2px_rgba(0,0,0,0.3)] element-icon-filter">{element.icon}</span>
                </div>
                <h2 className="font-gothic text-2xl md:text-3xl text-gold tracking-widest uppercase leading-tight px-4">
                  {element.name}
                </h2>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 bg-sepia/10 rounded-full border border-sepia/20">
                    {element.rarity}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 bg-sepia/10 rounded-full border border-sepia/20">
                    {element.type}
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-sepia/10" />

              <div className="relative py-2">
                <span className="absolute top-0 left-0 text-2xl text-sepia/10 font-serif">"</span>
                <p className="text-sm italic text-sepia leading-relaxed font-serif px-4">
                  {element.description}
                </p>
                <span className="absolute bottom-0 right-0 text-2xl text-sepia/10 font-serif">"</span>
              </div>

              <div className="w-full h-px bg-sepia/10" />

              <div className="grid grid-cols-2 gap-3 w-full text-sepia/70">
                <div className="flex flex-col items-center p-2 bg-sepia/5 rounded border border-sepia/10">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-sepia/60">Состояние</span>
                  <span className="font-sans font-bold text-sepia text-[14px] mt-0.5">{element.state}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-sepia/5 rounded border border-sepia/10">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-sepia/60">Температура</span>
                  <div className="flex flex-col items-center">
                    <span className="font-sans font-bold text-sepia text-[14px] mt-0.5">{Math.round(element.temperature ?? 0)}°C</span>
                    <span className="text-[11px] text-sepia/50 uppercase font-sans tracking-tight">Норма: {Math.round(element.targetTemperature ?? 0)}°C</span>
                  </div>
                </div>
                <div className="flex flex-col items-center p-2 bg-sepia/5 rounded border border-sepia/10">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-sepia/60">Стабильность</span>
                  <div className="flex items-center gap-1">
                    <span className="font-sans font-bold text-sepia text-[14px] mt-0.5">{element.stability ?? '???'}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-center p-2 bg-sepia/5 rounded border border-sepia/10">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-sepia/60">Слой Реальности</span>
                  <span className="font-sans font-bold text-sepia text-[14px] mt-0.5">{element.realityLevel ?? 1}</span>
                </div>
              </div>

              {element.essences && element.essences.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {element.essences.map((essence, idx) => (
                    <span key={`${essence}-${idx}`} className="text-[8px] uppercase tracking-widest font-bold px-2 py-1 bg-gold/10 text-gold rounded border border-gold/20">
                      {translateEssence(essence)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-sepia/5 border-t border-sepia/10 flex flex-col sm:flex-row gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onMaintenance?.(element);
                onClose();
              }}
              className="flex-1 bg-sepia/10 text-sepia py-3 rounded-full font-gothic tracking-[0.2em] border border-sepia/20 flex items-center justify-center gap-2"
            >
              <Hammer size={18} />
              ОБСЛУЖИТЬ
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onUse?.(element);
                onClose();
              }}
              className="flex-1 bg-gold text-white py-3 rounded-full font-gothic tracking-[0.2em] shadow-lg gold-glow flex items-center justify-center gap-2"
            >
              <Sparkles size={18} />
              ИСПОЛЬЗОВАТЬ
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
