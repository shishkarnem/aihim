import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CreditCard, Terminal, ShieldAlert, Key, Search, Filter, ArrowUpDown, 
  Plus, Check, X, Shield, Edit2, TrendingUp, AlertCircle, RefreshCw, BarChart2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Database, Send, Mail, Bell, MessageSquare, Sparkles, Trash2, Save, ExternalLink, BookOpen
} from 'lucide-react';
import { AppUser, BillingTransaction, AIRequestLog, TelegramBotSettings, ReminderTemplate, MailingLog, ArcanaLink, ArcanaConfig, PromptSettings } from '../types';
import { 
  getAdminUsers, saveAdminUsers, 
  getAdminTransactions, saveAdminTransactions, 
  getAdminLogs, saveAdminLogs, 
  getBotSettings, saveBotSettings,
  getReminderTemplates, saveReminderTemplates,
  getMailingLogs, saveMailingLogs,
  TOKEN_COST_RATIO 
} from '../lib/adminData';
import { ICON_LIBRARY, DynamicIcon } from '../lib/icons';
import { HIDDEN_LAWS, ELEMENT_TYPE_DETAILS, ESSENCE_DETAILS, RARITY_DETAILS, RANKS, REALITY_LAYERS, RARITY_CHANCES, DEFAULT_PROMPT_SETTINGS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { UserAvatar } from '../components/UserAvatar';
import { AppVersionControl } from '../components/ui/AppVersionControl';
import { BlogAdminBuilder } from './blog/BlogAdminBuilder';

interface AdminProps {
  currentUser: AppUser;
}

type AdminSubpage = 'crm' | 'billing' | 'logs' | 'arcana' | 'role' | 'token' | 'mailing' | 'blog';
type CrmView = 'kanban' | 'table' | 'analytics';

export const Admin: React.FC<AdminProps> = ({ currentUser }) => {
  const { subpage } = useParams<{ subpage: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminSubpage>('crm');

  useEffect(() => {
    if (subpage && ['crm', 'billing', 'logs', 'arcana', 'role', 'token', 'mailing', 'blog'].includes(subpage)) {
      setActiveTab(subpage as AdminSubpage);
    }
  }, [subpage]);

  const handleTabChange = (tab: AdminSubpage) => {
    setActiveTab(tab);
    navigate(`/admin/${tab}`);
  };

  const [crmView, setCrmView] = useState<CrmView>('kanban');

  // Данные из LocalStorage (с реактивным состоянием)
  const [users, setUsers] = useState<AppUser[]>(() => getAdminUsers());

  // Рассылки и напоминания
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplate[]>(() => getReminderTemplates());
  const [mailingLogs, setMailingLogs] = useState<MailingLog[]>(() => getMailingLogs());
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [massMailMessage, setMassMailMessage] = useState('Привет! Твои незавершенные алхимические элементы скучают без тебя в лаборатории! 🧪✨');
  const [massMailButtonText, setMassMailButtonText] = useState('Открыть Лабораторию 🚀');
  const [massMailButtonUrl, setMassMailButtonUrl] = useState('https://t.me/SAV_AIbot/app');
  const [massMailSending, setMassMailSending] = useState(false);
  const [massMailStatus, setMassMailStatus] = useState<string | null>(null);
  const [mailingSortField, setMailingSortField] = useState<'fullName' | 'id' | 'role' | 'status' | 'balance'>('fullName');
  const [mailingSortOrder, setMailingSortOrder] = useState<'asc' | 'desc'>('asc');

  // Real-time live dispatch logs & Persistent PostgreSQL Logs
  const [liveStreamLogs, setLiveStreamLogs] = useState<any[]>([]);
  const [serverMailingLogs, setServerMailingLogs] = useState<any[]>([]);
  const [historyPageSize, setHistoryPageSize] = useState<number>(20);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [isInactiveSending, setIsInactiveSending] = useState(false);

  // History log filters & selection
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [historySortField, setHistorySortField] = useState<'timestamp' | 'recipient' | 'status'>('timestamp');
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedHistoryLogIds, setSelectedHistoryLogIds] = useState<string[]>([]);
  const [isResending, setIsResending] = useState(false);

  const refreshMailingLogs = async () => {
    try {
      const res = await fetch('/api/admin/mailing-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setServerMailingLogs(data);
        }
      }
    } catch (e) {
      console.error("Failed to load mailing logs:", e);
    }
  };

  const refreshReminderTemplates = async () => {
    try {
      const res = await fetch('/api/admin/reminder-templates');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates) && data.templates.length > 0) {
          setReminderTemplates(data.templates);
          saveReminderTemplates(data.templates);
        }
      }
    } catch (e) {
      console.error("Failed to load reminder templates:", e);
    }
  };

  useEffect(() => {
    refreshMailingLogs();
    refreshReminderTemplates();
  }, []);

  // Промпты нейросети
  const [elementPrompt, setElementPrompt] = useState<string>(DEFAULT_PROMPT_SETTINGS.elementPrompt);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_PROMPT_SETTINGS.systemPrompt);
  const [promptSaved, setPromptSaved] = useState(false);

  // Ссылки и Сообщество
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
  const [editingLink, setEditingLink] = useState<ArcanaLink | null>(null);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState('Send');
  const [linksSavedStatus, setLinksSavedStatus] = useState<string | null>(null);

  // Конфигурация Арканов
  const [arcanaConfig, setArcanaConfig] = useState<ArcanaConfig>({
    laws: HIDDEN_LAWS.map((l, idx) => ({ id: l.id || `law-${idx}`, name: l.name, desc: l.desc, detail: l.detail, icon: l.icon })),
    elementTypes: ELEMENT_TYPE_DETAILS,
    essences: ESSENCE_DETAILS,
    rarities: RARITY_DETAILS,
    ranks: RANKS,
    realityLayers: REALITY_LAYERS,
    calculatorChances: RARITY_CHANCES
  });
  const [configSavedStatus, setConfigSavedStatus] = useState<string | null>(null);
  const [activeConfigSection, setActiveConfigSection] = useState<'laws' | 'types' | 'essences' | 'rarities' | 'ranks' | 'layers' | 'calc' | 'spells'>('laws');
  const [adminSpells, setAdminSpells] = useState<any[]>([]);
  const [editingSpell, setEditingSpell] = useState<any | null>(null);
  const [newSpellTitle, setNewSpellTitle] = useState('');
  const [newSpellTrans, setNewSpellTrans] = useState('');
  const [newSpellDesc, setNewSpellDesc] = useState('');
  const [newSpellCategory, setNewSpellCategory] = useState('Стихии');
  const [spellsSavedStatus, setSpellsSavedStatus] = useState<string | null>(null);

  // Детальный просмотр лога
  const [selectedLogDetail, setSelectedLogDetail] = useState<AIRequestLog | null>(null);

  // Загружаем данные с сервера
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data && data.users) {
          setUsers(data.users);
          saveAdminUsers(data.users);
        }
      })
      .catch(err => console.error('Failed to load users from DB:', err));

    fetch('/api/admin/prompt-settings')
      .then(res => res.json())
      .then(data => {
        const settings = data.settings || data;
        if (settings.elementPrompt) setElementPrompt(settings.elementPrompt);
        if (settings.systemPrompt) setSystemPrompt(settings.systemPrompt);
      })
      .catch(e => console.error('Failed to load prompt settings:', e));

    fetch('/api/admin/ai-logs')
      .then(res => res.json())
      .then(data => {
        const logsList = Array.isArray(data) ? data : (data?.logs && Array.isArray(data.logs) ? data.logs : null);
        if (logsList) {
          setAiLogs(logsList);
          saveAdminLogs(logsList);
        }
      })
      .catch(e => console.error('Failed to load AI logs:', e));

    fetch('/api/admin/transactions')
      .then(res => res.json())
      .then(data => {
        const txList = Array.isArray(data) ? data : (data?.transactions && Array.isArray(data.transactions) ? data.transactions : null);
        if (txList) {
          setTransactions(txList);
          saveAdminTransactions(txList);
        }
      })
      .catch(e => console.error('Failed to load transactions:', e));

    fetch('/api/arcana/links')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.links) && data.links.length > 0) {
          setArcanaLinks(data.links);
        }
      })
      .catch(e => console.error('Failed to load arcana links:', e));

    fetch('/api/arcana/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.config) {
          setArcanaConfig(prev => ({
            laws: Array.isArray(data.config.laws) ? data.config.laws : prev.laws,
            elementTypes: data.config.elementTypes || prev.elementTypes,
            essences: data.config.essences || prev.essences,
            rarities: data.config.rarities || prev.rarities,
            ranks: Array.isArray(data.config.ranks) ? data.config.ranks : prev.ranks,
            realityLayers: Array.isArray(data.config.realityLayers) ? data.config.realityLayers : prev.realityLayers,
            calculatorChances: data.config.calculatorChances || prev.calculatorChances
          }));
        }
      })
      .catch(e => console.error('Failed to load arcana config:', e));
    const loadSpellsWithRetry = async (attempt = 1): Promise<void> => {
      try {
        const res = await fetch('/api/spells');
        if (!res.ok) {
          if (res.status >= 500 && attempt < 3) {
            await new Promise(r => setTimeout(r, 350 * attempt));
            return loadSpellsWithRetry(attempt + 1);
          }
          throw new Error(`HTTP error ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        const data = await res.json();
        if (data && Array.isArray(data.spells)) {
          setAdminSpells(data.spells);
        }
      } catch (e) {
        console.error('Failed to load spells in admin:', e);
      }
    };
    loadSpellsWithRetry();
  }, []);

  const handleAddSpell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpellTitle.trim() || !newSpellTrans.trim()) return;
    const spellObj = {
      id: `spell-${Date.now()}`,
      name: newSpellTitle.trim(),
      translation: newSpellTrans.trim(),
      description: newSpellDesc.trim(),
      category: newSpellCategory
    };
    try {
      const res = await fetch('/api/spells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spellObj)
      });
      const data = await res.json();
      if (data.success) {
        setAdminSpells(data.spells || []);
        setNewSpellTitle('');
        setNewSpellTrans('');
        setNewSpellDesc('');
        setSpellsSavedStatus('Заклинание добавлено!');
        setTimeout(() => setSpellsSavedStatus(null), 3000);
      }
    } catch (err) {
      console.error('Failed to add spell:', err);
    }
  };

  const handleDeleteSpell = async (spellId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это заклинание из БД?')) return;
    try {
      const res = await fetch(`/api/spells/${spellId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAdminSpells(data.spells || []);
        setSpellsSavedStatus('Заклинание удалено');
        setTimeout(() => setSpellsSavedStatus(null), 3000);
      }
    } catch (err) {
      console.error('Failed to delete spell:', err);
    }
  };

  // Сохранение промптов
  const handleSavePromptSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/prompt-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementPrompt, systemPrompt })
      });
      const data = await res.json();
      if (data.success) {
        setPromptSaved(true);
        setTimeout(() => setPromptSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving prompt settings:', err);
    }
  };

  // Сохранение ссылок
  const handleSaveArcanaLinks = async (updated: ArcanaLink[]) => {
    setArcanaLinks(updated);
    try {
      const res = await fetch('/api/arcana/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: updated })
      });
      const data = await res.json();
      if (data.success) {
        setLinksSavedStatus('Ссылки успешно сохранены!');
        setTimeout(() => setLinksSavedStatus(null), 3000);
      }
    } catch (err) {
      setLinksSavedStatus('Ошибка при сохранении ссылок');
    }
  };

  const handleAddArcanaLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle || !newLinkUrl) return;
    const newLink: ArcanaLink = {
      id: `link-${Date.now()}`,
      title: newLinkTitle,
      description: newLinkDesc,
      url: newLinkUrl,
      icon: newLinkIcon
    };
    const updated = [...arcanaLinks, newLink];
    handleSaveArcanaLinks(updated);
    setNewLinkTitle('');
    setNewLinkDesc('');
    setNewLinkUrl('');
    setNewLinkIcon('Send');
  };

  const handleDeleteArcanaLink = (id: string) => {
    const updated = arcanaLinks.filter(l => l.id !== id);
    handleSaveArcanaLinks(updated);
  };

  // Сохранение конфигурации арканов
  const handleSaveArcanaConfig = async () => {
    try {
      const res = await fetch('/api/arcana/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: arcanaConfig })
      });
      const data = await res.json();
      if (data.success) {
        setConfigSavedStatus('Конфигурация арканов сохранена!');
        setTimeout(() => setConfigSavedStatus(null), 3000);
      }
    } catch (err) {
      setConfigSavedStatus('Ошибка при сохранении конфигурации');
    }
  };
  const [transactions, setTransactions] = useState<BillingTransaction[]>(() => getAdminTransactions());
  const [aiLogs, setAiLogs] = useState<AIRequestLog[]>(() => getAdminLogs());
  const [botSettings, setBotSettings] = useState<TelegramBotSettings>(() => getBotSettings());

  // Состояние выбранного пользователя для редактирования в CRM
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [adminDeltaInput, setAdminDeltaInput] = useState<number>(0);
  const [adminReasonInput, setAdminReasonInput] = useState<string>('');

  const handleStartEditUser = (user: AppUser) => {
    setEditingUser({ ...user });
    setAdminDeltaInput(0);
    setAdminReasonInput('');
  };
  
  // Поисковые и фильтрационные состояния
  const [crmSearch, setCrmSearch] = useState('');
  const [crmRoleFilter, setCrmRoleFilter] = useState<string>('all');
  const [crmSortField, setCrmSortField] = useState<keyof AppUser>('registrationDate');
  const [crmSortOrder, setCrmSortOrder] = useState<'asc' | 'desc'>('desc');

  const [billingSearch, setBillingSearch] = useState('');
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>('all');

  const [logsSearch, setLogsSearch] = useState('');
  const [logsStatusFilter, setLogsStatusFilter] = useState<string>('all');

  const [roleSearch, setRoleSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Массовые рассылки пакетами и выбор пользователей галочками
  const [mailingSearch, setMailingSearch] = useState('');
  const [mailingRoleFilter, setMailingRoleFilter] = useState('all');
  const [mailingStatusFilter, setMailingStatusFilter] = useState('all');
  const [selectedMailingUserIds, setSelectedMailingUserIds] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState<number>(20);
  const [testSendingStatus, setTestSendingStatus] = useState<string | null>(null);

  // Настройки формы бота
  const [botToken, setBotToken] = useState(botSettings.botToken);
  const [botUsername, setBotUsername] = useState(botSettings.botUsername);
  const [registrationEnabled, setRegistrationEnabled] = useState(botSettings.registrationEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(botSettings.welcomeMessage);
  const [proTalkToken, setProTalkToken] = useState(botSettings.proTalkToken);
  const [proTalkApiUrl, setProTalkApiUrl] = useState(botSettings.proTalkApiUrl);
  const [employeeId, setEmployeeId] = useState(botSettings.employeeId || '71164');
  const [robokassaMerchantLogin, setRobokassaMerchantLogin] = useState(botSettings.robokassaMerchantLogin || '');
  const [robokassaPass1, setRobokassaPass1] = useState(botSettings.robokassaPass1 || '');
  const [robokassaPass2, setRobokassaPass2] = useState(botSettings.robokassaPass2 || '');
  const [robokassaIsTest, setRobokassaIsTest] = useState(botSettings.robokassaIsTest !== undefined ? botSettings.robokassaIsTest : true);
  const [robokassaReceiptItemName, setRobokassaReceiptItemName] = useState(botSettings.robokassaReceiptItemName || 'Виртуальная игровая энергия AiHim');
  const [robokassaReceiptTax, setRobokassaReceiptTax] = useState(botSettings.robokassaReceiptTax || 'none');
  const [robokassaSno, setRobokassaSno] = useState(botSettings.robokassaSno || '');
  const [inactiveReminderEnabled, setInactiveReminderEnabled] = useState(botSettings.inactiveReminderEnabled !== undefined ? botSettings.inactiveReminderEnabled : true);
  const [inactiveDaysThreshold, setInactiveDaysThreshold] = useState(botSettings.inactiveDaysThreshold || 7);
  const [inactiveReminderMessage, setInactiveReminderMessage] = useState(botSettings.inactiveReminderMessage || 'Астральные сферы скучают по тебе! Вернись в AIhim и продолжи трансмутацию элементов.');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 320;
      const currentScroll = ref.current.scrollLeft;
      const targetScroll = direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      ref.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Фильтрация и сортировка пользователей в CRM
  const filteredUsers = useMemo(() => {
    return (users || [])
      .filter(user => {
        if (!user) return false;
        const search = (crmSearch || '').toLowerCase();
        const fullName = (user.fullName || '').toLowerCase();
        const username = (user.username || '').toLowerCase();
        const userId = String(user.id || '');

        const matchesSearch = 
          fullName.includes(search) ||
          username.includes(search) ||
          userId.includes(search);
        const matchesRole = crmRoleFilter === 'all' || user.role === crmRoleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        let valA = a ? a[crmSortField] : '';
        let valB = b ? b[crmSortField] : '';
        
        if (typeof valA === 'string' || typeof valB === 'string') {
          const strA = String(valA || '');
          const strB = String(valB || '');
          return crmSortOrder === 'asc' 
            ? strA.localeCompare(strB)
            : strB.localeCompare(strA);
        }
        
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return crmSortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [users, crmSearch, crmRoleFilter, crmSortField, crmSortOrder]);

  // Фильтрация транзакций
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      if (!tx) return false;
      const search = (billingSearch || '').toLowerCase();
      const fullName = (tx.fullName || '').toLowerCase();
      const username = (tx.username || '').toLowerCase();
      const txId = (tx.id || '').toLowerCase();
      const userId = String(tx.userId || '');

      const matchesSearch = 
        fullName.includes(search) ||
        username.includes(search) ||
        txId.includes(search) ||
        userId.includes(search);
      const matchesStatus = billingStatusFilter === 'all' || tx.status === billingStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, billingSearch, billingStatusFilter]);

  // Helper for safely stringifying log parameters
  const safeLogString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      if (typeof val.message === 'string') return val.message;
      if (typeof val.name === 'string') return val.name;
      if (typeof val.text === 'string') return val.text;
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  // Фильтрация ИИ логов
  const filteredLogs = useMemo(() => {
    return (aiLogs || []).filter(log => {
      if (!log) return false;
      const search = (logsSearch || '').toLowerCase();
      const username = safeLogString(log.username).toLowerCase();
      const elementA = safeLogString(log.elementA).toLowerCase();
      const elementB = safeLogString(log.elementB).toLowerCase();
      const userId = safeLogString(log.userId);

      const matchesSearch = 
        username.includes(search) ||
        elementA.includes(search) ||
        elementB.includes(search) ||
        userId.includes(search);
      const matchesStatus = logsStatusFilter === 'all' || log.status === logsStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [aiLogs, logsSearch, logsStatusFilter]);

  // Фильтрация пользователей на вкладке ролей
  const filteredRoleUsers = useMemo(() => {
    return (users || []).filter(user => {
      if (!user) return false;
      const search = (roleSearch || '').toLowerCase();
      const fullName = (user.fullName || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      const userId = String(user.id || '');

      const matchesSearch = 
        fullName.includes(search) ||
        username.includes(search) ||
        userId.includes(search);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, roleSearch, roleFilter]);

  // Суммарные расчеты для ИИ Трат
  const totalTokens = useMemo(() => (aiLogs || []).reduce((acc, curr) => acc + (curr?.tokensUsed || 0), 0), [aiLogs]);
  const totalCostRub = useMemo(() => totalTokens * TOKEN_COST_RATIO, [totalTokens]);

  // Суммарные расчеты для Биллинга
  const totalRevenue = useMemo(() => {
    return transactions
      .filter(t => t.status === 'success')
      .reduce((sum, current) => sum + current.price, 0);
  }, [transactions]);

  // Сортировка по колонкам
  const toggleSort = (field: keyof AppUser) => {
    if (crmSortField === field) {
      setCrmSortOrder(crmSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCrmSortField(field);
      setCrmSortOrder('desc');
    }
  };

  // Сохранить изменения пользователя
  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (currentUser.role === 'manager') {
      alert('Вам доступен только режим просмотра (Менеджер). Изменения не были сохранены в базе данных.');
      setEditingUser(null);
      return;
    }

    const bStart = editingUser.balance_start ?? 1000;
    const bTime = editingUser.balance_time ?? 0;
    const bRef = editingUser.balance_ref ?? 0;
    const bPay = editingUser.balance_pay ?? 0;
    const bAdminCurr = editingUser.balance_admin ?? 0;
    const newAdminValue = bAdminCurr + adminDeltaInput;
    const newTotalBalance = bStart + bTime + bRef + bPay + newAdminValue;

    const userToSave: AppUser = {
      ...editingUser,
      balance_start: bStart,
      balance_time: bTime,
      balance_ref: bRef,
      balance_pay: bPay,
      balance_admin: newAdminValue,
      balance: newTotalBalance
    };

    const updated = users.map(u => u.id === userToSave.id ? userToSave : u);
    setUsers(updated);
    saveAdminUsers(updated);

    // При наличии дельты добавляем запись в таблицу транзакций в интерфейсе
    if (adminDeltaInput !== 0) {
      const nowTs = Date.now();
      const txId = `TX-ADMIN-${nowTs}-${Math.floor(Math.random() * 10000)}`;
      const newTx: BillingTransaction = {
        id: txId,
        userId: userToSave.id,
        username: userToSave.username || `@id${userToSave.id}`,
        fullName: userToSave.fullName || 'Алхимик',
        amount: adminDeltaInput,
        price: 0,
        timestamp: nowTs,
        status: 'success'
      };
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);
      saveAdminTransactions(updatedTxs);
    }

    // Синхронизируем изменения с базой данных PostgreSQL
    fetch(`/api/users/${userToSave.id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userToSave,
        adminDelta: adminDeltaInput,
        adminReason: adminReasonInput || 'Корректировка администратором'
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('User successfully synced with PostgreSQL DB:', data);
      window.dispatchEvent(new Event('alchimia:refresh_user'));
    })
    .catch(err => console.error('Failed to sync updated user to PostgreSQL DB:', err));

    setEditingUser(null);
    setAdminDeltaInput(0);
    setAdminReasonInput('');
  };

  // Удаление пользователя из БД
  const handleDeleteUser = async (userId: string) => {
    if (currentUser.role !== 'admin') {
      alert('Только администраторы могут удалять пользователей из БД!');
      return;
    }
    if (!window.confirm(`Вы уверены, что хотите БЕЗВОЗВРАТНО удалить пользователя ${userId} и все его данные из базы данных?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const updated = users.filter(u => u.id !== userId);
        setUsers(updated);
        saveAdminUsers(updated);
        setEditingUser(null);
        alert(`Пользователь ${userId} успешно удален из базы данных!`);
      } else {
        alert(`Ошибка при удалении: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Ошибка соединения с сервером при удалении пользователя');
    }
  };

  // Смена роли пользователя
  const handleRoleChange = (userId: string, newRole: 'admin' | 'manager' | 'user') => {
    if (currentUser.role !== 'admin') {
      alert('Только администраторы могут изменять роли!');
      return;
    }
    const updated = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    setUsers(updated);
    saveAdminUsers(updated);

    const targetUser = updated.find(u => u.id === userId);
    if (targetUser) {
      fetch(`/api/users/${userId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetUser, overrideBalance: true })
      })
      .then(res => res.json())
      .catch(err => console.error('Failed to sync updated role to PostgreSQL DB:', err));
    }
  };

  useEffect(() => {
    fetch('/api/admin/protalk-config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.config) {
          if (data.config.botId) setEmployeeId(String(data.config.botId));
          if (data.config.botToken) setProTalkToken(data.config.botToken);
          if (data.config.apiUrl) setProTalkApiUrl(data.config.apiUrl);
        }
      })
      .catch(e => console.error("Error loading ProTalk config:", e));

    fetch('/api/admin/bot-settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.config) {
          if (data.config.botToken) setBotToken(data.config.botToken);
          if (data.config.botUsername) setBotUsername(data.config.botUsername);
          if (data.config.welcomeMessage) setWelcomeMessage(data.config.welcomeMessage);
          if (data.config.employeeId) setEmployeeId(String(data.config.employeeId));
          if (data.config.proTalkToken) setProTalkToken(data.config.proTalkToken);
          if (data.config.inactiveReminderEnabled !== undefined) setInactiveReminderEnabled(!!data.config.inactiveReminderEnabled);
          if (data.config.inactiveDaysThreshold) setInactiveDaysThreshold(Number(data.config.inactiveDaysThreshold));
          if (data.config.inactiveReminderMessage) setInactiveReminderMessage(data.config.inactiveReminderMessage);
        }
      })
      .catch(e => console.error("Error loading Bot settings from DB:", e));

    fetch('/api/admin/robokassa-config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.merchantLogin) setRobokassaMerchantLogin(data.merchantLogin);
          if (data.password1) setRobokassaPass1(data.password1);
          if (data.password2) setRobokassaPass2(data.password2);
          if (data.isTest !== undefined) setRobokassaIsTest(!!data.isTest);
          if (data.receiptItemName) setRobokassaReceiptItemName(data.receiptItemName);
          if (data.receiptTax !== undefined) setRobokassaReceiptTax(data.receiptTax || 'none');
          if (data.sno !== undefined) setRobokassaSno(data.sno || '');
        }
      })
      .catch(e => console.error("Error loading Robokassa config from DB:", e));
  }, []);

  // Сохранить настройки Ботов
  const handleSaveBotSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TelegramBotSettings = {
      botToken,
      botUsername,
      registrationEnabled,
      welcomeMessage,
      proTalkToken,
      proTalkApiUrl,
      employeeId,
      robokassaMerchantLogin,
      robokassaPass1,
      robokassaPass2,
      robokassaIsTest,
      robokassaReceiptItemName,
      robokassaReceiptTax,
      robokassaSno,
      inactiveReminderEnabled,
      inactiveDaysThreshold,
      inactiveReminderMessage
    };
    setBotSettings(updated);
    saveBotSettings(updated);

    // Save Bot settings to DB
    fetch('/api/admin/bot-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(e => console.error("Error saving Bot settings to DB:", e));

    // Save Robokassa config to DB
    fetch('/api/admin/robokassa-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantLogin: robokassaMerchantLogin,
        password1: robokassaPass1,
        password2: robokassaPass2,
        isTest: robokassaIsTest,
        receiptItemName: robokassaReceiptItemName,
        receiptTax: robokassaReceiptTax,
        sno: robokassaSno
      })
    }).catch(e => console.error("Error saving Robokassa config to DB:", e));

    // Save ProTalk config to DB
    fetch('/api/admin/protalk-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botId: employeeId,
        botToken: proTalkToken,
        apiUrl: proTalkApiUrl
      })
    }).catch(e => console.error("Error saving ProTalk config to DB:", e));

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Сохранить изменения шаблона рассылок
  const handleSaveTemplate = async (updated: ReminderTemplate) => {
    const newTemplates = reminderTemplates.map(t => t.id === updated.id ? updated : t);
    setReminderTemplates(newTemplates);
    saveReminderTemplates(newTemplates);
    setEditingTemplate(null);

    try {
      await fetch('/api/admin/reminder-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: newTemplates })
      });
    } catch (err) {
      console.error('Failed to save reminder templates to DB:', err);
    }
  };

  // Переключение включения напоминаний у конкретного пользователя
  const handleToggleUserReminders = async (userId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    const updated = users.map(u => u.id === userId ? { ...u, remindersEnabled: newVal } : u);
    setUsers(updated);
    saveAdminUsers(updated);

    try {
      await fetch('/api/admin/toggle-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled: newVal })
      });
    } catch (err) {
      console.error('Failed to toggle user reminders:', err);
    }
  };

  // Тестовая отправка сообщения админу Telegram 169262990
  const handleSendTestNotification = async (messageText: string, title?: string) => {
    setTestSendingStatus('Отправка теста админу 169262990...');
    try {
      const res = await fetch('/api/admin/send-test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser: '169262990',
          message: messageText || 'Тестовое сообщение рассылки',
          title: title || 'Тест Рассылки',
          buttonText: 'Открыть Играть',
          buttonUrl: 'https://t.me/AI_HimBot/app'
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestSendingStatus(`✅ Тестовое сообщение отправлено админу Telegram 169262990 (${new Date().toLocaleTimeString()})`);
      } else {
        setTestSendingStatus(`❌ Ошибка: ${data.error || 'Не удалось отправить'}`);
      }
    } catch (err) {
      setTestSendingStatus('❌ Сетевая ошибка при отправке теста');
    }
  };

  // Ручной запуск массовой рассылки пакетами
  const handleSendMassMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!massMailMessage.trim()) return;

    setMassMailSending(true);
    setMassMailStatus('Запуск пакетной отправки в Telegram...');

    try {
      const targetUserIds = selectedMailingUserIds.length > 0 ? selectedMailingUserIds : undefined;
      const res = await fetch('/api/admin/mass-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: massMailMessage,
          buttonText: massMailButtonText,
          buttonUrl: massMailButtonUrl,
          targetUserIds,
          userRole: currentUser.role
        })
      });
      const data = await res.json();
      if (data.success) {
        setMassMailStatus(`Пакетная рассылка выполнена! Успешно доставлено: ${data.successCount}, ошибок: ${data.errorCount}`);
        setMailingLogs(getMailingLogs());
        await refreshMailingLogs();

        if (data.results && Array.isArray(data.results)) {
          setLiveStreamLogs(prev => [...data.results, ...prev]);
        }

      } else {
        setMassMailStatus(`Ошибка: ${data.error || 'Неизвестный сбой'}`);
      }
    } catch (err) {
      setMassMailStatus('Ошибка сети при отправке рассылки');
    } finally {
      setMassMailSending(false);
    }
  };

  // Запуск еженедельной авто-рассылки по неактивным пользователям (5 случайных вариантов)
  const handleTriggerWeeklyInactiveBroadcast = async () => {
    setIsInactiveSending(true);
    try {
      const res = await fetch('/api/admin/broadcast/inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysInactive: 7 })
      });
      const data = await res.json();
      if (data.success) {
        setMassMailStatus(`✅ ${data.message}`);
        if (data.results && data.results.length > 0) {
          setLiveStreamLogs(prev => [...data.results, ...prev]);
        }
      } else {
        setMassMailStatus(`❌ Ошибка рассылки неактивным: ${data.error}`);
      }
    } catch (err) {
      setMassMailStatus('❌ Сетевая ошибка при авто-рассылке');
    } finally {
      setIsInactiveSending(false);
    }
  };

  // Повторная отправка сообщения выбранным получателям из истории
  const handleResendSelected = async () => {
    if (selectedHistoryLogIds.length === 0) return;
    setIsResending(true);
    try {
      // Build a lookup map from log item ID -> log record
      const map = new Map<string, any>();
      for (const log of serverMailingLogs) map.set(log.id, log);
      for (const log of liveStreamLogs) if (!map.has(log.id)) map.set(log.id, log);

      const targetUserIds = Array.from(new Set(
        selectedHistoryLogIds
          .map(logId => map.get(logId)?.recipientId)
          .filter(Boolean)
      ));

      if (targetUserIds.length === 0) {
        setMassMailStatus('Не удалось определить получателей для выбранных сообщений');
        return;
      }

      const res = await fetch('/api/admin/mass-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: massMailMessage || 'Повторное напоминание от Алхимика! 🧪✨',
          buttonText: massMailButtonText || 'Открыть',
          buttonUrl: massMailButtonUrl || 'https://t.me/SAV_AIbot/app',
          targetUserIds,
          userRole: currentUser.role
        })
      });
      const data = await res.json();
      if (data.success) {
        setMassMailStatus(`Повторная отправка выполнена! Доставлено: ${data.successCount}, ошибок: ${data.errorCount}`);
        await refreshMailingLogs();
        if (data.results && Array.isArray(data.results)) {
          setLiveStreamLogs(prev => [...data.results, ...prev]);
        }
        setSelectedHistoryLogIds([]);
      } else {
        setMassMailStatus(`Ошибка повторной отправки: ${data.error}`);
      }
    } catch (err) {
      setMassMailStatus('Ошибка сети при повторной отправке');
    } finally {
      setIsResending(false);
    }
  };

  // Сброс и загрузка базовых заклинаний LATIN_SPELLS
  const handleResetSpells = async () => {
    if (!window.confirm('Восстановить базовый латинский Гримуар Заклинаний (LATIN_SPELLS) в базе данных?')) return;
    try {
      const res = await fetch('/api/spells/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAdminSpells(data.spells || []);
        setSpellsSavedStatus('Базовые заклинания успешно загружены в БД!');
        setTimeout(() => setSpellsSavedStatus(null), 3000);
      }
    } catch (err) {
      console.error('Failed to reset spells:', err);
    }
  };

  // Симуляция добавления тестового платежа (с сохранением в БД)
  const handleSimulatePayment = async () => {
    const randomUser = users[Math.floor(Math.random() * users.length)] || { id: '169262990', username: '@shishkarnem', fullName: 'Dr.White' };
    const price = [99, 190, 350, 590, 990, 1890][Math.floor(Math.random() * 6)];
    const energyMap: Record<number, number> = { 99: 50000, 190: 150000, 350: 250000, 590: 500000, 990: 1000000, 1890: 2000000 };
    
    const newTx: BillingTransaction = {
      id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: randomUser.id,
      username: randomUser.username || `@id${randomUser.id}`,
      fullName: randomUser.fullName || 'Алхимик',
      amount: energyMap[price],
      price,
      timestamp: Date.now(),
      status: 'success',
      type: 'pay'
    };

    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        saveAdminTransactions(data.transactions);
      } else {
        const updatedTxs = [newTx, ...transactions];
        setTransactions(updatedTxs);
        saveAdminTransactions(updatedTxs);
      }
    } catch (_) {
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);
      saveAdminTransactions(updatedTxs);
    }

    // Refresh users from DB so balance_pay, balance_start, balance_ref, balance_admin, and total balance are loaded in real time!
    try {
      const uRes = await fetch('/api/users');
      const uData = await uRes.json();
      if (uData && Array.isArray(uData.users)) {
        setUsers(uData.users);
        saveAdminUsers(uData.users);
      } else {
        const updatedUsers = users.map(u => {
          if (u.id === randomUser.id) {
            return {
              ...u,
              balance_pay: (u.balance_pay || 0) + energyMap[price],
              balance: u.balance + energyMap[price]
            };
          }
          return u;
        });
        setUsers(updatedUsers);
        saveAdminUsers(updatedUsers);
      }
    } catch (_) {
      const updatedUsers = users.map(u => {
        if (u.id === randomUser.id) {
          return {
            ...u,
            balance_pay: (u.balance_pay || 0) + energyMap[price],
            balance: u.balance + energyMap[price]
          };
        }
        return u;
      });
      setUsers(updatedUsers);
      saveAdminUsers(updatedUsers);
    }
    window.dispatchEvent(new Event('alchimia:refresh_user'));
  };

  // Симуляция ИИ лога (с сохранением в БД)
  const handleSimulateAiLog = async () => {
    const randomUser = users[Math.floor(Math.random() * users.length)] || { id: '169262990', username: '@shishkarnem' };
    const elementA = ['Огонь', 'Вода', 'Воздух', 'Земля', 'Металл', 'Эфир'][Math.floor(Math.random() * 6)];
    const elementB = ['Хаос', 'Смерть', 'Время', 'Кристалл', 'Душа', 'Жизнь'][Math.floor(Math.random() * 6)];
    const tokens = Math.floor(1000 + Math.random() * 10000);
    const status = Math.random() > 0.1 ? 'success' : 'failed';

    const newLog: AIRequestLog = {
      id: `LOG-${Math.floor(5000 + Math.random() * 5000)}`,
      userId: randomUser.id,
      username: randomUser.username || `@id${randomUser.id}`,
      elementA,
      elementB,
      layer: Math.floor(1 + Math.random() * 5),
      tokensUsed: tokens,
      costRub: tokens * TOKEN_COST_RATIO,
      timestamp: Date.now(),
      status,
      prompt: `Тестовое слияние ${elementA} + ${elementB}.`,
      response: status === 'success' ? `Успешно создан элемент Резонанса. Затрачено ${tokens} энергии.` : 'Внутренняя ошибка сети трансмутации.'
    };

    try {
      const res = await fetch('/api/admin/ai-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAiLogs(data.logs);
        saveAdminLogs(data.logs);
      } else {
        const updatedLogs = [newLog, ...aiLogs];
        setAiLogs(updatedLogs);
        saveAdminLogs(updatedLogs);
      }
    } catch (_) {
      const updatedLogs = [newLog, ...aiLogs];
      setAiLogs(updatedLogs);
      saveAdminLogs(updatedLogs);
    }
  };

  // Графики аналитики
  const crmAnalyticsData = useMemo(() => {
    return [
      { name: 'Все пользователи', value: users.length },
      { name: 'Активные', value: users.filter(u => u.status === 'active').length },
      { name: 'Ожидают', value: users.filter(u => u.status === 'pending').length },
      { name: 'Забанены', value: users.filter(u => u.status === 'banned').length },
    ];
  }, [users]);

  const billingChartData = useMemo(() => {
    // Агрегируем поступления из реальной таблицы транзакций БД по дням недели
    const daysMap: Record<string, number> = {
      'Пн': 0, 'Вт': 0, 'Ср': 0, 'Чт': 0, 'Пт': 0, 'Сб': 0, 'Вс': 0
    };
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    const successfulTxs = transactions.filter(t => t.status === 'success' || t.status === 'completed');
    if (successfulTxs.length > 0) {
      for (const tx of successfulTxs) {
        if (tx.timestamp) {
          const d = new Date(tx.timestamp);
          const dayName = dayNames[d.getDay()];
          if (daysMap[dayName] !== undefined) {
            daysMap[dayName] += (tx.price || 0);
          }
        }
      }
    }

    return [
      { day: 'Пн', revenue: daysMap['Пн'] },
      { day: 'Вт', revenue: daysMap['Вт'] },
      { day: 'Ср', revenue: daysMap['Ср'] },
      { day: 'Чт', revenue: daysMap['Чт'] },
      { day: 'Пт', revenue: daysMap['Пт'] },
      { day: 'Сб', revenue: daysMap['Сб'] },
      { day: 'Вс', revenue: daysMap['Вс'] }
    ];
  }, [transactions]);

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="parchment-card p-8 max-w-md border-red-800/40 bg-white/60 shadow-xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-3xl">
            🛑
          </div>
          <h2 className="font-gothic text-2xl text-red-800 tracking-widest uppercase">ДОСТУП ЗАПРЕЩЕН</h2>
          <p className="text-sm text-sepia/80">
            Этот священный раздел доступен только Администраторам и Менеджерам ордена Алхимиков.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 px-6 py-2.5 bg-sepia text-parchment uppercase font-bold text-xs tracking-wider rounded hover:bg-sepia-light transition-all"
          >
            Вернуться в лабораторию
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-5xl mx-auto px-1">
      {/* Admin Title Banner */}
      <div className="parchment-card p-6 border-gold/40 bg-white/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold text-3xl">
            👑
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-gold">Административная панель</div>
            <h1 className="text-2xl font-gothic tracking-widest text-sepia">КАБИНЕТ ПРАВИТЕЛЯ (БОГ)</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/system-admin"
            className="flex items-center gap-2 font-mono text-xs px-3.5 py-1.5 bg-sepia text-parchment font-bold uppercase tracking-wider rounded-lg hover:bg-sepia-light transition-all shadow-md active:scale-95"
          >
            <Database size={13} />
            <span>База Данных</span>
          </Link>
          <div className="flex items-center gap-2 font-mono text-xs px-3 py-1.5 bg-gold/10 border border-gold/20 rounded-lg text-gold font-bold">
            <Shield size={14} />
            <span>Ваша роль: {currentUser.role.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Subpage Nav Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sepia/10 pb-1">
        <button 
          onClick={() => handleTabChange('crm')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'crm' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <Users size={14} />
          CRM Система
        </button>
        <button 
          onClick={() => handleTabChange('billing')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'billing' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <CreditCard size={14} />
          Финансы & Оплаты
        </button>
        <button 
          onClick={() => handleTabChange('logs')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'logs' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <Terminal size={14} />
          ИИ Журнал & Промпты
        </button>
        <button 
          onClick={() => handleTabChange('arcana')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'arcana' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <Sparkles size={14} />
          Арканы & Ссылки
        </button>
        <button 
          onClick={() => handleTabChange('role')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'role' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <ShieldAlert size={14} />
          Управление Ролями
        </button>
        <button 
          onClick={() => handleTabChange('token')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'token' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <Key size={14} />
          Токены & Боты
        </button>
        <button 
          onClick={() => handleTabChange('mailing')} 
          className={`px-4 py-2.5 font-bold uppercase tracking-wider text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'mailing' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/60 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <Send size={14} />
          Рассылки & Напоминания
        </button>
        <button 
          onClick={() => handleTabChange('blog')} 
          className={`px-4 py-2.5 font-bold tracking-wide text-[14px] rounded-t-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'blog' 
              ? 'border-gold text-gold bg-gold/5' 
              : 'border-transparent text-sepia/70 hover:text-sepia hover:bg-sepia/5'
          }`}
        >
          <BookOpen size={16} />
          Блог и SEO
        </button>
      </div>

      {/* Main Admin Section Content */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          {/* ==================================== CRM SUBPAGE ==================================== */}
          {activeTab === 'crm' && (
            <motion.div
              key="crm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              {/* CRM View Switcher & Filters */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 p-4 rounded-xl border border-sepia/10 shadow-sm">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCrmView('kanban')}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                      crmView === 'kanban' ? 'bg-gold text-ink' : 'bg-sepia/10 text-sepia/70 hover:bg-sepia/15'
                    }`}
                  >
                    Канбан доска
                  </button>
                  <button 
                    onClick={() => setCrmView('table')}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                      crmView === 'table' ? 'bg-gold text-ink' : 'bg-sepia/10 text-sepia/70 hover:bg-sepia/15'
                    }`}
                  >
                    Таблица
                  </button>
                  <button 
                    onClick={() => setCrmView('analytics')}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                      crmView === 'analytics' ? 'bg-gold text-ink' : 'bg-sepia/10 text-sepia/70 hover:bg-sepia/15'
                    }`}
                  >
                    Аналитика
                  </button>
                </div>

                {crmView !== 'analytics' && (
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Поиск */}
                    <div className="relative flex-1 md:w-64">
                      <Search size={14} className="absolute left-3 top-2.5 text-sepia/40" />
                      <input 
                        type="text" 
                        placeholder="Поиск по имени/username/ID..." 
                        value={crmSearch}
                        onChange={e => setCrmSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                      />
                    </div>
                    {/* Фильтр ролей */}
                    <select
                      value={crmRoleFilter}
                      onChange={e => setCrmRoleFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold"
                    >
                      <option value="all">Все роли</option>
                      <option value="admin">Админы</option>
                      <option value="manager">Менеджеры</option>
                      <option value="user">Пользователи</option>
                    </select>

                    {/* Сортировка */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={crmSortField}
                        onChange={e => setCrmSortField(e.target.value as keyof AppUser)}
                        className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold"
                        title="Сортировать по"
                      >
                        <option value="registrationDate">По дате регистрации</option>
                        <option value="balance">По балансу AiHim</option>
                        <option value="discoveredCount">По открытым элементам</option>
                        <option value="fullName">По имени</option>
                        <option value="lastActive">По активности</option>
                      </select>
                      <button
                        onClick={() => setCrmSortOrder(crmSortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-1.5 py-2.5 rounded bg-white border border-sepia/20 hover:border-gold hover:bg-gold/5 text-sepia transition-all flex items-center justify-center shrink-0"
                        title={crmSortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
                      >
                        <ArrowUpDown size={12} className={crmSortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* KANBAN VIEW */}
              {crmView === 'kanban' && (
                <div className="flex flex-col">
                  {/* Arrow controls */}
                  <div className="flex justify-end gap-2 mb-3">
                    <button 
                      onClick={() => scrollContainer(kanbanScrollRef, 'left')}
                      className="p-1.5 rounded bg-parchment border border-sepia/20 hover:border-gold hover:bg-gold/5 text-sepia transition-all active:scale-95 flex items-center justify-center"
                      title="Листать влево"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      onClick={() => scrollContainer(kanbanScrollRef, 'right')}
                      className="p-1.5 rounded bg-parchment border border-sepia/20 hover:border-gold hover:bg-gold/5 text-sepia transition-all active:scale-95 flex items-center justify-center"
                      title="Листать вправо"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div 
                    ref={kanbanScrollRef}
                    className="flex flex-row overflow-x-auto gap-6 pb-4 scroll-smooth custom-scrollbar snap-x snap-mandatory"
                  >
                    {/* Active Column */}
                    <div className="flex flex-col gap-4 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 min-h-[400px] w-[280px] sm:w-[320px] md:flex-1 shrink-0 snap-start">
                      <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Активные ({filteredUsers.filter(u => u.status === 'active').length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {filteredUsers.filter(u => u.status === 'active').map(user => (
                          <motion.div 
                            key={user.id} 
                            layoutId={`card-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="bg-white p-3.5 rounded-lg border border-sepia/10 shadow-sm hover:border-gold/50 cursor-pointer transition-all hover:shadow"
                          >
                            <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-9 h-9 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-sepia truncate">{user.fullName}</h4>
                                <p className="text-[10px] text-gold/80 font-mono truncate">{user.username}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-sepia/5 text-[10px]">
                              <span className="text-sepia/60">Открыто: <strong className="text-sepia">{user.discoveredCount}</strong></span>
                              <span className="font-bold text-gold">{(user.balance ?? 0).toLocaleString()} AiHim</span>
                            </div>
                            <div className="mt-1.5 text-[9px] text-sepia/50 font-mono truncate">
                              Активность: {user.lastActiveDate || (user.lastActive ? new Date(user.lastActive + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '—')}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Inactive Column */}
                    <div className="flex flex-col gap-4 bg-slate-500/5 p-4 rounded-xl border border-slate-500/10 min-h-[400px] w-[280px] sm:w-[320px] md:flex-1 shrink-0 snap-start">
                      <div className="flex justify-between items-center border-b border-slate-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          Неактивные ({filteredUsers.filter(u => u.status === 'inactive').length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {filteredUsers.filter(u => u.status === 'inactive').map(user => (
                          <motion.div 
                            key={user.id} 
                            layoutId={`card-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="bg-white p-3.5 rounded-lg border border-sepia/10 shadow-sm hover:border-gold/50 cursor-pointer transition-all hover:shadow opacity-85 hover:opacity-100"
                          >
                            <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-9 h-9 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-sepia truncate">{user.fullName}</h4>
                                <p className="text-[10px] text-gold/80 font-mono truncate">{user.username}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-sepia/5 text-[10px]">
                              <span className="text-sepia/60">Открыто: <strong className="text-sepia">{user.discoveredCount}</strong></span>
                              <span className="font-bold text-gold">{(user.balance ?? 0).toLocaleString()} AiHim</span>
                            </div>
                            <div className="mt-1.5 text-[9px] text-sepia/50 font-mono truncate">
                              Активность: {user.lastActiveDate || (user.lastActive ? new Date(user.lastActive + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '—')}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Banned Column */}
                    <div className="flex flex-col gap-4 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10 min-h-[400px] w-[280px] sm:w-[320px] md:flex-1 shrink-0 snap-start">
                      <div className="flex justify-between items-center border-b border-rose-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-rose-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          Заблокированные ({filteredUsers.filter(u => u.status === 'banned' || u.status === 'bot_blocked').length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {filteredUsers.filter(u => u.status === 'banned' || u.status === 'bot_blocked').map(user => (
                          <motion.div 
                            key={user.id} 
                            layoutId={`card-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="bg-white p-3.5 rounded-lg border border-sepia/10 shadow-sm hover:border-gold/50 cursor-pointer transition-all hover:shadow"
                          >
                            <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-9 h-9 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-sepia truncate">{user.fullName}</h4>
                                <p className="text-[10px] text-gold/80 font-mono truncate">{user.username}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-sepia/5 text-[10px]">
                              <span className="text-sepia/60">Открыто: <strong className="text-sepia">{user.discoveredCount}</strong></span>
                              <span className="font-bold text-gold">{(user.balance ?? 0).toLocaleString()} AiHim</span>
                            </div>
                            <div className="mt-1.5 text-[9px] text-rose-600/80 font-mono truncate">
                              Статус: {user.status === 'bot_blocked' ? 'Бот заблокирован' : 'Забанен'}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Other Column (Pending, Unknown, Custom) */}
                    <div className="flex flex-col gap-4 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 min-h-[400px] w-[280px] sm:w-[320px] md:flex-1 shrink-0 snap-start">
                      <div className="flex justify-between items-center border-b border-amber-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Другое ({filteredUsers.filter(u => !['active', 'inactive', 'banned', 'bot_blocked'].includes(u.status || '')).length})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {filteredUsers.filter(u => !['active', 'inactive', 'banned', 'bot_blocked'].includes(u.status || '')).map(user => (
                          <motion.div 
                            key={user.id} 
                            layoutId={`card-${user.id}`}
                            onClick={() => setEditingUser(user)}
                            className="bg-white p-3.5 rounded-lg border border-sepia/10 shadow-sm hover:border-gold/50 cursor-pointer transition-all hover:shadow"
                          >
                            <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-9 h-9 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-sepia truncate">{user.fullName}</h4>
                                <p className="text-[10px] text-gold/80 font-mono truncate">{user.username}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-sepia/5 text-[10px]">
                              <span className="text-sepia/60">Открыто: <strong className="text-sepia">{user.discoveredCount}</strong></span>
                              <span className="font-bold text-gold">{(user.balance ?? 0).toLocaleString()} AiHim</span>
                            </div>
                            <div className="mt-1.5 text-[9px] text-amber-700 font-mono truncate">
                              Статус: {user.status || 'Неизвестен'}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TABLE VIEW */}
              {crmView === 'table' && (
                <div className="flex flex-col">
                  {/* Arrow controls */}
                  <div className="flex justify-end gap-2 mb-3">
                    <button 
                      onClick={() => scrollContainer(tableScrollRef, 'left')}
                      className="p-1.5 rounded bg-parchment border border-sepia/20 hover:border-gold hover:bg-gold/5 text-sepia transition-all active:scale-95 flex items-center justify-center"
                      title="Листать таблицу влево"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      onClick={() => scrollContainer(tableScrollRef, 'right')}
                      className="p-1.5 rounded bg-parchment border border-sepia/20 hover:border-gold hover:bg-gold/5 text-sepia transition-all active:scale-95 flex items-center justify-center"
                      title="Листать таблицу вправо"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div 
                    ref={tableScrollRef}
                    className="parchment-card p-4 overflow-x-auto scroll-smooth custom-scrollbar"
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-sepia/10 text-sepia/60 uppercase tracking-wider font-bold">
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('fullName')}>Имя / ID</th>
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('role')}>Роль</th>
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('balance')}>Баланс</th>
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('discoveredCount')}>Элементов</th>
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('status')}>Статус</th>
                          <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort('lastActive')}>Активность</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sepia/5">
                        {filteredUsers.map(user => (
                          <tr 
                            key={user.id} 
                            onClick={() => setEditingUser(user)}
                            className="hover:bg-gold/5 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-2">
                              <div className="flex items-center gap-2.5">
                                <img src={user.avatar} className="w-8 h-8 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                                <div>
                                  <div className="font-bold text-sepia">{user.fullName}</div>
                                  <div className="text-[10px] text-sepia/50 font-mono">{user.username} (ID: {user.id})</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 font-mono font-bold text-gold">
                              {user.balance.toLocaleString()} AiHim
                            </td>
                            <td className="py-3.5 px-2 font-mono">
                              {user.discoveredCount}
                            </td>
                            <td className="py-3.5 px-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                user.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                user.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                user.status === 'bot_blocked' ? 'bg-purple-100 text-purple-800' :
                                user.status === 'inactive' ? 'bg-gray-100 text-gray-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {user.status === 'active' ? 'Активен' : user.status === 'pending' ? 'Ожидание' : user.status === 'bot_blocked' ? 'Бот заблокирован' : user.status === 'inactive' ? 'Неактивен' : 'Бан'}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-sepia/60 font-mono text-[10px]">
                              {user.lastActiveDate || (user.lastActive ? new Date(user.lastActive + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ANALYTICS VIEW */}
              {crmView === 'analytics' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="parchment-card p-6 flex flex-col gap-4">
                    <h3 className="font-gothic text-base tracking-widest text-sepia uppercase">Распределение Пользователей</h3>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={crmAnalyticsData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="name" stroke="#8c7a6b" fontSize={10} />
                          <YAxis stroke="#8c7a6b" fontSize={10} />
                          <Tooltip contentStyle={{ background: '#fcfaf7', border: '1px solid #c9a343' }} />
                          <Bar dataKey="value" fill="#c9a343" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="parchment-card p-6 flex flex-col gap-4 justify-between">
                    <div>
                      <h3 className="font-gothic text-base tracking-widest text-sepia uppercase mb-3">Сводная статистика</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gold/5 p-4 border border-gold/10 rounded-lg">
                          <div className="text-[10px] text-sepia/40 font-bold uppercase tracking-wider">Всего Алхимиков</div>
                          <div className="text-2xl font-gothic text-sepia mt-1">{users.length}</div>
                        </div>
                        <div className="bg-gold/5 p-4 border border-gold/10 rounded-lg">
                          <div className="text-[10px] text-sepia/40 font-bold uppercase tracking-wider">Общий баланс Эфира</div>
                          <div className="text-xl font-gothic text-gold mt-1">
                            {users.reduce((acc, curr) => acc + curr.balance, 0).toLocaleString()} AiHim
                          </div>
                        </div>
                        <div className="bg-gold/5 p-4 border border-gold/10 rounded-lg">
                          <div className="text-[10px] text-sepia/40 font-bold uppercase tracking-wider">Средний уровень</div>
                          <div className="text-2xl font-gothic text-sepia mt-1">
                            {(users.reduce((acc, curr) => acc + curr.level, 0) / users.length).toFixed(1)}
                          </div>
                        </div>
                        <div className="bg-gold/5 p-4 border border-gold/10 rounded-lg">
                          <div className="text-[10px] text-sepia/40 font-bold uppercase tracking-wider">Уровень открытий</div>
                          <div className="text-2xl font-gothic text-sepia mt-1">
                            {users.reduce((acc, curr) => acc + curr.discoveredCount, 0)} эл.
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-sepia/50 italic border-t border-sepia/10 pt-4 text-center">
                      Синхронизация с базой данных Эфира выполнена успешно.
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================================== BILLING SUBPAGE ==================================== */}
          {activeTab === 'billing' && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              {/* Financial Dashboard Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-500/5 p-4 border border-emerald-500/10 rounded-xl">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-800">Общая Выручка</div>
                  <div className="text-2xl font-gothic text-emerald-700 mt-1">{totalRevenue.toLocaleString()} ₽</div>
                  <div className="text-[8px] uppercase tracking-tight text-emerald-600 mt-0.5">Успешно оплачено в системе</div>
                </div>
                <div className="bg-gold/5 p-4 border border-gold/10 rounded-xl">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-gold">Всего Энергии продано</div>
                  <div className="text-2xl font-gothic text-gold mt-1">
                    {transactions.filter(t => t.status === 'success').reduce((sum, curr) => sum + curr.amount, 0).toLocaleString()} AiHim
                  </div>
                  <div className="text-[8px] uppercase tracking-tight text-sepia/40 mt-0.5">Энергетическая эмиссия вселенной</div>
                </div>
                <div className="bg-amber-500/5 p-4 border border-amber-500/10 rounded-xl">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-amber-800">Конверсия платежей</div>
                  <div className="text-2xl font-gothic text-amber-700 mt-1">
                    {Math.round((transactions.filter(t => t.status === 'success').length / (transactions.length || 1)) * 100)}%
                  </div>
                  <div className="text-[8px] uppercase tracking-tight text-amber-600 mt-0.5">
                    {transactions.filter(t => t.status === 'success').length} из {transactions.length} транзакций
                  </div>
                </div>
              </div>

              {/* Chart & Action */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="parchment-card p-5 md:col-span-2 flex flex-col gap-4">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">Поступления по дням (Из базы данных)</h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={billingChartData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c9a343" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#c9a343" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="day" stroke="#8c7a6b" fontSize={10} />
                        <YAxis stroke="#8c7a6b" fontSize={10} />
                        <Tooltip contentStyle={{ background: '#fcfaf7', border: '1px solid #c9a343' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#c9a343" fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="parchment-card p-5 bg-gold/5 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="font-gothic text-xs tracking-widest text-gold uppercase mb-1">Режим Тестирования</h4>
                    <p className="text-xs text-sepia/70 leading-relaxed">
                      Вы можете симулировать моментальный входящий платеж от случайного пользователя. Это начислит ему энергию и добавит запись в бухгалтерию.
                    </p>
                  </div>
                  <button 
                    onClick={handleSimulatePayment}
                    className="w-full py-3 bg-gold text-ink rounded font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow hover:bg-gold-light transition-all"
                  >
                    <Plus size={14} />
                    Имитировать Оплату
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="parchment-card p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">ЖУРНАЛ ТРАНЗАКЦИЙ</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="text" 
                      placeholder="Поиск по имени/TX-ID..." 
                      value={billingSearch}
                      onChange={e => setBillingSearch(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold w-full sm:w-48"
                    />
                    <select
                      value={billingStatusFilter}
                      onChange={e => setBillingStatusFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold"
                    >
                      <option value="all">Все статусы</option>
                      <option value="success">Успешные</option>
                      <option value="failed">Ошибка</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-sepia/10 text-sepia/60 uppercase tracking-wider font-bold">
                        <th className="py-2 px-1">ID Транзакции</th>
                        <th className="py-2 px-1">Пользователь</th>
                        <th className="py-2 px-1">Дата</th>
                        <th className="py-2 px-1">Объем Энергии</th>
                        <th className="py-2 px-1 text-right">Сумма (₽)</th>
                        <th className="py-2 px-1 text-center">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sepia/5 font-mono">
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gold/5 transition-colors">
                          <td className="py-3 px-1 text-sepia font-bold">{tx.id}</td>
                          <td className="py-3 px-1">
                            <span className="font-sans font-bold text-sepia">{tx.fullName}</span> 
                            <span className="text-[10px] text-sepia/50 block">{tx.username}</span>
                          </td>
                          <td className="py-3 px-1 text-sepia/70">
                            {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="py-3 px-1 text-gold font-bold">+{tx.amount.toLocaleString()} AiHim</td>
                          <td className="py-3 px-1 text-right font-sans font-bold text-sepia">{tx.price} ₽</td>
                          <td className="py-3 px-1 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide inline-block ${
                              tx.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {tx.status === 'success' ? 'Успешно' : 'Сбой'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================================== LOGS & PROMPTS SUBPAGE ==================================== */}
          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              {/* Prompt Settings Editor Card */}
              <div className="parchment-card p-6 border-purple-500/20 bg-purple-50/20 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-sepia/10 pb-3">
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-purple-950 uppercase flex items-center gap-2">
                      <Terminal size={16} className="text-purple-700" />
                      Настройки Промптов Нейросети
                    </h3>
                    <p className="text-[10px] text-sepia/60 mt-0.5">Управляйте базовым промптом генерации элементов и системной ролью нейросети</p>
                  </div>
                  {promptSaved && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-3 py-1 rounded">
                      Промпт успешно сохранен!
                    </span>
                  )}
                </div>

                <form onSubmit={handleSavePromptSettings} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-sepia uppercase tracking-wider">
                        Системная Роль Нейросети (System Prompt)
                      </label>
                      <button
                        type="button"
                        onClick={() => setSystemPrompt(DEFAULT_PROMPT_SETTINGS.systemPrompt)}
                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                      >
                        ✨ Вставить Базовый
                      </button>
                    </div>
                    <textarea 
                      rows={6}
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      className="w-full p-3 text-xs bg-white border border-sepia/20 rounded font-mono outline-none focus:border-purple-600 shadow-inner"
                      placeholder="Инструкции роли нейросети..."
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-[10px] font-bold text-sepia uppercase tracking-wider">
                        Промпт Генерации Алхимического Элемента (User Element Prompt)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setElementPrompt(DEFAULT_PROMPT_SETTINGS.elementPrompt)}
                          className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          ✨ Вставить Базовый
                        </button>
                        <span className="text-[10px] font-mono text-purple-800 font-bold">
                          Единый блок с поддержкой всех макросов
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50/80 border border-gold/30 rounded-lg text-[10px] font-mono text-amber-950 space-y-1">
                      <p className="font-bold">✨ Доступные динамо-макросы для подстановки в промпт:</p>
                      <div className="flex flex-wrap gap-1 text-[9px]">
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{world_phase}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{reality_layer}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{layer_rules}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{available_layers}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{discovered_laws}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_name}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_rarity}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_type}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_state}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_temperature}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_stability}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element1_essences}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_name}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_rarity}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_type}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_state}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_temperature}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_stability}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{element2_essences}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{target_rarity}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{is_mutation}`}</span>
                        <span className="bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-900">{`{spells_info}`}</span>
                      </div>
                    </div>

                    <textarea 
                      rows={14}
                      value={elementPrompt}
                      onChange={e => setElementPrompt(e.target.value)}
                      className="w-full p-3 text-xs bg-white border border-sepia/20 rounded font-mono outline-none focus:border-purple-600 shadow-inner"
                      placeholder="Основной промпт для слияния двух элементов с макросами..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-purple-800 hover:bg-purple-900 text-purple-50 text-xs font-bold uppercase tracking-wider rounded-lg shadow transition-all flex items-center gap-2"
                    >
                      <Save size={14} />
                      Сохранить Промпты
                    </button>
                  </div>
                </form>
              </div>

              {/* Cost Tracker Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="parchment-card p-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-purple-500/10 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-purple-800">Траты на Нейросеть (ProTalk API)</div>
                    <div className="text-3xl font-gothic text-purple-700 mt-1.5">{totalCostRub.toFixed(2)} ₽</div>
                    <div className="text-[9px] text-sepia/50 mt-1 leading-relaxed">
                      Расчет по формуле: <strong>10 млн токенов = 300 рублей</strong>
                    </div>
                  </div>
                  <div className="text-[9px] text-purple-600/70 font-mono mt-3 uppercase font-bold">
                    Использовано: {totalTokens.toLocaleString()} токенов
                  </div>
                </div>

                <div className="parchment-card p-6 bg-gold/5 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gold">Всего ИИ Запросов</div>
                    <div className="text-3xl font-gothic text-sepia mt-1.5">{aiLogs.length}</div>
                    <div className="text-[9px] text-sepia/50 mt-1">Средний расход токенов на слияние:</div>
                  </div>
                  <div className="text-xs font-mono text-gold font-bold">
                    {Math.round(totalTokens / (aiLogs.length || 1))} токенов / запрос
                  </div>
                </div>

                <div className="parchment-card p-6 bg-emerald-500/5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-800">Эмулятор Запросов</div>
                    <p className="text-xs text-sepia/60 mt-1">Сгенерируйте искусственный алхимический запрос в лог для отладки расхода.</p>
                  </div>
                  <button 
                    onClick={handleSimulateAiLog}
                    className="w-full py-2 bg-purple-600 text-white rounded font-bold uppercase tracking-widest text-[9px] hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Terminal size={12} />
                    Симулировать запрос ИИ
                  </button>
                </div>
              </div>

              {/* Logs Viewer */}
              <div className="parchment-card p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">ЖУРНАЛ ИИ ТРАНСМУТАЦИЙ</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="text" 
                      placeholder="Искать по пользователю/элементу..." 
                      value={logsSearch}
                      onChange={e => setLogsSearch(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold w-full sm:w-56"
                    />
                    <select
                      value={logsStatusFilter}
                      onChange={e => setLogsStatusFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold"
                    >
                      <option value="all">Все статусы</option>
                      <option value="success">Успешные</option>
                      <option value="error">Сбой</option>
                    </select>
                  </div>
                </div>

                {/* Log List */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredLogs.map(log => (
                    <div key={log.id} className="p-3.5 bg-white rounded-lg border border-sepia/10 flex flex-col gap-2 hover:border-gold/30 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-bold text-sepia flex items-center gap-1.5">
                            {log.status === 'success' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
                            <span>{safeLogString(log.username)} ({safeLogString(log.id)})</span>
                          </div>
                          <div className="text-[10px] text-sepia/50 font-mono mt-0.5">
                            {log.timestamp ? new Date(log.timestamp + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-gold font-mono block">{(log.tokensUsed || 0).toLocaleString()} Токенов</span>
                          <span className="text-[10px] text-purple-700/80 font-mono block">~{(log.costRub ?? ((log.tokensUsed || 0) * TOKEN_COST_RATIO)).toFixed(4)} ₽</span>
                        </div>
                      </div>

                      <div className="text-xs bg-sepia/[0.03] p-2.5 rounded border border-sepia/5 font-mono">
                        <div className="text-[10px] text-sepia/40 uppercase font-bold mb-1">Промпт:</div>
                        <div className="text-sepia/80 italic line-clamp-2">"{safeLogString(log.prompt)}"</div>
                        <div className="text-[10px] text-sepia/40 uppercase font-bold mt-2 mb-1">Ответ ИИ:</div>
                        <div className="text-indigo-900 line-clamp-2">"{safeLogString(log.response)}"</div>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-sepia/50 font-bold uppercase mt-1">
                        <span>Слой {log.layer} • Формула: {safeLogString(log.elementA)} + {safeLogString(log.elementB)}</span>
                        <button 
                          onClick={() => setSelectedLogDetail(log)}
                          className="text-purple-700 hover:underline font-bold"
                        >
                          Подробнее »
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12 text-sepia/40 italic">Логи по вашему запросу не найдены.</div>
                  )}
                </div>
              </div>

              {/* Modal for Log Details */}
              <AnimatePresence>
                {selectedLogDetail && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-parchment parchment-card p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl relative border-gold/40"
                    >
                      <button 
                        onClick={() => setSelectedLogDetail(null)}
                        className="absolute top-4 right-4 text-sepia/40 hover:text-sepia"
                      >
                        <X size={20} />
                      </button>

                      <h3 className="font-gothic text-lg text-sepia uppercase tracking-widest border-b border-sepia/10 pb-2">
                        Детали Запроса #{selectedLogDetail.id}
                      </h3>

                      <div className="grid grid-cols-2 gap-3 font-mono text-xs bg-gold/5 p-3 rounded border border-gold/10">
                        <div><strong className="text-sepia/60">Пользователь:</strong> {safeLogString(selectedLogDetail.username)} ({safeLogString(selectedLogDetail.userId)})</div>
                        <div><strong className="text-sepia/60">Дата:</strong> {selectedLogDetail.timestamp ? new Date(selectedLogDetail.timestamp + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) : '—'}</div>
                        <div><strong className="text-sepia/60">Токены:</strong> {(selectedLogDetail.tokensUsed || 0).toLocaleString()}</div>
                        <div><strong className="text-sepia/60">Стоимость:</strong> ~{(selectedLogDetail.costRub ?? ((selectedLogDetail.tokensUsed || 0) * TOKEN_COST_RATIO)).toFixed(4)} ₽</div>
                        <div><strong className="text-sepia/60">Формула:</strong> {safeLogString(selectedLogDetail.elementA)} + {safeLogString(selectedLogDetail.elementB)}</div>
                        <div><strong className="text-sepia/60">Слой:</strong> Слой {selectedLogDetail.layer}</div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-sepia uppercase tracking-wider">Полный Промпт Запроса</label>
                        <pre className="p-3 bg-white border border-sepia/20 rounded font-mono text-xs whitespace-pre-wrap text-sepia/90">
                          {safeLogString(selectedLogDetail.prompt)}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-sepia uppercase tracking-wider">Ответ Нейросети</label>
                        <pre className="p-3 bg-indigo-950 text-indigo-100 rounded font-mono text-xs whitespace-pre-wrap">
                          {safeLogString(selectedLogDetail.response)}
                        </pre>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button 
                          onClick={() => setSelectedLogDetail(null)}
                          className="px-5 py-2 bg-sepia text-parchment font-bold text-xs uppercase tracking-wider rounded hover:bg-sepia-light"
                        >
                          Закрыть
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ==================================== ARCANA & LINKS SUBPAGE ==================================== */}
          {activeTab === 'arcana' && (
            <motion.div
              key="arcana"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-8"
            >
              {/* Arcana Links Management */}
              <div className="parchment-card p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-sepia/10 pb-4">
                  <div>
                    <h3 className="font-gothic text-base tracking-widest text-gold uppercase flex items-center gap-2">
                      <Send size={18} />
                      Управление Ссылками и Сообществом (Arcana Links)
                    </h3>
                    <p className="text-xs text-sepia/60 mt-0.5">Управляйте внешними ресурсами и социальными ссылками на странице Арканов</p>
                  </div>
                  {linksSavedStatus && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded shadow">
                      {linksSavedStatus}
                    </span>
                  )}
                </div>

                {/* Add New Link Form */}
                <form onSubmit={handleAddArcanaLink} className="p-4 bg-gold/5 border border-gold/20 rounded-xl space-y-4">
                  <h4 className="font-gothic text-xs tracking-widest text-sepia uppercase font-bold">Добавить Новую Ссылку</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Название</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Например: 🤖 SAV AI" 
                        value={newLinkTitle} 
                        onChange={e => setNewLinkTitle(e.target.value)} 
                        className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Описание</label>
                      <input 
                        type="text" 
                        placeholder="Краткая подпись..." 
                        value={newLinkDesc} 
                        onChange={e => setNewLinkDesc(e.target.value)} 
                        className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-sepia uppercase block mb-1">URL адрес</label>
                      <input 
                        type="url" 
                        required 
                        placeholder="https://t.me/..." 
                        value={newLinkUrl} 
                        onChange={e => setNewLinkUrl(e.target.value)} 
                        className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Иконка</label>
                      <select 
                        value={newLinkIcon} 
                        onChange={e => setNewLinkIcon(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                      >
                        {Object.keys(ICON_LIBRARY).map(iconName => (
                          <option key={iconName} value={iconName}>{iconName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-gold text-white text-xs font-bold uppercase tracking-wider rounded shadow hover:bg-gold-dark transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Добавить Ссылку
                    </button>
                  </div>
                </form>

                {/* List of Arcana Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {arcanaLinks.map((link) => (
                    <div key={link.id} className="p-4 bg-white border border-sepia/15 rounded-xl shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
                          <DynamicIcon name={link.icon} size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-sepia truncate flex items-center gap-1">
                            {link.title}
                            <a href={link.url} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                              <ExternalLink size={10} />
                            </a>
                          </div>
                          <p className="text-[10px] text-sepia/60 truncate">{link.description}</p>
                          <span className="text-[9px] text-gold font-mono truncate block">{link.url}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteArcanaLink(link.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded transition-colors shrink-0"
                        title="Удалить ссылку"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arcana System Configuration Editor */}
              <div className="parchment-card p-6 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-sepia/10 pb-4">
                  <div>
                    <h3 className="font-gothic text-base tracking-widest text-gold uppercase flex items-center gap-2">
                      <Sparkles size={18} />
                      Конфигурация Вселенной и Арканов
                    </h3>
                    <p className="text-xs text-sepia/60 mt-0.5">Настраивайте Законы, Сущности, Типы, Ранги и Шансы Калькулятора Редкости</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {configSavedStatus && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded shadow">
                        {configSavedStatus}
                      </span>
                    )}
                    <button 
                      onClick={handleSaveArcanaConfig}
                      className="px-6 py-2.5 bg-gold text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:bg-gold-dark transition-all flex items-center gap-2"
                    >
                      <Save size={14} /> Сохранить Конфигурацию
                    </button>
                  </div>
                </div>

                {/* Arcana Config Sub-Navigation */}
                <div className="flex flex-wrap gap-2 border-b border-sepia/10 pb-3">
                  {[
                    { id: 'laws', label: 'Законы Мироздания' },
                    { id: 'types', label: 'Типы Элементов' },
                    { id: 'essences', label: 'Сущности (Эссенции)' },
                    { id: 'rarities', label: 'Иерархия Редкости' },
                    { id: 'ranks', label: 'Ранги Познания' },
                    { id: 'layers', label: 'Слои Реальности' },
                    { id: 'calc', label: 'Шансы Калькулятора' },
                    { id: 'spells', label: 'Гримуар Заклинаний (БД)' }
                  ].map(sec => (
                    <button
                      key={sec.id}
                      onClick={() => setActiveConfigSection(sec.id as any)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                        activeConfigSection === sec.id
                          ? 'bg-gold text-white shadow'
                          : 'bg-sepia/5 text-sepia/70 hover:bg-sepia/10'
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>

                {/* Config Sub-Section: Hidden Laws */}
                {activeConfigSection === 'laws' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Законы Мироздания ({arcanaConfig.laws.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {arcanaConfig.laws.map((law: any, idx) => (
                        <div key={law.id || idx} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-bold text-xs text-gold font-mono">#{idx + 1}</span>
                              <input 
                                type="text" 
                                value={law.name} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.laws];
                                  updated[idx].name = e.target.value;
                                  setArcanaConfig({ ...arcanaConfig, laws: updated });
                                }}
                                className="w-full font-bold text-xs p-1.5 bg-sepia/5 border border-sepia/10 rounded focus:border-gold outline-none"
                              />
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input 
                                type="checkbox" 
                                checked={law.active !== false} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.laws] as any[];
                                  updated[idx].active = e.target.checked;
                                  setArcanaConfig({ ...arcanaConfig, laws: updated });
                                }}
                                className="accent-gold"
                              />
                              <span className="text-[10px] font-bold text-sepia uppercase">Активен</span>
                            </label>
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Краткая суть</label>
                            <input 
                              type="text" 
                              value={law.desc} 
                              onChange={e => {
                                const updated = [...arcanaConfig.laws];
                                updated[idx].desc = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, laws: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Подробное правило</label>
                            <textarea 
                              rows={2}
                              value={law.detail} 
                              onChange={e => {
                                const updated = [...arcanaConfig.laws];
                                updated[idx].detail = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, laws: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          {/* Calculations & Formula Rule */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sepia/10">
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Сдвиг Temp (°C)</label>
                              <input 
                                type="number" 
                                value={law.tempModifier || 0} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.laws] as any[];
                                  updated[idx].tempModifier = parseFloat(e.target.value) || 0;
                                  setArcanaConfig({ ...arcanaConfig, laws: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Коэф. Стаб.</label>
                              <input 
                                type="number" 
                                step="0.05"
                                value={law.stabilityModifier || 1.0} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.laws] as any[];
                                  updated[idx].stabilityModifier = parseFloat(e.target.value) || 1.0;
                                  setArcanaConfig({ ...arcanaConfig, laws: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Бонус Сложности</label>
                              <input 
                                type="number" 
                                value={law.complexityBonus || 0} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.laws] as any[];
                                  updated[idx].complexityBonus = parseInt(e.target.value) || 0;
                                  setArcanaConfig({ ...arcanaConfig, laws: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] text-gold font-bold uppercase block mb-0.5">Алгоритмическая Формула (Formula Rule)</label>
                            <input 
                              type="text" 
                              value={law.formulaRule || ''} 
                              onChange={e => {
                                const updated = [...arcanaConfig.laws] as any[];
                                updated[idx].formulaRule = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, laws: updated });
                              }}
                              placeholder='e.g. complexity >= 5 -> realityLevel = currentLayer + 1'
                              className="w-full text-xs p-1.5 bg-gold/5 border border-gold/20 rounded font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Element Types */}
                {activeConfigSection === 'types' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Типы Элементов</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(arcanaConfig.elementTypes).map(([typeKey, details]: [string, any]) => (
                        <div key={typeKey} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <span className="font-bold text-xs text-gold uppercase block">{typeKey}</span>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Описание типа</label>
                            <textarea 
                              rows={2}
                              value={details.desc} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  elementTypes: {
                                    ...arcanaConfig.elementTypes,
                                    [typeKey]: { ...details, desc: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Влияние на реакцию</label>
                            <textarea 
                              rows={2}
                              value={details.influence} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  elementTypes: {
                                    ...arcanaConfig.elementTypes,
                                    [typeKey]: { ...details, influence: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          {/* Calculations for Types */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-sepia/10">
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Тепловыделение (°C)</label>
                              <input 
                                type="number" 
                                value={details.heatGeneration || 0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    elementTypes: {
                                      ...arcanaConfig.elementTypes,
                                      [typeKey]: { ...details, heatGeneration: parseFloat(e.target.value) || 0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Множитель Temp</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={details.tempMultiplier || 1.0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    elementTypes: {
                                      ...arcanaConfig.elementTypes,
                                      [typeKey]: { ...details, tempMultiplier: parseFloat(e.target.value) || 1.0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Множитель Стаб.</label>
                              <input 
                                type="number" 
                                step="0.05"
                                value={details.stabilityMultiplier || 1.0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    elementTypes: {
                                      ...arcanaConfig.elementTypes,
                                      [typeKey]: { ...details, stabilityMultiplier: parseFloat(e.target.value) || 1.0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Баз. Сложность</label>
                              <input 
                                type="number" 
                                value={details.baseComplexity || 1} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    elementTypes: {
                                      ...arcanaConfig.elementTypes,
                                      [typeKey]: { ...details, baseComplexity: parseInt(e.target.value) || 1 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Essences */}
                {activeConfigSection === 'essences' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Первородные Сущности (Эссенции)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(arcanaConfig.essences).map(([essKey, details]: [string, any]) => (
                        <div key={essKey} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <span className="font-bold text-xs text-purple-900 uppercase block font-mono">{essKey}</span>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Описание сущности</label>
                            <textarea 
                              rows={2}
                              value={details.desc} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  essences: {
                                    ...arcanaConfig.essences,
                                    [essKey]: { ...details, desc: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Влияние на синтез</label>
                            <textarea 
                              rows={2}
                              value={details.influence} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  essences: {
                                    ...arcanaConfig.essences,
                                    [essKey]: { ...details, influence: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          {/* Calculations for Essences */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sepia/10">
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Теплосдвиг (°C)</label>
                              <input 
                                type="number" 
                                value={details.heatGeneration || 0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    essences: {
                                      ...arcanaConfig.essences,
                                      [essKey]: { ...details, heatGeneration: parseFloat(e.target.value) || 0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Бонус Мутации</label>
                              <input 
                                type="number" 
                                step="0.05"
                                value={details.mutationBonus || 0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    essences: {
                                      ...arcanaConfig.essences,
                                      [essKey]: { ...details, mutationBonus: parseFloat(e.target.value) || 0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Фактор Стаб.</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={details.stabilityFactor || 1.0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    essences: {
                                      ...arcanaConfig.essences,
                                      [essKey]: { ...details, stabilityFactor: parseFloat(e.target.value) || 1.0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Rarities */}
                {activeConfigSection === 'rarities' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Иерархия Редкости</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(arcanaConfig.rarities).map(([rarityKey, details]: [string, any]) => (
                        <div key={rarityKey} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <span className="font-bold text-xs text-amber-800 uppercase block">{rarityKey}</span>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Описание редкости</label>
                            <textarea 
                              rows={2}
                              value={details.desc} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  rarities: {
                                    ...arcanaConfig.rarities,
                                    [rarityKey]: { ...details, desc: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Правила и свойства</label>
                            <textarea 
                              rows={2}
                              value={details.rules} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  rarities: {
                                    ...arcanaConfig.rarities,
                                    [rarityKey]: { ...details, rules: e.target.value }
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          {/* Calculations for Rarities */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-sepia/10">
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Мин. Сложность</label>
                              <input 
                                type="number" 
                                value={details.minComplexity || 1} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    rarities: {
                                      ...arcanaConfig.rarities,
                                      [rarityKey]: { ...details, minComplexity: parseInt(e.target.value) || 1 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Расход Энергии</label>
                              <input 
                                type="number" 
                                value={details.energyCost || 10} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    rarities: {
                                      ...arcanaConfig.rarities,
                                      [rarityKey]: { ...details, energyCost: parseInt(e.target.value) || 10 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Множитель Ценности</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={details.rarityMultiplier || 1.0} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    rarities: {
                                      ...arcanaConfig.rarities,
                                      [rarityKey]: { ...details, rarityMultiplier: parseFloat(e.target.value) || 1.0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Базовый Шанс %</label>
                              <input 
                                type="number" 
                                value={details.baseChancePercent || 10} 
                                onChange={e => {
                                  setArcanaConfig({
                                    ...arcanaConfig,
                                    rarities: {
                                      ...arcanaConfig.rarities,
                                      [rarityKey]: { ...details, baseChancePercent: parseFloat(e.target.value) || 0 }
                                    }
                                  });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {/* Config Sub-Section: Ranks */}
                {activeConfigSection === 'ranks' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Ранги Алхимика ({arcanaConfig.ranks.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {arcanaConfig.ranks.map((rank, idx) => (
                        <div key={idx} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{rank.icon}</span>
                            <input 
                              type="text" 
                              value={rank.name} 
                              onChange={e => {
                                const updated = [...arcanaConfig.ranks];
                                updated[idx].name = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, ranks: updated });
                              }}
                              className="w-full font-bold text-xs p-1.5 bg-sepia/5 border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Мин. открытых элементов</label>
                            <input 
                              type="number" 
                              value={rank.min} 
                              onChange={e => {
                                const updated = [...arcanaConfig.ranks];
                                updated[idx].min = parseInt(e.target.value) || 0;
                                setArcanaConfig({ ...arcanaConfig, ranks: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Описание ранга</label>
                            <input 
                              type="text" 
                              value={rank.desc} 
                              onChange={e => {
                                const updated = [...arcanaConfig.ranks];
                                updated[idx].desc = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, ranks: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Reality Layers */}
                {activeConfigSection === 'layers' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Слои Реальности ({arcanaConfig.realityLayers.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {arcanaConfig.realityLayers.map((layer: any, idx) => (
                        <div key={idx} className="p-4 bg-white border border-sepia/15 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gold">Слой {layer.level}</span>
                            <input 
                              type="text" 
                              value={layer.name} 
                              onChange={e => {
                                const updated = [...arcanaConfig.realityLayers];
                                updated[idx].name = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                              }}
                              className="w-full font-bold text-xs p-1.5 bg-sepia/5 border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Суть слоя</label>
                            <input 
                              type="text" 
                              value={layer.desc} 
                              onChange={e => {
                                const updated = [...arcanaConfig.realityLayers];
                                updated[idx].desc = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sepia/50 font-bold uppercase block mb-1">Правила слоя</label>
                            <textarea 
                              rows={2}
                              value={layer.rules} 
                              onChange={e => {
                                const updated = [...arcanaConfig.realityLayers];
                                updated[idx].rules = e.target.value;
                                setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                              }}
                              className="w-full text-xs p-1.5 bg-white border border-sepia/10 rounded focus:border-gold outline-none"
                            />
                          </div>
                          {/* Calculations for Reality Layers */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-sepia/10">
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Макс. Temp (°C)</label>
                              <input 
                                type="number" 
                                value={layer.maxTemperature || 1000} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.realityLayers] as any[];
                                  updated[idx].maxTemperature = parseFloat(e.target.value) || 1000;
                                  setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Мин. Стабильность</label>
                              <input 
                                type="number" 
                                step="0.05"
                                value={layer.minStability || 0.1} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.realityLayers] as any[];
                                  updated[idx].minStability = parseFloat(e.target.value) || 0.1;
                                  setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Множитель Энергии</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={layer.energyMultiplier || 1.0} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.realityLayers] as any[];
                                  updated[idx].energyMultiplier = parseFloat(e.target.value) || 1.0;
                                  setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-sepia/60 font-bold uppercase block mb-0.5">Мин. Уровень Доступа</label>
                              <input 
                                type="number" 
                                value={layer.unlockLevel || layer.level} 
                                onChange={e => {
                                  const updated = [...arcanaConfig.realityLayers] as any[];
                                  updated[idx].unlockLevel = parseInt(e.target.value) || 1;
                                  setArcanaConfig({ ...arcanaConfig, realityLayers: updated });
                                }}
                                className="w-full text-xs p-1 bg-sepia/5 border border-sepia/15 rounded font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Calculator Chances */}
                {activeConfigSection === 'calc' && (
                  <div className="space-y-4">
                    <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">Базовые Шансы Выпадения Редкости (%)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Object.entries(arcanaConfig.calculatorChances).map(([rarityKey, chanceVal]) => (
                        <div key={rarityKey} className="p-3 bg-white border border-sepia/15 rounded-xl space-y-1">
                          <label className="text-[10px] font-bold text-sepia uppercase block truncate">{rarityKey}</label>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              step="0.01"
                              value={chanceVal} 
                              onChange={e => {
                                setArcanaConfig({
                                  ...arcanaConfig,
                                  calculatorChances: {
                                    ...arcanaConfig.calculatorChances,
                                    [rarityKey]: parseFloat(e.target.value) || 0
                                  }
                                });
                              }}
                              className="w-full text-xs p-1.5 bg-sepia/5 border border-sepia/10 rounded focus:border-gold outline-none font-mono"
                            />
                            <span className="text-xs font-bold text-sepia/50">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Config Sub-Section: Spells Database */}
                {activeConfigSection === 'spells' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sepia/10 pb-3">
                      <div>
                        <h4 className="font-gothic text-sm tracking-widest text-sepia uppercase">База Данных Заклинаний в БД ({adminSpells.length} шт)</h4>
                        <p className="text-xs text-sepia/60">Все заклинания хранятся непосредственно в базе данных и считываются нейросетью трансмутаций</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetSpells}
                          className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 active:scale-95"
                          title="Загрузить или восстановить базовые латинские заклинания в БД"
                        >
                          <RefreshCw size={13} /> Загрузить базовые (LATIN_SPELLS) в БД
                        </button>
                        {spellsSavedStatus && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded shadow">
                            {spellsSavedStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add New Spell Form */}
                    <form onSubmit={handleAddSpell} className="p-4 bg-gold/5 border border-gold/20 rounded-xl space-y-4">
                      <h5 className="font-gothic text-xs tracking-widest text-sepia uppercase font-bold">Добавить Новое Заклинание в БД</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Латинское название</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Например: Ignis Flamma" 
                            value={newSpellTitle} 
                            onChange={e => setNewSpellTitle(e.target.value)} 
                            className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Перевод / Имя</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Пламя Огня..." 
                            value={newSpellTrans} 
                            onChange={e => setNewSpellTrans(e.target.value)} 
                            className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Категория</label>
                          <select 
                            value={newSpellCategory} 
                            onChange={e => setNewSpellCategory(e.target.value)}
                            className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                          >
                            <option value="Стихии">Стихии</option>
                            <option value="Жизнь и Смерть">Жизнь и Смерть</option>
                            <option value="Космос и Время">Космос и Время</option>
                            <option value="Разум и Дух">Разум и Дух</option>
                            <option value="Сила и Изменение">Сила и Изменение</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-sepia uppercase block mb-1">Описание действия</label>
                          <input 
                            type="text" 
                            placeholder="Увеличивает шансы огненных гибридов..." 
                            value={newSpellDesc} 
                            onChange={e => setNewSpellDesc(e.target.value)} 
                            className="w-full p-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none" 
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button 
                          type="submit" 
                          className="px-5 py-2 bg-gold text-white text-xs font-bold uppercase tracking-wider rounded shadow hover:bg-gold-dark transition-all flex items-center gap-1.5"
                        >
                          <Plus size={14} /> Сохранить в Базу Данных
                        </button>
                      </div>
                    </form>

                    {/* Spells List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {adminSpells.map((spell) => (
                        <div key={spell.id} className="p-3 bg-white border border-sepia/15 rounded-xl space-y-2 relative group">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-mono font-bold text-xs text-gold block">{spell.name}</span>
                              <span className="text-[11px] font-bold text-sepia block">{spell.translation}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteSpell(spell.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors shrink-0"
                              title="Удалить из БД"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <span className="inline-block text-[9px] font-bold uppercase bg-sepia/5 text-sepia/70 px-2 py-0.5 rounded">
                            {spell.category}
                          </span>
                          <p className="text-[10px] text-sepia/60 leading-snug">{spell.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ==================================== ROLE MANAGEMENT SUBPAGE ==================================== */}
          {activeTab === 'role' && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="parchment-card p-5 border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                  <ShieldAlert className="text-amber-600 shrink-0" size={24} />
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-amber-800 uppercase mb-1">Контроль Священного Синода</h3>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Внимание! Роль пользователя определяет его права во Вселенной AIhim. Только Высшие Администраторы могут возводить пользователей в ранг Админов или разжаловать их до Помощников (Менеджеров) или Обычных Искателей (Пользователей). Будьте благоразумны.
                    </p>
                  </div>
                </div>
              </div>

              {/* Roles Editor Grid */}
              <div className="parchment-card p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-sepia/10">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">РЕДАКТИРОВАНИЕ ПРИВИЛЕГИЙ</h3>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Поиск */}
                    <div className="relative flex-1 sm:w-64">
                      <Search size={14} className="absolute left-3 top-2.5 text-sepia/40" />
                      <input 
                        type="text" 
                        placeholder="Поиск по имени/username/ID..." 
                        value={roleSearch}
                        onChange={e => setRoleSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                      />
                    </div>
                    {/* Фильтр ролей */}
                    <select
                      value={roleFilter}
                      onChange={e => setRoleFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-sepia/20 rounded outline-none focus:border-gold shrink-0"
                    >
                      <option value="all">Все роли</option>
                      <option value="admin">Админы</option>
                      <option value="manager">Менеджеры</option>
                      <option value="user">Пользователи</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredRoleUsers.map(user => (
                    <div key={user.id} className="p-4 bg-white rounded-xl border border-sepia/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <img src={user.avatar} className="w-10 h-10 rounded-full object-cover border border-sepia/10" alt={user.fullName} referrerPolicy="no-referrer" />
                        <div>
                          <h4 className="text-xs font-bold text-sepia">{user.fullName} <span className="text-[10px] text-sepia/40 font-mono">(ID: {user.id})</span></h4>
                          <p className="text-[10px] text-gold font-mono">{user.username}</p>
                        </div>
                      </div>
 
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider mr-2">Роль:</span>
                        <button
                          onClick={() => handleRoleChange(user.id, 'user')}
                          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                            user.role === 'user' 
                              ? 'bg-gray-800 text-white shadow-sm' 
                              : 'bg-sepia/10 text-sepia hover:bg-sepia/15'
                          }`}
                        >
                          Пользователь
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, 'manager')}
                          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                            user.role === 'manager' 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-sepia/10 text-sepia hover:bg-sepia/15'
                          }`}
                        >
                          Менеджер
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                            user.role === 'admin' 
                              ? 'bg-purple-700 text-white shadow-sm' 
                              : 'bg-sepia/10 text-sepia hover:bg-sepia/15'
                          }`}
                        >
                          Админ
                        </button>
                        <button
                          onClick={() => setEditingUser({ ...user })}
                          className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 transition-all flex items-center gap-1"
                          title="Редактировать данные пользователя"
                        >
                          <Edit2 size={11} />
                          Правка
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded bg-rose-100 hover:bg-rose-200 text-rose-800 transition-all flex items-center gap-1"
                          title="Безвозвратно удалить из БД (все роли и данные)"
                        >
                          <Trash2 size={11} />
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredRoleUsers.length === 0 && (
                    <div className="text-center py-12 text-sepia/40 italic">
                      Пользователи по вашему запросу не найдены.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================================== TOKEN & BOT SETTINGS SUBPAGE ==================================== */}
          {activeTab === 'token' && (
            <motion.div
              key="token"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <AppVersionControl readOnly={currentUser.role !== 'admin'} />

              <form onSubmit={handleSaveBotSettings} className="parchment-card p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-sepia/10 pb-3">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">СИСТЕМНЫЕ КЛЮЧИ И СВЯЗЬ</h3>
                  <AnimatePresence>
                    {settingsSaved && (
                      <motion.span 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider"
                      >
                        Сохранено успешно!
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Telegram Bot */}
                  <div className="flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gold border-b border-gold/10 pb-1">Телеграм Бот Авторизации</h4>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Имя Бота (Bot Username)</label>
                      <input 
                        type="text" 
                        value={botUsername} 
                        onChange={e => setBotUsername(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Токен Бота (Bot Token API)</label>
                      <input 
                        type="password" 
                        value={botToken} 
                        onChange={e => setBotToken(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="checkbox" 
                        id="regEnabled" 
                        checked={registrationEnabled} 
                        onChange={e => setRegistrationEnabled(e.target.checked)}
                        className="accent-gold h-4 w-4"
                      />
                      <label htmlFor="regEnabled" className="text-xs text-sepia font-bold uppercase tracking-wider cursor-pointer select-none">
                        Разрешить регистрацию
                      </label>
                    </div>
                  </div>

                  {/* ProTalk API */}
                  <div className="flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gold border-b border-gold/10 pb-1">Интеграция ProTalk (Связь и AI)</h4>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Токен ProTalk (ProTalk API Token)</label>
                      <input 
                        type="password" 
                        value={proTalkToken} 
                        onChange={e => setProTalkToken(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Ссылка API ProTalk (API Endpoint)</label>
                      <input 
                        type="text" 
                        value={proTalkApiUrl} 
                        onChange={e => setProTalkApiUrl(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">ID сотрудника / ID бота (employee_id / bot_id)</label>
                      <input 
                        type="text" 
                        value={employeeId} 
                        onChange={e => setEmployeeId(e.target.value)}
                        className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Robokassa с фискализацией 54-ФЗ и номенклатурой по оферте */}
                  <div className="flex flex-col gap-4 p-4 rounded-2xl border border-gold/20 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gold/15 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🫧</span>
                        <h4 className="text-sm font-semibold text-gold">Робокасса и фискализация чеков 54-ФЗ</h4>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold text-sm font-medium">
                        🍃 Онлайн-касса РФ
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-sepia/20 bg-white/5 backdrop-blur-sm text-sm text-sepia/90 flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">🍃</span>
                        <div>
                          Параметр <b>Receipt</b> формируется автоматически на всю сумму платежа (одна позиция) по правилам 54-ФЗ и договору оферты.
                        </div>
                      </div>
                      <div className="text-sm text-sepia/75 pl-6 space-y-1">
                        <div>• В подпись передаётся сырой JSON чека: <code className="bg-black/20 px-1.5 py-0.5 rounded text-gold break-all font-mono">MerchantLogin:OutSum:InvId:Receipt:Пароль1:Shp_...</code></div>
                        <div>• В платёжную ссылку передаётся один раз закодированный JSON (<code className="bg-black/20 px-1.5 py-0.5 rounded font-mono">encodeURIComponent</code>), что исключает ошибку 29.</div>
                        <div>• Предмет и способ расчёта Робокасса берёт из настроек личного кабинета.</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                        <span>🫧</span> Магазин Робокасса (Merchant Login)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Например: aihim"
                        value={robokassaMerchantLogin} 
                        onChange={e => setRobokassaMerchantLogin(e.target.value)}
                        className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none font-mono text-sepia backdrop-blur-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                          <span>🍃</span> Пароль 1 (для инициализации оплаты)
                        </label>
                        <input 
                          type="password" 
                          placeholder="••••••••••••••"
                          value={robokassaPass1} 
                          onChange={e => setRobokassaPass1(e.target.value)}
                          className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none font-mono text-sepia backdrop-blur-sm"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                          <span>🍃</span> Пароль 2 (для проверки Result URL)
                        </label>
                        <input 
                          type="password" 
                          placeholder="••••••••••••••"
                          value={robokassaPass2} 
                          onChange={e => setRobokassaPass2(e.target.value)}
                          className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none font-mono text-sepia backdrop-blur-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                        <span>🫧</span> Наименование позиции в чеке (дословно из оферты)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Виртуальная игровая энергия AiHim"
                        value={robokassaReceiptItemName} 
                        onChange={e => setRobokassaReceiptItemName(e.target.value)}
                        className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none text-sepia backdrop-blur-sm font-medium"
                      />
                      <span className="text-sm text-sepia/60">
                        По умолчанию: «Виртуальная игровая энергия AiHim». В чек передаётся 1 позиция с количеством 1 и суммой равной OutSum.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                        <span>🍃</span> Ставка налога (тег 1199 в чеке по 54-ФЗ)
                      </label>
                      <select 
                        value={robokassaReceiptTax} 
                        onChange={e => setRobokassaReceiptTax(e.target.value)}
                        className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none text-sepia backdrop-blur-sm"
                      >
                        <option value="none" className="bg-[#1a1b1e] text-sepia">none — Без НДС (обязательное значение по 54-ФЗ для УСН и спецрежимов без НДС)</option>
                        <option value="vat0" className="bg-[#1a1b1e] text-sepia">vat0 — Ставка НДС 0%</option>
                        <option value="vat5" className="bg-[#1a1b1e] text-sepia">vat5 — Ставка НДС 5%</option>
                        <option value="vat7" className="bg-[#1a1b1e] text-sepia">vat7 — Ставка НДС 7%</option>
                        <option value="vat10" className="bg-[#1a1b1e] text-sepia">vat10 — Ставка НДС 10%</option>
                        <option value="vat20" className="bg-[#1a1b1e] text-sepia">vat20 — Ставка НДС 20%</option>
                      </select>
                      <span className="text-sm text-sepia/60">
                        По закону 54-ФЗ при отсутствии НДС передаётся значение «none». Без указания ставки налоговый регистратор отклоняет номенклатуру чека в статус «Свободная продажа».
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-sepia/80 font-medium flex items-center gap-1.5">
                        <span>🫧</span> Система налогообложения (СНО)
                      </label>
                      <select 
                        value={robokassaSno} 
                        onChange={e => setRobokassaSno(e.target.value)}
                        className="px-3.5 py-2.5 text-sm bg-transparent border border-sepia/20 rounded-xl focus:border-gold outline-none text-sepia backdrop-blur-sm"
                      >
                        <option value="" className="bg-[#1a1b1e] text-sepia">По умолчанию из настроек личного кабинета Робокассы</option>
                        <option value="usn_income" className="bg-[#1a1b1e] text-sepia">usn_income — Упрощенная СНО (доходы)</option>
                        <option value="usn_income_outcome" className="bg-[#1a1b1e] text-sepia">usn_income_outcome — Упрощенная СНО (доходы минус расходы)</option>
                        <option value="patent" className="bg-[#1a1b1e] text-sepia">patent — Патентная система</option>
                        <option value="osn" className="bg-[#1a1b1e] text-sepia">osn — Общая система налогообложения</option>
                      </select>
                      <span className="text-sm text-sepia/60">
                        Если не выбрано, Робокасса применяет СНО из вкладки «Фискализация» вашего личного кабинета.
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-sepia/20 bg-white/5 backdrop-blur-sm mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🫧</span>
                        <div>
                          <div className="text-sm text-sepia font-medium">Тестовый режим оплаты</div>
                          <div className="text-sm text-sepia/60">Платежи обрабатываются через тестовый шлюз Робокассы</div>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        id="roboIsTest" 
                        checked={robokassaIsTest} 
                        onChange={e => setRobokassaIsTest(e.target.checked)}
                        className="accent-gold h-5 w-5 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 border-t border-sepia/10 pt-4">
                  <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Приветственное сообщение бота</label>
                  <textarea 
                    value={welcomeMessage} 
                    onChange={e => setWelcomeMessage(e.target.value)}
                    rows={3}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-sepia/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sepia">Напоминания неактивным пользователям (раз в неделю)</h4>
                      <p className="text-[11px] text-sepia/70">Автоматическая рассылка напоминаний в личные сообщения неактивным ученикам</p>
                    </div>
                    <input 
                      type="checkbox" 
                      id="inactiveReminderEnabled" 
                      checked={inactiveReminderEnabled} 
                      onChange={e => setInactiveReminderEnabled(e.target.checked)}
                      className="accent-gold h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {inactiveReminderEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-paper-light p-3 rounded border border-sepia/10 mt-1">
                      <div className="flex flex-col gap-1 md:col-span-1">
                        <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Порог неактивности (дней)</label>
                        <input 
                          type="number" 
                          value={inactiveDaysThreshold} 
                          onChange={e => setInactiveDaysThreshold(Number(e.target.value))}
                          min={1}
                          className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Текст еженедельного напоминания</label>
                        <textarea 
                          value={inactiveReminderMessage} 
                          onChange={e => setInactiveReminderMessage(e.target.value)}
                          rows={2}
                          className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-2">
                  <button 
                    type="submit" 
                    className="px-8 py-3 bg-gold text-ink font-bold uppercase tracking-widest rounded-lg hover:bg-gold-light transition-all shadow-md text-xs active:scale-95"
                  >
                    Сохранить настройки
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ==================================== MAILING & REMINDERS SUBPAGE ==================================== */}
          {activeTab === 'mailing' && (
            <motion.div
              key="mailing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="parchment-card p-5 border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                  <Bell className="text-amber-600 shrink-0" size={24} />
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-amber-800 uppercase mb-1">Центр Уведомлений и Рассылок</h3>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Система автоматически раз в неделю отправляет случайное напоминание из 5 шаблонов пользователям, не заходившим в игру более 7 дней. Вы также можете запускать ручные массовые рассылки и настраивать персональные разрешения для каждого алхимика.
                    </p>
                  </div>
                </div>
              </div>

              {/* 5 Templates Grid */}
              <div className="parchment-card p-5">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-sepia/10">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase flex items-center gap-2">
                    <MessageSquare size={16} className="text-gold" />
                    Шаблоны Еженедельных Напоминаний (5 шт)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reminderTemplates.map((template) => (
                    <div key={template.id} className="p-4 bg-white rounded-xl border border-sepia/10 flex flex-col justify-between gap-3 shadow-sm hover:border-gold/30 transition-all">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded">
                            {template.title}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSendTestNotification(template.text, template.title)}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded flex items-center gap-1 transition shadow-sm"
                              title="Тестовая отправка в Telegram админу 169262990"
                            >
                              <span>🧪</span> Тест
                            </button>
                            <button 
                              onClick={() => setEditingTemplate(template)}
                              className="p-1 text-sepia/50 hover:text-gold transition-colors"
                              title="Редактировать шаблон"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-sepia/80 whitespace-pre-wrap leading-relaxed font-sans bg-parchment/40 p-3 rounded border border-sepia/5">
                          "{template.text}"
                        </p>
                      </div>

                      <div className="pt-2 border-t border-sepia/5 space-y-1.5">
                        <div className="text-[10px] text-sepia/40 uppercase font-bold mb-1">Инлайн-кнопка:</div>
                        <div className="flex items-center justify-between text-xs bg-gold/5 p-2 rounded border border-gold/10">
                          <span className="font-bold text-sepia truncate">{template.buttonText}</span>
                          <span className="text-[10px] text-gold/80 font-mono truncate max-w-[120px]">{template.buttonUrl}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {testSendingStatus && (
                <div className="p-3 bg-amber-100/80 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex items-center justify-between">
                  <span>{testSendingStatus}</span>
                  <button onClick={() => setTestSendingStatus(null)} className="text-amber-900 hover:opacity-75">✕</button>
                </div>
              )}

              {/* Mass Mailing Setup: Filters & Selected User Checkboxes */}
              <div className="parchment-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sepia/10 pb-3">
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase flex items-center gap-2">
                      <Users size={16} className="text-gold" />
                      Выбор Получателей Рассылки (Фильтры и Галочки)
                    </h3>
                    <p className="text-xs text-sepia/60">Отметьте конкретных пользователей или выберите всю группу по фильтру</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-sepia font-mono bg-amber-100/60 px-3 py-1.5 rounded-xl border border-amber-300/50">
                    <span>Выбрано для отправки:</span>
                    <span className="text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
                      {selectedMailingUserIds.length > 0 ? selectedMailingUserIds.length : `Все (${users.length})`}
                    </span>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-sepia/40" size={14} />
                    <input
                      type="text"
                      placeholder="Поиск по имени, @username или ID..."
                      value={mailingSearch}
                      onChange={e => setMailingSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none"
                    />
                  </div>

                  <select
                    value={mailingRoleFilter}
                    onChange={e => setMailingRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-bold text-sepia"
                  >
                    <option value="all">Все роли (Админы, Менеджеры, Алхимики)</option>
                    <option value="admin">Только Администраторы</option>
                    <option value="manager">Только Менеджеры</option>
                    <option value="user">Только Пользователи</option>
                  </select>

                  <select
                    value={mailingStatusFilter}
                    onChange={e => setMailingStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-bold text-sepia"
                  >
                    <option value="all">Все статусы активности</option>
                    <option value="active">Только активные (Заходили недавно)</option>
                    <option value="inactive">Неактивные (&gt;7 дней не заходили)</option>
                  </select>
                </div>

                {/* User Table with Sorting and Header Filtering */}
                {(() => {
                  const filteredMailingUsers = users.filter(u => {
                    const matchSearch = u.fullName.toLowerCase().includes(mailingSearch.toLowerCase()) ||
                      u.username.toLowerCase().includes(mailingSearch.toLowerCase()) ||
                      u.id.includes(mailingSearch);
                    const matchRole = mailingRoleFilter === 'all' || u.role === mailingRoleFilter;
                    const isInactive = (Date.now() - u.lastActive) > 7 * 24 * 3600 * 1000;
                    const matchStatus = mailingStatusFilter === 'all' || 
                      (mailingStatusFilter === 'inactive' && isInactive) ||
                      (mailingStatusFilter === 'active' && !isInactive);
                    return matchSearch && matchRole && matchStatus;
                  });

                  const sortedMailingUsers = [...filteredMailingUsers].sort((a, b) => {
                    let valA: any = a[mailingSortField as keyof AppUser];
                    let valB: any = b[mailingSortField as keyof AppUser];
                    if (mailingSortField === 'status') {
                      valA = (Date.now() - a.lastActive) > 7 * 24 * 3600 * 1000 ? 'inactive' : 'active';
                      valB = (Date.now() - b.lastActive) > 7 * 24 * 3600 * 1000 ? 'inactive' : 'active';
                    }
                    if (typeof valA === 'string') {
                      return mailingSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    }
                    return mailingSortOrder === 'asc' ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
                  });

                  const isAllFilteredSelected = sortedMailingUsers.length > 0 && 
                    sortedMailingUsers.every(u => selectedMailingUserIds.includes(u.id));

                  const toggleSort = (field: 'fullName' | 'id' | 'role' | 'status' | 'balance') => {
                    if (mailingSortField === field) {
                      setMailingSortOrder(mailingSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setMailingSortField(field);
                      setMailingSortOrder('asc');
                    }
                  };

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-sepia select-none">
                          <input
                            type="checkbox"
                            checked={isAllFilteredSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                const allFilteredIds = sortedMailingUsers.map(u => u.id);
                                const merged = Array.from(new Set([...selectedMailingUserIds, ...allFilteredIds]));
                                setSelectedMailingUserIds(merged);
                              } else {
                                const filteredIdsSet = new Set(sortedMailingUsers.map(u => u.id));
                                setSelectedMailingUserIds(selectedMailingUserIds.filter(id => !filteredIdsSet.has(id)));
                              }
                            }}
                            className="accent-amber-800 w-4 h-4 rounded"
                          />
                          <span>Выбрать всех из таблицы ({sortedMailingUsers.length} чел.)</span>
                        </label>

                        {selectedMailingUserIds.length > 0 && (
                          <button
                            onClick={() => setSelectedMailingUserIds([])}
                            className="text-[11px] text-amber-900 hover:underline font-bold"
                          >
                            Сбросить выбор ({selectedMailingUserIds.length})
                          </button>
                        )}
                      </div>

                      {/* User Table Container */}
                      <div className="overflow-x-auto border border-sepia/15 rounded-xl bg-white shadow-sm max-h-[320px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-amber-50/90 sticky top-0 z-10 border-b border-sepia/20 shadow-xs">
                            <tr className="text-sepia/70 uppercase tracking-wider font-bold text-[10px]">
                              <th className="py-2 px-3 text-center w-10">
                                <input
                                  type="checkbox"
                                  checked={isAllFilteredSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      const allFilteredIds = sortedMailingUsers.map(u => u.id);
                                      setSelectedMailingUserIds(Array.from(new Set([...selectedMailingUserIds, ...allFilteredIds])));
                                    } else {
                                      const filteredIdsSet = new Set(sortedMailingUsers.map(u => u.id));
                                      setSelectedMailingUserIds(selectedMailingUserIds.filter(id => !filteredIdsSet.has(id)));
                                    }
                                  }}
                                  className="accent-amber-800 w-3.5 h-3.5 rounded"
                                />
                              </th>
                              <th 
                                onClick={() => toggleSort('fullName')}
                                className="py-2.5 px-3 cursor-pointer hover:bg-amber-100/60 transition-colors select-none"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Пользователь</span>
                                  <ArrowUpDown size={12} className={mailingSortField === 'fullName' ? 'text-amber-800 font-bold' : 'opacity-40'} />
                                </div>
                              </th>
                              <th 
                                onClick={() => toggleSort('id')}
                                className="py-2.5 px-3 cursor-pointer hover:bg-amber-100/60 transition-colors select-none"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Telegram ID</span>
                                  <ArrowUpDown size={12} className={mailingSortField === 'id' ? 'text-amber-800 font-bold' : 'opacity-40'} />
                                </div>
                              </th>
                              <th className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <span onClick={() => toggleSort('role')} className="cursor-pointer hover:underline flex items-center gap-1">
                                    <span>Роль</span>
                                    <ArrowUpDown size={12} className={mailingSortField === 'role' ? 'text-amber-800 font-bold' : 'opacity-40'} />
                                  </span>
                                  <select
                                    value={mailingRoleFilter}
                                    onChange={e => setMailingRoleFilter(e.target.value)}
                                    className="ml-1 text-[9px] bg-white border border-sepia/20 rounded px-1 py-0.5 outline-none font-bold text-amber-950"
                                  >
                                    <option value="all">Все</option>
                                    <option value="admin">Админ</option>
                                    <option value="manager">Менеджер</option>
                                    <option value="user">Игрок</option>
                                  </select>
                                </div>
                              </th>
                              <th className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <span onClick={() => toggleSort('status')} className="cursor-pointer hover:underline flex items-center gap-1">
                                    <span>Статус</span>
                                    <ArrowUpDown size={12} className={mailingSortField === 'status' ? 'text-amber-800 font-bold' : 'opacity-40'} />
                                  </span>
                                  <select
                                    value={mailingStatusFilter}
                                    onChange={e => setMailingStatusFilter(e.target.value)}
                                    className="ml-1 text-[9px] bg-white border border-sepia/20 rounded px-1 py-0.5 outline-none font-bold text-amber-950"
                                  >
                                    <option value="all">Все</option>
                                    <option value="active">Активен</option>
                                    <option value="inactive">Неактивен</option>
                                  </select>
                                </div>
                              </th>
                              <th 
                                onClick={() => toggleSort('balance')}
                                className="py-2.5 px-3 cursor-pointer hover:bg-amber-100/60 transition-colors select-none text-right"
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <span>Баланс AiHim</span>
                                  <ArrowUpDown size={12} className={mailingSortField === 'balance' ? 'text-amber-800 font-bold' : 'opacity-40'} />
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sepia/10">
                            {sortedMailingUsers.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center text-sepia/50 italic">
                                  Пользователи не найдены
                                </td>
                              </tr>
                            ) : (
                              sortedMailingUsers.map(u => {
                                const isSelected = selectedMailingUserIds.includes(u.id);
                                const isInactive = (Date.now() - u.lastActive) > 7 * 24 * 3600 * 1000;
                                return (
                                  <tr 
                                    key={u.id}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedMailingUserIds(selectedMailingUserIds.filter(id => id !== u.id));
                                      } else {
                                        setSelectedMailingUserIds([...selectedMailingUserIds, u.id]);
                                      }
                                    }}
                                    className={`cursor-pointer transition-colors ${
                                      isSelected ? 'bg-amber-100/70' : 'hover:bg-amber-50/50'
                                    }`}
                                  >
                                    <td className="py-2 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="accent-amber-800 w-3.5 h-3.5 rounded"
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-2">
                                        <UserAvatar src={u.avatar} alt={u.fullName} size="xs" />
                                        <div>
                                          <div className="font-bold text-sepia">{u.fullName}</div>
                                          <div className="text-[10px] text-sepia/50">{u.username}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[11px] text-sepia/70">
                                      {u.id}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                        u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {u.role}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                        isInactive ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {isInactive ? 'Неактивен (>7д)' : 'Активен'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-950">
                                      {u.balance?.toLocaleString() || 0}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Manual Mass Mailing Form & Per-User Reminders */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mass Mail Form */}
                <div className="parchment-card p-5 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase mb-3 flex items-center justify-between border-b border-sepia/10 pb-2">
                      <span className="flex items-center gap-2">
                        <Send size={16} className="text-gold" />
                        Мгновенная Пакетная Рассылка
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {selectedMailingUserIds.length > 0 ? `Адресатов: ${selectedMailingUserIds.length}` : 'Все пользователям'}
                      </span>
                    </h3>

                    <form onSubmit={handleSendMassMail} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Текст сообщения рассылки</label>
                        <textarea 
                          value={massMailMessage}
                          onChange={e => setMassMailMessage(e.target.value)}
                          placeholder="Введите текст рассылки..."
                          rows={4}
                          required
                          className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Текст на кнопке</label>
                          <input 
                            type="text" 
                            value={massMailButtonText}
                            onChange={e => setMassMailButtonText(e.target.value)}
                            placeholder="Например: Открыть Играть"
                            className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-sepia/60 font-bold uppercase tracking-wider">Ссылка кнопки</label>
                          <input 
                            type="text" 
                            value={massMailButtonUrl}
                            onChange={e => setMassMailButtonUrl(e.target.value)}
                            placeholder="https://t.me/your_bot/app"
                            className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-mono"
                          />
                        </div>
                      </div>

                      {/* Packet / Batch size */}
                      <div className="flex items-center justify-between bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60 text-xs">
                        <span className="font-bold text-sepia">Размер пакета отправки (пользователей в батче):</span>
                        <select
                          value={batchSize}
                          onChange={e => setBatchSize(Number(e.target.value))}
                          className="px-2.5 py-1 bg-white border border-sepia/20 rounded-lg text-xs font-bold text-amber-950 font-mono"
                        >
                          <option value={10}>10 пользователей / батч</option>
                          <option value={20}>20 пользователей / батч</option>
                          <option value={50}>50 пользователей / батч</option>
                          <option value={100}>100 пользователей / батч</option>
                        </select>
                      </div>

                      {massMailStatus && (
                        <div className={`p-2.5 rounded-xl text-xs font-bold ${massMailStatus.includes('Ошибка') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {massMailStatus}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <button 
                          type="button"
                          onClick={() => handleSendTestNotification(massMailMessage, 'Тест Рассылки')}
                          className="px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                          title="Отправит тестовую копию сообщения админу Telegram 169262990"
                        >
                          <span>🧪</span> Тест Админу (169262990)
                        </button>

                        <button 
                          type="submit" 
                          disabled={massMailSending}
                          className="flex-1 py-3 bg-gold text-ink font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-gold-light transition-all shadow flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                          {massMailSending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                          {massMailSending ? 'Отправка пакетами...' : 'Запустить Пакетную Рассылку'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Per-User Reminders Preferences */}
                <div className="parchment-card p-5 flex flex-col gap-4">
                  <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase flex items-center gap-2 border-b border-sepia/10 pb-2">
                    <Users size={16} className="text-gold" />
                    Персональный Допуск Напоминаний
                  </h3>

                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                    {users.map(user => {
                      const enabled = user.remindersEnabled !== false;
                      return (
                        <div key={user.id} className="p-3 bg-white rounded-xl border border-sepia/10 flex items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar src={user.avatar} alt={user.fullName} size="sm" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-sepia truncate">{user.fullName}</h4>
                              <p className="text-[10px] text-sepia/50 font-mono truncate">{user.username} (ID: {user.id})</p>
                              <p className="text-[10px] text-amber-900/70 font-mono truncate">
                                ⏰ След. отправка: {
                                  user.status === 'bot_blocked'
                                    ? '🚫 Бот заблокирован'
                                    : !enabled
                                    ? '⏸ Отключено'
                                    : (user as any).nextReminderAt
                                    ? new Date((user as any).nextReminderAt).toLocaleDateString() + ' ' + new Date((user as any).nextReminderAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                                    : 'Через 7 дней неактивности'
                                }
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleUserReminders(user.id, enabled)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 ${
                              enabled 
                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            {enabled ? 'Включено' : 'Выключено'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Live Dispatch Stream Block (ABOVE HISTORY) */}
              <div className="parchment-card p-5 border-amber-500/30 bg-amber-50/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sepia/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">
                      Процесс и Живой Статус Отправки (Real-Time Stream)
                    </h3>
                  </div>

                  {liveStreamLogs.length > 0 && (
                    <button
                      onClick={() => setLiveStreamLogs([])}
                      className="text-[10px] text-sepia/50 hover:text-sepia underline font-mono self-end sm:self-auto"
                    >
                      Очистить поток ({liveStreamLogs.length})
                    </button>
                  )}
                </div>

                {liveStreamLogs.length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {liveStreamLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-white rounded-xl border border-sepia/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs text-xs font-mono">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {log.status === 'success' ? '✅ УСПЕШНО' : '❌ ОШИБКА'}
                          </span>
                          <span className="font-bold text-amber-950 truncate">
                            {log.recipientName || log.recipientUsername || `ID: ${log.recipientId}`}
                          </span>
                          <span className="text-[10px] text-sepia/50 hidden md:inline">
                            (ID: {log.recipientId})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-sepia/70 truncate max-w-[200px] italic">
                            "{log.messageText || log.templateTitle || 'Сообщение'}"
                          </span>
                          <span className="text-[10px] text-sepia/40 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-sepia/50 italic bg-white/50 rounded-xl border border-dashed border-sepia/20">
                    ⚡ Нажмите «Запустить Пакетную Рассылку» или «Запустить авто-рассылку неактивным», чтобы увидеть живые статусы доставки каждому пользователю в реальном времени.
                  </div>
                )}
              </div>

              {/* Enhanced Persistent PostgreSQL History Log Table with Pagination */}
              <div className="parchment-card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-sepia/10 pb-3">
                  <div>
                    <h3 className="font-gothic text-sm tracking-widest text-sepia uppercase">
                      История и Журнал Отправки Рассылок
                    </h3>
                    <p className="text-xs text-sepia/60">
                      Сохраняется навсегда в базе PostgreSQL. Фильтрация, сортировка, постраничный просмотр и повторная отправка.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedHistoryLogIds.length > 0 && (
                      <button
                        onClick={handleResendSelected}
                        disabled={isResending}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-emerald-50 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                      >
                        {isResending ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                        🔄 Повторить рассылку выбранным ({selectedHistoryLogIds.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Controls: Search, Status Filter, Sorting, Page Size Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Поиск по ID, имени, тексту..."
                      value={historySearch}
                      onChange={e => {
                        setHistorySearch(e.target.value);
                        setHistoryPage(1);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none"
                    />
                  </div>

                  <div>
                    <select
                      value={historyStatusFilter}
                      onChange={e => {
                        setHistoryStatusFilter(e.target.value as any);
                        setHistoryPage(1);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-bold text-sepia"
                    >
                      <option value="all">Все статусы (Успешные и Ошибки)</option>
                      <option value="success">Только доставленные (Успешно)</option>
                      <option value="failed">Только с ошибками</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={`${historySortField}-${historySortOrder}`}
                      onChange={e => {
                        const [f, o] = e.target.value.split('-');
                        setHistorySortField(f as any);
                        setHistorySortOrder(o as any);
                        setHistoryPage(1);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-bold text-sepia"
                    >
                      <option value="timestamp-desc">Сортировка: Новые сначала</option>
                      <option value="timestamp-asc">Сортировка: Старые сначала</option>
                      <option value="recipient-asc">Сортировка: По получателю (А-Я)</option>
                      <option value="status-desc">Сортировка: Сначала ошибки</option>
                    </select>
                  </div>

                  {/* Page Size Selector */}
                  <div>
                    <select
                      value={historyPageSize}
                      onChange={e => {
                        setHistoryPageSize(Number(e.target.value));
                        setHistoryPage(1);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-sepia/20 rounded-xl focus:border-gold outline-none font-bold text-amber-900"
                    >
                      <option value={20}>Показывать по 20 строк</option>
                      <option value={100}>Показывать по 100 строк</option>
                      <option value={500}>Показывать по 500 строк</option>
                    </select>
                  </div>
                </div>

                {/* Table Logic with Pagination */}
                {(() => {
                  // Merge server logs + live logs + fallback mock logs
                  const map = new Map<string, any>();
                  for (const log of serverMailingLogs) {
                    map.set(log.id, log);
                  }
                  for (const log of liveStreamLogs) {
                    if (!map.has(log.id)) {
                      map.set(log.id, log);
                    }
                  }
                  if (map.size === 0 && mailingLogs.length > 0) {
                    for (const m of mailingLogs) {
                      for (const u of users) {
                        const fallbackId = `${m.id}-${u.id}`;
                        map.set(fallbackId, {
                          id: fallbackId,
                          timestamp: m.timestamp,
                          recipientId: u.id,
                          recipientName: u.fullName,
                          recipientUsername: u.username,
                          messageText: m.text,
                          status: 'success',
                          errorMsg: null
                        });
                      }
                    }
                  }
                  const allLogsList = Array.from(map.values());

                  const filtered = allLogsList.filter(item => {
                    if (historyStatusFilter !== 'all' && item.status !== historyStatusFilter) return false;
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      String(item.recipientId || '').toLowerCase().includes(q) ||
                      String(item.recipientName || '').toLowerCase().includes(q) ||
                      String(item.recipientUsername || '').toLowerCase().includes(q) ||
                      String(item.messageText || '').toLowerCase().includes(q) ||
                      String(item.errorMsg || '').toLowerCase().includes(q)
                    );
                  }).sort((a, b) => {
                    if (historySortField === 'timestamp') {
                      return historySortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
                    }
                    if (historySortField === 'recipient') {
                      const nameA = String(a.recipientName || a.recipientId);
                      const nameB = String(b.recipientName || b.recipientId);
                      return historySortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
                    }
                    if (historySortField === 'status') {
                      return historySortOrder === 'asc' ? String(a.status).localeCompare(String(b.status)) : String(b.status).localeCompare(String(a.status));
                    }
                    return 0;
                  });

                  const totalCount = filtered.length;
                  const totalPages = Math.max(1, Math.ceil(totalCount / historyPageSize));
                  const currentPage = Math.min(Math.max(1, historyPage), totalPages);
                  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * historyPageSize;
                  const endIndex = Math.min(startIndex + historyPageSize, totalCount);
                  const pageLogs = filtered.slice(startIndex, endIndex);

                  const allCurrentPageLogIds = pageLogs.map(p => p.id);
                  const isAllPageSelected = pageLogs.length > 0 && allCurrentPageLogIds.every(id => selectedHistoryLogIds.includes(id));

                  return (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-sepia/15 bg-sepia/5 text-sepia/70 uppercase tracking-wider font-bold text-[10px]">
                              <th className="py-2.5 px-3 text-center w-8">
                                <input
                                  type="checkbox"
                                  checked={isAllPageSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedHistoryLogIds(prev => Array.from(new Set([...prev, ...allCurrentPageLogIds])));
                                    } else {
                                      setSelectedHistoryLogIds(prev => prev.filter(id => !allCurrentPageLogIds.includes(id)));
                                    }
                                  }}
                                  className="rounded text-amber-800 focus:ring-amber-800 cursor-pointer"
                                />
                              </th>
                              <th 
                                onClick={() => {
                                  if (historySortField === 'timestamp') {
                                    setHistorySortOrder(historySortOrder === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setHistorySortField('timestamp');
                                    setHistorySortOrder('desc');
                                  }
                                }}
                                className="py-2.5 px-3 cursor-pointer hover:bg-sepia/10 transition"
                              >
                                Дата и Время {historySortField === 'timestamp' && (historySortOrder === 'asc' ? '▲' : '▼')}
                              </th>
                              <th 
                                onClick={() => {
                                  if (historySortField === 'recipient') {
                                    setHistorySortOrder(historySortOrder === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setHistorySortField('recipient');
                                    setHistorySortOrder('asc');
                                  }
                                }}
                                className="py-2.5 px-3 cursor-pointer hover:bg-sepia/10 transition"
                              >
                                Получатель {historySortField === 'recipient' && (historySortOrder === 'asc' ? '▲' : '▼')}
                              </th>
                              <th className="py-2.5 px-3">Текст сообщения</th>
                              <th 
                                onClick={() => {
                                  if (historySortField === 'status') {
                                    setHistorySortOrder(historySortOrder === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setHistorySortField('status');
                                    setHistorySortOrder('desc');
                                  }
                                }}
                                className="py-2.5 px-3 text-center cursor-pointer hover:bg-sepia/10 transition"
                              >
                                Статус {historySortField === 'status' && (historySortOrder === 'asc' ? '▲' : '▼')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sepia/10">
                            {pageLogs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-sepia/50 italic font-mono">
                                  Записей в истории не найдено по заданным фильтрам.
                                </td>
                              </tr>
                            ) : (
                              pageLogs.map(item => {
                                const isChecked = selectedHistoryLogIds.includes(item.id);
                                return (
                                  <tr key={item.id} className="hover:bg-amber-50/60 transition-colors">
                                    <td className="py-2.5 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setSelectedHistoryLogIds(prev => [...prev, item.id]);
                                          } else {
                                            setSelectedHistoryLogIds(prev => prev.filter(id => id !== item.id));
                                          }
                                        }}
                                        className="rounded text-amber-800 focus:ring-amber-800 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-sepia/70 whitespace-nowrap">
                                      {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-amber-950">
                                      {item.recipientName || item.recipientUsername || `ID: ${item.recipientId}`}
                                      <span className="block text-[10px] text-sepia/50 font-normal font-mono">
                                        ID: {item.recipientId} {item.recipientUsername ? `(${item.recipientUsername})` : ''}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-sepia/80 max-w-xs truncate italic">
                                      "{item.messageText || 'Напоминание о лаборатории'}"
                                      {item.errorMsg && (
                                        <span className="block text-[10px] text-rose-700 not-italic font-mono truncate">
                                          ⚠️ {item.errorMsg}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-bold whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] ${item.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {item.status === 'success' ? 'Доставлено' : 'Ошибка'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-sepia/10 text-xs font-mono">
                        <div className="text-sepia/70">
                          {totalCount > 0
                            ? `Записи ${startIndex + 1}–${endIndex} из ${totalCount} (Всего страниц: ${totalPages})`
                            : 'Записей нет'}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setHistoryPage(1)}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1 bg-white border border-sepia/20 rounded-lg text-sepia disabled:opacity-40 hover:bg-sepia/10 transition font-bold"
                            title="Первая страница"
                          >
                            ««
                          </button>
                          <button
                            onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-2.5 py-1 bg-white border border-sepia/20 rounded-lg text-sepia disabled:opacity-40 hover:bg-sepia/10 transition font-bold"
                            title="Предыдущая страница"
                          >
                            ‹ Назад
                          </button>
                          <span className="px-3 py-1 font-bold text-amber-950 bg-amber-100/50 rounded-lg border border-sepia/10">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setHistoryPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-2.5 py-1 bg-white border border-sepia/20 rounded-lg text-sepia disabled:opacity-40 hover:bg-sepia/10 transition font-bold"
                            title="Следующая страница"
                          >
                            Вперед ›
                          </button>
                          <button
                            onClick={() => setHistoryPage(totalPages)}
                            disabled={currentPage >= totalPages}
                            className="px-2.5 py-1 bg-white border border-sepia/20 rounded-lg text-sepia disabled:opacity-40 hover:bg-sepia/10 transition font-bold"
                            title="Последняя страница"
                          >
                            »»
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
          {activeTab === 'blog' && (
            <motion.div
              key="blog"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <BlogAdminBuilder />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* USER DETAIL MODAL (CRM) */}
      <AnimatePresence>
        {editingUser && (
          <div 
            onClick={() => {
              setEditingUser(null);
              setAdminDeltaInput(0);
              setAdminReasonInput('');
            }}
            className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl border-2 border-gold shadow-2xl p-6 w-full max-w-md relative font-sans my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setEditingUser(null)} 
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="font-gothic text-lg text-sepia tracking-widest uppercase mb-4">РЕДАКТОР АЛХИМИКА</h3>

              <form onSubmit={handleSaveUserEdit} className="flex flex-col gap-4">
                <div className="flex items-center gap-4 border-b border-sepia/10 pb-4">
                  <img src={editingUser.avatar} className="w-14 h-14 rounded-full border border-sepia/10 object-cover" alt="User Profile" referrerPolicy="no-referrer" />
                  <div>
                    <h4 className="font-bold text-sepia">{editingUser.fullName}</h4>
                    <span className="text-xs text-sepia/50 font-mono">ID: {editingUser.id}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">ФИО Алхимика</label>
                  <input 
                    type="text" 
                    value={editingUser.fullName}
                    onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Телеграм Username</label>
                  <input 
                    type="text" 
                    value={editingUser.username}
                    onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                  />
                </div>

                <div className="bg-sepia/5 p-3 rounded-xl border border-sepia/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
                    <span className="text-[10px] text-sepia/70 font-bold uppercase tracking-wider">Текущий Итоговый Баланс</span>
                    <span className="text-sm font-black text-gold font-mono">
                      {((editingUser.balance_start ?? 1000) + (editingUser.balance_time ?? 0) + (editingUser.balance_ref ?? 0) + (editingUser.balance_pay ?? 0) + (editingUser.balance_admin ?? 0)).toLocaleString()} AiHim
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white/80 border border-sepia/10 rounded flex flex-col gap-0.5">
                      <span className="text-[9px] text-sepia/50 font-semibold">1. Стартовый (balance_start)</span>
                      <span className="font-mono text-xs font-bold text-sepia">{(editingUser.balance_start ?? 1000).toLocaleString()} AiHim</span>
                    </div>

                    <div className="p-2 bg-white/80 border border-sepia/10 rounded flex flex-col gap-0.5">
                      <span className="text-[9px] text-sepia/50 font-semibold">2. Таймер (balance_time)</span>
                      <span className="font-mono text-xs font-bold text-sepia">{(editingUser.balance_time ?? 0).toLocaleString()} AiHim</span>
                    </div>

                    <div className="p-2 bg-white/80 border border-sepia/10 rounded flex flex-col gap-0.5">
                      <span className="text-[9px] text-sepia/50 font-semibold">3. Рефералы (balance_ref)</span>
                      <span className="font-mono text-xs font-bold text-sepia">{(editingUser.balance_ref ?? 0).toLocaleString()} AiHim</span>
                    </div>

                    <div className="p-2 bg-white/80 border border-sepia/10 rounded flex flex-col gap-0.5">
                      <span className="text-[9px] text-sepia/50 font-semibold">4. Покупки (balance_pay)</span>
                      <span className="font-mono text-xs font-bold text-sepia">{(editingUser.balance_pay ?? 0).toLocaleString()} AiHim</span>
                    </div>
                  </div>

                  {/* Calculator for balance_admin */}
                  <div className="mt-1 p-3 bg-amber-500/10 border-2 border-amber-400/50 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-amber-300/40 pb-1.5">
                      <span className="text-[10px] text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span>🧮</span> Калькулятор корректировки (balance_admin)
                      </span>
                      <span className="text-xs font-bold text-amber-900 font-mono">
                        Текущий: {(editingUser.balance_admin ?? 0).toLocaleString()} AiHim
                      </span>
                    </div>

                    <p className="text-[10px] text-amber-900/80 leading-relaxed">
                      Ручные изменения баланса разрешены строго через дельту калькулятора. Корректировка автоматически записывается в таблицу транзакций (<code className="font-mono text-amber-950 font-bold">transactions</code>).
                    </p>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-amber-900 font-bold uppercase">Введите разницу (+/- Дельта)</label>
                      <input 
                        type="number"
                        value={adminDeltaInput || ''}
                        onChange={e => setAdminDeltaInput(parseInt(e.target.value) || 0)}
                        placeholder="Например: +1000 или -500"
                        className="px-3 py-1.5 bg-white border border-amber-400 rounded font-mono text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {[-1000, -500, -100, 100, 500, 1000, 5000, 10000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdminDeltaInput(prev => prev + val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                            val > 0 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' 
                              : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                          }`}
                        >
                          {val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAdminDeltaInput(0)}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
                      >
                        Сброс
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-amber-900 font-bold uppercase">Причина / Описание транзакции</label>
                      <input 
                        type="text"
                        value={adminReasonInput}
                        onChange={e => setAdminReasonInput(e.target.value)}
                        placeholder="Например: Корректировка администратором"
                        className="px-3 py-1.5 bg-white border border-amber-300 rounded text-xs text-sepia focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Live Preview */}
                    <div className="p-2 bg-amber-100/80 rounded border border-amber-300/60 text-[10px] flex flex-col gap-1 font-mono text-amber-950">
                      <div className="flex justify-between">
                        <span>Корректировка:</span>
                        <span className={`font-bold ${adminDeltaInput >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {adminDeltaInput >= 0 ? `+${adminDeltaInput.toLocaleString()}` : adminDeltaInput.toLocaleString()} AiHim
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-amber-200 pt-1 font-bold">
                        <span>Новый balance_admin:</span>
                        <span>{((editingUser.balance_admin ?? 0) + adminDeltaInput).toLocaleString()} AiHim</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-300/80 pt-1 text-xs font-black text-amber-900">
                        <span>Новый Итоговый Баланс:</span>
                        <span>
                          {((editingUser.balance_start ?? 1000) + (editingUser.balance_time ?? 0) + (editingUser.balance_ref ?? 0) + (editingUser.balance_pay ?? 0) + (editingUser.balance_admin ?? 0) + adminDeltaInput).toLocaleString()} AiHim
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Открыто элементов</label>
                    <input 
                      type="number" 
                      value={editingUser.discoveredCount}
                      onChange={e => setEditingUser({ ...editingUser, discoveredCount: parseInt(e.target.value) || 0 })}
                      className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Уровень Алхимии</label>
                    <input 
                      type="number" 
                      value={editingUser.level}
                      onChange={e => setEditingUser({ ...editingUser, level: parseInt(e.target.value) || 1 })}
                      className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Статус Аккаунта</label>
                  <select
                    value={editingUser.status}
                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-bold"
                  >
                    <option value="active">Активен</option>
                    <option value="pending">Ожидающий</option>
                    <option value="inactive">Неактивен</option>
                    <option value="bot_blocked">Бот заблокирован</option>
                    <option value="banned">Забанен</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 bg-sepia/5 p-2.5 rounded border border-sepia/10">
                  <span className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Дата последней активности</span>
                  <span className="text-xs font-mono text-sepia font-bold">
                    {editingUser.lastActiveDate || (editingUser.lastActive ? new Date(editingUser.lastActive).toLocaleString() : '—')}
                  </span>
                </div>

                <div className="flex gap-2 mt-4 border-t border-sepia/10 pt-4">
                  <button 
                    type="button" 
                    onClick={() => handleDeleteUser(editingUser.id)}
                    className="px-3 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold uppercase tracking-wider text-[10px] rounded transition-all flex items-center gap-1 shrink-0"
                    title="Безвозвратно удалить из БД"
                  >
                    <Trash2 size={12} />
                    Удалить
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2.5 border border-sepia/30 text-sepia/80 font-bold uppercase tracking-widest text-[10px] rounded hover:bg-sepia/5"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-gold text-ink font-bold uppercase tracking-widest text-[10px] rounded hover:bg-gold-light transition-all"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* TEMPLATE EDIT MODAL */}
        {editingTemplate && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl border-2 border-gold shadow-2xl p-6 w-full max-w-md relative font-sans"
            >
              <button 
                onClick={() => setEditingTemplate(null)} 
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="font-gothic text-lg text-sepia tracking-widest uppercase mb-4">РЕДАКТИРОВАНИЕ ШАБЛОНА</h3>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveTemplate(editingTemplate); }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Название шаблона</label>
                  <input 
                    type="text" 
                    value={editingTemplate.title}
                    onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Текст напоминания</label>
                  <textarea 
                    value={editingTemplate.text}
                    onChange={e => setEditingTemplate({ ...editingTemplate, text: e.target.value })}
                    rows={5}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none resize-none font-sans"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Текст инлайн-кнопки</label>
                  <input 
                    type="text" 
                    value={editingTemplate.buttonText}
                    onChange={e => setEditingTemplate({ ...editingTemplate, buttonText: e.target.value })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-sepia/50 font-bold uppercase tracking-wider">Ссылка инлайн-кнопки</label>
                  <input 
                    type="text" 
                    value={editingTemplate.buttonUrl}
                    onChange={e => setEditingTemplate({ ...editingTemplate, buttonUrl: e.target.value })}
                    className="px-3 py-2 text-xs bg-white border border-sepia/20 rounded focus:border-gold outline-none font-mono"
                  />
                </div>

                <div className="flex gap-3 mt-4 border-t border-sepia/10 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingTemplate(null)}
                    className="flex-1 py-2.5 border border-sepia/30 text-sepia/80 font-bold uppercase tracking-widest text-[10px] rounded hover:bg-sepia/5"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-gold text-ink font-bold uppercase tracking-widest text-[10px] rounded hover:bg-gold-light transition-all"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
