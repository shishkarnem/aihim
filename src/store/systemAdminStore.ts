import { create } from 'zustand';

interface SystemAdminState {
  tables: string[];
  selectedTable: string | null;
  tableData: any[];
  triggers: any[];
  cronJobs: any[];
  isLoading: boolean;
  isLoadingTables: boolean;
  isLoadingTableData: boolean;
  isLoadingTriggers: boolean;
  isLoadingCron: boolean;
  hasLoadedTriggers: boolean;
  hasLoadedCron: boolean;
  error: string | null;

  fetchTables: (silent?: boolean) => Promise<void>;
  setSelectedTable: (tableName: string | null) => void;
  fetchTableData: (tableName: string, silent?: boolean) => Promise<void>;
  fetchTriggers: (silent?: boolean) => Promise<void>;
  fetchCronJobs: (silent?: boolean) => Promise<void>;
  triggerCronJob: (jobName: string) => Promise<boolean>;
  updateCronJob: (jobName: string, schedule: string, description?: string, status?: string) => Promise<boolean>;
}

let activeTableFetchToken = 0;

function computeIsLoading(s: {
  isLoadingTables: boolean;
  isLoadingTableData: boolean;
  isLoadingTriggers: boolean;
  isLoadingCron: boolean;
}) {
  return s.isLoadingTables || s.isLoadingTableData || s.isLoadingTriggers || s.isLoadingCron;
}

export const useSystemAdminStore = create<SystemAdminState>((set, get) => ({
  tables: [],
  selectedTable: null,
  tableData: [],
  triggers: [],
  cronJobs: [],
  isLoading: false,
  isLoadingTables: false,
  isLoadingTableData: false,
  isLoadingTriggers: false,
  isLoadingCron: false,
  hasLoadedTriggers: false,
  hasLoadedCron: false,
  error: null,

  fetchTables: async (silent = false) => {
    if (!silent) {
      set(state => {
        const next = { ...state, isLoadingTables: true, error: null };
        return { isLoadingTables: true, error: null, isLoading: computeIsLoading(next) };
      });
    }
    try {
      const res = await fetch('/api/system-admin/tables', { cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось загрузить список таблиц PostgreSQL');
      const data = await res.json();
      const fetchedTables: string[] = Array.isArray(data.tables) ? data.tables : [];

      set(state => {
        const next = { ...state, tables: fetchedTables, isLoadingTables: false };
        return {
          tables: fetchedTables,
          ...(silent ? {} : { isLoadingTables: false, isLoading: computeIsLoading(next) })
        };
      });

      if (!get().selectedTable && fetchedTables.length > 0) {
        const preferredDefault = fetchedTables.includes('users') ? 'users' : fetchedTables[0];
        get().setSelectedTable(preferredDefault);
      }
    } catch (err) {
      set(state => {
        const next = { ...state, isLoadingTables: false };
        return {
          error: (err as Error).message,
          ...(silent ? {} : { isLoadingTables: false, isLoading: computeIsLoading(next) })
        };
      });
    }
  },

  setSelectedTable: (tableName) => {
    const prevTable = get().selectedTable;
    if (tableName && tableName === prevTable && get().tableData.length > 0) {
      return;
    }
    set({ selectedTable: tableName, tableData: [], error: null });
    if (tableName) {
      get().fetchTableData(tableName);
    }
  },

  fetchTableData: async (tableName, silent = false) => {
    const reqToken = ++activeTableFetchToken;
    if (!silent) {
      set(state => {
        const next = { ...state, isLoadingTableData: true, error: null };
        return { isLoadingTableData: true, error: null, isLoading: computeIsLoading(next) };
      });
    }
    try {
      const res = await fetch(`/api/system-admin/data/${encodeURIComponent(tableName)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Ошибка загрузки таблицы: ${tableName}`);
      const data = await res.json();
      if (reqToken !== activeTableFetchToken || get().selectedTable !== tableName) {
        return;
      }
      set(state => {
        const next = { ...state, tableData: data.rows || [], isLoadingTableData: false };
        return {
          tableData: data.rows || [],
          ...(silent ? {} : { isLoadingTableData: false, isLoading: computeIsLoading(next) })
        };
      });
    } catch (err) {
      if (reqToken !== activeTableFetchToken) return;
      set(state => {
        const next = { ...state, isLoadingTableData: false };
        return {
          error: (err as Error).message,
          ...(silent ? {} : { isLoadingTableData: false, isLoading: computeIsLoading(next) })
        };
      });
    }
  },

  fetchTriggers: async (silent = false) => {
    if (!silent) {
      set(state => {
        const next = { ...state, isLoadingTriggers: true, error: null };
        return { isLoadingTriggers: true, error: null, isLoading: computeIsLoading(next) };
      });
    }
    try {
      const res = await fetch('/api/system-admin/triggers', { cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось загрузить триггеры базы данных');
      const data = await res.json();
      set(state => {
        const next = { ...state, triggers: data.triggers || [], isLoadingTriggers: false };
        return {
          triggers: data.triggers || [],
          hasLoadedTriggers: true,
          ...(silent ? {} : { isLoadingTriggers: false, isLoading: computeIsLoading(next) })
        };
      });
    } catch (err) {
      set(state => {
        const next = { ...state, isLoadingTriggers: false };
        return {
          error: (err as Error).message,
          ...(silent ? {} : { isLoadingTriggers: false, isLoading: computeIsLoading(next) })
        };
      });
    }
  },

  fetchCronJobs: async (silent = false) => {
    if (!silent) {
      set(state => {
        const next = { ...state, isLoadingCron: true, error: null };
        return { isLoadingCron: true, error: null, isLoading: computeIsLoading(next) };
      });
    }
    try {
      const res = await fetch('/api/system-admin/cron-jobs', { cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось загрузить Cron-задачи');
      const data = await res.json();
      set(state => {
        const next = { ...state, cronJobs: data.jobs || [], isLoadingCron: false };
        return {
          cronJobs: data.jobs || [],
          hasLoadedCron: true,
          ...(silent ? {} : { isLoadingCron: false, isLoading: computeIsLoading(next) })
        };
      });
    } catch (err) {
      set(state => {
        const next = { ...state, isLoadingCron: false };
        return {
          error: (err as Error).message,
          ...(silent ? {} : { isLoadingCron: false, isLoading: computeIsLoading(next) })
        };
      });
    }
  },

  triggerCronJob: async (jobName) => {
    set(state => {
      const next = { ...state, isLoadingCron: true, error: null };
      return { isLoadingCron: true, error: null, isLoading: computeIsLoading(next) };
    });
    try {
      const res = await fetch(`/api/system-admin/run-cron/${encodeURIComponent(jobName)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Ошибка запуска Cron-задачи: ${jobName}`);
      set(state => {
        const next = { ...state, isLoadingCron: false };
        return { isLoadingCron: false, isLoading: computeIsLoading(next) };
      });
      await get().fetchCronJobs(true);
      return true;
    } catch (err) {
      set(state => {
        const next = { ...state, isLoadingCron: false };
        return { error: (err as Error).message, isLoadingCron: false, isLoading: computeIsLoading(next) };
      });
      return false;
    }
  },

  updateCronJob: async (jobName, schedule, description, status) => {
    set(state => {
      const next = { ...state, isLoadingCron: true, error: null };
      return { isLoadingCron: true, error: null, isLoading: computeIsLoading(next) };
    });
    try {
      const res = await fetch('/api/system-admin/update-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: jobName, schedule, description, status })
      });
      if (!res.ok) throw new Error(`Ошибка обновления Cron-задачи: ${jobName}`);
      set(state => {
        const next = { ...state, isLoadingCron: false };
        return { isLoadingCron: false, isLoading: computeIsLoading(next) };
      });
      await get().fetchCronJobs(true);
      return true;
    } catch (err) {
      set(state => {
        const next = { ...state, isLoadingCron: false };
        return { error: (err as Error).message, isLoadingCron: false, isLoading: computeIsLoading(next) };
      });
      return false;
    }
  },
}));
