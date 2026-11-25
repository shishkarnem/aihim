import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlchemyElement, AppUser } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, BookOpen, Search, ArrowLeft, SlidersHorizontal, Award, ChevronDown } from 'lucide-react';
import { getAdminUsers } from '../lib/adminData';
import { calculateRank, RANKS } from '../constants';

interface RateProps {
  elements: AlchemyElement[];
  aihim: number;
  currentUser: AppUser;
}

type SortField = 'level' | 'elements' | 'balance';

export const Rate: React.FC<RateProps> = ({ elements, aihim, currentUser }) => {
  const [search, setSearch] = useState('');
  const [selectedRank, setSelectedRank] = useState<string>('All');
  const [minElements, setMinElements] = useState<string>('');
  const [minBalance, setMinBalance] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>('elements');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset pagination when filter/search/sort changes
  useEffect(() => {
    setVisibleCount(20);
  }, [search, selectedRank, minElements, minBalance, sortBy]);

  const [dbUsers, setDbUsers] = useState<AppUser[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // Fetch users strictly from PostgreSQL DB
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.users)) {
          setDbUsers(data.users);
        }
      })
      .catch(err => console.error("Failed to load leaderboard users from DB:", err))
      .finally(() => setIsLoadingDb(false));
  }, []);

  // Merge users with real-time stats of current user
  const usersList = useMemo(() => {
    let list = dbUsers.length > 0 ? [...dbUsers] : getAdminUsers();
    
    // Ensure current user is present or updated with live state
    let foundCurrent = false;
    const mapped = list.map(user => {
      if (user.id === currentUser.id) {
        foundCurrent = true;
        return {
          ...user,
          balance: aihim,
          discoveredCount: elements.length,
          level: calculateRank(elements.length).level
        };
      }
      return user;
    });

    if (!foundCurrent && currentUser.id !== 'guest_demo') {
      mapped.push({
        ...currentUser,
        balance: aihim,
        discoveredCount: elements.length,
        level: calculateRank(elements.length).level
      });
    }

    return mapped;
  }, [dbUsers, currentUser, aihim, elements.length]);

  // Apply filters and sorting
  const filteredAndSortedUsers = useMemo(() => {
    let list = [...usersList];

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(u => 
        (u.fullName && u.fullName.toLowerCase().includes(s)) || 
        (u.username && u.username.toLowerCase().includes(s))
      );
    }

    // Rank (min total elements tier name) filter
    if (selectedRank !== 'All') {
      list = list.filter(u => {
        const rankInfo = calculateRank(u.discoveredCount).currentRank;
        return rankInfo.name === selectedRank;
      });
    }

    // Min elements filter
    if (minElements !== '') {
      const min = parseInt(minElements);
      if (!isNaN(min)) {
        list = list.filter(u => u.discoveredCount >= min);
      }
    }

    // Min balance filter
    if (minBalance !== '') {
      const min = parseInt(minBalance);
      if (!isNaN(min)) {
        list = list.filter(u => u.balance >= min);
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'level') {
        if (b.level !== a.level) return b.level - a.level;
        return b.discoveredCount - a.discoveredCount; // Tie-breaker
      } else if (sortBy === 'elements') {
        if (b.discoveredCount !== a.discoveredCount) return b.discoveredCount - a.discoveredCount;
        return b.balance - a.balance; // Tie-breaker
      } else {
        if (b.balance !== a.balance) return b.balance - a.balance;
        return b.discoveredCount - a.discoveredCount; // Tie-breaker
      }
    });

    return list;
  }, [usersList, search, selectedRank, minElements, minBalance, sortBy]);

  const displayedUsers = useMemo(() => {
    return filteredAndSortedUsers.slice(0, visibleCount);
  }, [filteredAndSortedUsers, visibleCount]);

  // Extract unique rank names from RANKS constant for filter
  const rankNames = useMemo(() => {
    return RANKS.map(r => r.name);
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-12 w-full max-w-full text-[14px]">
      {/* Header section */}
      <div className="flex items-center justify-between gap-3 border-b border-sepia/10 pb-3">
        <div className="flex items-center gap-3">
          <Link 
            to="/profile" 
            className="p-2 border border-sepia/20 rounded-xl hover:bg-sepia/5 text-sepia transition-all shrink-0"
            title="Назад в Профиль"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="text-[14px] uppercase tracking-widest font-bold text-gold">Зал Славы AIhim</div>
            <h1 className="text-xl sm:text-2xl font-gothic tracking-widest text-sepia uppercase">Рейтинг Алхимиков</h1>
          </div>
        </div>
      </div>

      {/* Unified Search Bar & Compact Filter Toggle Row */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 w-full">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia/40" size={16} />
            <input
              type="text"
              placeholder="Поиск по имени или @username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white/70 border border-sepia/20 rounded-xl focus:border-gold outline-none text-[14px] font-serif italic text-sepia shadow-sm transition"
            />
          </div>

          {/* Compact Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? 'Скрыть фильтры' : 'Показать расширенные фильтры'}
            className={`p-2.5 rounded-xl border transition-all shrink-0 flex items-center justify-center gap-1.5 ${
              showFilters || selectedRank !== 'All' || minElements || minBalance
                ? 'bg-gold text-ink border-gold shadow-sm font-bold' 
                : 'bg-white/70 border-sepia/20 text-sepia hover:border-gold'
            }`}
          >
            <SlidersHorizontal size={18} />
            <span className="text-[14px] font-bold hidden sm:inline">Фильтры</span>
          </button>
        </div>

        {/* Sort Tabs (3 Equal Columns) */}
        <div className="grid grid-cols-3 gap-1.5 w-full bg-sepia/5 p-1 rounded-xl">
          <button
            onClick={() => setSortBy('elements')}
            className={`py-2 px-1 text-[14px] tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
              sortBy === 'elements' 
                ? 'bg-gold text-ink shadow-sm' 
                : 'text-sepia/70 hover:bg-sepia/5'
            }`}
          >
            <BookOpen size={14} className="shrink-0" />
            <span className="truncate">По элементам</span>
          </button>
          
          <button
            onClick={() => setSortBy('level')}
            className={`py-2 px-1 text-[14px] tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
              sortBy === 'level' 
                ? 'bg-gold text-ink shadow-sm' 
                : 'text-sepia/70 hover:bg-sepia/5'
            }`}
          >
            <Award size={14} className="shrink-0" />
            <span className="truncate">По Уровню</span>
          </button>

          <button
            onClick={() => setSortBy('balance')}
            className={`py-2 px-1 text-[14px] tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
              sortBy === 'balance' 
                ? 'bg-gold text-ink shadow-sm' 
                : 'text-sepia/70 hover:bg-sepia/5'
            }`}
          >
            <Zap size={14} className="shrink-0" />
            <span className="truncate">По AiHim</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Form Collapsible */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-amber-50/80 border border-gold/40 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Filter by Rank Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[14px] font-bold text-sepia/80 tracking-wider">Фильтр по Рангу</label>
                <select
                  value={selectedRank}
                  onChange={(e) => setSelectedRank(e.target.value)}
                  className="bg-white border border-sepia/20 rounded-lg px-2.5 py-1.5 text-[14px] outline-none focus:border-gold w-full text-sepia font-medium"
                >
                  <option value="All">Все Ранги</option>
                  {rankNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Min Elements Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[14px] font-bold text-sepia/80 tracking-wider">Мин. элементов</label>
                <input
                  type="number"
                  placeholder="Например: 10"
                  value={minElements}
                  onChange={(e) => setMinElements(e.target.value)}
                  className="px-2.5 py-1.5 text-[14px] bg-white border border-sepia/20 rounded-lg focus:border-gold outline-none font-mono w-full text-sepia"
                />
              </div>

              {/* Min AiHim Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[14px] font-bold text-sepia/80 tracking-wider">Мин. баланс AiHim</label>
                <input
                  type="number"
                  placeholder="Например: 50000"
                  value={minBalance}
                  onChange={(e) => setMinBalance(e.target.value)}
                  className="px-2.5 py-1.5 text-[14px] bg-white border border-sepia/20 rounded-lg focus:border-gold outline-none font-mono w-full text-sepia"
                />
              </div>

              {/* Reset Filters Option */}
              {(selectedRank !== 'All' || minElements || minBalance) && (
                <div className="sm:col-span-3 flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setSelectedRank('All');
                      setMinElements('');
                      setMinBalance('');
                    }}
                    className="text-[14px] text-rose-700 hover:text-rose-800 font-bold tracking-wider underline transition-colors"
                  >
                    Сбросить все фильтры
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard list container */}
      <div className="bg-transparent w-full overflow-hidden">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-sepia/15 text-[14px] tracking-widest font-black text-sepia/70">
              {/* Column 1: Place */}
              <th className="py-2.5 px-1 text-center w-12 sm:w-16">Место</th>

              {/* Column 2: Alchemist */}
              <th className="py-2.5 px-2">Алхимик</th>

              {/* Column 3: Dynamic Metric based on Sort Filter */}
              <th className="py-2.5 px-2 text-right w-28 sm:w-36">
                {sortBy === 'elements' && 'Элементы'}
                {sortBy === 'level' && 'Уровень'}
                {sortBy === 'balance' && 'Энергия AiHim'}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user, index) => {
              const isMe = user.id === currentUser.id;
              const rankData = calculateRank(user.discoveredCount);
              
              // Medal icons for top 3
              let medal: React.ReactNode = null;
              if (index === 0) medal = <span className="text-xl" title="Первое место">🥇</span>;
              else if (index === 1) medal = <span className="text-xl" title="Второе место">🥈</span>;
              else if (index === 2) medal = <span className="text-xl" title="Третье место">🥉</span>;
              else medal = <span className="text-[14px] font-mono font-bold text-sepia/70">#{index + 1}</span>;

              return (
                <tr 
                  key={user.id}
                  className={`border-b border-sepia/10 transition-all ${
                    isMe 
                      ? 'bg-amber-100/60 border-gold/50 font-medium' 
                      : 'hover:bg-sepia/[0.03]'
                  }`}
                >
                  {/* Column 1: Position */}
                  <td className="py-3 px-1 text-center font-bold">
                    <div className="flex items-center justify-center">
                      {medal}
                    </div>
                  </td>

                  {/* Column 2: Alchemist Avatar & Name */}
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border ${isMe ? 'border-gold shadow-sm' : 'border-sepia/20'} bg-sepia/10 flex items-center justify-center`}>
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={user.fullName || 'Алхимик'} 
                              className="w-full h-full object-cover grayscale sepia brightness-90 contrast-125"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-sm text-sepia/40">🔮</span>
                          )}
                        </div>
                        {isMe && (
                          <span className="absolute -top-1 -right-1 bg-gold text-ink rounded-full p-0.5" title="Это Вы">
                            <Sparkles size={10} className="fill-current animate-pulse" />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 leading-tight">
                        <span className={`text-[14px] font-bold truncate ${isMe ? 'text-amber-950 font-black' : 'text-sepia'}`}>
                          {user.fullName || 'Алхимик'}
                        </span>
                        <span className="text-[14px] font-mono text-amber-900/80 truncate">
                          {user.username || `@id${user.id}`}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Column 3: Dynamic metric matching selected filter */}
                  <td className="py-3 px-2 text-right">
                    {sortBy === 'elements' && (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[14px] font-mono font-black text-amber-950">
                          {user.discoveredCount}
                        </span>
                        <span className="text-[14px] tracking-tighter text-sepia/60 font-bold">
                          эл-тов
                        </span>
                      </div>
                    )}

                    {sortBy === 'level' && (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[14px] font-serif font-black text-amber-950 flex items-center gap-1 justify-end">
                          <span className="text-[14px]" title={rankData.currentRank.name}>{rankData.currentRank.icon}</span>
                          Ур. {user.level}
                        </span>
                        <span className="text-[14px] tracking-tighter text-sepia/60 font-bold truncate max-w-[110px]">
                          {rankData.currentRank.name}
                        </span>
                      </div>
                    )}

                    {sortBy === 'balance' && (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[14px] font-mono font-black text-amber-900 flex items-center gap-0.5 justify-end">
                          <Zap size={12} className="fill-current text-amber-800 shrink-0" />
                          {user.balance.toLocaleString()}
                        </span>
                        <span className="text-[14px] tracking-tighter text-sepia/60 font-bold">
                          AiHim
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAndSortedUsers.length === 0 && (
          <div className="text-center py-16 italic text-sepia/60 font-serif text-[14px]">
            Ни один алхимик не найден по вашему запросу...
          </div>
        )}
      </div>

      {/* Pagination "Show More" Button (+20 items) */}
      {filteredAndSortedUsers.length > visibleCount && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount(prev => prev + 20)}
            className="w-full sm:w-auto px-6 py-3 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl font-bold text-[14px] tracking-wider shadow-md transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Показать еще 20</span>
            <ChevronDown size={16} />
            <span className="opacity-75 font-mono text-[14px]">({filteredAndSortedUsers.length - visibleCount} осталось)</span>
          </button>
        </div>
      )}

      <div className="text-center pt-2">
        <p className="text-[14px] text-sepia/70 tracking-wide italic font-bold">
          Показано {Math.min(visibleCount, filteredAndSortedUsers.length)} из {filteredAndSortedUsers.length} алхимиков
        </p>
      </div>
    </div>
  );
};
