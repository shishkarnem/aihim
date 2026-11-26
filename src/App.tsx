import React, { useState, useEffect } from 'react';
import { AlchemyElement, WorldPhase, CombinationResult, AppUser } from './types';
import { INITIAL_ELEMENTS, calculateRank, HIDDEN_LAWS, REALITY_LAYERS, STABILITY_DECAY_INTERVAL, TEMPERATURE_DECAY_INTERVAL, calculateUnlockedReality } from './constants';
import { Atelier } from './pages/Atelier';
import { Profile } from './pages/Profile';
import { Arcana } from './pages/Arcana';
import { Admin } from './pages/Admin';
import { Oferta } from './pages/Oferta';
import { Rate } from './pages/Rate';
import { SystemAdminPage } from './pages/SystemAdminPage';
import { getAdminUsers, registerTelegramUser, saveAdminUsers } from './lib/adminData';
import { Maintenance } from './pages/Maintenance';
import { TelegramRedirect } from './pages/TelegramRedirect';
import { ElementDetailsModal } from './components/ElementDetailsModal';
import { SystemDiagnosticsModal } from './components/SystemDiagnosticsModal';
import { ElementCard } from './components/ElementCard';
import { AuthModal } from './components/AuthModal';
import { AncientManuscriptBackground } from './components/AncientManuscriptBackground';
import { VortexAnimation, MagicParticles, RareFlash } from './components/Animations';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate, Link } from 'react-router-dom';
import { Trophy, FlaskConical, History, Settings as SettingsIcon, Sparkles, X, Hammer, Thermometer, AlertCircle, Zap, Coins, User, ShieldCheck, Key, LogIn, Plus, Moon, Clock, RotateCw, CheckCircle2, BookOpen } from 'lucide-react';
import { BlogListPage } from './pages/blog/BlogListPage';
import { BlogArticlePage } from './pages/blog/BlogArticlePage';
import { SeoHeadManager } from './components/seo/SeoHeadManager';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { generateNewElement } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getTelegramUserFromContext() {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user;
    }
    if (tg?.initData) {
      const params = new URLSearchParams(tg.initData);
      const userStr = params.get('user');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          if (parsed && typeof parsed === 'object' && parsed.id) return parsed;
        } catch (e) {}
      }
    }
    const hash = window.location.hash;
    if (hash && hash.includes('tgWebAppData=')) {
      const cleanHash = hash.replace(/^#/, '');
      const searchParams = new URLSearchParams(cleanHash);
      const tgWebAppData = searchParams.get('tgWebAppData');
      if (tgWebAppData) {
        const parsedData = new URLSearchParams(tgWebAppData);
        const userStr = parsedData.get('user');
        if (userStr) {
          try {
            const parsed = JSON.parse(userStr);
            if (parsed && typeof parsed === 'object' && parsed.id) return parsed;
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.error("Error parsing Telegram user context:", e);
  }
  return null;
}

const MaintenanceWrapper: React.FC<{
  discoveredElements: AlchemyElement[];
  setDiscoveredElements: React.Dispatch<React.SetStateAction<AlchemyElement[]>>;
  aihim: number;
  setAihim: React.Dispatch<React.SetStateAction<number>>;
  setIsShopOpen: (open: boolean) => void;
  toggleFavorite: (id: string) => void;
  regenTimer: number;
  isSyncingBalance?: boolean;
  onAddToAtelier?: (element: AlchemyElement) => void;
}> = ({ discoveredElements, setDiscoveredElements, aihim, setAihim, setIsShopOpen, toggleFavorite, regenTimer, isSyncingBalance, onAddToAtelier }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Maintenance 
        elements={discoveredElements}
        setElements={setDiscoveredElements}
        initialElementId={id}
        onClearInitial={() => navigate('/maintenance', { replace: true })}
        aihim={aihim}
        setAihim={setAihim}
        onOpenShop={() => setIsShopOpen(true)}
        onToggleFavorite={toggleFavorite}
        regenTimer={regenTimer}
        isSyncingBalance={isSyncingBalance}
        onAddToAtelier={onAddToAtelier}
      />
    </motion.div>
  );
};

function dedupeElements(elements: AlchemyElement[]): AlchemyElement[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: AlchemyElement[] = [];
  for (const el of elements) {
    if (!el || !el.id) continue;
    const idKey = String(el.id);
    const nameKey = el.name ? el.name.toLowerCase().trim() : '';
    if (seenIds.has(idKey) || (nameKey && seenNames.has(nameKey))) continue;
    seenIds.add(idKey);
    if (nameKey) seenNames.add(nameKey);
    result.push(el);
  }
  return result;
}

export default function App() {
  const [discoveredElements, setDiscoveredElements] = useState<AlchemyElement[]>(() => {
    const saved = localStorage.getItem('aihim_elements');
    if (!saved) return INITIAL_ELEMENTS;
    
    try {
      const parsed = JSON.parse(saved);
      // Filter out any null/undefined elements that might have been saved
      const validElements = Array.isArray(parsed) ? parsed.filter((e): e is AlchemyElement => e !== null && typeof e === 'object' && !!e.id) : INITIAL_ELEMENTS;
      
      // Migration: If elements are in English (e.g., name is "Water") or contain old base elements, reset to INITIAL_ELEMENTS
      const isEnglish = validElements.some((e: any) => e.id === 'water' && e.name === 'Water');
      const hasOldElements = validElements.some((e: any) => e.id === 'metal' || e.id === 'crystal' || e.id === 'darkness');
      if (isEnglish || hasOldElements) {
        localStorage.removeItem('aihim_elements');
        localStorage.removeItem('aihim_history');
        return INITIAL_ELEMENTS;
      }
      
      // Migration: Ensure all elements have targetTemperature
      return dedupeElements(validElements.map((e: any) => {
        if (e.targetTemperature === undefined || e.targetTemperature === 0) {
          const initial = INITIAL_ELEMENTS.find(ie => ie.id === e.id);
          if (initial) return { ...e, targetTemperature: initial.targetTemperature };
          return { ...e, targetTemperature: e.temperature || 0 };
        }
        return e;
      }));
    } catch (e) {
      return INITIAL_ELEMENTS;
    }
  });

  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('aihim_history');
    return saved ? JSON.parse(saved) : [];
  });

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname === '/' ? 'atelier' : location.pathname.split('/')[1];

  const [aihim, setAihim] = useState<number>(() => {
    const saved = localStorage.getItem('aihim_energy');
    return saved ? parseInt(saved) : 1000;
  });

  const [appVersion, setAppVersion] = useState<string>(() => {
    return localStorage.getItem('aihim_app_version') || '1.32';
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/app-version', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.version) {
          const clean = String(data.version).replace(/^v/i, '').trim() || '1.32';
          setAppVersion(clean);
          localStorage.setItem('aihim_app_version', clean);
        }
      })
      .catch(() => {});

    const onVersionUpdated = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        const clean = String(custom.detail).replace(/^v/i, '').trim() || '1.32';
        setAppVersion(clean);
        localStorage.setItem('aihim_app_version', clean);
      }
    };
    window.addEventListener('alchimia:version_updated', onVersionUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('alchimia:version_updated', onVersionUpdated);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('aihim_energy', aihim.toString());
  }, [aihim]);

  const [stabilityWarning, setStabilityWarning] = useState<AlchemyElement | null>(null);
  const [temperatureWarning, setTemperatureWarning] = useState<AlchemyElement | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  const [combinationResult, setCombinationResult] = useState<AlchemyElement | null>(null);
  const [worldPhase, setWorldPhase] = useState<WorldPhase>(() => (localStorage.getItem('aihim_world_phase') as WorldPhase) || 'day');
  const [lastCombinationTime, setLastCombinationTime] = useState(0);
  const [alchemyMessage, setAlchemyMessage] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<AlchemyElement | null>(null);
  const [slotA, setSlotA] = useState<AlchemyElement | null>(null);
  const [slotB, setSlotB] = useState<AlchemyElement | null>(null);
  const [combiningElements, setCombiningElements] = useState<{a: AlchemyElement | null, b: AlchemyElement | null}>({ a: null, b: null });
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [manualRubles, setManualRubles] = useState<string>('100');

  const [isAstralRestartOpen, setIsAstralRestartOpen] = useState(false);
  const [astralRestartState, setAstralRestartState] = useState<'restarting' | 'success'>('restarting');
  const [astralRestartTimer, setAstralRestartTimer] = useState(30);
  const astralTimerRef = React.useRef<any>(null);

  const handleFinishAstralError = () => {
    setAlchemyMessage(null);
    fetch('/api/protalk/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id, telegramId: currentUser?.telegramId })
    }).catch(() => {});
  };

  const handleRestartAstral = () => {
    setAlchemyMessage(null);
    setIsAstralRestartOpen(true);
    setAstralRestartState('restarting');
    setAstralRestartTimer(30);

    if (astralTimerRef.current) clearInterval(astralTimerRef.current);

    astralTimerRef.current = setInterval(() => {
      setAstralRestartTimer(prev => {
        if (prev <= 1) {
          if (astralTimerRef.current) clearInterval(astralTimerRef.current);
          setAstralRestartState('success');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    fetch('/api/protalk/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id, telegramId: currentUser?.telegramId })
    })
    .then(() => {
      if (astralTimerRef.current) clearInterval(astralTimerRef.current);
      setAstralRestartState('success');
    })
    .catch(() => {
      if (astralTimerRef.current) clearInterval(astralTimerRef.current);
      setAstralRestartState('success');
    });
  };

  const handleContinueAfterRestart = () => {
    setIsAstralRestartOpen(false);
    if (astralTimerRef.current) clearInterval(astralTimerRef.current);
    navigate('/');
  };

  // Keyboard shortcut listener for Ctrl + [ (System Diagnostics)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        setIsDiagnosticsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSyncingBalance, setIsSyncingBalance] = useState(false);

  const lastSyncedAihim = React.useRef<number>(aihim);
  const lastSyncedElementsCount = React.useRef<number>(discoveredElements.length);
  const [cancelTimer, setCancelTimer] = useState(30);
  const [phaseTimer, setPhaseTimer] = useState<number>(() => {
    const saved = localStorage.getItem('aihim_phase_timer');
    return saved ? parseInt(saved, 10) : 300;
  });
  const [regenTimer, setRegenTimer] = useState(60);
  const isFirstRegen = React.useRef(true);
  const hasRegeneratedForCycle = React.useRef(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isUserIdle, setIsUserIdle] = useState(false);
  const lastActivityTimestamp = React.useRef<number>(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // User Inactivity Tracker (10 minutes = 600,000 ms)
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimestamp.current = Date.now();
      if (isUserIdle) {
        setIsUserIdle(false);
      }
    };

    const activityEvents = ['click', 'keydown', 'touchstart', 'mousedown'];
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    const checkIdleInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTimestamp.current;
      if (!isUserIdle && timeSinceLastActivity >= 600000) { // 10 minutes of no interaction
        setIsUserIdle(true);
      }
    }, 3000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(checkIdleInterval);
    };
  }, [isUserIdle]);
  
  // Stage Notification State
  const [stageNotification, setStageNotification] = useState<{
    type: 'rank' | 'layer' | 'level';
    title: string;
    value: string | number;
    icon: string | React.ReactNode;
    desc: string;
  } | null>(null);

  const [prevRankName, setPrevRankName] = useState<string>(() => {
    const saved = localStorage.getItem('aihim_prev_rank');
    return saved || 'Закалка Тела';
  });

  const [topUpHistory, setTopUpHistory] = useState<Array<{ amount: number; price: number; timestamp: number }>>(() => {
    const saved = localStorage.getItem('aihim_topup_history');
    return saved ? JSON.parse(saved) : [];
  });

  const recordTopUp = (amount: number, price: number) => {
    const newEntry = { amount, price, timestamp: Date.now() };
    setTopUpHistory(prev => {
      const updated = [newEntry, ...prev];
      localStorage.setItem('aihim_topup_history', JSON.stringify(updated));
      return updated;
    });
  };

  const [prevLayerLevel, setPrevLayerLevel] = useState<number>(() => {
    const saved = localStorage.getItem('aihim_prev_layer');
    return saved ? parseInt(saved) : 1;
  });

  const [prevAlchemyLevel, setPrevAlchemyLevel] = useState<number>(() => {
    const saved = localStorage.getItem('aihim_prev_level');
    return saved ? parseInt(saved) : 1;
  });

  const [selectedRealityLevel, setSelectedRealityLevel] = useState<number>(() => {
    const saved = localStorage.getItem('aihim_selected_layer');
    if (saved) return parseInt(saved);
    return calculateUnlockedReality(discoveredElements);
  });

  // Helper to clear local storage cache completely
  const clearLocalStorageCache = () => {
    localStorage.removeItem('alchimia_active_user_id');
    localStorage.removeItem('aihim_elements');
    localStorage.removeItem('alchimia_discovered_elements');
    localStorage.removeItem('aihim_history');
    localStorage.removeItem('aihim_energy');
    localStorage.removeItem('aihim_prev_rank');
    localStorage.removeItem('aihim_prev_layer');
    localStorage.removeItem('aihim_selected_layer');
    localStorage.removeItem('aihim_prev_level');
  };

  const [isUserDbLoaded, setIsUserDbLoaded] = useState(false);
  const lastSyncedElementsSigRef = React.useRef<string>('');
  const buildElementsSignature = (els: AlchemyElement[]) => {
    if (!els || els.length === 0) return '0';
    return `${els.length}:${els.map(e => `${e.id}:${e.isFavorite ? 1 : 0}`).join('|')}`;
  };

  // Helper to load user profile and exact elements from PostgreSQL database
  const loadUserFromDb = async (userId: string) => {
    if (!userId || userId === 'guest_demo') {
      setIsUserDbLoaded(true);
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) {
        // User deleted or missing in DB! Force clear cache and reset to guest
        clearLocalStorageCache();
        setIsDemoMode(true);
        setCurrentUser({
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
        });
        setDiscoveredElements(INITIAL_ELEMENTS);
        setAihim(1000);
        setHistory([]);
        setSelectedRealityLevel(1);
        setIsUserDbLoaded(true);
        return;
      }
      const data = await res.json();
      if (!data || !data.user) {
        setIsUserDbLoaded(true);
        return;
      }

      if (data.user) {
        setCurrentUser(data.user);
        if (data.user.balance !== undefined && data.user.balance !== null) {
          setAihim(data.user.balance);
          lastSyncedAihim.current = data.user.balance;
          localStorage.setItem('aihim_energy', data.user.balance.toString());
        }
      }

      if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
        const formattedElements: AlchemyElement[] = data.elements.map((dbEl: any) => {
          const elName = dbEl.name || dbEl.elementName;
          const matchingInitial = INITIAL_ELEMENTS.find(ie => ie.name.toLowerCase() === elName?.toLowerCase());
          return {
            id: dbEl.id || matchingInitial?.id || `DISC-${userId}-${elName}`,
            name: elName || matchingInitial?.name || 'Безымянный Элемент',
            description: dbEl.description || matchingInitial?.description || 'Открытый элемент алхимии',
            icon: dbEl.icon || matchingInitial?.icon || '✨',
            rarity: dbEl.rarity || matchingInitial?.rarity || 'Обычный',
            type: dbEl.type || matchingInitial?.type || 'Материя',
            state: dbEl.state || matchingInitial?.state || 'Твердое',
            complexity: dbEl.complexity || matchingInitial?.complexity || 1,
            discoveredAt: dbEl.discoveredAt || Date.now(),
            temperature: dbEl.temperature ?? matchingInitial?.temperature ?? 20,
            targetTemperature: dbEl.targetTemperature ?? matchingInitial?.targetTemperature ?? 20,
            stability: dbEl.stability ?? matchingInitial?.stability ?? 100,
            essences: typeof dbEl.essences === 'string' ? JSON.parse(dbEl.essences) : (dbEl.essences || matchingInitial?.essences || []),
            parents: typeof dbEl.parents === 'string' ? JSON.parse(dbEl.parents) : (dbEl.parents || matchingInitial?.parents || []),
            realityLevel: dbEl.realityLevel || dbEl.layer || matchingInitial?.realityLevel || 1,
            isFavorite: !!dbEl.isFavorite
          };
        });
        const uniqueElements = dedupeElements(formattedElements);
        setDiscoveredElements(uniqueElements);
        lastSyncedElementsCount.current = uniqueElements.length;
        lastSyncedElementsSigRef.current = buildElementsSignature(uniqueElements);
        localStorage.setItem('aihim_elements', JSON.stringify(uniqueElements));
        localStorage.setItem('alchimia_discovered_elements', JSON.stringify(uniqueElements));
      } else {
        setDiscoveredElements(INITIAL_ELEMENTS);
        lastSyncedElementsCount.current = INITIAL_ELEMENTS.length;
        lastSyncedElementsSigRef.current = buildElementsSignature(INITIAL_ELEMENTS);
        localStorage.setItem('aihim_elements', JSON.stringify(INITIAL_ELEMENTS));
        localStorage.setItem('alchimia_discovered_elements', JSON.stringify(INITIAL_ELEMENTS));
      }
    } catch (err) {
      console.error("Error loading user profile from DB:", err);
    } finally {
      setIsUserDbLoaded(true);
    }
  };

  // Helper to switch user, login, or logout
  const handleSelectUser = (newUser: AppUser) => {
    if (!newUser || newUser.id === 'guest_demo') {
      clearLocalStorageCache();
      setIsDemoMode(true);
      setCurrentUser({
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
      });
      setDiscoveredElements(INITIAL_ELEMENTS);
      setAihim(1000);
      setHistory([]);
      setSelectedRealityLevel(1);
    } else {
      localStorage.setItem('alchimia_active_user_id', newUser.id.toString());
      setIsDemoMode(false);
      setCurrentUser(newUser);
      if (newUser.balance !== undefined && newUser.balance !== null) {
        setAihim(newUser.balance);
      }
      loadUserFromDb(newUser.id.toString());
    }
  };

  // Пользовательские состояния и загрузка из Telegram WebApp
  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    const adminUsers = getAdminUsers();
    const urlParams = new URLSearchParams(window.location.search);
    const isExplicitDemo = urlParams.get('demo') === 'true';

    // 1. Если открыто из Telegram Mini App
    const tgUser = getTelegramUserFromContext();
    if (tgUser && tgUser.id) {
      let startParam: string | undefined = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (!startParam) {
        const startVal = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam');
        if (startVal) startParam = startVal;
      }
      return registerTelegramUser(tgUser, startParam);
    }

    // 2. Если явно передан ID через URL параметр admin или user
    const explicitAdminId = urlParams.get('admin') || urlParams.get('user');
    if (explicitAdminId && !isExplicitDemo) {
      const found = adminUsers.find(u => u.id === explicitAdminId);
      if (found) return found;
      return {
        id: explicitAdminId,
        username: explicitAdminId === '169262990' ? '@shishkarnem' : `@id${explicitAdminId}`,
        fullName: explicitAdminId === '169262990' ? 'Dr.White' : 'Алхимик',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
        role: (explicitAdminId === '169262990') ? 'admin' : 'user',
        balance: 1000,
        discoveredCount: 8,
        status: 'active',
        level: 1,
        registrationDate: Date.now(),
        lastActive: Date.now()
      };
    }

    // 3. По умолчанию для первого входа и AI Studio Preview: ДЕМО РЕЖИМ (чистый гость)
    return {
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
  });

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') return true;
    return currentUser.id === 'guest_demo' || currentUser.role === 'demo';
  });

  const [referrerUser, setReferrerUser] = useState<AppUser | null>(null);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Auto-open AuthModal if path is /login or query has login=true
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (location.pathname === '/login' || urlParams.get('login') === 'true') {
      setIsAuthModalOpen(true);
    }
  }, [location.pathname]);

  // Demo user rule: only true if explicit demo mode or guest_demo/demo role
  const isTelegramUser = Boolean((window as any).Telegram?.WebApp?.initDataUnsafe?.user);
  const isDemoUser = isDemoMode || currentUser?.id === 'guest_demo' || (currentUser?.role as string) === 'demo';
  const createdElementsCount = Math.max(0, discoveredElements.length - 8);
  const isDemoLimitReached = isDemoUser && createdElementsCount >= 5;

  // Intercept clicks when demo limit is reached
  useEffect(() => {
    if (!isDemoLimitReached) return;

    const handleGlobalClick = (e: MouseEvent) => {
      // Don't trigger if already interacting with the modal
      const target = e.target as HTMLElement;
      if (target && target.closest('.parchment-card')) return;
      setIsTelegramModalOpen(true);
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, [isDemoLimitReached]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      setAlchemyMessage('✨ Оплата в Робокассе прошла успешно! Энергия AiHim зачислена.');
      window.history.replaceState({}, document.title, window.location.pathname);

      if (currentUser?.id && currentUser.id !== 'guest_demo') {
        const refreshUser = () => {
          fetch(`/api/users/${currentUser.id}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && data.user && data.user.balance !== undefined && data.user.balance !== null) {
                setAihim(data.user.balance);
                lastSyncedAihim.current = data.user.balance;
                localStorage.setItem('aihim_energy', data.user.balance.toString());
                setCurrentUser(prev => ({ ...prev, balance: data.user.balance }));
              }
            })
            .catch(err => console.warn("Payment refresh warning:", err));
        };
        refreshUser();
        setTimeout(refreshUser, 1000);
        setTimeout(refreshUser, 3000);
        setTimeout(refreshUser, 5000);
      }
    } else if (paymentStatus === 'fail') {
      setAlchemyMessage('⚠️ Оплата в Робокассе была отменена или завершилась ошибкой.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentUser?.id]);

  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Запуск матрицы Эфира...');

  useEffect(() => {
    const steps = [
      { progress: 20, status: 'Считывание частоты Эфира...' },
      { progress: 45, status: 'Поиск ключа Telegram WebApp...' },
      { progress: 70, status: 'Проверка священной подписи...' },
      { progress: 90, status: 'Трансмутация сознания...' },
      { progress: 100, status: 'Синхронизация завершена!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setLoadingProgress(steps[currentStep].progress);
        setLoadingStatus(steps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(interval);
        
        try {
          // Инициализация Telegram WebApp
          const tg = (window as any).Telegram?.WebApp;
          if (tg) {
            try {
              tg.ready?.();
              tg.expand?.();
            } catch (e) {}
          }
          
          let startParam: string | undefined = tg?.initDataUnsafe?.start_param;
          if (!startParam) {
            const urlParams = new URLSearchParams(window.location.search);
            let startVal = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || urlParams.get('start_param') || urlParams.get('ref') || urlParams.get('start');
            if (!startVal && window.location.hash) {
              const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
              startVal = hashParams.get('startapp') || hashParams.get('tgWebAppStartParam') || hashParams.get('start_param') || hashParams.get('ref') || hashParams.get('start');
            }
            if (startVal) startParam = startVal;
          }
          if (startParam) {
            startParam = String(startParam).replace(/^ref_?|^user_?/i, '').trim();
          }

          const tgUser = getTelegramUserFromContext();

          if (tgUser) {
            const registered = registerTelegramUser(tgUser, startParam);
            setCurrentUser(registered);
            setIsDemoMode(false);
            localStorage.setItem('alchimia_active_user_id', tgUser.id.toString());

            // Immediately load exact user data and elements directly from DB
            loadUserFromDb(tgUser.id.toString());

            // Sync Telegram login to server DB
            fetch('/api/users/telegram-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: tgUser.id,
                username: tgUser.username,
                first_name: tgUser.first_name || tgUser.firstName,
                last_name: tgUser.last_name || tgUser.lastName,
                photo_url: tgUser.photo_url || tgUser.photoUrl,
                startParam,
                initData: (window as any).Telegram?.WebApp?.initData
              })
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && data.user) {
                setCurrentUser(data.user);
                if (data.user.balance !== undefined) {
                  setAihim(data.user.balance);
                  lastSyncedAihim.current = data.user.balance;
                }
                localStorage.setItem('alchimia_active_user_id', data.user.id.toString());
                loadUserFromDb(data.user.id.toString());
              }
            })
            .catch(err => console.error("Telegram DB Login error:", err));
          } else {
            // Обычный веб-режим или AI Studio Preview
            const urlParams = new URLSearchParams(window.location.search);
            const explicitAdminId = urlParams.get('admin') || urlParams.get('user');

            if (explicitAdminId) {
              const tempUser: AppUser = {
                id: explicitAdminId,
                username: explicitAdminId === '169262990' ? '@shishkarnem' : `@id${explicitAdminId}`,
                fullName: explicitAdminId === '169262990' ? 'Dr.White' : 'Алхимик',
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
                role: (explicitAdminId === '169262990') ? 'admin' : 'user',
                balance: 1000,
                discoveredCount: 8,
                status: 'active',
                level: 1,
                registrationDate: Date.now(),
                lastActive: Date.now()
              };
              handleSelectUser(tempUser);
            } else {
              const savedActiveUserId = localStorage.getItem('alchimia_active_user_id');
              if (savedActiveUserId && savedActiveUserId !== 'guest_demo') {
                fetch(`/api/users/${savedActiveUserId}`)
                  .then(res => res.ok ? res.json() : null)
                  .then(data => {
                    if (data && data.user) {
                      handleSelectUser(data.user);
                    } else {
                      handleSelectUser({
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
                      });
                    }
                  })
                  .catch(() => {
                    handleSelectUser({
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
                    });
                  });
              } else {
                handleSelectUser({
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
                });
              }
            }
          }
        } catch (e) {
          console.error("Ошибка при получении данных из Telegram", e);
        }

        setIsAppLoaded(true);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const discoveredElementsRef = React.useRef(discoveredElements);
  discoveredElementsRef.current = discoveredElements;
  const isUserIdleRef = React.useRef(isUserIdle);
  isUserIdleRef.current = isUserIdle;
  const aihimRef = React.useRef(aihim);
  aihimRef.current = aihim;

  const isPollInFlightRef = React.useRef(false);
  const isSyncInFlightRef = React.useRef(false);

  // Poll server for live user changes (Role, Balance, Status) so changes by Admin apply without hammering DB
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest_demo' || !isAppLoaded) return;

    const uid = currentUser.id;
    const initUser = currentUserRef.current;

    // Auto-register & lightweight sync user with backend DB on mount
    fetch(`/api/users/${uid}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        balance: aihimRef.current,
        discoveredCount: discoveredElementsRef.current.length,
        level: calculateRank(discoveredElementsRef.current.length).level,
        role: initUser.role || 'user',
        status: initUser.status || 'active',
        fullName: initUser.fullName || 'Алхимик',
        username: initUser.username || `@user_${uid}`,
        avatar: initUser.avatar,
        referredById: initUser.referredById,
        referredByUsername: initUser.referredByUsername,
        lightweight: true
      })
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.user && data.user.balance !== undefined && data.user.balance !== null) {
        setAihim(data.user.balance);
        lastSyncedAihim.current = data.user.balance;
        localStorage.setItem('aihim_energy', data.user.balance.toString());
      }
    })
    .catch(err => {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn("Auto registration sync warning:", err?.message || err);
      }
    });

    const fetchLiveState = () => {
      const activeUser = currentUserRef.current;
      if (!activeUser?.id || activeUser.id === 'guest_demo') return;
      if (isPollInFlightRef.current) return;
      isPollInFlightRef.current = true;

      const knownCount = discoveredElementsRef.current.length;
      fetch(`/api/users/${activeUser.id}?lite=1&knownCount=${knownCount}`, {
        signal: AbortSignal.timeout(12000)
      })
        .then(res => {
          if (!res.ok) return null;
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return res.json();
          }
          return null;
        })
        .then(data => {
          if (!data) return;
          if (data.referrer) {
            setReferrerUser(data.referrer);
          }
          if (data && data.user) {
            const u = data.user;
            setCurrentUser(prev => {
              if (
                prev.balance !== u.balance ||
                prev.role !== u.role ||
                prev.status !== u.status ||
                prev.fullName !== u.fullName ||
                prev.username !== u.username ||
                prev.avatar !== u.avatar ||
                prev.level !== u.level ||
                prev.referredById !== u.referredById ||
                prev.referredByUsername !== u.referredByUsername
              ) {
                return { ...prev, ...u };
              }
              return prev;
            });
            if (u.balance !== undefined && u.balance !== null) {
              const numBal = Number(u.balance);
              if (numBal !== lastSyncedAihim.current || lastSyncedAihim.current === null) {
                lastSyncedAihim.current = numBal;
                localStorage.setItem('aihim_energy', numBal.toString());
                setAihim(numBal);
              }
            }
          }
          if (data && Array.isArray(data.elements)) {
            const dbElements: AlchemyElement[] = data.elements.map((dbEl: any) => ({
              ...dbEl,
              parents: typeof dbEl.parents === 'string' ? JSON.parse(dbEl.parents) : dbEl.parents,
              essences: typeof dbEl.essences === 'string' ? JSON.parse(dbEl.essences) : dbEl.essences,
            }));

            setDiscoveredElements(prev => {
              // If universe was explicitly reset (8 basic elements in DB while local had more)
              if (dbElements.length === 8 && prev.length > 8) {
                const uniqueDb = dedupeElements(dbElements);
                lastSyncedElementsCount.current = uniqueDb.length;
                lastSyncedElementsSigRef.current = buildElementsSignature(uniqueDb);
                localStorage.setItem('aihim_elements', JSON.stringify(uniqueDb));
                localStorage.setItem('alchimia_discovered_elements', JSON.stringify(uniqueDb));
                return uniqueDb;
              }

              const existingIds = new Set(prev.map(e => e.id));
              const existingNames = new Set(prev.map(e => e.name.toLowerCase().trim()));
              const newFromDb: AlchemyElement[] = [];

              for (const dbEl of dbElements) {
                if (!dbEl || !dbEl.id || !dbEl.name) continue;
                const nameLower = dbEl.name.toLowerCase().trim();
                if (!existingIds.has(dbEl.id) && !existingNames.has(nameLower)) {
                  newFromDb.push(dbEl);
                  existingIds.add(dbEl.id);
                  existingNames.add(nameLower);
                }
              }
              if (newFromDb.length > 0) {
                const merged = [...prev, ...newFromDb];
                lastSyncedElementsCount.current = merged.length;
                lastSyncedElementsSigRef.current = buildElementsSignature(merged);
                localStorage.setItem('aihim_elements', JSON.stringify(merged));
                localStorage.setItem('alchimia_discovered_elements', JSON.stringify(merged));
                return merged;
              }
              lastSyncedElementsCount.current = Math.max(prev.length, dbElements.length);
              return prev;
            });
          }
        })
        .catch(err => {
          if ((err as Error)?.name !== 'AbortError') {
            console.warn("Poll user warning:", err?.message || err);
          }
        })
        .finally(() => {
          isPollInFlightRef.current = false;
        });
    };

    const pollTick = () => {
      if (document.visibilityState === 'hidden') return;
      const p = window.location.pathname;
      if (p.startsWith('/admin') || p.startsWith('/system-admin')) return;
      fetchLiveState();
    };
    const onManualRefresh = () => {
      fetchLiveState();
    };

    pollTick();
    const pollInterval = setInterval(pollTick, 12000);
    window.addEventListener('alchimia:refresh_user', onManualRefresh);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('alchimia:refresh_user', onManualRefresh);
    };
  }, [currentUser?.id, isAppLoaded]);

  const syncDebounceTimer = React.useRef<any>(null);

  const syncToDb = React.useCallback(() => {
    const activeUser = currentUserRef.current;
    if (!activeUser?.id || activeUser.id === 'guest_demo' || !isAppLoaded || !isUserDbLoaded) return;
    if (isSyncInFlightRef.current) return;

    const currentEls = discoveredElementsRef.current;
    const currentSig = buildElementsSignature(currentEls);
    const elementsChanged = currentSig !== lastSyncedElementsSigRef.current;

    isSyncInFlightRef.current = true;
    lastSyncedElementsCount.current = currentEls.length;

    fetch(`/api/users/${activeUser.id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        discoveredCount: currentEls.length,
        level: calculateRank(currentEls.length).level,
        role: activeUser.role,
        status: isUserIdleRef.current ? 'inactive' : (activeUser.status || 'active'),
        fullName: activeUser.fullName,
        username: activeUser.username,
        avatar: activeUser.avatar,
        referredById: activeUser.referredById,
        referredByUsername: activeUser.referredByUsername,
        elements: elementsChanged ? currentEls : [],
        lightweight: !elementsChanged
      })
    }).then(res => res.ok ? res.json() : null)
      .then(data => {
        if (elementsChanged) {
          lastSyncedElementsSigRef.current = currentSig;
        }
        if (data && data.user && data.user.balance !== undefined && data.user.balance !== null) {
          const numBal = Number(data.user.balance);
          if (numBal !== lastSyncedAihim.current) {
            lastSyncedAihim.current = numBal;
            setAihim(numBal);
            localStorage.setItem('aihim_energy', numBal.toString());
          }
          setCurrentUser(prev => {
            const nextDiscovered = data.user.discoveredCount ?? prev.discoveredCount;
            if (prev.balance === numBal && prev.level === data.user.level && prev.discoveredCount === nextDiscovered) {
              return prev;
            }
            return {
              ...prev,
              balance: numBal,
              level: data.user.level,
              discoveredCount: nextDiscovered
            };
          });
        }
        if (data && Array.isArray(data.elements) && data.elements.length > 0) {
          const dbElements: AlchemyElement[] = data.elements.map((dbEl: any) => ({
            ...dbEl,
            parents: typeof dbEl.parents === 'string' ? JSON.parse(dbEl.parents) : dbEl.parents,
            essences: typeof dbEl.essences === 'string' ? JSON.parse(dbEl.essences) : dbEl.essences,
          }));

          setDiscoveredElements(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const existingNames = new Set(prev.map(e => e.name.toLowerCase().trim()));
            const newFromDb: AlchemyElement[] = [];

            for (const dbEl of dbElements) {
              if (!dbEl || !dbEl.id || !dbEl.name) continue;
              const nameLower = dbEl.name.toLowerCase().trim();
              if (!existingIds.has(dbEl.id) && !existingNames.has(nameLower)) {
                newFromDb.push(dbEl);
                existingIds.add(dbEl.id);
                existingNames.add(nameLower);
              }
            }

            if (newFromDb.length > 0) {
              const merged = [...prev, ...newFromDb];
              lastSyncedElementsCount.current = merged.length;
              lastSyncedElementsSigRef.current = buildElementsSignature(merged);
              localStorage.setItem('aihim_elements', JSON.stringify(merged));
              localStorage.setItem('alchimia_discovered_elements', JSON.stringify(merged));
              return merged;
            }
            lastSyncedElementsCount.current = Math.max(prev.length, dbElements.length);
            return prev;
          });
        }
      })
      .catch(err => {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn("Sync to DB warning:", err?.message || err);
        }
      })
      .finally(() => {
        isSyncInFlightRef.current = false;
      });
  }, [currentUser?.id, isAppLoaded, isUserDbLoaded]);

  // Debounced auto-sync only when discoveredElements actually change (1.5s delay for rapid clicking)
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest_demo' || !isAppLoaded || !isUserDbLoaded) return;

    const currentSig = buildElementsSignature(discoveredElements);
    if (currentSig === lastSyncedElementsSigRef.current) return;

    if (syncDebounceTimer.current) clearTimeout(syncDebounceTimer.current);

    syncDebounceTimer.current = setTimeout(() => {
      syncToDb();
      syncDebounceTimer.current = null;
    }, 1500);

    return () => {
      if (syncDebounceTimer.current) {
        clearTimeout(syncDebounceTimer.current);
        syncDebounceTimer.current = null;
      }
    };
  }, [discoveredElements, currentUser?.id, isAppLoaded, isUserDbLoaded, syncToDb]);

  // Periodic lightweight heartbeat sync (every 60s) and tab hidden sync
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest_demo' || !isAppLoaded || !isUserDbLoaded) return;

    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        syncToDb();
      }
    }, 60000);

    const handleSyncOnLeave = () => {
      if (document.visibilityState === 'hidden') {
        syncToDb();
      }
    };
    document.addEventListener('visibilitychange', handleSyncOnLeave);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleSyncOnLeave);
    };
  }, [currentUser?.id, isAppLoaded, isUserDbLoaded, syncToDb]);

  // Monitor Progress for Notifications
  useEffect(() => {
    const { currentRank, level } = calculateRank(discoveredElements.length);
    const maxReality = calculateUnlockedReality(discoveredElements);

    // Rank Notification
    if (currentRank.name !== prevRankName) {
      setStageNotification({
        type: 'rank',
        title: 'НОВЫЙ РАНГ ДОСТИГНУТ',
        value: currentRank.name,
        icon: currentRank.icon,
        desc: currentRank.desc
      });
      setPrevRankName(currentRank.name);
      localStorage.setItem('aihim_prev_rank', currentRank.name);
    }

    // Level Notification
    if (level > prevAlchemyLevel) {
      setStageNotification({
        type: 'level',
        title: 'НОВЫЙ УРОВЕНЬ АЛХИМИИ',
        value: level,
        icon: <Sparkles className="text-gold" size={32} />,
        desc: `Ваше мастерство растет. Теперь вы можете манипулировать более сложными структурами.`
      });
      setPrevAlchemyLevel(level);
      localStorage.setItem('aihim_prev_level', level.toString());
    }

    // Layer Notification
    if (maxReality > prevLayerLevel) {
      const layer = REALITY_LAYERS.find(l => l.level === maxReality);
      if (layer) {
        setStageNotification({
          type: 'layer',
          title: 'НОВЫЙ СЛОЙ РЕАЛЬНОСТИ',
          value: layer.name,
          icon: <FlaskConical className="text-gold" size={32} />,
          desc: layer.desc
        });
        setPrevLayerLevel(maxReality);
        localStorage.setItem('aihim_prev_layer', maxReality.toString());
        // Auto-switch to new layer if it's higher
        setSelectedRealityLevel(maxReality);
        localStorage.setItem('aihim_selected_layer', maxReality.toString());
      }
    }
  }, [discoveredElements.length, prevRankName, prevAlchemyLevel, prevLayerLevel]);

  const toggleFavorite = (elementId: string) => {
    setDiscoveredElements(current => {
      const updated = current.map(e => 
        e.id === elementId ? { ...e, isFavorite: !e.isFavorite } : e
      );
      localStorage.setItem('aihim_elements', JSON.stringify(updated));
      return updated;
    });
    
    // Update slots if they contain the element
    if (slotA?.id === elementId) {
      setSlotA(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
    if (slotB?.id === elementId) {
      setSlotB(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  };

  const handleTrySetSlot = (element: AlchemyElement | null, slot: 'A' | 'B') => {
    if (!element) {
      if (slot === 'A') setSlotA(null);
      else setSlotB(null);
      return;
    }

    // Stability Check: Minimum 80% required
    if ((element.stability ?? 100) < 80) {
      setStabilityWarning(element);
      return;
    }

    // Temperature Check: Synthesis impossible if current temp is > 200 degrees below target
    const tempDiff = (element.targetTemperature || 0) - (element.temperature || 0);
    if (tempDiff > 200) {
      setTemperatureWarning(element);
      return;
    }

    if (slot === 'A') {
      if (slotB?.id !== element.id) setSlotA(element);
    } else {
      if (slotA?.id !== element.id) setSlotB(element);
    }
  };

  // Timer for combination
  useEffect(() => {
    let interval: any;
    if (isCombining) {
      setCancelTimer(30);
      interval = setInterval(() => {
        if (!isTabVisible || isUserIdle) return;
        setCancelTimer(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCombining, isTabVisible, isUserIdle]);

  // Stability & Temperature Update Logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTabVisible || isUserIdle) return;
      const now = Date.now();
      setDiscoveredElements(current => {
        let hasChanged = false;
        const nextElements = current.map(el => {
          let updatedEl = { ...el };
          
          // Stability Decay
          const sIntervalMs = (STABILITY_DECAY_INTERVAL[el.rarity] || 60) * 1000;
          const lastSDecay = el.lastDecayAt || el.discoveredAt;
          
          if (updatedEl.stability > 0 && now - lastSDecay >= sIntervalMs) {
            hasChanged = true;
            const newStability = Math.max(0, (updatedEl.stability ?? 100) - 1);
            updatedEl = { 
              ...updatedEl, 
              stability: newStability,
              lastDecayAt: now 
            };
          }

          // Temperature Decay (Goes cold or heat depending on Day/Night law)
          const tIntervalMs = (TEMPERATURE_DECAY_INTERVAL[el.rarity] || 60) * 1000;
          const lastTDecay = el.lastTempDecayAt || el.discoveredAt;

          if (now - lastTDecay >= tIntervalMs) {
            hasChanged = true;
            
            // Закон Дня и Ночи:
            // Днем (worldPhase === 'day') элементы со стабильностью > 0% получают бесплатный нагрев (+1°C).
            // Ночью (worldPhase === 'night') или при стабильности 0% действуют стандартные правила энтропии (остывание -1°C до -273°C).
            if (worldPhase === 'day' && updatedEl.stability > 0) {
              updatedEl = {
                ...updatedEl,
                temperature: (updatedEl.temperature ?? 0) + 1,
                lastTempDecayAt: now
              };
            } else {
              updatedEl = {
                ...updatedEl,
                temperature: Math.max(-273, (updatedEl.temperature ?? 0) - 1),
                lastTempDecayAt: now
              };
            }
          }
          
          return updatedEl;
        });
        return hasChanged ? nextElements : current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [worldPhase, isTabVisible, isUserIdle]);

  // Phase Timer - 5 minutes Day/Night Cycle (300 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTabVisible || isUserIdle) return;
      setPhaseTimer(prev => (prev <= 0 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTabVisible, isUserIdle]);

  // Handle phase change on the last second (when phaseTimer reaches 0)
  useEffect(() => {
    localStorage.setItem('aihim_phase_timer', phaseTimer.toString());

    if (phaseTimer === 0) {
      setWorldPhase(prevPhase => {
        const nextPhase = prevPhase === 'day' ? 'night' : 'day';
        localStorage.setItem('aihim_world_phase', nextPhase);
        return nextPhase;
      });
    }
  }, [phaseTimer]);

  // AiHim Auto-Regeneration Timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTabVisible || isUserIdle) return;
      setRegenTimer(prev => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTabVisible, isUserIdle]);

  // AiHim Auto-Regeneration Logic (10 * level every 60s)
  useEffect(() => {
    if (regenTimer !== 60) {
      hasRegeneratedForCycle.current = false;
      return;
    }

    if (hasRegeneratedForCycle.current) {
      return;
    }

    hasRegeneratedForCycle.current = true;

    if (isFirstRegen.current) {
      isFirstRegen.current = false;
      return;
    }

    if (!currentUser?.id || currentUser.id === 'guest_demo') return;

    // Send command to backend DB to add 10 * level directly to balance_time in database!
    setIsSyncingBalance(true);
    fetch(`/api/users/${currentUser.id}/timer-bonus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user && data.user.balance !== undefined) {
          const numBal = Number(data.user.balance);
          lastSyncedAihim.current = numBal;
          setAihim(numBal);
          localStorage.setItem('aihim_energy', numBal.toString());
          setCurrentUser(prev => ({ ...prev, balance: numBal, balance_time: data.user.balance_time }));
          window.dispatchEvent(new CustomEvent('alchimia:refresh_user'));
        }
      })
      .catch(err => console.warn('Timer bonus DB sync error:', err))
      .finally(() => {
        setTimeout(() => setIsSyncingBalance(false), 600);
      });
  }, [regenTimer, currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('aihim_elements', JSON.stringify(discoveredElements));
  }, [discoveredElements]);

  useEffect(() => {
    localStorage.setItem('aihim_history', JSON.stringify(history));
  }, [history]);

  const handleCombine = async (elementA: AlchemyElement, elementB: AlchemyElement, spells: string[] = []) => {
    if (!elementA || !elementB) return;

    // Demo Mode Limit Check: Max 5 new elements (8 initial + 5 = 13 total)
    if (isDemoUser && createdElementsCount >= 5) {
      setIsCombining(false);
      setIsTelegramModalOpen(true);
      return;
    }

    const now = Date.now();
    if (now - lastCombinationTime < 3000) {
      setAlchemyMessage("Тигель ещё не остыл... Подождите несколько секунд.");
      return;
    }

    // Temperature Check: Synthesis impossible if current temp is > 200 degrees below target
    const tempDiffA = (elementA.targetTemperature || 0) - (elementA.temperature || 0);
    const tempDiffB = (elementB.targetTemperature || 0) - (elementB.temperature || 0);

    if (tempDiffA > 200 || tempDiffB > 200) {
      setAlchemyMessage("Температура одного из элементов слишком низка для трансмутации! Разница с нормой превышает 200°C.");
      return;
    }

    // Stability Check: Minimum 80% required
    if ((elementA.stability ?? 100) < 80 || (elementB.stability ?? 100) < 80) {
      setAlchemyMessage("Один из элементов слишком нестабилен для трансмутации! Требуется минимум 80% стабильности.");
      return;
    }

    setIsCombining(true);
    setCombiningElements({ a: elementA, b: elementB });
    setAlchemyMessage(null);
    setLastCombinationTime(now);

    try {
      const discoveredLaws = HIDDEN_LAWS.filter(law => {
        if (law.id === 'temp') return discoveredElements.some(e => (e.temperature ?? 0) < (e.targetTemperature ?? 0) - 200);
        if (law.id === 'stab') return discoveredElements.some(e => (e.stability ?? 100) <= 0);
        return false;
      });

      const maxReality = calculateUnlockedReality(discoveredElements);
      const currentLayer = REALITY_LAYERS.find(l => l.level === selectedRealityLevel) || REALITY_LAYERS[0];
      
      // Calculate which layers are "available" for discovery
      const availableLayers = REALITY_LAYERS.filter(layer => {
        if (layer.level <= maxReality) return true;
        if (layer.level === maxReality + 1) {
          const prevLayerNewElements = discoveredElements.filter(e => 
            e && e.realityLevel === layer.level - 1 && 
            !INITIAL_ELEMENTS.some(ie => ie && ie.id === e.id)
          ).length;
          
          if (layer.level === 2) return prevLayerNewElements >= 10;
          if (layer.level === 3) return prevLayerNewElements >= 15 && discoveredElements.some(e => e.essences?.includes('life'));
          if (layer.level === 4) return prevLayerNewElements >= 25;
          if (layer.level === 5) return prevLayerNewElements >= 50;
          return false;
        }
        return false;
      });

      const result = await generateNewElement(
        elementA, 
        elementB, 
        discoveredElements, 
        worldPhase, 
        discoveredLaws, 
        currentLayer,
        availableLayers,
        spells,
        currentUser?.id,
        currentUser?.username
      );
      
      if (result.element) {
        // Search if we already have an element with this exact name (case-insensitive)
        const nameToMatch = result.element.name.toLowerCase().trim();
        const existingByName = discoveredElements.find(e => e && e.name && e.name.toLowerCase().trim() === nameToMatch);

        if (existingByName) {
          // If already exists, we do not add a new element. We just use the existing one!
          setCombinationResult(existingByName);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          setSelectedElement(existingByName);
          setHistory(prev => [{
            elementA,
            elementB,
            result: existingByName,
            timestamp: Date.now(),
            isNew: false
          }, ...prev.slice(0, 49)]);
          setCombinationResult(null);
        } else {
          // Day/Night Impact on Stability
          let stabilityBonus = 0;
          if (worldPhase === 'day') {
            if (result.element.essences?.includes('creation') || result.element.type === 'Энергия') {
              stabilityBonus = 10;
            }
          } else {
            if (result.element.essences?.includes('void') || result.element.essences?.includes('destruction')) {
              stabilityBonus = 10;
            }
          }
          
          const finalElement = {
            ...result.element,
            stability: Math.min(100, (result.element.stability || 100) + stabilityBonus),
            lastDecayAt: Date.now()
          };

          setDiscoveredElements(prev => {
            const updated = dedupeElements([...prev, finalElement]);
            localStorage.setItem('alchimia_discovered_elements', JSON.stringify(updated));
            lastSyncedElementsSigRef.current = buildElementsSignature(updated);

            if (currentUser?.id && currentUser.id !== 'guest_demo') {
              fetch(`/api/users/${currentUser.id}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(12000),
                body: JSON.stringify({
                  discoveredCount: updated.length,
                  level: calculateRank(updated.length).level,
                  role: currentUser.role,
                  status: currentUser.status || 'active',
                  fullName: currentUser.fullName,
                  username: currentUser.username,
                  avatar: currentUser.avatar,
                  referredById: currentUser.referredById,
                  referredByUsername: currentUser.referredByUsername,
                  elements: [finalElement]
                })
              }).catch(err => console.warn("Immediate element sync error:", err));
            }

            return updated;
          });
          
          // Reveal sequence
          setCombinationResult(finalElement);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          setSelectedElement(finalElement);
          setHistory(prev => [{
            elementA,
            elementB,
            result: finalElement,
            timestamp: Date.now(),
            isNew: true
          }, ...prev.slice(0, 49)]);
          setCombinationResult(null);
        }
      }

      if (result.message) {
        setAlchemyMessage(typeof result.message === 'string' ? result.message : JSON.stringify(result.message));
      } else if (result.isAlmostGuessed) {
        setAlchemyMessage("Реакция была близка к успеху, но чего-то не хватило...");
      }

    } catch (error) {
      console.error("Alchemy failed:", error);
      setAlchemyMessage("Трансмутация прервана хаосом...");
    } finally {
      setIsCombining(false);
    }
  };

  const deleteElement = (id: string) => {
    if (INITIAL_ELEMENTS.some(e => e.id === id)) {
      alert("Первоначальные элементы нельзя удалить!");
      return;
    }
    setDiscoveredElements(prev => prev.filter(e => e && e.id !== id));
    setHistory(prev => prev.filter(h => h && h.result && h.result.id !== id));
  };

  const handleAddToTransmutationTable = (element: AlchemyElement) => {
    if (!slotA) {
      handleTrySetSlot(element, 'A');
    } else if (!slotB && slotA && slotA.id !== element.id) {
      handleTrySetSlot(element, 'B');
    } else if (slotA.id !== element.id) {
      handleTrySetSlot(element, 'A');
    }
    navigate('/');
  };

  const navItems = [
    { id: 'atelier', icon: FlaskConical, label: 'Стол' },
    { id: 'maintenance', icon: Hammer, label: 'Кузня' },
    { id: 'profile', icon: User, label: 'Алхимик' },
    { id: 'arcana', icon: SettingsIcon, label: 'Арканы' },
    { id: 'rate', icon: Trophy, label: 'Рейтинг' },
    { id: 'blog', icon: BookOpen, label: 'Блог' },
  ];

  const renderNav = (isMobile: boolean) => (
    <nav className={isMobile 
      ? "fixed bottom-0 left-0 right-0 bg-parchment/30 backdrop-blur-xl backdrop-saturate-180 rounded-t-3xl border-t border-x border-white/60 border-gold/30 shadow-[0_-8px_32px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.6)] flex justify-around py-2 px-1.5 z-50 md:hidden" 
      : "hidden md:flex gap-5 items-center"
    }>
      {navItems.map((tab) => (
        <button
          key={tab.id}
          onClick={() => navigate(tab.id === 'atelier' ? '/' : `/${tab.id}`)}
          className={`relative flex flex-col items-center p-1.5 min-w-[46px] transition-all duration-300 ${
            isMobile
              ? (activeTab === tab.id ? 'text-[#1e1b18] scale-105 font-black' : 'text-[#1e1b18]/80 hover:text-[#1e1b18]')
              : (activeTab === tab.id ? 'text-[#1e1b18] scale-105' : 'text-sepia/60 hover:text-sepia')
          }`}
        >
          <tab.icon size={isMobile ? 20 : 24} className={activeTab === tab.id ? 'text-[#c9a343]' : ''} />
          <span className={`${isMobile ? 'text-[10px]' : 'text-[12px]'} font-bold mt-1 tracking-wide`}>{tab.label}</span>
          {isMobile && activeTab === tab.id && (
            <motion.div 
              layoutId="mobile-nav-glow" 
              className="absolute inset-0 bg-[#1e1b18]/10 rounded-2xl border border-[#1e1b18]/20 -z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]" 
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {!isMobile && activeTab === tab.id && (
            <motion.div layoutId="nav-underline" className="h-0.5 w-full bg-gold mt-1" />
          )}
        </button>
      ))}
    </nav>
  );

  if (!isAppLoaded) {
    return (
      <div className="fixed inset-0 z-[10000] bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        {/* Warm light ambient background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full filter blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sepia/5 rounded-full filter blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
        
        <div className="relative max-w-sm w-full flex flex-col items-center gap-8">
          {/* Pulsing logo */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Soft decorative background glow */}
            <div className="absolute inset-0 bg-gold/10 rounded-full filter blur-md animate-pulse" />
            <motion.img 
              src="/file/1/aihim.png" 
              alt="Логотип AiHim"
              className="w-28 h-28 object-contain relative z-10"
              animate={{ 
                scale: [0.95, 1.05, 0.95],
                opacity: [0.9, 1, 0.9] 
              }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut", 
                repeat: Infinity 
              }}
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="font-gothic text-3xl text-sepia tracking-[0.2em] uppercase">AiHim</h1>
            <p className="text-sepia/70 text-xs tracking-widest font-mono">САКРАЛЬНАЯ СИНХРОНИЗАЦИЯ</p>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-sepia/10 border border-sepia/20 h-3.5 rounded-full overflow-hidden p-0.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-gold to-sepia rounded-full shadow-[0_0_10px_rgba(201,163,67,0.3)]"
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex flex-col gap-1 items-center">
            <motion.p 
              key={loadingStatus}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-serif italic text-sepia/80 min-h-[16px]"
            >
              {loadingStatus}
            </motion.p>
            <span className="text-xs text-sepia font-mono font-bold tracking-widest">{loadingProgress}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-4 pb-24 md:pb-12 pt-6 relative">
      {/* 12th Century Ancient Manuscript SVG & Smoldering Embers Background */}
      <AncientManuscriptBackground />

      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between gap-1.5 mb-4 pb-3 border-b border-sepia/10">
        <div 
          className="flex items-center gap-1.5 cursor-pointer shrink-0"
          onClick={() => navigate('/')}
        >
          <img 
            src="/file/7/aiicon.png" 
            alt="Logo" 
            className="h-7 object-contain" 
          />
          <span className="font-gothic text-base text-gold leading-none">AIhim</span>
        </div>

        {/* Center AIhim Balance & Buy Button */}
        <div className="flex items-center gap-1 bg-gold/10 px-2 py-1 rounded-full border border-gold/30 shrink-0">
          <span className="text-[16px] font-bold text-[#1e1b18]">{aihim}</span>
          <button 
            onClick={() => setIsShopOpen(true)}
            className="ml-0.5 px-2 py-0.5 bg-gold text-white text-[9px] font-bold rounded-full uppercase tracking-wider hover:bg-gold/80 transition-colors shadow-sm gold-glow flex items-center gap-0.5"
          >
            <Plus size={9} />
            <span>КУПИТЬ</span>
          </button>
        </div>

        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-2 py-1 bg-gold/10 hover:bg-gold/20 border border-gold/40 text-gold text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider transition-all shrink-0"
        >
          <ShieldCheck size={12} />
          <span>{currentUser.id === 'guest_demo' ? 'Вход' : `ID: ${currentUser.id}`}</span>
        </button>
      </div>

      {/* Desktop Header Navigation - Always Visible on PC */}
      <header className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4 relative z-[400] mb-8 pb-4 border-b border-sepia/10">
        <div 
          className="flex items-center gap-3 cursor-pointer group transition-all duration-300"
          onClick={() => navigate('/')}
        >
          <motion.img 
            whileHover={{ rotate: 10, scale: 1.1 }}
            src="/file/7/aiicon.png" 
            alt="Logo" 
            className="h-10 object-contain" 
          />
          <div className="flex flex-col">
            <span className="font-gothic text-xl text-gold leading-none">AIhim</span>
          </div>
        </div>
        
        <div className="flex-1 flex justify-center">
          {renderNav(false)}
        </div>

        <div className="flex items-center gap-3">
          {/* Balance & Buy Button */}
          <div className="flex items-center gap-2 bg-gold/10 px-3 py-1.5 rounded-full border border-gold/30">
            <span className="text-sm font-bold text-[#1e1b18]">{aihim}</span>
            <button
              onClick={() => setIsShopOpen(true)}
              className="ml-1 px-2.5 py-1 bg-gold text-white text-xs font-bold rounded-full uppercase tracking-wider hover:bg-gold/80 transition-colors shadow-sm gold-glow flex items-center gap-1"
            >
              <Plus size={12} />
              <span>КУПИТЬ</span>
            </button>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3 py-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/40 text-gold text-[14px] font-bold rounded flex items-center gap-1.5 uppercase tracking-wider transition-all shadow-sm hover:scale-105 active:scale-95"
          >
            <ShieldCheck size={14} />
            <span className="text-[14px]">
              {currentUser.id === 'guest_demo'
                ? 'Вход'
                : `ID: ${currentUser.id}`}
            </span>
          </button>
        </div>
      </header>

      <SeoHeadManager />

      {/* Main Content Area (Pages) */}
      <main className="flex-1 relative">
        <OfflineIndicator />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname.split('/')[1] || 'atelier'}>
            <Route path="/" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Atelier 
                  elements={discoveredElements} 
                  setElements={setDiscoveredElements}
                  onCombine={handleCombine}
                  isCombining={isCombining}
                  worldPhase={worldPhase}
                  phaseTimer={phaseTimer}
                  alchemyMessage={alchemyMessage}
                  onClearMessage={() => {
                    setAlchemyMessage(null);
                    setIsCombining(false);
                  }}
                  onSelectElement={setSelectedElement}
                  onToggleFavorite={toggleFavorite}
                  slotA={slotA}
                  setSlotA={(el) => el === null ? setSlotA(null) : handleTrySetSlot(el as AlchemyElement, 'A')}
                  slotB={slotB}
                  setSlotB={(el) => el === null ? setSlotB(null) : handleTrySetSlot(el as AlchemyElement, 'B')}
                  aihim={aihim}
                  onOpenShop={() => setIsShopOpen(true)}
                  selectedRealityLevel={selectedRealityLevel}
                  onSelectRealityLevel={(level) => {
                    setSelectedRealityLevel(level);
                    localStorage.setItem('aihim_selected_layer', level.toString());
                  }}
                  referrerUser={referrerUser}
                  currentUser={currentUser}
                />
              </motion.div>
            } />

            <Route path="/maintenance" element={<MaintenanceWrapper discoveredElements={discoveredElements} setDiscoveredElements={setDiscoveredElements} aihim={aihim} setAihim={setAihim} setIsShopOpen={setIsShopOpen} toggleFavorite={toggleFavorite} regenTimer={regenTimer} isSyncingBalance={isSyncingBalance} onAddToAtelier={handleAddToTransmutationTable} />} />
            <Route path="/maintenance/:id" element={<MaintenanceWrapper discoveredElements={discoveredElements} setDiscoveredElements={setDiscoveredElements} aihim={aihim} setAihim={setAihim} setIsShopOpen={setIsShopOpen} toggleFavorite={toggleFavorite} regenTimer={regenTimer} isSyncingBalance={isSyncingBalance} onAddToAtelier={handleAddToTransmutationTable} />} />

            <Route path="/profile" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h1 className="font-gothic text-3xl text-sepia tracking-widest">АЛХИМИК</h1>
                  <p className="text-sepia italic text-sm opacity-70">Ваш путь к истинному знанию</p>
                </div>
                <Profile 
                  elements={discoveredElements}
                  history={history}
                  aihim={aihim}
                  topUpHistory={topUpHistory}
                  onOpenShop={() => setIsShopOpen(true)}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                />
              </motion.div>
            } />

            <Route path="/rate" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Rate 
                  elements={discoveredElements}
                  aihim={aihim}
                  currentUser={currentUser}
                />
              </motion.div>
            } />
            
            <Route path="/system-admin" element={<SystemAdminPage currentUser={currentUser} />} />
            
            <Route path="/admin" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Admin currentUser={currentUser} />
              </motion.div>
            } />

            <Route path="/admin/:subpage" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Admin currentUser={currentUser} />
              </motion.div>
            } />
            
            <Route path="/arcana" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8">
                  <h1 className="font-gothic text-3xl text-sepia tracking-widest">АРКАНЫ</h1>
                  <p className="text-sepia italic text-sm opacity-70">Тайные настройки мироздания</p>
                </div>
                <Arcana 
                  elements={discoveredElements}
                  aihim={aihim}
                  setAihim={setAihim}
                  onReset={async () => {
                    const currentAihim = aihim;
                    
                    if (currentUser && currentUser.id && currentUser.id !== 'guest_demo') {
                      try {
                        await fetch(`/api/users/${currentUser.id}/reset-universe`, { method: 'POST' });
                      } catch (err) {
                        console.error('Failed to reset universe on server:', err);
                      }
                    }

                    setDiscoveredElements(INITIAL_ELEMENTS);
                    setHistory([]);
                    setIsCombining(false);
                    setAlchemyMessage('Вселенная сброшена к истокам. Сохранен ваш баланс Энергии!');
                    setAihim(currentAihim);
                    setSelectedRealityLevel(1);
                    setWorldPhase('day');
                    setPhaseTimer(300);

                    const activeUserId = localStorage.getItem('alchimia_active_user_id');
                    localStorage.clear();
                    if (activeUserId) {
                      localStorage.setItem('alchimia_active_user_id', activeUserId);
                    }
                    localStorage.setItem('aihim_energy', currentAihim.toString());
                  }}
                />
              </motion.div>
            } />

            <Route path="/oferta" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Oferta />
              </motion.div>
            } />

            <Route path="/telegram" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <TelegramRedirect />
              </motion.div>
            } />

            <Route path="/blog" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <BlogListPage />
              </motion.div>
            } />

            <Route path="/blog/:slug" element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <BlogArticlePage />
              </motion.div>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      {renderNav(true)}

      {/* Global Modals */}
      <AnimatePresence>
        {/* Telegram Registration Limit Modal for Demo Mode */}
        {isTelegramModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-md parchment-card p-6 md:p-8 shadow-2xl gold-glow border-2 border-gold flex flex-col items-center text-center gap-5"
            >
              <button 
                onClick={() => setIsTelegramModalOpen(false)}
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors p-1"
              >
                <X size={20} />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-gold flex items-center justify-center text-3xl shadow-md text-amber-900">
                🚀
              </div>

              <div>
                <h3 className="font-gothic text-2xl text-sepia tracking-widest uppercase">
                  Демо-версия завершена!
                </h3>
                <p className="text-xs text-sepia/80 mt-2 leading-relaxed">
                  Вы открыли максимальные <strong className="text-amber-900 font-bold">5 демо-элементов</strong> (всего {discoveredElements.length} из 13 возможных).
                </p>
                <p className="text-xs text-sepia/70 mt-1 italic">
                  Чтобы продолжить трансмутацию, открывать новые слои реальности, развивать Кузню и сохранить ваш прогресс — зарегистрируйтесь через Telegram.
                </p>
              </div>

              <div className="w-full space-y-3 pt-2">
                <a
                  href={
                    (new URLSearchParams(window.location.search).get('startapp') || new URLSearchParams(window.location.search).get('ref') || currentUser?.referredById)
                      ? `https://t.me/AI_HimBot/app?startapp=${new URLSearchParams(window.location.search).get('startapp') || new URLSearchParams(window.location.search).get('ref') || currentUser?.referredById}`
                      : `https://t.me/AI_HimBot/app`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl font-bold text-sm tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-95 no-underline"
                >
                  <span>✈️ Зарегистрироваться в Telegram Bot</span>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}

        {alchemyMessage && (() => {
          const msgStr = typeof alchemyMessage === 'string' 
            ? alchemyMessage 
            : (typeof alchemyMessage === 'object' && alchemyMessage !== null 
                ? ((alchemyMessage as any).message && typeof (alchemyMessage as any).message === 'string'
                    ? (alchemyMessage as any).message
                    : JSON.stringify(alchemyMessage))
                : String(alchemyMessage || ''));

          const isAstralError = msgStr.includes('достучаться до эфирной сети') || 
                                msgStr.includes('истощился астральный канал') || 
                                msgStr.includes('перезапустить астрал') ||
                                msgStr.includes('ProTalk');

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative w-full max-w-md parchment-card p-8 shadow-2xl gold-glow border-gold/40"
              >
                <button 
                  onClick={() => setAlchemyMessage(null)}
                  className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
                >
                  <X size={20} />
                </button>
                
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                    <Sparkles size={32} />
                  </div>
                  <p className="text-lg font-serif italic text-sepia leading-relaxed">
                    {msgStr}
                  </p>

                  {isAstralError ? (
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <button
                        onClick={handleRestartAstral}
                        className="flex-1 bg-gold hover:bg-gold-light text-ink font-bold py-3.5 px-4 rounded-xl font-gothic tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                      >
                        <RotateCw size={18} />
                        <span>ПЕРЕЗАПУСК</span>
                      </button>
                      <button
                        onClick={handleFinishAstralError}
                        className="flex-1 bg-ink/40 hover:bg-ink/60 text-sepia border border-sepia/20 font-bold py-3.5 px-4 rounded-xl font-gothic tracking-wider shadow flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                      >
                        <span>ЗАВЕРШИТЬ</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAlchemyMessage(null)}
                      className="w-full bg-gold text-white py-3 rounded-full font-gothic tracking-widest shadow-lg cursor-pointer"
                    >
                      ПОНЯТНО
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {isAstralRestartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-md parchment-card p-8 shadow-2xl gold-glow border-gold/40 text-center flex flex-col items-center gap-6"
            >
              {astralRestartState === 'restarting' ? (
                <>
                  <div className="relative flex items-center justify-center w-24 h-24">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-gold/60"
                    />
                    <motion.div
                      animate={{ scale: [0.9, 1.1, 0.9] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center text-gold shadow-lg gold-glow"
                    >
                      <RotateCw size={32} className="animate-spin" />
                    </motion.div>
                  </div>

                  <div>
                    <h3 className="text-xl font-gothic tracking-wider text-gold mb-2">
                      ОЖИДАНИЕ ПЕРЕЗАПУСКА АСТРАЛА
                    </h3>
                    <p className="text-sm font-serif italic text-sepia/80 leading-relaxed">
                      Идет перенастройка эфирного канала. Пожалуйста, подождите...
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-sepia/5 px-4 py-2 rounded-full border border-gold/20">
                    <Sparkles size={16} className="text-gold animate-pulse" />
                    <span className="font-mono font-bold text-lg text-gold">
                      00:{astralRestartTimer < 10 ? `0${astralRestartTimer}` : astralRestartTimer}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl"
                  >
                    <CheckCircle2 size={40} />
                  </motion.div>

                  <div>
                    <h3 className="text-xl font-gothic tracking-wider text-emerald-400 mb-2">
                      АСТРАЛ УСПЕШНО ЗАПУЩЕН!
                    </h3>
                    <p className="text-sm font-serif italic text-sepia/80 leading-relaxed">
                      Эфирный канал успешно восстановлен. Вы можете продолжить работу на алхимическом столе.
                    </p>
                  </div>

                  <button
                    onClick={handleContinueAfterRestart}
                    className="w-full bg-gold hover:bg-gold-light text-ink font-bold py-3.5 rounded-xl font-gothic tracking-widest shadow-lg transition active:scale-95 cursor-pointer"
                  >
                    ПРОДОЛЖИТЬ
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        {isCombining && !alchemyMessage && (
          <motion.div 
            key="combining-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-ink/80 backdrop-blur-xl p-4"
          >
            <div className="relative flex flex-col items-center w-full">
              {/* Enhanced Mixing Elements Animation */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  {!combinationResult ? (
                    <div key="mixing-group" className="relative flex items-center justify-center">
                      <motion.div
                        key="mixing-a"
                        initial={{ x: -300, opacity: 0, scale: 0.8 }}
                        animate={{ 
                          x: [ -300, -150, 0 ],
                          scale: [ 0.8, 1.2, 0.5 ],
                          opacity: [ 0, 1, 0.5 ],
                          rotate: [ 0, 180, 360 ]
                        }}
                        transition={{ 
                          duration: 4, 
                          ease: "easeInOut",
                          repeat: Infinity
                        }}
                        className="absolute flex items-center justify-center"
                      >
                        {combiningElements.a && (
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#faf7f2] border-2 border-gold rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-xl gold-glow">
                            <span className="element-icon-filter">{combiningElements.a.icon}</span>
                          </div>
                        )}
                      </motion.div>
                      
                      <motion.div
                        key="mixing-b"
                        initial={{ x: 300, opacity: 0, scale: 0.8 }}
                        animate={{ 
                          x: [ 300, 150, 0 ],
                          scale: [ 0.8, 1.2, 0.5 ],
                          opacity: [ 0, 1, 0.5 ],
                          rotate: [ 0, 180, 360 ]
                        }}
                        transition={{ 
                          duration: 4, 
                          ease: "easeInOut",
                          repeat: Infinity
                        }}
                        className="absolute flex items-center justify-center"
                      >
                        {combiningElements.b && (
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-[#faf7f2] border-2 border-gold rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-xl gold-glow">
                            <span className="element-icon-filter">{combiningElements.b.icon}</span>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  ) : (
                    <motion.div
                      key="reveal-glow"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
                      className={cn(
                        "absolute w-96 h-96 rounded-full blur-[100px] animate-pulse",
                        combinationResult.rarity === 'Обычный' && "bg-slate-400/50",
                        combinationResult.rarity === 'Редкий' && "bg-emerald-400/50",
                        combinationResult.rarity === 'Эпический' && "bg-sky-400/50",
                        combinationResult.rarity === 'Легендарный' && "bg-amber-400/50",
                        combinationResult.rarity === 'Мифический' && "bg-rose-400/50",
                        combinationResult.rarity === 'Божественный' && "bg-orange-400/50",
                        combinationResult.rarity === 'Вечный' && "bg-violet-400/50",
                        combinationResult.rarity === 'Космический' && "bg-pink-400/50",
                        combinationResult.rarity === 'Изначальный' && "bg-stone-600/50",
                        combinationResult.rarity === 'Трансцендентный' && "bg-gold/50"
                      )}
                    />
                  )}
                </AnimatePresence>
              </div>

              <VortexAnimation 
                elementA={combiningElements.a}
                elementB={combiningElements.b}
                className={cn(
                  "w-48 h-48 md:w-80 md:h-80 relative z-10 transition-colors duration-1000",
                  combinationResult?.rarity === 'Редкий' && "text-emerald-500",
                  combinationResult?.rarity === 'Эпический' && "text-sky-500",
                  combinationResult?.rarity === 'Легендарный' && "text-amber-500",
                  combinationResult?.rarity === 'Мифический' && "text-rose-500",
                  combinationResult?.rarity === 'Божественный' && "text-orange-500",
                  combinationResult?.rarity === 'Вечный' && "text-violet-500",
                  combinationResult?.rarity === 'Космический' && "text-pink-500",
                  combinationResult?.rarity === 'Изначальный' && "text-stone-500",
                  combinationResult?.rarity === 'Трансцендентный' && "text-gold"
                )} 
              />
              <MagicParticles />
              
              <div className="flex flex-col items-center gap-4 mt-12 relative z-10">
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "font-gothic text-xl text-gold tracking-[0.4em] text-center w-full px-2 drop-shadow-glow transition-all duration-300",
                    combinationResult ? "md:text-2xl md:tracking-[0.8em]" : "md:text-sm md:tracking-[0.4em]"
                  )}
                >
                  {combinationResult ? "СУЩНОСТЬ ПРОЯВЛЕНА" : "ТРАНСМУТАЦИЯ..."}
                </motion.p>

                {combinationResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-gold/60 text-xs uppercase tracking-[0.3em] mb-1">Уровень редкости</span>
                    <span className={cn(
                      "text-xl md:text-3xl font-black uppercase tracking-[0.2em] drop-shadow-sm",
                      combinationResult.rarity === 'Обычный' && "text-slate-400",
                      combinationResult.rarity === 'Редкий' && "text-emerald-400",
                      combinationResult.rarity === 'Эпический' && "text-sky-400",
                      combinationResult.rarity === 'Легендарный' && "text-amber-400",
                      combinationResult.rarity === 'Мифический' && "text-rose-400",
                      combinationResult.rarity === 'Божественный' && "text-orange-400",
                      combinationResult.rarity === 'Вечный' && "text-violet-400",
                      combinationResult.rarity === 'Космический' && "text-pink-400",
                      combinationResult.rarity === 'Изначальный' && "text-stone-400",
                      combinationResult.rarity === 'Трансцендентный' && "text-gold"
                    )}>
                      {combinationResult.rarity}
                    </span>
                  </motion.div>
                )}
              </div>
              
              <div className="mt-8 text-gold/40 font-mono text-base tracking-widest relative z-10">
                ЭФИРНЫЙ СТАБИЛИЗАТОР: {cancelTimer}s
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                onClick={() => {
                  setIsCombining(false);
                  setAlchemyMessage(null);
                  setCombinationResult(null);
                }}
                className="mt-20 px-10 py-4 border-2 border-gold/20 text-gold/40 hover:text-gold hover:border-gold/60 transition-all rounded-full text-sm uppercase tracking-[0.3em] font-bold relative z-[1010] bg-ink/50"
              >
                Прервать Ритуал
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Removed newlyDiscovered popup as requested - opening DetailsModal directly */}
      </AnimatePresence>

      <ElementDetailsModal 
        element={selectedElement} 
        onClose={() => setSelectedElement(null)} 
        onMaintenance={(element) => {
          if (!element) return;
          navigate(`/maintenance/${element.id}`);
          setSelectedElement(null);
        }}
        onUse={(element) => {
          if (!element) return;
          if (activeTab !== 'atelier') {
            navigate('/');
          }
          
          if (!slotA) {
            handleTrySetSlot(element, 'A');
          } else if (!slotB && slotA && slotA.id !== element.id) {
            handleTrySetSlot(element, 'B');
          } else {
            // If both full or same as A, replace A
            handleTrySetSlot(element, 'A');
          }
          setSelectedElement(null);
        }}
      />

      {/* Footer / Stats */}
      <footer className="mt-8 pt-4 pb-6 border-t border-sepia/15 flex flex-col sm:flex-row justify-between items-center text-[14px] text-sepia/80 gap-3 px-4 max-w-7xl mx-auto bg-transparent">
        <div className="opacity-75 italic">Путь алхимика бесконечен...</div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[14px]">
          <Link to="/blog" className="text-sepia hover:text-gold font-semibold transition-colors">
            Журнал блога
          </Link>
          <Link to="/oferta" className="text-sepia hover:text-gold font-semibold transition-colors">
            Оферта
          </Link>
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-sepia/75 hover:text-gold transition-colors">
            Карта сайта
          </a>
        </div>
        <div className="text-sepia/80 font-mono font-semibold bg-transparent px-3.5 py-1 rounded-full border border-sepia/20">AiHim v{appVersion}</div>
      </footer>

      {/* Shop Modal */}
      <AnimatePresence>
        {/* Stability Warning Modal */}
        {stabilityWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-sm parchment-card p-8 shadow-2xl border-red-900/40"
            >
              <button 
                onClick={() => setStabilityWarning(null)}
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-red-900/10 flex items-center justify-center text-red-900">
                  <AlertCircle size={32} />
                </div>
                <h3 className="font-gothic text-xl text-red-900 uppercase tracking-widest">Нестабильность!</h3>
                <p className="text-sm font-serif italic text-sepia leading-relaxed">
                  Сущность "{stabilityWarning.name}" слишком нестабильна ({stabilityWarning.stability}%). 
                  Для трансмутации требуется минимум 80% стабильности. 
                  Восстановите её в Кузне!
                </p>
                <button
                  onClick={() => {
                    navigate(`/maintenance/${stabilityWarning.id}`);
                    setStabilityWarning(null);
                  }}
                  className="w-full bg-red-900 text-white py-3 rounded-full font-gothic tracking-widest shadow-lg"
                >
                  В КУЗНЮ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Temperature Warning Modal */}
        {temperatureWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-sm parchment-card p-8 shadow-2xl border-blue-900/40"
            >
              <button 
                onClick={() => setTemperatureWarning(null)}
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-blue-900/10 flex items-center justify-center text-blue-900">
                  <Thermometer size={32} />
                </div>
                <h3 className="font-gothic text-xl text-blue-900 uppercase tracking-widest">Холодная Сущность!</h3>
                <p className="text-sm font-serif italic text-sepia leading-relaxed">
                  Температура "{temperatureWarning.name}" слишком низка ({temperatureWarning.temperature}°C). 
                  Разница с нормой ({temperatureWarning.targetTemperature}°C) превышает 200°C. 
                  Разогрейте её в Кузне!
                </p>
                <button
                  onClick={() => {
                    navigate(`/maintenance/${temperatureWarning.id}`);
                    setTemperatureWarning(null);
                  }}
                  className="w-full bg-blue-900 text-white py-3 rounded-full font-gothic tracking-widest shadow-lg"
                >
                  В КУЗНЮ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Stage Notification Modal */}
        {stageNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative w-full max-w-md parchment-card p-10 shadow-[0_0_50px_rgba(201,163,67,0.4)] gold-glow border-gold/60 text-center"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gold flex items-center justify-center text-5xl shadow-2xl border-4 border-parchment">
                {stageNotification.icon}
              </div>
              
              <div className="mt-8 flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] uppercase font-bold text-gold tracking-[0.3em]">{stageNotification.title}</div>
                  <h2 className="font-gothic text-4xl text-sepia tracking-widest uppercase">{stageNotification.value}</h2>
                </div>
                
                <div className="h-px w-full bg-gold/20" />
                
                <p className="text-sm font-serif italic text-sepia/80 leading-relaxed">
                  {stageNotification.desc}
                </p>
                
                <button
                  onClick={() => setStageNotification(null)}
                  className="w-full bg-gold text-white py-4 rounded-xl font-gothic tracking-widest shadow-lg hover:bg-gold-light transition-all active:scale-95"
                >
                  ПРОДОЛЖИТЬ ПУТЬ
                </button>
              </div>
              
              <MagicParticles />
            </motion.div>
          </motion.div>
        )}

        {isShopOpen && (
          <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-6 flex items-start sm:items-center justify-center min-h-screen">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShopOpen(false)}
              className="fixed inset-0 -z-10"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="parchment-card max-w-lg w-full p-4 sm:p-6 relative z-10 border-2 border-gold shadow-[0_0_50px_rgba(212,175,55,0.3)] my-auto max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
            >
              <button 
                onClick={() => setIsShopOpen(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-sepia/40 hover:text-sepia transition-colors p-1 z-20"
              >
                <X size={22} />
              </button>

              <div className="text-center mb-4 sm:mb-6 shrink-0 pr-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-gold/30">
                  <Zap size={26} className="text-gold" />
                </div>
                <h2 className="font-gothic text-2xl sm:text-3xl text-gold mb-1">МАГАЗИН ЭНЕРГИИ</h2>
                <p className="font-serif italic text-xs sm:text-sm text-sepia/70">AiHim — топливо для ваших великих трансмутаций</p>
                {(() => {
                  const { level } = calculateRank(discoveredElements.length);
                  return (
                    <div className="inline-block px-3 py-1 bg-gold/15 border border-gold/40 rounded-full text-[10px] sm:text-xs text-gold mt-2 uppercase tracking-widest font-bold">
                      Ваш уровень ({level}) умножает объем AiHim в {level} раз!
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                {(() => {
                  const { level } = calculateRank(discoveredElements.length);
                  const SHOP_TIERS = [
                    { nominalRubles: 100, payPrice: 100, discountPercent: 0, label: 'Старт', baseEnergy: 10000 },
                    { nominalRubles: 500, payPrice: 475, discountPercent: 5, label: 'Ученик', baseEnergy: 50000 },
                    { nominalRubles: 1000, payPrice: 900, discountPercent: 10, label: 'Мастер', baseEnergy: 100000 },
                    { nominalRubles: 3000, payPrice: 2400, discountPercent: 20, label: 'Архимаг', baseEnergy: 300000 },
                    { nominalRubles: 10000, payPrice: 7000, discountPercent: 30, label: 'Демиург', baseEnergy: 1000000 },
                  ];

                  if (isDemoMode || currentUser.id === 'guest_demo') {
                    return (
                      <div className="space-y-3">
                        {SHOP_TIERS.map((tier) => {
                          const totalEnergy = tier.baseEnergy * level;
                          return (
                            <div
                              key={tier.nominalRubles}
                              className="w-full p-3.5 border border-sepia/20 rounded-xl flex items-center justify-between bg-gold/5 gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Zap size={18} className="text-gold shrink-0" />
                                <div className="text-left min-w-0">
                                  <div className="font-bold text-[16px] text-sepia truncate">
                                    {totalEnergy.toLocaleString()} AiHim
                                  </div>
                                  <div className="text-[12px] text-sepia/60 uppercase tracking-wider flex items-center gap-1">
                                    <span>Пакет «{tier.label}»</span>
                                    {tier.discountPercent > 0 && (
                                      <span className="text-emerald-700 font-black">(-{tier.discountPercent}%)</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-gothic text-[16px] text-gold font-bold">{tier.payPrice} ₽</div>
                                {tier.discountPercent > 0 && (
                                  <div className="text-[12px] text-sepia/40 line-through">{tier.nominalRubles} ₽</div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div className="p-4 bg-gold/10 border border-gold/40 rounded-xl text-center space-y-3">
                          <p className="text-xs font-bold text-sepia uppercase tracking-wider">
                            Пополнение энергии доступно зарегистрированным пользователям
                          </p>
                          <button
                            onClick={() => {
                              setIsShopOpen(false);
                              setIsAuthModalOpen(true);
                            }}
                            className="w-full py-3 bg-gold hover:bg-gold-light text-ink font-gothic text-xs font-bold uppercase tracking-widest rounded-lg shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                          >
                            <User size={14} />
                            Войти для покупки
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const handleInitiateRobokassa = async (payPrice: number, baseEnergy: number, label: string) => {
                    setIsProcessingPayment(true);
                    try {
                      const res = await fetch('/api/payments/robokassa/initiate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: currentUser.id,
                          payPrice,
                          baseEnergy,
                          packageLabel: label,
                          email: currentUser.email
                        })
                      });

                      const data = await res.json();
                      if (data.success && data.payUrl) {
                        window.location.href = data.payUrl;
                      } else {
                        alert(data.error || 'Ошибка при генерации ссылки на оплату Робокассы');
                        setIsProcessingPayment(false);
                      }
                    } catch (err) {
                      console.error("Robokassa initiate error:", err);
                      alert('Не удалось подключиться к серверу Робокассы');
                      setIsProcessingPayment(false);
                    }
                  };

                  return (
                    <>
                      {SHOP_TIERS.map((tier) => {
                        const totalEnergy = tier.baseEnergy * level;
                        return (
                          <button
                            key={tier.nominalRubles}
                            disabled={isProcessingPayment}
                            onClick={() => handleInitiateRobokassa(tier.payPrice, tier.baseEnergy, tier.label)}
                            className="w-full p-3.5 border border-sepia/20 hover:border-gold rounded-xl flex items-center justify-between bg-gold/5 hover:bg-gold/15 transition-all group gap-2 text-left cursor-pointer active:scale-98 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Zap size={20} className="text-gold group-hover:scale-110 transition-transform shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold text-[16px] text-sepia truncate">
                                  +{totalEnergy.toLocaleString()} AiHim
                                </div>
                                <div className="text-[12px] text-sepia/70 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                                  <span>Пакет «{tier.label}»</span>
                                  {tier.discountPercent > 0 && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded font-black text-[12px]">
                                      Скидка {tier.discountPercent}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-gothic text-[16px] text-gold font-bold flex items-center gap-1 justify-end">
                                <span>{tier.payPrice} ₽</span>
                              </div>
                              {tier.discountPercent > 0 && (
                                <div className="text-[12px] text-sepia/40 line-through">{tier.nominalRubles} ₽</div>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* Ручной ввод баланса */}
                      <div className="p-3.5 border border-gold/40 rounded-xl bg-gold/5 flex flex-col gap-2.5 mt-2">
                        <div className="text-left">
                          <h3 className="text-xs font-bold text-sepia uppercase tracking-wider">Произвольная сумма</h3>
                          <p className="text-[10px] text-sepia/60">Минимальное пополнение — 10 ₽ (с учетом скидок до 30%)</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="10"
                              value={manualRubles}
                              onChange={(e) => setManualRubles(e.target.value)}
                              placeholder="Сумма в рублях, ₽"
                              className="w-full px-3 py-2 pr-8 text-xs bg-white border border-sepia/30 rounded-lg focus:border-gold outline-none font-mono"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-sepia/40">₽</span>
                          </div>

                          <button
                            disabled={isProcessingPayment || !manualRubles || parseFloat(manualRubles) < 10}
                            onClick={() => {
                              const rub = parseFloat(manualRubles);
                              if (rub >= 10) {
                                let divisor = 1.0;
                                if (rub >= 7000) divisor = 0.7;
                                else if (rub >= 2400) divisor = 0.8;
                                else if (rub >= 900) divisor = 0.9;
                                else if (rub >= 475) divisor = 0.95;

                                const nominalRubles = Math.round(rub / divisor);
                                const baseEnergy = Math.round(nominalRubles * 100);
                                handleInitiateRobokassa(rub, baseEnergy, 'Индивидуальный');
                              }
                            }}
                            className="px-4 py-2 bg-gold text-ink font-bold uppercase tracking-widest rounded-lg text-xs hover:bg-gold-light transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95 shrink-0"
                          >
                            {isProcessingPayment ? 'Переход...' : 'Оплатить'}
                          </button>
                        </div>

                        {manualRubles && parseFloat(manualRubles) >= 10 ? (
                          (() => {
                            const rub = parseFloat(manualRubles);
                            let discountPercent = 0;
                            let divisor = 1.0;
                            if (rub >= 7000) { discountPercent = 30; divisor = 0.7; }
                            else if (rub >= 2400) { discountPercent = 20; divisor = 0.8; }
                            else if (rub >= 900) { discountPercent = 10; divisor = 0.9; }
                            else if (rub >= 475) { discountPercent = 5; divisor = 0.95; }

                            const nominalRubles = Math.round(rub / divisor);
                            const calculatedAmount = Math.round(nominalRubles * 100 * level);
                            return (
                              <div className="text-[10px] text-emerald-800 font-bold text-center uppercase tracking-wider bg-emerald-50 border border-emerald-200 p-1.5 rounded">
                                Начисление с уровнем (x{level}): +{calculatedAmount.toLocaleString()} AiHim {discountPercent > 0 ? `(Скидка ${discountPercent}%)` : ''}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-[10px] text-rose-700 font-bold text-center uppercase tracking-wider">
                            Минимальная сумма пополнения — 10 рублей
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <p className="mt-6 text-[9px] text-center text-sepia/50 uppercase tracking-wider leading-relaxed">
                * Платежи безопасно обрабатываются через шлюз Робокасса. <br />
                Зачисление энергии AiHim происходит автоматически после проведения платежа.
              </p>

              <div className="mt-4 text-center border-t border-sepia/10 pt-4">
                <Link 
                  to="/oferta" 
                  onClick={() => setIsShopOpen(false)}
                  className="text-[10px] text-gold hover:text-gold-light uppercase tracking-widest font-bold underline transition-colors"
                >
                  Договор оферты ООО «РентРоп»
                </Link>
              </div>
            </motion.div>
          </div>
        )}
    </AnimatePresence>
      {/* Inactivity Modal Overlay */}
      <AnimatePresence>
        {isUserIdle && (
          <div 
            onClick={() => {
              lastActivityTimestamp.current = Date.now();
              setIsUserIdle(false);
            }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-slate-50 border-2 border-slate-300 p-6 md:p-8 rounded-2xl max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-900"
              onClick={(e) => {
                e.stopPropagation();
                lastActivityTimestamp.current = Date.now();
                setIsUserIdle(false);
              }}
            >
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300 text-slate-800 animate-pulse">
                <Moon size={32} />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-900 border border-slate-300 text-xs font-bold uppercase tracking-widest">
                ⚠️ Неактивен
              </div>

              <h2 className="font-gothic text-2xl text-slate-900 tracking-widest uppercase font-black">
                Покой Эфира
              </h2>

              <p className="text-sm text-slate-800 leading-relaxed font-semibold bg-slate-100/90 p-3.5 rounded-xl border border-slate-200">
                Вы не совершали действий более 10 минут. Начисление бонусов AiHim, изменения температуры и стабильности элементов приостановлены.
              </p>

              <button
                type="button"
                onClick={() => {
                  lastActivityTimestamp.current = Date.now();
                  setIsUserIdle(false);
                }}
                className="mt-2 w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-lg active:scale-95"
              >
                ✨ Продолжить работу (Активен)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Diagnostics Modal (Ctrl + [) */}
      <SystemDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {/* Auth Modal for Telegram ID Login */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* Hidden SEO Catalog of Discovered Elements for Search Engines & LLM Web Crawlers (Yandex, Google, SearchGPT, Gemini, Perplexity) */}
      <section id="seo-discovered-elements" className="sr-only" aria-hidden="true">
        <h2>Каталог открытых алхимических элементов ИИ (SEO & GEO Search Indexing)</h2>
        <p>
          База данных трансмутаций первоматерии AIhim. Объединение стихий, веществ, духа и закалка в кузне.
        </p>
        <ul>
          {discoveredElements.map((el, idx) => (
            <li key={`${el.id || el.name}-${idx}`}>
              <article>
                <h3>{el.name} ({el.type || 'Материя'}, Редкость: {el.rarity || 'Обычный'})</h3>
                <p>{el.description || 'Интерактивный алхимический элемент'}</p>
                <div>Состояние: {el.state || 'Твердое'} | Слово силы: {el.realityLevel || 1}</div>
                {Array.isArray(el.parents) && el.parents.length > 0 && (
                  <div>Формула создания: {el.parents.join(' + ')}</div>
                )}
                {Array.isArray(el.essences) && el.essences.length > 0 && (
                  <div>Алхимические эссенции: {el.essences.join(', ')}</div>
                )}
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
