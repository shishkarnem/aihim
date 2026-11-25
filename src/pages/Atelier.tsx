import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlchemyElement, WorldPhase, Rarity, AppUser } from '../types';
import { ElementCard } from '../components/ElementCard';
import { ElementDetailsModal } from '../components/ElementDetailsModal';
import { ParchmentContainerFrame } from '../components/ParchmentContainerFrame';
import { UserAvatar } from '../components/UserAvatar';
import { VortexAnimation, MagicParticles, RareFlash } from '../components/Animations';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sparkles, Search, X, Info, Zap, Shield, Eye, Globe, Sun, Moon, AlertCircle, Thermometer, Contrast, Leaf, Hourglass, Heart, ShieldAlert, UserCheck, ExternalLink, ChevronDown, Lock, Unlock } from 'lucide-react';
import { cn } from '../lib/utils';
import { REALITY_LAYERS, HIDDEN_LAWS, calculateRank, translateEssence, calculateUnlockedReality } from '../constants';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  DragOverlay,
  DragStartEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Hand, Grab } from 'lucide-react';
import { LATIN_SPELLS, type Spell } from '../data/spells';

interface AtelierProps {
  elements: AlchemyElement[];
  onCombine: (a: AlchemyElement, b: AlchemyElement, spells: string[]) => void;
  isCombining: boolean;
  setElements: React.Dispatch<React.SetStateAction<AlchemyElement[]>>;
  worldPhase: WorldPhase;
  phaseTimer: number;
  alchemyMessage: string | null;
  onClearMessage: () => void;
  onSelectElement: (element: AlchemyElement) => void;
  onToggleFavorite: (id: string) => void;
  slotA: AlchemyElement | null;
  setSlotA: React.Dispatch<React.SetStateAction<AlchemyElement | null>>;
  slotB: AlchemyElement | null;
  setSlotB: React.Dispatch<React.SetStateAction<AlchemyElement | null>>;
  aihim: number;
  onOpenShop: () => void;
  selectedRealityLevel: number;
  onSelectRealityLevel: (level: number) => void;
  referrerUser?: AppUser | null;
  currentUser?: AppUser | null;
}

const LAYER_ICONS: Record<number, any> = {
  1: Shield,
  2: Zap,
  3: Sparkles,
  4: Eye,
  5: Globe,
};

const LAW_ICONS: Record<string, any> = {
  'Thermometer': Thermometer,
  'Contrast': Contrast,
  'Leaf': Leaf,
  'Hourglass': Hourglass,
};

const UniverseStatus = ({ 
  elements, 
  worldPhase, 
  phaseTimer, 
  aihim, 
  onOpenShop,
  selectedRealityLevel,
  onSelectRealityLevel
}: { 
  elements: AlchemyElement[], 
  worldPhase: WorldPhase, 
  phaseTimer: number, 
  aihim: number, 
  onOpenShop: () => void,
  selectedRealityLevel: number,
  onSelectRealityLevel: (level: number) => void
}) => {
  const maxReality = calculateUnlockedReality(elements);
  const currentLayer = REALITY_LAYERS.find(l => l.level === selectedRealityLevel) || REALITY_LAYERS[0];
  const LayerIcon = LAYER_ICONS[selectedRealityLevel] || Shield;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="w-full parchment-card p-2 md:p-3 bg-gold/5 border-ink/20 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-[16px] uppercase tracking-widest text-gold font-bold flex items-center gap-2">
              <LayerIcon size={12} className="md:w-[14px] md:h-[14px]" />
              Слой Реальности
            </div>
            <div className="flex flex-wrap gap-2">
              {REALITY_LAYERS.filter(l => l.level <= maxReality).map(layer => {
                const Icon = LAYER_ICONS[layer.level] || Shield;
                return (
                  <button
                    key={layer.level}
                    onClick={() => onSelectRealityLevel(layer.level)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2",
                      selectedRealityLevel === layer.level
                        ? "bg-gold text-white border-gold shadow-md gold-glow scale-105"
                        : "bg-parchment/40 text-sepia border-gold/20 hover:border-gold/50 hover:bg-parchment/60"
                    )}
                  >
                    <Icon size={10} />
                    {layer.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-10 md:h-12 w-px bg-gold/20 hidden md:block" />

          <div className="hidden md:flex items-center gap-2 md:gap-3">
            <div className={`p-1 md:p-1.5 rounded-full ${worldPhase === 'day' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-indigo-500/20 text-indigo-400'}`}>
              {worldPhase === 'day' ? <Sun size={14} className="md:w-[16px] md:h-[16px]" /> : <Moon size={14} className="md:w-[16px] md:h-[16px]" />}
            </div>
            <div>
              <div className="text-[14px] uppercase tracking-widest text-[#704214] font-bold">Фаза Мира</div>
              <div className="text-[14px] font-bold uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
                {worldPhase === 'day' ? 'День' : 'Ночь'}
                <span className="font-mono text-[14px] opacity-80 text-[#704214]">({formatTime(phaseTimer)})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-2 md:gap-3 bg-sepia/5 px-3 py-1.5 rounded-full border border-gold/20">
            <img src="/file/1/aihim.png" alt="AIhim" className="w-4 h-4 md:w-5 md:h-5 object-contain" />
            <div className="flex flex-col">
              <span className="text-[14px] uppercase font-bold text-[#704214] leading-none">Баланс AIhim</span>
              <span className="text-[14px] font-bold text-gold leading-none">{aihim}</span>
            </div>
          </div>
          
          <button 
            onClick={onOpenShop}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-gold text-white rounded-full text-[14px] font-bold uppercase tracking-widest hover:bg-gold/80 transition-colors shadow-lg gold-glow"
          >
            <Plus size={14} />
            <span className="text-[14px]">КУПИТЬ</span>
          </button>
        </div>
      </div>
      <div className="px-4 py-1.5 bg-gold/5 border border-gold/10 rounded-lg flex items-center gap-2">
        <Info size={14} className="text-gold shrink-0" />
        <p className="text-[16px] text-sepia/70 italic">
          Выбранный слой реальности влияет на синтез. Разные слои позволяют открывать разные грани элементов.
        </p>
      </div>
    </div>
  );
};

const Slot = ({ id, element, onRemove, label, isCombining }: { 
  id: string, 
  element: AlchemyElement | null, 
  onRemove: () => void, 
  label: string,
  isCombining: boolean 
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        ref={setNodeRef}
        onClick={() => !isCombining && element && onRemove()}
        className={`w-24 h-24 md:w-36 md:h-36 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 relative group overflow-hidden ${
          isOver ? 'border-gold bg-gold/20 scale-110 shadow-[0_0_30px_rgba(201,163,67,0.4)]' : 'border-ink/40 bg-parchment/40 shadow-lg'
        } ${!element ? 'border-dashed opacity-60' : 'opacity-100 cursor-pointer hover:border-ink/60 hover:bg-parchment/60'}`}
      >
        {element ? (
          <ElementCard element={element} className="w-full h-full border-none shadow-none pointer-events-none scale-90" />
        ) : (
          <div className="text-gold/40 flex flex-col items-center gap-2">
            <Plus size={32} className="animate-pulse" />
          </div>
        )}
        
        {element && !isCombining && (
          <div className="absolute top-2 right-2 bg-red-900/80 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
            <X size={14} />
          </div>
        )}

        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-ink/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-ink/40" />
      </div>
      <div className="px-2 py-1 bg-parchment/60 backdrop-blur-sm rounded-full border border-ink/90 whitespace-nowrap min-w-fit">
        <span className={cn(
          "uppercase tracking-[0.1em] md:tracking-[0.2em] font-black text-ink leading-none text-[12px]"
        )}>{label}</span>
      </div>
    </div>
  );
};

interface RealityLayerDropdownProps {
  selectedRealityLevel: number;
  maxReality: number;
  onSelectRealityLevel: (level: number) => void;
}

const RealityLayerDropdown: React.FC<RealityLayerDropdownProps> = ({
  selectedRealityLevel,
  maxReality,
  onSelectRealityLevel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableLayers = REALITY_LAYERS.filter((l) => l.level <= maxReality);
  const currentLayer = availableLayers.find((l) => l.level === selectedRealityLevel) || availableLayers[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-parchment/80 backdrop-blur-md border border-gold/40 text-[#704214] font-bold text-[11px] uppercase tracking-wider rounded-lg pl-2.5 pr-7 py-1 outline-none focus:border-gold cursor-pointer shadow-sm hover:border-gold flex items-center justify-between transition-all"
      >
        <span>{currentLayer?.name || 'Физический'}</span>
        <ChevronDown size={13} className={`absolute right-2 text-gold transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-parchment/95 backdrop-blur-md border border-gold/40 rounded-xl shadow-xl overflow-hidden z-50 py-1 border-gold/60">
          {availableLayers.map((layer) => {
            const isSelected = layer.level === selectedRealityLevel;
            return (
              <button
                key={layer.level}
                type="button"
                onClick={() => {
                  onSelectRealityLevel(layer.level);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#c9a343] text-white shadow-xs font-black'
                    : 'text-[#704214] hover:bg-[#c9a343]/20'
                }`}
              >
                <span>{layer.name}</span>
                {isSelected && <span className="text-[10px] ml-1 opacity-90">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Atelier: React.FC<AtelierProps> = ({ 
  elements, 
  onCombine, 
  isCombining, 
  setElements,
  worldPhase,
  phaseTimer,
  alchemyMessage,
  onClearMessage,
  onSelectElement,
  onToggleFavorite,
  slotA,
  setSlotA,
  slotB,
  setSlotB,
  aihim,
  onOpenShop,
  selectedRealityLevel,
  onSelectRealityLevel,
  referrerUser,
  currentUser
}) => {
  const [search, setSearch] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState<0 | 1 | 2>(0);
  const [unstableFilter, setUnstableFilter] = useState<0 | 1 | 2>(0);
  const [tempFilter, setTempFilter] = useState<0 | 1 | 2>(0);
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'All'>('All');
  const [selectedSpells, setSelectedSpells] = useState<Spell[]>([]);
  const [showSpellsModal, setShowSpellsModal] = useState(false);
  const [spellsSearch, setSpellsSearch] = useState('');
  const [selectedSpellCategory, setSelectedSpellCategory] = useState<string>('Все');

  const [dbSpells, setDbSpells] = useState<Spell[]>(LATIN_SPELLS);
  const [isRealityInfoOpen, setIsRealityInfoOpen] = useState(false);

  const maxReality = calculateUnlockedReality(elements);
  const LayerIcon = LAYER_ICONS[selectedRealityLevel] || Shield;

  React.useEffect(() => {
    fetch('/api/spells')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data.spells) && data.spells.length > 0) {
          setDbSpells(data.spells);
        }
      })
      .catch(err => console.error('Failed to load spells from DB:', err));
  }, []);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCombining) {
        onClearMessage();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCombining, onClearMessage]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeElement = useMemo(() => 
    elements.find(e => e && e.id === activeId), 
    [elements, activeId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredElements = useMemo(() => {
    if (!elements) return [];
    return elements.filter(e => {
      if (!e || !e.name) return false;
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
      const matchesRarity = rarityFilter === 'All' || e.rarity === rarityFilter;

      const isFav = !!e.isFavorite;
      const isUnstable = (e.stability ?? 100) < 80;
      const isTemp = (e.temperature ?? 0) < (e.targetTemperature ?? 0) - 200;

      const matchesFavorite = favoriteFilter === 0 ? true : (favoriteFilter === 1 ? isFav : !isFav);
      const matchesUnstable = unstableFilter === 0 ? true : (unstableFilter === 1 ? isUnstable : !isUnstable);
      const matchesTemp = tempFilter === 0 ? true : (tempFilter === 1 ? isTemp : !isTemp);

      return matchesSearch && matchesFavorite && matchesRarity && matchesUnstable && matchesTemp;
    }).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });
  }, [elements, search, favoriteFilter, rarityFilter, unstableFilter, tempFilter]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Handle dropping into slots
    if (over.id === 'slot-a') {
      const element = elements.find(e => e && e.id === active.id);
      if (element && slotB?.id !== element.id) setSlotA(element);
      return;
    }
    if (over.id === 'slot-b') {
      const element = elements.find(e => e && e.id === active.id);
      if (element && slotA?.id !== element.id) setSlotB(element);
      return;
    }

    // Handle sorting
    if (active.id !== over.id) {
      setElements((items) => {
        const oldIndex = items.findIndex(i => i && i.id === active.id);
        const newIndex = items.findIndex(i => i && i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCombineClick = () => {
    if (slotA && slotB) {
      onCombine(slotA, slotB, selectedSpells.map(s => s.name));
      setSlotA(null);
      setSlotB(null);
      setSelectedSpells([]);
    }
  };

  const handleUseElement = (element: AlchemyElement) => {
    if (!element) return;
    if (!slotA) {
      setSlotA(element);
    } else if (!slotB && slotA && slotA.id !== element.id) {
      setSlotB(element);
    } else if (slotA && slotB) {
      setSlotA(element);
    }
  };

  const { currentRank, nextRank, progressToNextRank, level, levelTarget, progressToNextLevel } = useMemo(() => {
    const validElementsCount = elements.filter(e => e !== null).length;
    const { currentRank, nextRank, progressToNextRank, level, levelTarget, progressToNextLevel } = calculateRank(validElementsCount);
    return { currentRank, nextRank, progressToNextRank, level, levelTarget, progressToNextLevel };
  }, [elements.length]);

  const [showProgressTooltip, setShowProgressTooltip] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Reality Layer Info Modal */}
      <AnimatePresence>
        {isRealityInfoOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md parchment-card p-5 bg-parchment border-gold/40 shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setIsRealityInfoOpen(false)}
                className="absolute top-3 right-3 text-sepia/60 hover:text-sepia p-1 rounded-full hover:bg-gold/10 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 border-b border-sepia/20 pb-3">
                <div className="p-2 bg-gold/10 rounded-lg text-gold border border-gold/30">
                  <Info size={20} />
                </div>
                <h3 className="font-gothic text-lg text-gold uppercase tracking-widest">
                  Слой Реальности
                </h3>
              </div>
              <p className="text-sm md:text-base text-sepia leading-relaxed font-serif italic">
                Выбранный слой реальности влияет на синтез. Разные слои позволяют открывать разные грани элементов.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsRealityInfoOpen(false)}
                  className="px-4 py-1.5 bg-gold text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow hover:bg-gold/80 transition-colors"
                >
                  Понятно
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Top Hero Stage with Centered Logo & Floating Corner Overlays */}
        <div className="relative w-full flex flex-col items-center justify-center pt-2 pb-2 mb-2 min-h-[140px] md:min-h-[180px]">
          
          {/* Top-Left Overlay: Phase of World (Transparent Background) */}
          <div className="absolute top-0 left-0 flex flex-col items-start gap-1.5 z-20 bg-transparent max-w-[48%]">
            {/* World Phase */}
            <div className="flex items-center gap-1.5">
              <div className={`p-1 rounded-full ${worldPhase === 'day' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-indigo-500/20 text-indigo-400'}`}>
                {worldPhase === 'day' ? <Sun size={13} /> : <Moon size={13} />}
              </div>
              <div>
                <div className="text-[12px] uppercase font-bold text-[#704214] leading-none">Фаза Мира</div>
                <div className="text-[15px] font-bold text-sepia leading-tight flex items-center gap-1 mt-0.5">
                  {worldPhase === 'day' ? 'День' : 'Ночь'}
                  <span className="font-mono text-[#704214] text-[14px]">({formatTime(phaseTimer)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Grand Logo */}
          <motion.img 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src="/file/1/aihim.png" 
            alt="AIhim Grand Logo" 
            className="h-28 md:h-36 object-contain drop-shadow-2xl z-10 my-1 pointer-events-none"
          />

          {/* Reality Layer Centered Under Logo in 1 Row */}
          <div className="flex items-center justify-center gap-2 z-20 mt-1">
            <button 
              onClick={() => setIsRealityInfoOpen(true)}
              className="text-[12px] uppercase font-bold text-[#704214] hover:text-gold-light transition-colors flex items-center gap-1 group leading-none"
              title="Информация о Слоях Реальности"
            >
              <LayerIcon size={13} className="text-[#704214]" />
              <span className="text-[12px]">Слой Реальности</span>
              <Info size={11} className="text-[#704214] group-hover:text-gold shrink-0" />
            </button>

            <RealityLayerDropdown 
              selectedRealityLevel={selectedRealityLevel} 
              maxReality={maxReality} 
              onSelectRealityLevel={onSelectRealityLevel} 
            />
          </div>

          {/* Top-Right Overlay: Level & Rank (Transparent Background) */}
          <div className="absolute top-0 right-0 flex flex-col items-end gap-1.5 z-20 bg-transparent max-w-[48%] text-right">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <div className="text-[10px] md:text-[11px] uppercase font-bold text-[#1e1b18] tracking-wider leading-none">
                  Ранг: {currentRank.name}
                </div>
                <div className="text-[13px] md:text-[16px] font-gothic text-sepia tracking-wider font-bold leading-tight mt-0.5">
                  Уровень {level}
                </div>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gold/10 flex items-center justify-center text-lg md:text-xl border border-gold/30 shrink-0">
                <span className="element-icon-filter">{currentRank.icon}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Inventory Section (Now Second) */}
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
                    className="h-full bg-gold shadow-[0_0_8px_rgba(201,163,67,0.6)]"
                  />
                </div>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[130px] max-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia/40" size={14} />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-6 py-1.5 bg-parchment/80 backdrop-blur-sm border border-sepia/20 rounded-full focus:border-gold outline-none text-[15px] font-serif italic text-sepia"
                />
                {search && (
                  <button 
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sepia/40 hover:text-sepia"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              
              {/* Rarity Filter */}
              <select
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value as any)}
                className="bg-parchment/80 backdrop-blur-sm border border-sepia/20 rounded-full px-3 py-1.5 text-[15px] outline-none focus:border-gold cursor-pointer text-sepia font-serif max-w-[145px] truncate shrink-0"
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

              {/* Action Filter Buttons (+Узы, +Распад, +Термо) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => setFavoriteFilter(((favoriteFilter + 1) % 3) as 0 | 1 | 2)}
                  title={favoriteFilter === 0 ? "Эфирные Узы: Все элементы" : favoriteFilter === 1 ? "Эфирные Узы: Только совпадения (+Избранное)" : "Эфирные Узы: Исключить совпадения (-Избранное)"}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-xs relative",
                    favoriteFilter === 0 && "bg-parchment/80 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    favoriteFilter === 1 && "bg-red-500/15 border-red-500/60 text-red-600 shadow-[0_0_10px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30 font-semibold",
                    favoriteFilter === 2 && "bg-red-950/20 border-red-700/70 text-red-700 shadow-inner ring-1 ring-red-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <Heart size={14} className={favoriteFilter === 1 ? "fill-red-500 text-red-500" : favoriteFilter === 2 ? "text-red-700 opacity-60" : ""} />
                    {favoriteFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {favoriteFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-red-700 bg-red-100 rounded-full px-1 border border-red-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="text-[14px] text-[#704214] font-serif ml-1.5">
                    {favoriteFilter === 0 ? "Узы" : favoriteFilter === 1 ? "+Узы" : "-Узы"}
                  </span>
                </button>

                <button 
                  onClick={() => setUnstableFilter(((unstableFilter + 1) % 3) as 0 | 1 | 2)}
                  title={unstableFilter === 0 ? "Распад: Все элементы" : unstableFilter === 1 ? "Распад: Только нестабильные (+Распад)" : "Распад: Исключить нестабильные (-Распад)"}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-xs relative",
                    unstableFilter === 0 && "bg-parchment/80 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    unstableFilter === 1 && "bg-amber-500/15 border-amber-500/60 text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30 font-semibold",
                    unstableFilter === 2 && "bg-amber-950/20 border-amber-700/70 text-amber-700 shadow-inner ring-1 ring-amber-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <ShieldAlert size={14} className={unstableFilter === 1 ? "text-amber-600" : unstableFilter === 2 ? "text-amber-700 opacity-60" : ""} />
                    {unstableFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {unstableFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-amber-800 bg-amber-100 rounded-full px-1 border border-amber-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="text-[14px] text-[#704214] font-serif ml-1.5">
                    {unstableFilter === 0 ? "Распад" : unstableFilter === 1 ? "+Распад" : "-Распад"}
                  </span>
                </button>

                <button 
                  onClick={() => setTempFilter(((tempFilter + 1) % 3) as 0 | 1 | 2)}
                  title={tempFilter === 0 ? "Термо: Все элементы" : tempFilter === 1 ? "Термо: Только аномалии (+Термо)" : "Термо: Исключить аномалии (-Термо)"}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full border transition-all duration-300 flex items-center justify-center shrink-0 shadow-xs relative",
                    tempFilter === 0 && "bg-parchment/80 backdrop-blur-sm border-sepia/20 text-sepia/50 hover:border-gold hover:text-sepia",
                    tempFilter === 1 && "bg-cyan-500/15 border-cyan-500/60 text-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/30 font-semibold",
                    tempFilter === 2 && "bg-cyan-950/20 border-cyan-700/70 text-cyan-700 shadow-inner ring-1 ring-cyan-700/40 font-semibold"
                  )}
                >
                  <div className="relative flex items-center">
                    <Thermometer size={14} className={tempFilter === 1 ? "text-cyan-600" : tempFilter === 2 ? "text-cyan-700 opacity-60" : ""} />
                    {tempFilter === 1 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-emerald-700 bg-emerald-100 rounded-full px-1 border border-emerald-400 leading-none shadow-xs">+</span>}
                    {tempFilter === 2 && <span className="absolute -top-1.5 -right-2 text-[8px] font-black text-cyan-800 bg-cyan-100 rounded-full px-1 border border-cyan-400 leading-none shadow-xs">✕</span>}
                  </div>
                  <span className="text-[14px] text-[#704214] font-serif ml-1.5">
                    {tempFilter === 0 ? "Термо" : tempFilter === 1 ? "+Термо" : "-Термо"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="parchment-card p-0 relative z-10 overflow-hidden bg-sepia/[0.02] shadow-inner">
            <ParchmentContainerFrame />
            <div className="p-4 md:p-6 h-[400px] md:h-[550px] !overflow-y-auto custom-scrollbar touch-pan-y relative z-10">
              <SortableContext 
                items={filteredElements.map(e => e.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pb-20 justify-items-center">
                  {filteredElements.map((element) => (
                    <ElementCard
                      key={element.id}
                      element={element}
                      isDraggable
                      isSelected={slotA?.id === element.id || slotB?.id === element.id}
                      onClick={() => onSelectElement(element)}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              </SortableContext>
              {filteredElements.length === 0 && (
                <div className="flex items-center justify-center h-32 text-sepia/40 italic font-serif">
                  Ничего не найдено в свитках...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alchemy Table Section (Now Third) */}
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-sepia/20 to-transparent opacity-50" />
          
          <div 
            className="relative flex flex-col items-center justify-center gap-2 md:gap-4 py-6 md:py-10 px-4 md:px-8 w-full max-w-4xl !overflow-visible bg-no-repeat bg-center bg-cover border-4 border-gold/20 rounded-[2rem] md:rounded-[3rem] aspect-[4/5] md:aspect-video transition-all duration-500 mx-auto"
            style={{ 
              backgroundImage: "url('/file/2/tableaihim.png')",
            }}
          >
            <div className="absolute inset-0 bg-ink/10 rounded-[2rem] md:rounded-[3rem] pointer-events-none" />
            
            <div className="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 bg-parchment/60 backdrop-blur-sm px-4 md:px-12 py-2 md:py-4 border-2 border-ink/90 rounded-full text-[10px] md:text-sm uppercase tracking-[0.2em] md:tracking-[0.5em] font-black text-ink z-20 whitespace-nowrap flex items-center gap-2 md:gap-4">
              <VortexAnimation className="w-4 h-4 md:w-8 md:h-8" />
              СТОЛ ТРАНСМУТАЦИИ
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-12 xl:gap-20 w-full z-10 scale-[0.85] md:scale-100">
              <div className="flex items-center gap-2 sm:gap-6 md:gap-10 relative">
                <div className="absolute inset-0 bg-gold/10 blur-[100px] rounded-full -z-10" />
                
                <Slot 
                  id="slot-a" 
                  element={slotA} 
                  onRemove={() => setSlotA(null)} 
                  label="ПЕРВОМАТЕРИЯ"
                  isCombining={isCombining}
                />
                
                <div className="flex flex-col items-center justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="text-gold/40 font-gothic text-3xl md:text-5xl select-none drop-shadow-[0_0_15px_rgba(201,163,67,0.3)]"
                  >
                    🜔
                  </motion.div>
                </div>

                <Slot 
                  id="slot-b" 
                  element={slotB} 
                  onRemove={() => setSlotB(null)} 
                  label="РЕАГЕНТ"
                  isCombining={isCombining}
                />
              </div>

              <div className="flex flex-col items-center gap-3 md:gap-4 w-full max-w-[240px] sm:max-w-[280px] md:max-w-none">
                {/* Ввод заклинаний */}
                <div className="w-full flex flex-col items-center gap-1.5 px-2 mb-1">
                  <button
                    type="button"
                    onClick={() => setShowSpellsModal(true)}
                    className="w-full h-11 bg-parchment/65 hover:bg-parchment/80 border border-gold/40 hover:border-gold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 text-xs text-sepia shadow-xs"
                  >
                    {selectedSpells.length === 0 ? (
                      <span className="flex items-center gap-1.5 font-serif italic text-[#704214] text-[16px] font-bold">
                        <Sparkles size={16} className="text-gold animate-pulse" /> Выбрать заклинания...
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full custom-scrollbar py-0.5">
                        {selectedSpells.map(spell => (
                          <span 
                            key={spell.id}
                            className="bg-gold/20 text-[#704214] border border-gold/40 px-2.5 py-1 rounded-lg font-gothic text-[11px] font-bold flex items-center gap-1 uppercase tracking-wider"
                          >
                            {spell.name}
                            <span className="text-[9px] opacity-75">({spell.translation})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </div>

                <div className="relative w-full flex justify-center">
                  {slotA && slotB && !isCombining && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -inset-10 bg-gold/30 blur-3xl rounded-full animate-pulse"
                    />
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(201, 163, 67, 0.8)" }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!slotA || !slotB || isCombining}
                    onClick={handleCombineClick}
                    className={`w-full md:w-auto px-6 md:px-10 py-3 md:py-5 rounded-2xl font-gothic text-lg md:text-3xl tracking-[0.2em] md:tracking-[0.4em] transition-all duration-500 relative overflow-hidden group min-w-0 md:min-w-[250px] border-2 backdrop-blur-sm ${
                      slotA && slotB && !isCombining
                        ? 'bg-gold/70 text-white border-ink/90 cursor-pointer' 
                        : 'bg-parchment/40 text-ink/40 border-ink/30 cursor-not-allowed'
                    }`}
                  >
                    <span className="relative z-10 font-black">СИНТЕЗ</span>
                    {slotA && slotB && !isCombining && (
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      />
                    )}
                  </motion.button>
                </div>
                <div className="flex flex-col items-center gap-2 text-center px-4 py-3 bg-parchment/60 backdrop-blur-sm rounded-xl border border-ink/90">
                  <div className="flex items-center gap-2 text-ink">
                    <Zap size={16} className="animate-pulse text-gold" />
                    <p className="text-[14px] md:text-[16px] uppercase tracking-[0.1em] md:tracking-[0.2em] font-black">Ритуал Великого Делания</p>
                    <Zap size={16} className="animate-pulse text-gold" />
                  </div>
                  <p className="text-[12px] md:text-[14px] uppercase tracking-widest text-ink/60 font-medium italic">Соедините две сущности для рождения новой</p>
                </div>
              </div>
            </div>
            
            {/* Decorative Alchemical Symbols */}
            <div className="absolute bottom-6 left-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜁</div>
            <div className="absolute bottom-6 right-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜃</div>
            <div className="absolute top-6 left-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜂</div>
            <div className="absolute top-6 right-6 text-gold/20 font-gothic text-5xl select-none drop-shadow-lg">🜄</div>
          </div>
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeElement ? (
            <div className="relative">
              <ElementCard 
                element={activeElement} 
                className="w-32 h-32 shadow-2xl gold-glow border-gold/50 rotate-3" 
              />
              {(activeElement.stability ?? 100) < 80 ? (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg border border-white/20 whitespace-nowrap z-50">
                  Нестабильно!
                </div>
              ) : ((activeElement.targetTemperature || 0) - (activeElement.temperature || 0)) > 200 ? (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg border border-white/20 whitespace-nowrap z-50">
                  Слишком холодно!
                </div>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Модальное окно заклинаний */}
      <AnimatePresence>
        {showSpellsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/75 backdrop-blur-md z-[100] flex items-center justify-center p-2 md:p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] bg-[#faf7f2] text-sepia border-2 border-gold/40 rounded-[1.5rem] md:rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative"
            >
              {/* Декоративные уголки */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold/40 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold/40 pointer-events-none" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold/40 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold/40 pointer-events-none" />

              {/* Шапка */}
              <div className="p-3 md:p-6 border-b border-gold/25 bg-[#f4efe6] flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gold/10 flex items-center justify-center text-lg md:text-xl border border-gold/30 text-gold shadow-md">
                    📖
                  </div>
                  <div>
                    <h3 className="text-sm md:text-xl font-gothic tracking-widest text-sepia uppercase">Гримуар Слов Силы</h3>
                    <p className="hidden md:block text-[16px] text-sepia/60 uppercase tracking-wider font-serif italic">Выберите до трех латинских формул заклинания для синтеза</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSpellsModal(false)}
                  className="p-1 md:p-2 rounded-full hover:bg-gold/10 text-gold transition-colors"
                >
                  <X size={18} className="text-sepia/70 hover:text-sepia" />
                </button>
              </div>

              {/* Поиск и категории */}
              <div className="p-2.5 md:p-4 bg-[#ede6d9] border-b border-gold/20 flex flex-col md:flex-row gap-2.5 md:gap-4 items-center justify-between">
                {/* Поиск */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia/40" size={14} />
                  <input
                    type="text"
                    placeholder="Поиск по имени или свойству..."
                    value={spellsSearch}
                    onChange={(e) => setSpellsSearch(e.target.value)}
                    className="w-full pl-8 pr-4 py-1.5 bg-white/80 border border-gold/30 rounded-xl focus:border-gold outline-none text-xs text-sepia placeholder-sepia/40 font-serif italic shadow-inner"
                  />
                  {spellsSearch && (
                    <button 
                      onClick={() => setSpellsSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-sepia/40 hover:text-sepia"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Категории */}
                <div 
                  onWheel={(e) => {
                    if (e.deltaY !== 0) {
                      e.currentTarget.scrollLeft += e.deltaY;
                    }
                  }}
                  className="flex flex-row gap-1.5 max-w-full justify-start md:justify-end overflow-x-auto custom-scrollbar pb-1.5 md:pb-1 scroll-smooth cursor-grab active:cursor-grabbing shrink-0"
                >
                  {['Все', 'Стихии', 'Жизнь и Смерть', 'Космос и Время', 'Разум и Дух', 'Сила и Изменение'].map((category) => {
                    const count = category === 'Все' 
                      ? dbSpells.length 
                      : dbSpells.filter(s => s.category === category).length;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedSpellCategory(category)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap shrink-0",
                          selectedSpellCategory === category
                            ? "bg-gold text-white border-gold font-black scale-105 shadow-sm"
                            : "bg-white/60 text-sepia/70 border-gold/20 hover:border-gold/40 hover:bg-white"
                        )}
                      >
                        {category} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Сетка заклинаний */}
              <div className="p-3 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#fbf9f4]">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3.5 items-stretch">
                  {(() => {
                    const userLevel = currentUser?.level || Math.floor((elements?.length || 0) / 10) + 1;
                    const sortedSpells = [...dbSpells].sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));
                    
                    return sortedSpells.filter(spell => {
                      const matchesCategory = selectedSpellCategory === 'Все' || spell.category === selectedSpellCategory;
                      const matchesSearch = !spellsSearch || 
                        spell.name.toLowerCase().includes(spellsSearch.toLowerCase()) || 
                        (spell.translation && spell.translation.toLowerCase().includes(spellsSearch.toLowerCase())) ||
                        (spell.description && spell.description.toLowerCase().includes(spellsSearch.toLowerCase())) ||
                        (spell.incantation && spell.incantation.toLowerCase().includes(spellsSearch.toLowerCase()));
                      return matchesCategory && matchesSearch;
                    }).map((spell) => {
                       const isSelected = selectedSpells.some(s => s.id === spell.id);
                       const requiredLevel = spell.unlockLevel || 1;
                       const isLocked = requiredLevel > userLevel;

                       return (
                         <button
                           key={spell.id}
                           type="button"
                           disabled={isLocked}
                           onClick={() => {
                             if (isLocked) return;
                             if (isSelected) {
                               setSelectedSpells(prev => prev.filter(s => s.id !== spell.id));
                             } else {
                               if (selectedSpells.length < 3) {
                                 setSelectedSpells(prev => [...prev, spell]);
                               }
                             }
                           }}
                           style={{
                             borderColor: spell.color || '#c9a343'
                           }}
                           className={cn(
                             "p-3.5 md:p-4 rounded-xl border-2 text-left transition-all duration-300 relative group flex flex-col gap-2 select-none h-full min-h-[185px]",
                             isLocked
                               ? "bg-stone-200/70 border-stone-400/80 opacity-80 cursor-not-allowed grayscale-[0.2]"
                               : isSelected
                                 ? "bg-gold/10 shadow-[0_0_15px_rgba(201,163,67,0.2)] scale-[1.01]"
                                 : "bg-white/90 hover:bg-white hover:shadow-md"
                           )}
                         >
                           {/* Если заклинание закрыто: Показываем доступность уровня КРУПНО и по центру */}
                           {isLocked ? (
                             <div className="flex flex-col items-center justify-center my-auto py-3 px-2 w-full text-center bg-stone-100/90 rounded-lg border border-stone-300/80 shadow-inner">
                               <Lock size={28} className="text-stone-600 mb-1" />
                               <span className="text-[12px] font-bold uppercase tracking-wider text-stone-700">Закрытое заклинание</span>
                               <span className="text-[12px] text-stone-600 font-serif mt-1">Доступно с уровня</span>
                               <div className="text-3xl font-black font-mono text-stone-900 my-1 drop-shadow-sm">
                                 {requiredLevel}
                               </div>
                               <span className="text-[12px] text-stone-600 font-serif">
                                 Ваш уровень: <strong className="text-[14px] text-stone-900 font-mono font-bold">{userLevel}</strong>
                               </span>
                             </div>
                           ) : (
                             <>
                               {/* Шапка карточки */}
                               <div className="flex flex-row justify-between items-baseline gap-2 w-full">
                                 <div className="flex items-center gap-1.5 overflow-hidden">
                                   <span className="text-base shrink-0 element-icon-filter">{spell.icon || '✨'}</span>
                                   <span 
                                     style={{ color: spell.color || '#c9a343' }}
                                     className="font-gothic text-[13px] md:text-[14px] tracking-wider transition-colors truncate font-bold"
                                   >
                                     {spell.name}
                                   </span>
                                 </div>
                                 <span className="text-[12px] italic text-gold font-serif whitespace-nowrap shrink-0">
                                   {spell.translation}
                                 </span>
                               </div>

                               {/* Заклинательная формула */}
                               {spell.incantation && (
                                 <p className="text-[12px] text-amber-900/90 font-serif italic border-l-2 border-gold/40 pl-2 my-0.5">
                                   «{spell.incantation}»
                                 </p>
                               )}

                               {/* Описание */}
                               <p className="text-[12px] text-sepia/90 leading-relaxed font-sans break-words whitespace-normal flex-1">
                                 {spell.description}
                               </p>

                               {/* Дополнительные характеристики */}
                               <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[12px] font-mono text-sepia/80">
                                 {spell.basePower !== undefined && (
                                   <span className="px-2 py-0.5 rounded bg-amber-100/70 border border-amber-200 flex items-center gap-1" title="Базовая мощь">
                                     ⚡ <span className="text-[14px] font-bold">{spell.basePower}</span>
                                   </span>
                                 )}
                                 {spell.manaCost !== undefined && (
                                   <span className="px-2 py-0.5 rounded bg-blue-100/70 border border-blue-200 flex items-center gap-1" title="Затраты маны">
                                     💎 <span className="text-[14px] font-bold">{spell.manaCost}</span>
                                   </span>
                                 )}
                                 {spell.targetRealityLayer !== undefined && (
                                   <span className="px-2 py-0.5 rounded bg-purple-100/70 border border-purple-200 flex items-center gap-1" title="Слой реальности">
                                     🌐 Слой <span className="text-[14px] font-bold">{spell.targetRealityLayer}</span>
                                   </span>
                                 )}
                                 {spell.rarity && (
                                   <span className="px-2 py-0.5 rounded bg-gold/10 border border-gold/20 text-gold font-bold text-[12px]">
                                     {spell.rarity}
                                   </span>
                                 )}
                                 {spell.isForbidden && (
                                   <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 font-bold text-[12px]">
                                     ⛔ Запретное
                                   </span>
                                 )}
                               </div>

                               {/* Подвал открытой карточки */}
                               <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-gold/15 w-full text-[12px]">
                                 <span className="uppercase tracking-widest text-sepia/60 text-[12px] font-bold truncate max-w-[50%]">
                                   {spell.category}
                                 </span>

                                 {isSelected ? (
                                   <span className="text-[12px] text-gold font-bold whitespace-nowrap flex items-center gap-1">
                                     <Unlock size={12} /> ✓ Активно
                                   </span>
                                 ) : (
                                   <span className="text-[12px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60" title="Требуемый уровень">
                                     🔓 <span className="text-[14px] font-mono">{requiredLevel}</span> ур.
                                   </span>
                                 )}
                               </div>
                             </>
                           )}
                         </button>
                       );
                     });
                  })()}
                </div>
              </div>

              {/* Подвал */}
               <div className="p-3 md:p-6 border-t border-gold/25 bg-[#f4efe6] flex flex-col md:flex-row items-center justify-between gap-2.5 md:gap-4">
                 <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                   <span className="text-[12px] uppercase tracking-wider text-sepia font-bold">Выбрано:</span>
                   <div className="flex flex-wrap gap-1">
                     {selectedSpells.length === 0 ? (
                       <span className="text-[10px] md:text-xs text-sepia/40 italic font-serif">Нет заклинаний</span>
                     ) : (
                       selectedSpells.map(s => (
                         <span 
                           key={s.id}
                           onClick={() => setSelectedSpells(prev => prev.filter(sp => sp.id !== s.id))}
                           className="bg-gold/15 text-sepia border border-gold/30 hover:border-red-500/50 hover:text-red-600 px-1.5 py-0.5 rounded text-[10px] font-gothic flex items-center gap-1 uppercase cursor-pointer transition-colors"
                         >
                           {s.name} <X size={8} />
                         </span>
                       ))
                     )}
                   </div>
                 </div>

                 <div className="flex gap-2 w-full md:w-auto">
                   <button
                     type="button"
                     onClick={() => setSelectedSpells([])}
                     disabled={selectedSpells.length === 0}
                     className="flex-1 md:flex-none px-3 py-1.5 border border-red-500/30 text-red-600 hover:bg-red-500/10 rounded-xl text-[10px] md:text-xs uppercase tracking-wider font-bold transition-all disabled:opacity-30 disabled:pointer-events-none"
                   >
                     Сброс
                   </button>
                   <button
                     type="button"
                     onClick={() => setShowSpellsModal(false)}
                     className="flex-[2] md:flex-none px-4 md:px-6 py-1.5 md:py-2 bg-gold text-white font-bold rounded-xl text-[10px] md:text-xs uppercase tracking-widest transition-all hover:bg-gold/90 gold-glow shadow-md"
                   >
                     Сплести Заклинание
                   </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
          )}
        </AnimatePresence>

      {/* Modals & Popups handled globally in App.tsx */}
    </div>
  );
};
