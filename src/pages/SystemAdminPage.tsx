import React, { useEffect, useState, useMemo } from 'react';
import { useSystemAdminStore } from '../store/systemAdminStore';
import { 
  Database, Cpu, Play, RefreshCw, AlertTriangle, Table, Zap, ArrowLeft, Terminal, Server,
  Code, Search, Shield, CheckCircle2, Send, Trash2, Edit3, Save, X, Sparkles, Sliders,
  HelpCircle, Plus, ToggleLeft, ToggleRight, Download, Upload, FileText, Cloud
} from 'lucide-react';
import { FileCloudManager } from '../components/FileCloudManager';
import { NeurosphereLoader } from '../components/ui/NeurosphereLoader';
import { AppVersionControl } from '../components/ui/AppVersionControl';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser } from '../types';

interface SystemAdminPageProps {
  currentUser?: AppUser;
}

export const SystemAdminPage: React.FC<SystemAdminPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const {
    tables,
    selectedTable,
    tableData,
    triggers,
    cronJobs,
    isLoading,
    isLoadingTables,
    isLoadingTableData,
    isLoadingTriggers,
    isLoadingCron,
    hasLoadedTriggers,
    hasLoadedCron,
    error,
    fetchTables,
    setSelectedTable,
    fetchTableData,
    fetchTriggers,
    fetchCronJobs,
    triggerCronJob,
  } = useSystemAdminStore();

  const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'triggers' | 'cron' | 'files'>('tables');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Table Pagination & Page Size State (20, 100, 500, or 'all')
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page number on table, search filter, or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable, searchFilter, pageSize]);
  
  // DB Table Sorting State
  const [tableSortColumn, setTableSortColumn] = useState<string | null>(null);
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Multi-select Bulk Delete State
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // CSV Import / Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // 1-Click JSON Backup & Restore State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreJsonText, setRestoreJsonText] = useState('');
  const [restoreJsonUrl, setRestoreJsonUrl] = useState('');
  const [restoreProgress, setRestoreProgress] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Easy mode vs Dev Mode for non-technical users ("Для чайников")
  const [noCodeMode, setNoCodeMode] = useState(true);

  // Modal Row Editor State
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [rowFormData, setRowFormData] = useState<Record<string, any>>({});
  const [sysAdminDeltaInput, setSysAdminDeltaInput] = useState<number>(0);
  const [sysAdminReasonInput, setSysAdminReasonInput] = useState<string>('');
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [isDeletingRow, setIsDeletingRow] = useState(false);

  // Universal Modal Dialog State
  interface SystemAdminModalState {
    isOpen: boolean;
    type?: 'confirm_single_delete' | 'confirm_bulk_delete' | 'confirm_edit' | 'alert';
    title: string;
    message: string | React.ReactNode;
    warningText?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    onConfirm?: () => void;
  }

  const [adminModal, setAdminModal] = useState<SystemAdminModalState>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showAdminAlert = (title: string, message: string | React.ReactNode) => {
    setAdminModal({
      isOpen: true,
      type: 'alert',
      title,
      message,
      isDanger: false
    });
  };

  // Custom SQL Console State
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 50;');
  const [sqlResultRows, setSqlResultRows] = useState<any[] | null>(null);
  const [sqlMessage, setSqlMessage] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  // Simple Trigger Generator State
  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerEvent, setNewTriggerEvent] = useState('При получении нового ученика');
  const [newTriggerAction, setNewTriggerAction] = useState('Начислить +100,000 AiHim энергии');

  // Easy Cron Job Edit Modal State
  const [editingCronJob, setEditingCronJob] = useState<{
    name: string;
    title: string;
    schedule: string;
    description: string;
  } | null>(null);

  // Trigger Editor State
  const [editingTrigger, setEditingTrigger] = useState<{
    name: string;
    tbl_name?: string;
    event?: string;
    action?: string;
    sql?: string;
    active?: boolean;
    ruleId?: number;
  } | null>(null);

  // Smooth lazy loading per opened tab (avoids saturating PostgreSQL proxy queue on mount)
  useEffect(() => {
    if (activeTab === 'tables') {
      if (tables.length === 0) {
        fetchTables();
      } else if (selectedTable && tableData.length === 0 && !isLoadingTableData) {
        fetchTableData(selectedTable);
      }
    } else if (activeTab === 'cron') {
      if (!hasLoadedCron && !isLoadingCron) {
        fetchCronJobs();
      }
    } else if (activeTab === 'triggers') {
      if (!hasLoadedTriggers && !isLoadingTriggers) {
        fetchTriggers();
      }
    }
  }, [activeTab]);

  // Background polling strictly for currently opened tab (silent, non-blocking)
  useEffect(() => {
    let inFlight = false;
    const syncActiveTab = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        if (activeTab === 'tables' && selectedTable) {
          await fetchTableData(selectedTable, true);
        } else if (activeTab === 'cron') {
          await fetchCronJobs(true);
        } else if (activeTab === 'triggers') {
          await fetchTriggers(true);
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(syncActiveTab, 10000);
    const onRefreshUser = () => {
      if (activeTab === 'tables' && selectedTable) {
        fetchTableData(selectedTable, true);
      }
    };
    window.addEventListener('alchimia:refresh_user', onRefreshUser);
    return () => {
      clearInterval(interval);
      window.removeEventListener('alchimia:refresh_user', onRefreshUser);
    };
  }, [activeTab, selectedTable, fetchTableData, fetchCronJobs, fetchTriggers]);

  // Uniform Column Headers for Active Table (Fixes Column Alignment Defects)
  const tableHeaders = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    const keySet = new Set<string>();
    tableData.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => keySet.add(k));
      }
    });
    if (selectedTable === 'users') {
      const userPreferredOrder = [
        'id', 'username', 'fullName', 'avatar', 'role', 'email', 'password',
        'balance', 'balance_start', 'balance_time', 'balance_ref', 'balance_pay', 'balance_admin',
        'discoveredCount', 'status', 'level', 'registrationDate',
        'lastActive', 'nextReminderAt', 'lastLoginAt', 'updatedAt',
        'referredById', 'referredByUsername'
      ];
      const ordered: string[] = [];
      userPreferredOrder.forEach(k => {
        if (keySet.has(k)) {
          ordered.push(k);
          keySet.delete(k);
        }
      });
      return [...ordered, ...Array.from(keySet)];
    }
    return Array.from(keySet);
  }, [tableData, selectedTable]);

  // Access Control Check
  const isManager = currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  if (!currentUser || (!isAdmin && !isManager)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="parchment-card p-8 max-w-md border-red-800/40 bg-white/80 shadow-2xl flex flex-col items-center gap-4 rounded-xl"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-red-600 text-3xl shadow-inner">
            🛑
          </div>
          <h2 className="font-gothic text-2xl text-red-800 tracking-widest uppercase">ДОСТУП ЗАПРЕЩЕН</h2>
          <p className="text-sm text-sepia/80 leading-relaxed">
            Системная консоль управления баз данных доступна только Великим Алхимикам Ордена (Администраторам и Менеджерам).
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 px-6 py-2.5 bg-sepia text-parchment uppercase font-bold text-xs tracking-wider rounded-lg hover:bg-sepia-light transition-all shadow-md active:scale-95"
          >
            Вернуться в Лабораторию
          </button>
        </motion.div>
      </div>
    );
  }

  const handleRunCron = async (jobName: string) => {
    if (isManager) {
      showAdminAlert('Доступ ограничен', 'Режим просмотра (Менеджер). Ручной запуск задач доступен только Администратору.');
      return;
    }
    const success = await triggerCronJob(jobName);
    if (success) {
      setSuccessMessage(`Фоновая задача "${jobName}" успешно инициирована на сервере.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const executeCustomSql = async (queryToRun?: string) => {
    const targetSql = queryToRun || sqlQuery;
    if (!targetSql.trim()) return;

    if (isManager) {
      showAdminAlert('Доступ ограничен', 'Режим просмотра (Менеджер). Выполнение произвольных SQL-запросов доступно только Администраторам.');
      return;
    }

    setIsExecutingSql(true);
    setSqlMessage(null);
    setSqlResultRows(null);

    try {
      const res = await fetch('/api/system-admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: targetSql,
          userRole: currentUser.role
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSqlMessage(`Ошибок при выполнении: ${data.error || 'Сбой синтаксиса SQL'}`);
      } else {
        if (data.rows) {
          setSqlResultRows(data.rows);
          setSqlMessage(`Запрос выполнен! Получено строк: ${data.rows.length}`);
        } else {
          setSqlMessage(`Операция успешно проведена! Затронуто записей: ${data.result?.changes || 0}`);
          fetchTables();
          if (selectedTable) fetchTableData(selectedTable);
        }
      }
    } catch (err: any) {
      setSqlMessage(`Сбой сети при запросе: ${err.message}`);
    } finally {
      setIsExecutingSql(false);
    }
  };

  // Row Modal Edit Handlers
  const handleOpenRowModal = (row: any) => {
    setEditingRow(row);
    setRowFormData({ ...row });
    setSysAdminDeltaInput(0);
    setSysAdminReasonInput('');
  };

  const handleSaveRowModal = async () => {
    if (!selectedTable || !editingRow || isManager) return;
    setAdminModal({
      isOpen: true,
      type: 'confirm_edit',
      title: 'Подтверждение изменения записи',
      message: `Вы действительно хотите сохранить изменения в таблице "${selectedTable}"?`,
      confirmLabel: 'Да, сохранить',
      cancelLabel: 'Отмена',
      isDanger: false,
      onConfirm: () => performSaveRowModal()
    });
  };

  const getPrimaryKeyField = (row: any) => {
    if (!row) return 'id';
    const keys = Object.keys(row);
    return keys.find(k => k.toLowerCase() === 'id') 
      || keys.find(k => k.toLowerCase() === 'key') 
      || keys.find(k => k.toLowerCase() === 'name') 
      || keys[0] 
      || 'id';
  };

  const performSaveRowModal = async () => {
    if (!selectedTable || !editingRow) return;
    setIsSavingRow(true);
    try {
      const updatedData = { ...rowFormData };

      // Determine primary key correctly
      const primaryKeyField = getPrimaryKeyField(editingRow);
      const primaryKeyValue = editingRow[primaryKeyField];

      // Handle balance delta adjustments for users table
      if (selectedTable === 'users') {
        const origAdmin = Number(editingRow.balance_admin) || 0;
        const formAdmin = Number(updatedData.balance_admin) || 0;

        let delta = sysAdminDeltaInput;
        // If delta calculator input is 0, check if balance_admin was edited directly in form
        if (delta === 0 && formAdmin !== origAdmin) {
          delta = formAdmin - origAdmin;
        }

        if (delta !== 0) {
          const finalAdmin = origAdmin + delta;
          const bStart = Number(updatedData.balance_start) || 1000;
          const bTime = Number(updatedData.balance_time) || 0;
          const bRef = Number(updatedData.balance_ref) || 0;
          const bPay = Number(updatedData.balance_pay) || 0;
          const newTotal = bStart + bTime + bRef + bPay + finalAdmin;

          updatedData.balance_admin = finalAdmin;
          updatedData.balance = newTotal;

          // Insert transaction record for the admin adjustment
          const txId = `TX-ADMIN-${Date.now()}-${Math.floor(Math.random()*10000)}`;
          const userLabel = updatedData.username || `@id${updatedData.id}`;
          const nameLabel = String(updatedData.fullName || 'Алхимик').replace(/'/g, "''");
          const reasonText = sysAdminReasonInput ? String(sysAdminReasonInput).replace(/'/g, "''") : 'Корректировка администратором';
          const insertTxSql = `INSERT INTO transactions (id, userId, username, fullName, amount, price, timestamp, status, type, reason) VALUES ('${txId}', '${updatedData.id}', '${userLabel}', '${nameLabel}', ${delta}, 0, ${Date.now()}, 'success', 'admin', '${reasonText}');`;
          await executeCustomSql(insertTxSql);
          setSysAdminDeltaInput(0);
          setSysAdminReasonInput('');
        }
      }

      const fieldsToUpdate = Object.keys(updatedData).filter(k => k.toLowerCase() !== primaryKeyField.toLowerCase());
      const setStatements = fieldsToUpdate.map(k => {
        const val = updatedData[k];
        if (val === null || val === undefined) return `${k} = NULL`;
        if (typeof val === 'number') return `${k} = ${val}`;
        if (typeof val === 'boolean') {
          if (selectedTable === 'file_storage' && k === 'preserve_alpha') {
            return `${k} = ${val ? 'TRUE' : 'FALSE'}`;
          }
          return `${k} = ${val ? 1 : 0}`;
        }
        if (typeof val === 'object') return `${k} = '${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `${k} = '${String(val).replace(/'/g, "''")}'`;
      }).join(', ');

      if (setStatements.length > 0) {
        const sql = `UPDATE ${selectedTable} SET ${setStatements} WHERE ${primaryKeyField} = '${String(primaryKeyValue).replace(/'/g, "''")}';`;
        await executeCustomSql(sql);
      }

      setSuccessMessage(`Запись таблицы "${selectedTable}" (${primaryKeyField} = "${primaryKeyValue}") сохранена.`);
      setEditingRow(null);
      setSysAdminDeltaInput(0);
      setSysAdminReasonInput('');

      // Refresh current table data & notify app
      await fetchTableData(selectedTable);
      window.dispatchEvent(new CustomEvent('alchimia:refresh_user'));
    } catch (err: any) {
      showAdminAlert('Ошибка при сохранении', err.message);
    } finally {
      setIsSavingRow(false);
    }
  };

  const handleDeleteRowModal = async () => {
    if (!selectedTable || !editingRow || isManager) return;
    const primaryKeyField = getPrimaryKeyField(editingRow);
    const primaryKeyValue = editingRow[primaryKeyField];

    setAdminModal({
      isOpen: true,
      type: 'confirm_single_delete',
      title: 'Подтверждение удаления строки',
      message: `Вы действительно хотите полностью удалить эту строку из таблицы "${selectedTable}"? (${primaryKeyField}: ${primaryKeyValue})`,
      warningText: selectedTable === 'users'
        ? 'ВНИМАНИЕ (КАСКАДНОЕ УДАЛЕНИЕ): Все открытые пользователем элементы (из таблицы discovered_elements), его истории транзакций и логи будут АВТОМАТИЧЕСКИ УДАЛЕНЫ!'
        : undefined,
      confirmLabel: 'Да, удалить строку',
      cancelLabel: 'Отмена',
      isDanger: true,
      onConfirm: () => performDeleteRowSingle(primaryKeyField, primaryKeyValue)
    });
  };

  const performDeleteRowSingle = async (primaryKeyField: string, primaryKeyValue: any) => {
    setIsDeletingRow(true);
    try {
      if (selectedTable === 'users') {
        const res = await fetch('/api/users/' + primaryKeyValue, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка удаления пользователя');
        setSuccessMessage(data.message || `Пользователь ${primaryKeyValue} и его каскадные элементы удалены.`);
      } else {
        const sql = `DELETE FROM ${selectedTable} WHERE ${primaryKeyField} = '${String(primaryKeyValue).replace(/'/g, "''")}';`;
        await executeCustomSql(sql);
        setSuccessMessage(`Запись (${primaryKeyField}: ${primaryKeyValue}) удалена из базы данных.`);
      }
      setEditingRow(null);
      fetchTables();
      if (selectedTable) fetchTableData(selectedTable);
    } catch (err: any) {
      showAdminAlert('Ошибка при удалении', err.message);
    } finally {
      setIsDeletingRow(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTable || selectedRowKeys.length === 0 || isManager) return;
    const pkField = Object.keys(tableData[0] || {})[0] || 'id';

    setAdminModal({
      isOpen: true,
      type: 'confirm_bulk_delete',
      title: 'Подтверждение каскадного массового удаления',
      message: `Вы уверены, что хотите массово удалить ${selectedRowKeys.length} выбранных записей из таблицы "${selectedTable}"?`,
      warningText: selectedTable === 'users'
        ? 'ВНИМАНИЕ (КАСКАДНОЕ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ): Все открытые ими элементы (из таблицы discovered_elements), история транзакций и логи также будут АВТОМАТИЧЕСКИ КАКАДНО УДАЛЕНЫ!'
        : undefined,
      confirmLabel: 'Да, выполнить каскадное удаление',
      cancelLabel: 'Отмена',
      isDanger: true,
      onConfirm: () => performBulkDelete(pkField)
    });
  };

  const performBulkDelete = async (pkField: string) => {
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable,
          primaryKey: pkField,
          keys: selectedRowKeys
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showAdminAlert('Ошибка массового удаления', data.error);
      } else {
        setSuccessMessage(data.message || `Успешно удалено ${selectedRowKeys.length} записей!`);
        setSelectedRowKeys([]);
        fetchTables();
        if (selectedTable) fetchTableData(selectedTable);
      }
    } catch (err: any) {
      showAdminAlert('Сбой сети при удалении', err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportTableCsv = async (tableName: string) => {
    try {
      const res = await fetch(`/api/admin/export-csv?table=${tableName}`);
      if (!res.ok) {
        const errText = await res.text();
        showAdminAlert('Ошибка экспорта CSV', errText);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showAdminAlert('Сбой экспорта CSV', err.message);
    }
  };

  const handleExportAllTablesCsv = async () => {
    try {
      const res = await fetch(`/api/admin/export-zip`);
      if (!res.ok) {
        const errText = await res.text();
        showAdminAlert('Ошибка экспорта ZIP', errText);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_all_tables_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showAdminAlert('Сбой экспорта ZIP', err.message);
    }
  };

  const handleExportJsonBackup = async () => {
    try {
      const res = await fetch('/api/admin/export-json-backup');
      if (!res.ok) {
        const errText = await res.text();
        showAdminAlert('Ошибка экспорта Бэкапа JSON', errText);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      a.download = `aihim_db_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Полный Бэкап базы данных (JSON) успешно скачан!');
    } catch (err: any) {
      showAdminAlert('Сбой сохранения Бэкапа JSON', err.message);
    }
  };

  const handleJsonBackupFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setRestoreJsonText(event.target?.result as string || '');
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const parseServerJsonResponse = async (res: Response, fallbackContext: string) => {
    const resText = await res.text();
    const trimmed = resText.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed.startsWith('<')) {
        const titleMatch = trimmed.match(/<title[^>]*>([^<]+)<\/title>/i);
        const titleInfo = titleMatch?.[1]?.trim() ? ` (${titleMatch[1].trim()})` : '';
        throw new Error(
          `Сервер вернул HTML вместо JSON (HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''})${titleInfo} при ${fallbackContext}.`
        );
      }
      throw new Error(trimmed || `Пустой ответ сервера (HTTP ${res.status})`);
    }
  };

  const handleRestoreJsonSubmit = async () => {
    const trimmedUrl = restoreJsonUrl.trim();
    const trimmedText = restoreJsonText.trim();
    const textIsUrl = /^https?:\/\/\S+$/i.test(trimmedText);
    const effectiveUrl = trimmedUrl || (textIsUrl ? trimmedText : '');

    if (!effectiveUrl && !trimmedText) {
      showAdminAlert('Ошибка', 'Выберите файл бэкапа JSON, вставьте ссылку (.json) или вставьте JSON данные!');
      return;
    }

    setIsRestoring(true);
    setRestoreProgress('Подготовка восстановления...');

    try {
      if (effectiveUrl) {
        setRestoreProgress('Скачивание и пакетное восстановление из URL...');
        const res = await fetch('/api/admin/restore-json-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupUrl: effectiveUrl, table: selectedTable })
        });
        const data = await parseServerJsonResponse(res, 'восстановлении по URL');
        if (!res.ok || data.error) {
          showAdminAlert('Ошибка восстановления бэкапа', data.error || 'Неизвестная ошибка сервера');
          return;
        }
        setSuccessMessage(data.message || 'Бэкап базы данных успешно восстановлен!');
        setIsRestoreModalOpen(false);
        setRestoreJsonText('');
        setRestoreJsonUrl('');
        fetchTables();
        if (selectedTable) fetchTableData(selectedTable);
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(trimmedText.replace(/^\uFEFF/, ''));
      } catch {
        showAdminAlert('Ошибка синтаксиса JSON', 'Проверьте корректность JSON-файла перед восстановлением.');
        return;
      }

      // Normalize to tables map so we can send compact batches (< 80KB per request)
      let tablesObj: Record<string, any[]> = {};
      if (Array.isArray(parsed)) {
        tablesObj[selectedTable || 'ai_logs'] = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.tables && typeof parsed.tables === 'object') {
          tablesObj = parsed.tables;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          tablesObj[selectedTable || 'ai_logs'] = parsed.data;
        } else {
          tablesObj = parsed;
        }
      }

      const orderedTables = Object.entries(tablesObj)
        .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
        .sort(([a], [b]) => {
          if (a === 'file_folders') return -1;
          if (b === 'file_folders') return 1;
          return 0;
        });

      if (orderedTables.length === 0) {
        showAdminAlert('Пустой бэкап', 'В переданном JSON не найдено таблиц с записями для восстановления.');
        return;
      }

      const CHUNK_SIZE = 25;
      let totalTables = 0;
      let totalRows = 0;

      for (const [tbl, rows] of orderedTables) {
        totalTables++;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const processedSoFar = Math.min(i + chunk.length, rows.length);
          setRestoreProgress(`Таблица ${tbl}: ${processedSoFar} / ${rows.length}...`);

          const res = await fetch('/api/admin/restore-json-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              backupData: { [tbl]: chunk },
              table: tbl,
              skipPostSync: true
            })
          });
          const data = await parseServerJsonResponse(res, `восстановлении таблицы ${tbl}`);
          if (!res.ok || data.error) {
            showAdminAlert('Ошибка восстановления бэкапа', data.error || `Сбой в таблице ${tbl}`);
            return;
          }
          totalRows += Number(data.totalRowsRestored ?? chunk.length);
        }
      }

      setRestoreProgress('Финализация индексов и пересчет балансов...');
      const finRes = await fetch('/api/admin/restore-json-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const finData = await parseServerJsonResponse(finRes, 'финализации восстановления');
      if (!finRes.ok || finData.error) {
        showAdminAlert('Ошибка финализации бэкапа', finData.error || 'Не удалось завершить пересчет балансов');
        return;
      }

      setSuccessMessage(`Восстановление бэкапа успешно выполнено! Обработано таблиц: ${totalTables}, записей: ${totalRows}`);
      setIsRestoreModalOpen(false);
      setRestoreJsonText('');
      setRestoreJsonUrl('');
      fetchTables();
      if (selectedTable) fetchTableData(selectedTable);
    } catch (err: any) {
      showAdminAlert('Сбой восстановления Бэкапа', err.message);
    } finally {
      setIsRestoring(false);
      setRestoreProgress('');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportCsvText(event.target?.result as string || '');
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleImportCsvSubmit = async () => {
    if (!selectedTable || !importCsvText.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: selectedTable, csvData: importCsvText })
      });

      const data = await parseServerJsonResponse(res, 'импорте таблицы');

      if (!res.ok || data.error) {
        showAdminAlert('Ошибка импорта', data.error || 'Неизвестная ошибка сервера');
      } else {
        setSuccessMessage(data.message || 'Данные успешно импортированы!');
        setIsImportModalOpen(false);
        setImportCsvText('');
        fetchTableData(selectedTable);
      }
    } catch (err: any) {
      showAdminAlert('Сбой импорта', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'Никогда';
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Filtered & Sorted Table Data for Search
  const filteredRows = tableData ? tableData.filter(row => {
    if (!searchFilter.trim()) return true;
    const searchLower = searchFilter.toLowerCase();
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    if (!tableSortColumn) return 0;
    const valA = a[tableSortColumn];
    const valB = b[tableSortColumn];
    if (valA === valB) return 0;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;
    if (typeof valA === 'number' && typeof valB === 'number') {
      return tableSortDirection === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    return tableSortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  }) : [];

  // Pagination calculations
  const totalRowsCount = filteredRows.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalRowsCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(startIdx, startIdx + pageSize);
  }, [filteredRows, pageSize, safeCurrentPage]);

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-6xl mx-auto px-2 sm:px-4 text-[14px]">
      {/* Top Banner Header */}
      <div className="parchment-card p-5 sm:p-6 flex flex-col gap-4 border-gold/30 shadow-lg bg-transparent">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold">
              <Server size={20} className="text-amber-700" />
              <span className="font-mono tracking-wide text-[14px]">Системное ядро вселенной AiHim</span>
            </div>
            <h1 className="font-gothic text-2xl sm:text-3xl tracking-wide text-sepia mt-1">
              Управление базой данных и крон
            </h1>
            <p className="text-[14px] italic text-sepia/80 mt-0.5">
              Удобный конструктор автоматизации, табличный редактор и фоновые службы
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AppVersionControl compact readOnly={!isAdmin} />

            <button
              onClick={handleExportJsonBackup}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-[14px] font-medium rounded-full transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title="Скачать бэкап всей базы данных в 1 клик (JSON)"
            >
              <Download size={15} /> Бэкап БД (JSON)
            </button>

            <button
              onClick={() => setIsRestoreModalOpen(true)}
              className="px-4 py-2 bg-indigo-800 hover:bg-indigo-900 text-white text-[14px] font-medium rounded-full transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title="Загрузить и восстановить бэкап базы данных из файла JSON"
            >
              <Upload size={15} /> Восстановление
            </button>

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[14px] font-semibold bg-transparent ${
              isAdmin ? 'border-gold/40 text-amber-900' : 'border-blue-300 text-blue-900'
            }`}>
              <Shield size={15} />
              <span>{isAdmin ? 'Администратор' : 'Менеджер (просмотр)'}</span>
            </div>

            <Link
              to="/admin"
              className="px-4 py-2 bg-sepia text-parchment hover:bg-sepia-light text-[14px] font-medium rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm transition-all flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <ArrowLeft size={15} /> CRM Кабинет
            </Link>
          </div>
        </div>
      </div>

      {/* Global Banners */}
      {error && (
        <div className="p-3 bg-transparent border border-red-400/60 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm text-[14px] text-red-800 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <span>Системная ошибка: {error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-transparent border border-amber-400/60 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm text-[14px] text-amber-900 flex items-center gap-2 shadow-sm">
          <Zap size={16} className="shrink-0 text-amber-600 animate-bounce" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="parchment-card p-4 border-gold/25 bg-transparent flex flex-col">
          <span className="text-[14px] text-sepia/70">База данных</span>
          <span className="text-[16px] font-gothic text-sepia mt-1 flex items-center gap-2">
            <Database size={16} className="text-amber-700 shrink-0" /> PostgreSQL (aihim2)
          </span>
        </div>
        <div className="parchment-card p-4 border-gold/25 bg-transparent flex flex-col">
          <span className="text-[14px] text-sepia/70">Таблицы БД</span>
          <span className="text-2xl font-gothic text-sepia mt-1">{tables.length}</span>
        </div>
        <div className="parchment-card p-4 border-gold/25 bg-transparent flex flex-col">
          <span className="text-[14px] text-sepia/70">Триггеры</span>
          <span className="text-2xl font-gothic text-sepia mt-1">{hasLoadedTriggers ? triggers.length : 'По требованию'}</span>
        </div>
        <div className="parchment-card p-4 border-gold/25 bg-transparent flex flex-col">
          <span className="text-[14px] text-sepia/70">Фоновые кроны</span>
          <span className="text-[16px] font-gothic text-amber-900 mt-1 flex items-center gap-2 font-bold">
            <Cpu size={16} className="text-amber-700 shrink-0" /> {hasLoadedCron ? `${cronJobs.length} задач` : 'Каждую 1 мин'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs - Vertical/Bubble Stack on Mobile (no horizontal scroll), Wrapping Bubbles on Desktop */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap border-b border-sepia/20 gap-2 pb-3">
        <button
          onClick={() => setActiveTab('tables')}
          className={`px-4 py-2.5 text-[14px] font-medium rounded-full transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'tables'
              ? 'bg-sepia text-parchment font-bold shadow-md'
              : 'bg-transparent text-sepia hover:bg-amber-900/10 border border-sepia/20'
          }`}
        >
          <Table size={15} /> Таблицы БД ({tables.length})
        </button>

        <button
          onClick={() => setActiveTab('cron')}
          className={`px-4 py-2.5 text-[14px] font-medium rounded-full transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'cron'
              ? 'bg-sepia text-parchment font-bold shadow-md'
              : 'bg-transparent text-sepia hover:bg-amber-900/10 border border-sepia/20'
          }`}
        >
          <Cpu size={15} /> Крон менеджер
        </button>

        <button
          onClick={() => setActiveTab('triggers')}
          className={`px-4 py-2.5 text-[14px] font-medium rounded-full transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'triggers'
              ? 'bg-sepia text-parchment font-bold shadow-md'
              : 'bg-transparent text-sepia hover:bg-amber-900/10 border border-sepia/20'
          }`}
        >
          <Zap size={15} /> БД триггеры
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-2.5 text-[14px] font-medium rounded-full transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-sepia text-parchment font-bold shadow-md'
              : 'bg-transparent text-sepia hover:bg-amber-900/10 border border-sepia/20'
          }`}
        >
          <Code size={15} /> SQL консоль
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2.5 text-[14px] font-medium rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm transition-all flex items-center justify-center sm:justify-start gap-2 cursor-pointer ${
            activeTab === 'files'
              ? 'bg-sepia text-parchment font-bold shadow-md'
              : 'bg-transparent text-sepia hover:bg-amber-900/10 border border-sepia/20'
          }`}
        >
          <Cloud size={15} /> Облако файлов
        </button>
      </div>

      {/* TAB 1: Database Tables */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table List */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <h3 className="text-[14px] font-semibold text-amber-900 mb-1">
              Выберите таблицу
            </h3>
            {isLoadingTables && tables.length === 0 ? (
              <div className="py-6 flex items-center justify-center bg-transparent border border-sepia/15 rounded-2xl">
                <NeurosphereLoader label="Загрузка" size="sm" />
              </div>
            ) : tables.map(tblName => (
              <button
                key={tblName}
                onClick={() => {
                  setSelectedTable(tblName);
                  setSearchFilter('');
                  setSelectedRowKeys([]);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm border text-[14px] transition-all flex items-center justify-between gap-2 font-mono cursor-pointer ${
                  selectedTable === tblName
                    ? 'border-amber-700/60 bg-amber-100/40 text-amber-950 font-bold shadow-sm'
                    : 'border-sepia/20 bg-transparent hover:bg-amber-900/5 hover:border-sepia/35 text-sepia'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <Table size={15} className={selectedTable === tblName ? 'text-amber-800 shrink-0' : 'opacity-60 shrink-0'} />
                  <span className="truncate">{tblName}</span>
                </span>
                <span className="text-[14px] font-sans px-2 py-0.5 rounded-full border border-sepia/15 text-sepia/80 shrink-0">
                  {tblName === 'users' ? 'Люди' : tblName === 'discovered_elements' ? 'Элементы' : 'Данные'}
                </span>
              </button>
            ))}

            <div className="pt-2 border-t border-sepia/15 space-y-2">
              <button
                onClick={handleExportJsonBackup}
                className="w-full p-2.5 rounded-lg border border-amber-700/50 bg-amber-800 hover:bg-amber-900 text-white text-xs transition flex items-center justify-center gap-1.5 font-mono font-bold shadow active:scale-95 cursor-pointer"
                title="Скачать всю базу данных в 1 файл JSON"
              >
                <Download size={14} />
                📦 Скачать Бэкап БД (JSON)
              </button>

              <button
                onClick={() => setIsRestoreModalOpen(true)}
                className="w-full p-2.5 rounded-lg border border-indigo-700/50 bg-indigo-800 hover:bg-indigo-900 text-white text-xs transition flex items-center justify-center gap-1.5 font-mono font-bold shadow active:scale-95 cursor-pointer"
                title="Восстановить базу данных из файла JSON (добавляет и обновляет записи)"
              >
                <Upload size={14} />
                📥 Восстановление бэкапа (JSON)
              </button>

              <button
                onClick={handleExportAllTablesCsv}
                className="w-full p-2 rounded-lg border border-emerald-700/50 bg-emerald-900/80 hover:bg-emerald-900 text-emerald-100 text-[11px] transition flex items-center justify-center gap-1.5 font-mono cursor-pointer"
              >
                <Download size={12} />
                Экспорт таблиц в ZIP (CSV)
              </button>
            </div>
          </div>

          {/* Table Content Explorer */}
          <div className="lg:col-span-3">
            {selectedTable ? (
              <div className="parchment-card p-0 border-gold/30 overflow-hidden bg-white/80 shadow-md">
                <div className="p-4 bg-amber-50/80 border-b border-sepia/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Table size={16} className="text-amber-800" />
                    <span className="text-xs font-mono font-bold text-sepia">
                      Таблица: <span className="text-amber-900 uppercase font-black">{selectedTable}</span> ({filteredRows.length} записей)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleExportTableCsv(selectedTable)}
                      className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-xs transition flex items-center gap-1 font-mono font-bold shadow"
                      title="Скачать таблицу в формате CSV"
                    >
                      <Download size={11} />
                      CSV Экспорт
                    </button>
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded text-xs transition flex items-center gap-1 font-mono font-bold shadow"
                      title="Импортировать данные из CSV файла"
                    >
                      <Upload size={11} />
                      CSV Импорт
                    </button>
                    <div className="relative flex-1 sm:w-44">
                      <Search size={12} className="absolute left-2.5 top-2.5 text-sepia/50" />
                      <input
                        type="text"
                        placeholder="Поиск по строкам..."
                        value={searchFilter}
                        onChange={e => {
                          setSearchFilter(e.target.value);
                          setSelectedRowKeys([]);
                        }}
                        className="w-full pl-8 pr-2 py-1 bg-white border border-sepia/20 rounded text-xs font-mono focus:outline-none focus:border-amber-700"
                      />
                    </div>
                    <button
                      onClick={() => {
                        fetchTableData(selectedTable);
                        setSelectedRowKeys([]);
                      }}
                      className="px-2.5 py-1 bg-sepia text-parchment hover:bg-sepia-light rounded text-xs transition flex items-center gap-1 font-mono shrink-0"
                    >
                      <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                      Обновить
                    </button>
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedRowKeys.length > 0 && (
                  <div className="p-3 bg-red-100 border-b border-red-300 text-xs font-mono text-red-950 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-2 font-bold">
                      <Trash2 size={16} className="text-red-700" />
                      <span>Выбрано строк: <span className="text-red-900 font-black">{selectedRowKeys.length}</span></span>
                      {selectedTable === 'users' && (
                        <span className="text-[10px] text-red-800 italic font-normal">(При удалении также удалятся все их элементы из БД)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRowKeys([])}
                        className="px-3 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-900 text-xs font-mono rounded transition"
                      >
                        Снять выбор
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting}
                        className="px-4 py-1 bg-red-800 hover:bg-red-900 text-white font-bold text-xs font-mono rounded shadow flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {isBulkDeleting ? 'Удаление...' : `Удалить выбранные (${selectedRowKeys.length})`}
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-2 bg-amber-100/40 border-b border-sepia/10 text-[11px] font-mono text-amber-900 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-amber-700 shrink-0" />
                    <span>💡 Выберите число строк или используйте листалку страниц.</span>
                  </div>

                  {/* Page Size & Page Nav Controls Header */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sepia font-bold text-[10px] uppercase">Строк:</span>
                      <select
                        value={pageSize}
                        onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-white border border-sepia/20 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-700"
                      >
                        <option value={20}>20</option>
                        <option value={100}>100</option>
                        <option value={500}>500</option>
                        <option value="all">Все ({totalRowsCount})</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-2 py-0.5 bg-white border border-sepia/20 hover:bg-amber-100 rounded text-xs font-bold font-mono text-amber-950 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        ◀ Назад
                      </button>
                      <span className="font-bold text-amber-950 text-xs">
                        {safeCurrentPage} / {totalPages}
                      </span>
                      <button
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-2 py-0.5 bg-white border border-sepia/20 hover:bg-amber-100 rounded text-xs font-bold font-mono text-amber-950 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        Вперед ▶
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  {isLoadingTableData && (!displayedRows || displayedRows.length === 0) ? (
                    <div className="py-10 flex items-center justify-center bg-transparent">
                      <NeurosphereLoader label="Загрузка" size="md" />
                    </div>
                  ) : displayedRows && displayedRows.length > 0 ? (
                    <table className="w-full text-left text-[14px] font-mono">
                      <thead>
                        <tr className="bg-amber-100/60 text-amber-950 text-[14px] border-b border-sepia/20">
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={displayedRows.length > 0 && displayedRows.every(r => {
                                const pkField = Object.keys(r || {})[0] || 'id';
                                return selectedRowKeys.includes(String(r[pkField]));
                              })}
                              onChange={e => {
                                if (e.target.checked) {
                                  const pkField = Object.keys(displayedRows[0] || {})[0] || 'id';
                                  const pageKeys = displayedRows.map(r => String(r[pkField]));
                                  setSelectedRowKeys(prev => Array.from(new Set([...prev, ...pageKeys])));
                                } else {
                                  const pkField = Object.keys(displayedRows[0] || {})[0] || 'id';
                                  const pageKeys = new Set(displayedRows.map(r => String(r[pkField])));
                                  setSelectedRowKeys(prev => prev.filter(k => !pageKeys.has(k)));
                                }
                              }}
                              className="cursor-pointer accent-amber-800 w-4 h-4"
                              title="Выбрать все строки на текущей странице"
                            />
                          </th>
                          <th className="p-3 w-10 text-center">⚙️</th>
                          {tableHeaders.map(key => {
                            const isSorted = tableSortColumn === key;
                            return (
                              <th 
                                key={key} 
                                onClick={() => {
                                  if (tableSortColumn === key) {
                                    setTableSortDirection(tableSortDirection === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setTableSortColumn(key);
                                    setTableSortDirection('asc');
                                  }
                                }}
                                className="p-3 font-bold cursor-pointer hover:bg-amber-200/80 transition-colors select-none"
                                title={`Сортировать по ${key}`}
                              >
                                <div className="flex items-center gap-1">
                                  <span>{key}</span>
                                  <span className="text-[14px] text-amber-800 font-black">
                                    {isSorted ? (tableSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sepia/10">
                        {displayedRows.map((row, idx) => {
                          const pkField = tableHeaders[0] || Object.keys(row)[0] || 'id';
                          const pkVal = String(row[pkField] ?? '');
                          const isRowSelected = selectedRowKeys.includes(pkVal);

                          return (
                            <tr 
                              key={idx} 
                              onClick={() => handleOpenRowModal(row)}
                              className={`hover:bg-amber-100/70 cursor-pointer transition-colors group ${
                                isRowSelected ? 'bg-amber-100/90 font-medium' : ''
                              }`}
                            >
                              <td 
                                className="p-3 text-center" 
                                onClick={e => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isRowSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedRowKeys(prev => [...prev, pkVal]);
                                    } else {
                                      setSelectedRowKeys(prev => prev.filter(k => k !== pkVal));
                                    }
                                  }}
                                  className="cursor-pointer accent-amber-800 w-4 h-4"
                                />
                              </td>
                              <td className="p-3 text-center text-amber-700 font-bold group-hover:scale-125 transition-transform">
                                <Edit3 size={14} />
                              </td>
                              {tableHeaders.map((key, colIdx) => {
                                const val = row[key];
                                return (
                                  <td key={colIdx} className="p-3 max-w-[220px] truncate" title={val !== undefined && val !== null ? String(val) : ''}>
                                    {val === undefined || val === null ? (
                                      <span className="text-sepia/40 italic">null</span>
                                    ) : typeof val === 'object' ? (
                                      JSON.stringify(val)
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-10 text-center text-[14px] opacity-70 italic font-mono">
                      {searchFilter ? 'По вашему фильтру ничего не найдено.' : 'Таблица пуста.'}
                    </div>
                  )}
                </div>

                {/* Table Footer with Pagination Controls */}
                <div className="p-3 bg-amber-50/80 border-t border-sepia/15 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="text-sepia font-bold">
                    Показано строк {totalRowsCount === 0 ? 0 : (pageSize === 'all' ? 1 : (safeCurrentPage - 1) * pageSize + 1)}–{pageSize === 'all' ? totalRowsCount : Math.min(safeCurrentPage * pageSize, totalRowsCount)} из {totalRowsCount}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sepia font-bold text-xs">Строк на страницу:</span>
                      <select
                        value={pageSize}
                        onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="bg-white border border-sepia/20 rounded px-2.5 py-1 text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-700 shadow-sm"
                      >
                        <option value={20}>20 записей</option>
                        <option value={100}>100 записей</option>
                        <option value={500}>500 записей</option>
                        <option value="all">Все ({totalRowsCount})</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1 bg-white border border-sepia/20 hover:bg-amber-100 rounded text-xs font-bold font-mono text-amber-950 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                      >
                        ◀ Назад
                      </button>
                      <span className="font-bold text-amber-950 px-1">
                        Стр. {safeCurrentPage} из {totalPages}
                      </span>
                      <button
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-3 py-1 bg-white border border-sepia/20 hover:bg-amber-100 rounded text-xs font-bold font-mono text-amber-950 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                      >
                        Вперед ▶
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : isLoadingTables ? (
              <div className="py-12 flex items-center justify-center bg-transparent border border-sepia/15 rounded-2xl">
                <NeurosphereLoader label="Загрузка" size="md" />
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-sepia/20 rounded-xl bg-transparent p-6 text-center text-[14px] text-sepia/70">
                <Database size={32} className="mb-2 text-amber-700 opacity-60" />
                Выберите таблицу из списка слева для инспекции и редактирования записей.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Cron Jobs Manager */}
      {activeTab === 'cron' && (
        <div className="flex flex-col gap-5">
          {/* Easy mode switcher header */}
          <div className="parchment-card p-4 border-gold/30 bg-amber-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 text-lg">
                🧙‍♂️
              </div>
              <div>
                <h3 className="text-sm font-bold text-sepia">Настройка Крон Задач</h3>
                <p className="text-xs text-sepia/70">Управление фоновыми службами сервера</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sepia/15 shadow-sm">
              <span className="text-xs font-mono text-sepia/80 font-bold">Простой режим (Для чайников):</span>
              <button
                onClick={() => setNoCodeMode(!noCodeMode)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  noCodeMode 
                    ? 'bg-amber-800 text-amber-50 shadow-md' 
                    : 'bg-sepia/10 text-sepia hover:bg-sepia/20'
                }`}
              >
                {noCodeMode ? <ToggleRight size={18} className="text-amber-300" /> : <ToggleLeft size={18} />}
                {noCodeMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}
              </button>
            </div>
          </div>

          {/* CRON CHEATSHEET & INSTRUCTION CARD */}
          <div className="parchment-card p-5 border-gold/40 bg-amber-50/40 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-sepia/15 pb-2">
              <h4 className="text-xs font-bold font-mono text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <span>📖</span> Шпаргалка по Cron-выражениям (Формат 5 символов)
              </h4>
              <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                [Минута] [Час] [День] [Месяц] [ДеньНедели]
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
              <div className="bg-white p-2 rounded-xl border border-sepia/15">
                <div className="text-amber-800 font-bold text-sm">*</div>
                <div className="text-[10px] text-sepia/60">1. Минуты (0-59)</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-sepia/15">
                <div className="text-amber-800 font-bold text-sm">*</div>
                <div className="text-[10px] text-sepia/60">2. Часы (0-23)</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-sepia/15">
                <div className="text-amber-800 font-bold text-sm">*</div>
                <div className="text-[10px] text-sepia/60">3. День мес (1-31)</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-sepia/15">
                <div className="text-amber-800 font-bold text-sm">*</div>
                <div className="text-[10px] text-sepia/60">4. Месяц (1-12)</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-sepia/15">
                <div className="text-amber-800 font-bold text-sm">*</div>
                <div className="text-[10px] text-sepia/60">5. День нед (0-6)</div>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-bold text-sepia mb-1.5">Готовые популярные шаблоны расписаний:</div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  onClick={() => setEditingCronJob({ name: 'EnergyRegenBackground', title: 'Регенерация Энергии', schedule: '*/1 * * * *', description: 'Каждую 1 минуту' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-sepia/20 rounded-lg text-amber-900 font-bold transition shadow-xs"
                >
                  ⚡ */1 * * * * (Каждую 1 мин)
                </button>
                <button
                  onClick={() => setEditingCronJob({ name: 'ShortIntervalJob', title: 'Интервал 5 минут', schedule: '*/5 * * * *', description: 'Каждые 5 минут' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-sepia/20 rounded-lg text-amber-900 font-bold transition shadow-xs"
                >
                  ⏱️ */5 * * * * (Каждые 5 мин)
                </button>
                <button
                  onClick={() => setEditingCronJob({ name: 'HourlyJob', title: 'Ежечасовая проверка', schedule: '0 * * * *', description: 'Каждый час в 00 минут' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-sepia/20 rounded-lg text-amber-900 font-bold transition shadow-xs"
                >
                  🕐 0 * * * * (Каждый час)
                </button>
                <button
                  onClick={() => setEditingCronJob({ name: 'CleanStaleLogs', title: 'Очистка Логов', schedule: '0 0 * * *', description: 'Раз в сутки в полночь' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-sepia/20 rounded-lg text-amber-900 font-bold transition shadow-xs"
                >
                  🌙 0 0 * * * (Каждую ночь 00:00)
                </button>
                <button
                  onClick={() => setEditingCronJob({ name: 'WeeklyDigest', title: 'Еженедельный дайджест', schedule: '0 0 * * 1', description: 'Раз в неделю по понедельникам' })}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-sepia/20 rounded-lg text-amber-900 font-bold transition shadow-xs"
                >
                  📅 0 0 * * 1 (Пн 00:00)
                </button>
              </div>
            </div>
          </div>

          {noCodeMode ? (
            /* EASY NO-CODE CRON CARDS FOR ALL CRON JOBS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {cronJobs && cronJobs.length > 0 ? (
                cronJobs.map(job => {
                  const isEnergy = job.name.includes('EnergyRegen');
                  const isInactive = job.name.includes('WeeklyInactive');
                  const isLogs = job.name.includes('CleanStaleLogs');
                  const isReward = job.name.includes('WeeklyReward');

                  const title = isEnergy 
                    ? 'Регенерация Энергии' 
                    : isInactive 
                    ? 'Рассылка Неактивным Игрокам' 
                    : isLogs 
                    ? 'Очистка Логов ИИ' 
                    : isReward 
                    ? 'Награды Лучшим Игрокам' 
                    : job.name;

                  const description = isEnergy 
                    ? 'Начисляет эфирную энергию активным алхимикам каждые 60 секунд.' 
                    : isInactive 
                    ? 'Авто-отправка 5 вариантов текстов пользователям, не заходившим более 7 дней.' 
                    : isLogs 
                    ? 'Автоматическая очистка старых системных журналов и отчетов.' 
                    : isReward 
                    ? 'Подсчитывает ТОП-10 алхимикам недели и выдает бонусы.' 
                    : 'Системная фоновая служба сервера.';

                  const badgeColor = isEnergy ? 'bg-emerald-600' : isInactive ? 'bg-amber-600' : isLogs ? 'bg-blue-600' : 'bg-purple-600';

                  return (
                    <div key={job.name} className="parchment-card p-4 border-gold/40 bg-white/90 flex flex-col justify-between gap-3 shadow-md rounded-2xl relative overflow-hidden">
                      <div className={`absolute top-0 right-0 ${badgeColor} text-white text-[9px] font-bold px-2.5 py-1 rounded-bl-xl uppercase tracking-widest font-mono`}>
                        {job.status === 'active' || job.status === 'running' || !job.status ? 'АКТИВЕН' : job.status}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2 pr-12">
                          <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800 text-sm">
                            {isEnergy ? '⚡' : isInactive ? '✉️' : isLogs ? '🧹' : '🏆'}
                          </div>
                          <h4 className="font-bold text-xs text-sepia leading-tight">{title}</h4>
                        </div>
                        <p className="text-[11px] text-sepia/80 leading-relaxed min-h-[32px]">
                          {description}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-sepia/10">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-sepia/60">Периодичность:</span>
                          <span className="font-bold font-mono text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {job.schedule}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-sepia/60">Запусков:</span>
                          <span className="font-bold font-mono text-emerald-800">{job.executionsCount || 0}</span>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleRunCron(job.name)}
                            disabled={isLoading || isManager}
                            className="flex-1 py-2 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl font-bold text-[11px] shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Play size={12} /> Запустить
                          </button>
                          <button
                            onClick={() => setEditingCronJob({
                              name: job.name,
                              title: title,
                              schedule: job.schedule,
                              description: description
                            })}
                            disabled={isManager}
                            className="px-2.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-[11px] shadow-xs transition flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Edit3 size={12} /> Настроить
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : isLoadingCron ? (
                <div className="col-span-full py-10 flex items-center justify-center bg-transparent">
                  <NeurosphereLoader label="Загрузка" size="md" />
                </div>
              ) : (
                <div className="col-span-full p-8 text-center text-[14px] text-sepia/60 italic font-mono">
                  Список крон-задач пуст.
                </div>
              )}
            </div>
          ) : (
            /* DEV MODE CRON DISPLAY */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cronJobs && cronJobs.length > 0 ? (
                cronJobs.map(job => (
                  <div key={job.name} className="parchment-card p-5 border-gold/30 bg-white/80 flex flex-col gap-3 font-mono">
                    <div className="flex items-center justify-between border-b border-sepia/15 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Terminal size={15} className="text-amber-800" />
                        <span className="text-xs font-bold text-sepia">{job.name}</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                        {job.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-sepia/60">Cron syntax:</span>
                        <div className="text-amber-950 font-bold">{job.schedule}</div>
                      </div>
                      <div>
                        <span className="text-sepia/60">Запусков:</span>
                        <div className="text-amber-950 font-bold">{job.executionsCount}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sepia/60">Прошлый запуск:</span>
                        <div className="text-amber-950 font-semibold">{formatTimestamp(job.lastRun)}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRunCron(job.name)}
                      disabled={isLoading || isManager}
                      className="w-full mt-2 py-2 bg-amber-800 text-amber-50 rounded text-xs font-bold"
                    >
                      Запустить вручную
                    </button>
                  </div>
                ))
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Database Triggers */}
      {activeTab === 'triggers' && (
        <div className="flex flex-col gap-5">
          {/* Easy mode switcher header */}
          <div className="parchment-card p-4 border-gold/30 bg-amber-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 text-lg">
                ⚡
              </div>
              <div>
                <h3 className="text-sm font-bold text-sepia">Автоматика и Правила Базы Данных</h3>
                <p className="text-xs text-sepia/70">Регуляторы автоматических событий в приложении без программирования</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sepia/15 shadow-sm">
              <span className="text-xs font-mono text-sepia/80 font-bold">Простой режим (Для чайников):</span>
              <button
                onClick={() => setNoCodeMode(!noCodeMode)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  noCodeMode 
                    ? 'bg-amber-800 text-amber-50 shadow-md' 
                    : 'bg-sepia/10 text-sepia hover:bg-sepia/20'
                }`}
              >
                {noCodeMode ? <ToggleRight size={18} className="text-amber-300" /> : <ToggleLeft size={18} />}
                {noCodeMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}
              </button>
            </div>
          </div>

          {noCodeMode ? (
            /* NO-CODE EASY TRIGGERS DISPLAY */
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rule 1 */}
                <div className="parchment-card p-5 border-gold/40 bg-white/90 flex flex-col justify-between gap-3 rounded-2xl shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
                      <span className="text-xs font-bold text-amber-900 uppercase font-mono">Правило №1</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                        АКТИВНО
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-sepia">Авто-повышение Уровня Алхимика</h4>
                    <p className="text-xs text-sepia/80">
                      <strong>Когда:</strong> Игрок совершает трансмутацию и открывает каждые 5 новых элементов.
                    </p>
                    <p className="text-xs text-sepia/80">
                      <strong>Действие:</strong> Система автоматически вычисляет и повышает его уровень и ранг.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingTrigger({
                      name: 'Авто-повышение Уровня Алхимика',
                      tbl_name: 'discovered_elements',
                      event: 'При открытии каждых 5 новых элементов',
                      action: 'Повысить уровень и ранг',
                      active: true,
                      ruleId: 1
                    })}
                    className="w-full py-1.5 mt-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    ✏️ Редактировать Правило №1
                  </button>
                </div>

                {/* Rule 2 */}
                <div className="parchment-card p-5 border-gold/40 bg-white/90 flex flex-col justify-between gap-3 rounded-2xl shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
                      <span className="text-xs font-bold text-amber-900 uppercase font-mono">Правило №2</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                        АКТИВНО
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-sepia">Реферальный Бонус Ученика</h4>
                    <p className="text-xs text-sepia/80">
                      <strong>Когда:</strong> В Telegram Mini App регистрируется новый ученик по реферальной ссылке.
                    </p>
                    <p className="text-xs text-sepia/80">
                      <strong>Действие:</strong> Автоматически начисляется бонус энергии (+100,000 * уровень) обоим игрокам.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingTrigger({
                      name: 'Реферальный Бонус Ученика',
                      tbl_name: 'users',
                      event: 'При регистрации нового ученика по реферальной ссылке',
                      action: 'Начислить +100,000 AiHim энергии',
                      active: true,
                      ruleId: 2
                    })}
                    className="w-full py-1.5 mt-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    ✏️ Редактировать Правило №2
                  </button>
                </div>

                {/* Rule 3 */}
                <div className="parchment-card p-5 border-gold/40 bg-white/90 flex flex-col justify-between gap-3 rounded-2xl shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-sepia/10 pb-2">
                      <span className="text-xs font-bold text-amber-900 uppercase font-mono">Правило №3</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                        АКТИВНО
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-sepia">Обновление Статуса при Оплате</h4>
                    <p className="text-xs text-sepia/80">
                      <strong>Когда:</strong> Пользователь пополняет баланс AiHim в магазине.
                    </p>
                    <p className="text-xs text-sepia/80">
                      <strong>Действие:</strong> Включает статус "Активен" и обновляет время активности в базе.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingTrigger({
                      name: 'Обновление Статуса при Оплате',
                      tbl_name: 'transactions',
                      event: 'При совершении платежа',
                      action: 'Включить статус Активен и обновить время активности',
                      active: true,
                      ruleId: 3
                    })}
                    className="w-full py-1.5 mt-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    ✏️ Редактировать Правило №3
                  </button>
                </div>
              </div>

              {/* Simple Rule Constructor for Non-Coders */}
              <div className="parchment-card p-6 border-gold/40 bg-amber-50/40 rounded-2xl flex flex-col gap-4 shadow-md">
                <div className="flex items-center gap-2 border-b border-sepia/15 pb-2">
                  <Plus size={18} className="text-amber-800" />
                  <h3 className="text-sm font-bold text-sepia uppercase tracking-wider font-mono">
                    Конструктор Простого Правила (Без Кода)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">Название правила:</label>
                    <input
                      type="text"
                      placeholder="Например: Бонус за активность"
                      value={newTriggerName}
                      onChange={e => setNewTriggerName(e.target.value)}
                      className="w-full p-2 bg-white border border-sepia/20 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">Когда происходит событие:</label>
                    <select
                      value={newTriggerEvent}
                      onChange={e => setNewTriggerEvent(e.target.value)}
                      className="w-full p-2 bg-white border border-sepia/20 rounded-lg text-xs"
                    >
                      <option>При получении нового ученика</option>
                      <option>При совершении успешного платежа</option>
                      <option>При первом входе в день</option>
                      <option>При открытии редкого элемента</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">Автоматическое действие:</label>
                    <select
                      value={newTriggerAction}
                      onChange={e => setNewTriggerAction(e.target.value)}
                      className="w-full p-2 bg-white border border-sepia/20 rounded-lg text-xs"
                    >
                      <option>Начислить +100,000 AiHim энергии</option>
                      <option>Повысить уровень пользователя</option>
                      <option>Отправить поздравление в бот</option>
                      <option>Активировать премиум статус</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!newTriggerName) {
                        showAdminAlert('Недостаточно данных', 'Укажите название нового правила.');
                        return;
                      }
                      setSuccessMessage(`Новое автоматическое правило "${newTriggerName}" успешно создано и подключено!`);
                      setNewTriggerName('');
                    }}
                    className="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 text-amber-50 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 size={14} /> Сохранить Новое Правило
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* DEV MODE TRIGGERS SQL DISPLAY */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {triggers && triggers.length > 0 ? (
                triggers.map((trigger, idx) => (
                  <div key={`${trigger.name}-${idx}`} className="parchment-card p-4 border-gold/30 bg-white/80 flex flex-col gap-2 font-mono">
                    <div className="flex items-center justify-between border-b border-sepia/15 pb-2">
                      <span className="text-xs font-bold text-amber-900">{trigger.name}</span>
                      <button
                        onClick={() => setEditingTrigger({
                          name: trigger.name,
                          tbl_name: trigger.tbl_name,
                          sql: trigger.sql,
                          active: true
                        })}
                        className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1"
                      >
                        ✏️ Редактировать SQL
                      </button>
                    </div>
                    <div className="text-xs text-sepia/80">
                      Целевая таблица: <span className="font-bold text-amber-950">{trigger.tbl_name}</span>
                    </div>
                    <div className="mt-1 bg-[#1c120c] text-orange-200/90 p-3 rounded-lg text-[11px] whitespace-pre-wrap overflow-x-auto max-h-36 border border-sepia/30">
                      <code>{trigger.sql}</code>
                    </div>
                  </div>
                ))
              ) : isLoadingTriggers ? (
                <div className="col-span-full py-10 flex items-center justify-center bg-transparent">
                  <NeurosphereLoader label="Загрузка" size="md" />
                </div>
              ) : (
                <div className="col-span-full p-8 text-center text-[14px] text-sepia/60 italic font-mono">
                  Активных SQL-триггеров пока нет.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SQL Console */}
      {activeTab === 'sql' && (
        <div className="flex flex-col gap-4">
          <div className="parchment-card p-5 border-gold/30 bg-white/80 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-sepia/15 pb-2">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-amber-800" />
                <h3 className="text-xs uppercase font-mono font-bold text-amber-900">
                  Прямые SQL Запросы к Серверу
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                {isAdmin ? 'ADMIN EXECUTE' : 'READ-ONLY MODE'}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-sepia/70 text-[11px] font-bold">Быстрые шаблоны:</span>
              <button
                onClick={() => setSqlQuery('SELECT * FROM users;')}
                className="px-2.5 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] transition"
              >
                Все пользователи
              </button>
              <button
                onClick={() => setSqlQuery('SELECT * FROM discovered_elements ORDER BY discoveredAt DESC LIMIT 100;')}
                className="px-2.5 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] transition"
              >
                Все открытые элементы
              </button>
              <button
                onClick={() => setSqlQuery("UPDATE users SET balance = balance + 50000 WHERE id = '169262990';")}
                className="px-2.5 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[11px] transition"
              >
                +50к AIhim Админу
              </button>
            </div>

            <textarea
              value={sqlQuery}
              onChange={e => setSqlQuery(e.target.value)}
              rows={4}
              placeholder="Введите SQL запрос..."
              className="w-full p-3 bg-[#1e130c] text-orange-200 font-mono text-xs rounded-lg border border-sepia/30 focus:outline-none focus:border-amber-500 shadow-inner"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-sepia/70 font-mono italic">
                Поддерживаются выборки SELECT и модификации UPDATE/INSERT/DELETE.
              </span>
              <button
                onClick={() => executeCustomSql()}
                disabled={isExecutingSql || !sqlQuery.trim() || isManager}
                className="px-6 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-amber-50 font-gothic tracking-wider uppercase text-xs rounded-lg transition-all shadow-md flex items-center gap-2 active:scale-95 font-bold"
              >
                <Send size={13} /> Выполнить SQL
              </button>
            </div>

            {sqlMessage && (
              <div className={`p-3 rounded-lg text-xs font-mono mt-2 border ${
                sqlMessage.includes('Ошибка') || sqlMessage.includes('Сбой') 
                  ? 'bg-red-50 border-red-200 text-red-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                {sqlMessage}
              </div>
            )}
          </div>

          {/* SQL Execution Results Table */}
          {sqlResultRows && (
            <div className="parchment-card p-0 border-gold/30 bg-white/80 overflow-hidden shadow-md">
              <div className="p-3 bg-amber-50 border-b border-sepia/15 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-950">
                  Результат Запроса ({sqlResultRows.length} записей)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                {sqlResultRows.length > 0 ? (
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-amber-100/60 text-amber-950 uppercase text-[10px] tracking-wider border-b border-sepia/20">
                        {Object.keys(sqlResultRows[0] || {}).map(key => (
                          <th key={key} className="p-3 font-bold">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sepia/10">
                      {sqlResultRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/50 transition">
                          {Object.values(row).map((val: any, colIdx) => (
                            <td key={colIdx} className="p-3 max-w-[220px] truncate" title={String(val)}>
                              {val === null ? (
                                <span className="text-sepia/40 italic">NULL</span>
                              ) : typeof val === 'object' ? (
                                JSON.stringify(val)
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-xs opacity-60 italic font-mono">
                    Запрос выполнен успешно, но строк не найдено.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Cloud Files Gallery */}
      {activeTab === 'files' && (
        <FileCloudManager />
      )}

      {/* LIGHT EDIT/DELETE ROW MODAL WINDOW (Requirement 3) */}
      <AnimatePresence>
        {editingRow && (
          <div 
            onClick={() => {
              setEditingRow(null);
              setSysAdminDeltaInput(0);
              setSysAdminReasonInput('');
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto"
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="parchment-card bg-[#fefcf8] border border-gold/40 text-sepia shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col my-auto"
            >
              {/* Modal Header */}
              <div className="p-5 bg-amber-100/80 border-b border-gold/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-200/80 rounded-lg text-amber-900">
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h3 className="font-gothic text-lg text-sepia font-bold">
                      Редактирование Записи Таблицы [{selectedTable?.toUpperCase()}]
                    </h3>
                    <p className="text-[11px] font-mono text-sepia/70">
                      Идентификатор записи: <strong className="text-amber-900">{String(editingRow.id || editingRow.name || Object.values(editingRow)[0]).substring(0, 50)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingRow(null);
                    setSysAdminDeltaInput(0);
                    setSysAdminReasonInput('');
                  }}
                  className="p-1.5 text-sepia/60 hover:text-sepia hover:bg-sepia/10 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form Fields */}
              <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                {selectedTable === 'users' && (
                  <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-300/60 flex flex-col gap-2 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-1.5 font-bold text-amber-950">
                      <span>Сводка по Балансу (Пользователь #{rowFormData.id})</span>
                      <span className="text-amber-900 font-mono">
                        {((Number(rowFormData.balance_start) || 1000) + (Number(rowFormData.balance_time) || 0) + (Number(rowFormData.balance_ref) || 0) + (Number(rowFormData.balance_pay) || 0) + (Number(rowFormData.balance_admin) || 0) + sysAdminDeltaInput).toLocaleString()} AiHim
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white p-2 rounded border border-amber-200">
                        <span className="text-sepia/60 block text-[9px]">1. Стартовый</span>
                        <span className="font-bold">{(Number(rowFormData.balance_start) || 1000).toLocaleString()} AiHim</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-amber-200">
                        <span className="text-sepia/60 block text-[9px]">2. Таймер</span>
                        <span className="font-bold">{(Number(rowFormData.balance_time) || 0).toLocaleString()} AiHim</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-amber-200">
                        <span className="text-sepia/60 block text-[9px]">3. Рефералы</span>
                        <span className="font-bold">{(Number(rowFormData.balance_ref) || 0).toLocaleString()} AiHim</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-amber-200">
                        <span className="text-sepia/60 block text-[9px]">4. Покупки</span>
                        <span className="font-bold">{(Number(rowFormData.balance_pay) || 0).toLocaleString()} AiHim</span>
                      </div>
                    </div>
                  </div>
                )}

                {Object.keys(rowFormData).map((fieldKey, idx) => {
                  const val = rowFormData[fieldKey];
                  const hasIdKey = Object.keys(rowFormData).some(k => k.toLowerCase() === 'id');
                  const isPrimaryKey = hasIdKey ? fieldKey.toLowerCase() === 'id' : idx === 0;

                  if (selectedTable === 'users' && fieldKey === 'balance_admin') {
                    return (
                      <div key={fieldKey} className="flex flex-col gap-1 font-mono">
                        <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <span>balance_admin</span>
                          <span className="text-[9px] bg-amber-300 text-amber-950 px-1.5 py-0.2 rounded font-mono uppercase font-bold">
                            КАЛЬКУЛЯТОР АДМИНА
                          </span>
                        </label>

                        <div className="p-3 bg-amber-500/10 border-2 border-amber-400/60 rounded-xl flex flex-col gap-2.5">
                          <div className="flex items-center justify-between border-b border-amber-300/40 pb-1.5">
                            <span className="text-[10px] text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1">
                              <span>🧮</span> Калькулятор Корректировки
                            </span>
                            <span className="text-xs font-bold text-amber-900 font-mono">
                              Текущий: {(Number(rowFormData.balance_admin) || 0).toLocaleString()} AiHim
                            </span>
                          </div>

                          <p className="text-[10px] text-amber-900/80 leading-relaxed">
                            Введите разницу (+/-). Транзакция создается автоматически в <code className="font-bold font-mono">transactions</code>.
                          </p>

                          <div className="flex flex-col gap-1 border-b border-amber-300/40 pb-2.5">
                            <label className="text-[9px] text-amber-900 font-bold uppercase">Прямое изменение balance_admin (Точное значение)</label>
                            <input 
                              type="number"
                              disabled={isManager}
                              value={rowFormData.balance_admin ?? ''}
                              onChange={e => {
                                const parsed = parseFloat(e.target.value);
                                setRowFormData({ ...rowFormData, balance_admin: isNaN(parsed) ? 0 : parsed });
                              }}
                              placeholder="0"
                              className="px-3 py-1.5 bg-white border border-amber-400 rounded font-mono text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-amber-900 font-bold uppercase">Или введите разницу (+/- Дельта)</label>
                            <input 
                              type="number"
                              value={sysAdminDeltaInput || ''}
                              onChange={e => setSysAdminDeltaInput(parseInt(e.target.value) || 0)}
                              placeholder="Например: +1000 или -500"
                              className="px-3 py-1.5 bg-white border border-amber-400 rounded font-mono text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {[-1000, -500, -100, 100, 500, 1000, 5000, 10000].map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setSysAdminDeltaInput(prev => prev + v)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                                  v > 0 
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' 
                                    : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                                }`}
                              >
                                {v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setSysAdminDeltaInput(0)}
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
                            >
                              Сброс
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-amber-900 font-bold uppercase">Причина / Описание</label>
                            <input 
                              type="text"
                              value={sysAdminReasonInput}
                              onChange={e => setSysAdminReasonInput(e.target.value)}
                              placeholder="Корректировка администратором"
                              className="px-3 py-1.5 bg-white border border-amber-300 rounded text-xs text-sepia focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Live Preview */}
                          <div className="p-2 bg-amber-100/80 rounded border border-amber-300/60 text-[10px] flex flex-col gap-1 font-mono text-amber-950">
                            <div className="flex justify-between">
                              <span>Корректировка:</span>
                              <span className={`font-bold ${sysAdminDeltaInput >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {sysAdminDeltaInput >= 0 ? `+${sysAdminDeltaInput.toLocaleString()}` : sysAdminDeltaInput.toLocaleString()} AiHim
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-amber-200 pt-1 font-bold">
                              <span>Новый balance_admin:</span>
                              <span>{((Number(rowFormData.balance_admin) || 0) + sysAdminDeltaInput).toLocaleString()} AiHim</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={fieldKey} className="flex flex-col gap-1 font-mono">
                      <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <span>{fieldKey}</span>
                        {isPrimaryKey && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono uppercase">
                            PRIMARY KEY
                          </span>
                        )}
                      </label>

                      {typeof val === 'object' && val !== null ? (
                        <textarea
                          rows={3}
                          value={typeof rowFormData[fieldKey] === 'string' ? rowFormData[fieldKey] : JSON.stringify(rowFormData[fieldKey], null, 2)}
                          onChange={e => {
                            try {
                              setRowFormData({ ...rowFormData, [fieldKey]: JSON.parse(e.target.value) });
                            } catch {
                              setRowFormData({ ...rowFormData, [fieldKey]: e.target.value });
                            }
                          }}
                          className="w-full p-2.5 bg-white border border-sepia/25 rounded-lg text-xs focus:outline-none focus:border-amber-700"
                        />
                      ) : typeof val === 'string' && (val.includes('\n') || val.length > 50 || fieldKey.toLowerCase().includes('prompt') || fieldKey.toLowerCase().includes('desc') || fieldKey.toLowerCase().includes('sql')) ? (
                        <textarea
                          rows={Math.min(14, Math.max(4, (String(rowFormData[fieldKey] || '').split('\n').length + 2)))}
                          disabled={isPrimaryKey || isManager}
                          value={rowFormData[fieldKey] ?? ''}
                          onChange={e => setRowFormData({ ...rowFormData, [fieldKey]: e.target.value })}
                          className="w-full p-2.5 bg-white border border-sepia/25 rounded-lg text-xs font-mono focus:outline-none focus:border-amber-700 shadow-inner"
                        />
                      ) : (
                        <input
                          type={typeof val === 'number' ? 'number' : 'text'}
                          disabled={isPrimaryKey || isManager}
                          value={rowFormData[fieldKey] ?? ''}
                          onChange={e => {
                            const newNum = Number(e.target.value);
                            const finalVal = typeof val === 'number' && !isNaN(newNum) ? newNum : e.target.value;
                            setRowFormData({ ...rowFormData, [fieldKey]: finalVal });
                          }}
                          className={`w-full p-2.5 bg-white border border-sepia/25 rounded-lg text-xs focus:outline-none focus:border-amber-700 ${
                            isPrimaryKey ? 'bg-sepia/5 text-sepia/60 cursor-not-allowed' : ''
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal Action Footer */}
              <div className="p-4 bg-amber-50/90 border-t border-gold/30 flex items-center justify-between shrink-0 gap-3">
                <button
                  onClick={handleDeleteRowModal}
                  disabled={isDeletingRow || isManager}
                  className="px-4 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition active:scale-95"
                >
                  <Trash2 size={15} /> Удалить Строку
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingRow(null)}
                    className="px-4 py-2.5 bg-sepia/10 hover:bg-sepia/20 text-sepia rounded-xl font-bold text-xs transition"
                  >
                    Отмена
                  </button>

                  <button
                    onClick={handleSaveRowModal}
                    disabled={isSavingRow || isManager}
                    className="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-amber-50 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Save size={15} /> Сохранить Изменения
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: EASY CRON JOB EDITOR FOR BEGINNERS */}
        {editingCronJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sepia-dark/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-parchment-light border-2 border-gold rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 bg-amber-100/90 border-b border-gold/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-800 text-amber-50 rounded-lg">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-sepia">Настройка задачи</h3>
                    <p className="text-[11px] font-mono text-amber-900 font-bold">{editingCronJob.title}</p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingCronJob(null)}
                  className="p-1.5 text-sepia/60 hover:text-sepia hover:bg-sepia/10 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold text-sepia mb-1">
                    Выберите периодичность запуска (для чайников):
                  </label>
                  <select
                    value={
                      ['*/1 * * * *', '*/5 * * * *', '*/15 * * * *', '0 * * * *', '0 0 * * *', '0 0 * * 0'].includes(editingCronJob.schedule)
                        ? editingCronJob.schedule
                        : 'custom'
                    }
                    onChange={e => {
                      if (e.target.value !== 'custom') {
                        setEditingCronJob({ ...editingCronJob, schedule: e.target.value });
                      }
                    }}
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-mono font-bold text-sepia focus:outline-none focus:border-amber-700"
                  >
                    <option value="*/1 * * * *">⚡ Каждую 1 минуту (Максимальная частота)</option>
                    <option value="*/5 * * * *">⏱️ Каждые 5 минут</option>
                    <option value="*/15 * * * *">⏳ Каждые 15 минут</option>
                    <option value="0 * * * *">🕐 Каждый час</option>
                    <option value="0 0 * * *">🌙 Раз в сутки (Каждую ночь в 00:00)</option>
                    <option value="0 0 * * 0">🏆 Раз в неделю (Каждое воскресенье в 00:00)</option>
                    <option value="custom">🛠️ Точная настройка (Свой Cron-синтаксис)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sepia mb-1">
                    Cron-выражение (Расписание сервера):
                  </label>
                  <input
                    type="text"
                    value={editingCronJob.schedule}
                    onChange={e => setEditingCronJob({ ...editingCronJob, schedule: e.target.value })}
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-700"
                    placeholder="Например: */5 * * * *"
                  />
                  <p className="text-[10px] text-sepia/60 mt-1 italic">
                    Формат: [Минута] [Час] [День месяца] [Месяц] [День недели]
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sepia mb-1">
                    Описание работы:
                  </label>
                  <textarea
                    rows={2}
                    value={editingCronJob.description}
                    onChange={e => setEditingCronJob({ ...editingCronJob, description: e.target.value })}
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs text-sepia focus:outline-none focus:border-amber-700"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-amber-50/90 border-t border-gold/30 flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => setEditingCronJob(null)}
                  className="px-4 py-2 bg-sepia/10 hover:bg-sepia/20 text-sepia rounded-xl font-bold text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    const { updateCronJob } = useSystemAdminStore.getState();
                    const success = await updateCronJob(
                      editingCronJob.name,
                      editingCronJob.schedule,
                      editingCronJob.description
                    );
                    if (success) {
                      setSuccessMessage(`Настройки фоновой службы "${editingCronJob.title}" успешно сохранены!`);
                      setEditingCronJob(null);
                    }
                  }}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  <Save size={14} /> Сохранить расписание
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* MODAL: EASY TRIGGER EDITOR FOR BEGINNERS */}
        {editingTrigger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sepia-dark/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-parchment-light border-2 border-gold rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 bg-amber-100/90 border-b border-gold/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-800 text-amber-50 rounded-lg">
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-sepia">Редактор БД Триггера</h3>
                    <p className="text-[11px] font-mono text-amber-900 font-bold">{editingTrigger.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingTrigger(null)}
                  className="p-1.5 text-sepia/60 hover:text-sepia hover:bg-sepia/10 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold text-sepia mb-1">
                    Название автоматического правила / триггера:
                  </label>
                  <input
                    type="text"
                    value={editingTrigger.name}
                    onChange={e => setEditingTrigger({ ...editingTrigger, name: e.target.value })}
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-bold text-sepia focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sepia mb-1">
                    Целевая таблица БД:
                  </label>
                  <input
                    type="text"
                    value={editingTrigger.tbl_name || 'users'}
                    onChange={e => setEditingTrigger({ ...editingTrigger, tbl_name: e.target.value })}
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-700"
                    placeholder="users, discovered_elements, etc."
                  />
                </div>

                {editingTrigger.event !== undefined && (
                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">
                      Когда происходит событие (Для новичков):
                    </label>
                    <select
                      value={editingTrigger.event}
                      onChange={e => setEditingTrigger({ ...editingTrigger, event: e.target.value })}
                      className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-bold text-sepia focus:outline-none focus:border-amber-700"
                    >
                      <option value="При открытии каждых 5 новых элементов">При открытии каждых 5 новых элементов</option>
                      <option value="При регистрации нового ученика по реферальной ссылке">При регистрации нового ученика по реферальной ссылке</option>
                      <option value="При совершении платежа">При совершении платежа</option>
                      <option value="При первом входе в день">При первом входе в день</option>
                    </select>
                  </div>
                )}

                {editingTrigger.action !== undefined && (
                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">
                      Выполняемое действие (Без кода):
                    </label>
                    <select
                      value={editingTrigger.action}
                      onChange={e => setEditingTrigger({ ...editingTrigger, action: e.target.value })}
                      className="w-full p-2.5 bg-white border border-sepia/25 rounded-xl text-xs font-bold text-sepia focus:outline-none focus:border-amber-700"
                    >
                      <option value="Повысить уровень и ранг">Повысить уровень и ранг</option>
                      <option value="Начислить +100,000 AiHim энергии">Начислить +100,000 AiHim энергии</option>
                      <option value="Включить статус Активен и обновить время активности">Включить статус Активен и обновить время активности</option>
                      <option value="Отправить уведомление в Telegram">Отправить уведомление в Telegram</option>
                    </select>
                  </div>
                )}

                {editingTrigger.sql !== undefined && (
                  <div>
                    <label className="block text-xs font-bold text-sepia mb-1">
                      Код SQL Триггера (Для разработчиков):
                    </label>
                    <textarea
                      rows={5}
                      value={editingTrigger.sql}
                      onChange={e => setEditingTrigger({ ...editingTrigger, sql: e.target.value })}
                      className="w-full p-2.5 bg-[#1c120c] text-orange-200 border border-sepia/25 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-700"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-xs font-bold text-sepia">Статус правила:</span>
                  <button
                    onClick={() => setEditingTrigger({ ...editingTrigger, active: !editingTrigger.active })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      editingTrigger.active !== false
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {editingTrigger.active !== false ? '✅ АКТИВЕН' : '🛑 ОТКЛЮЧЕН'}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-amber-50/90 border-t border-gold/30 flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => setEditingTrigger(null)}
                  className="px-4 py-2 bg-sepia/10 hover:bg-sepia/20 text-sepia rounded-xl font-bold text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setSuccessMessage(`Настройки триггера/правила "${editingTrigger.name}" успешно обновлены!`);
                    setEditingTrigger(null);
                  }}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-amber-50 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  <Save size={14} /> Сохранить Триггер
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[6000] overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl parchment-card p-6 border-2 border-amber-800 shadow-2xl text-sepia my-auto"
            >
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-lg text-amber-950 uppercase">
                    Импорт CSV в таблицу: <span className="text-amber-700">{selectedTable}</span>
                  </h3>
                  <p className="text-xs text-sepia/70">
                    Выберите .csv файл с вашего устройства или вставьте строки CSV с заголовками напрямую.
                  </p>
                </div>
              </div>

              <div className="space-y-4 my-4 font-mono text-xs">
                <div>
                  <label className="block font-bold text-sepia mb-1">Загрузить .csv файл:</label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="w-full p-2 bg-white border border-sepia/25 rounded text-xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sepia mb-1">Или вставьте текст CSV:</label>
                  <textarea
                    rows={8}
                    value={importCsvText}
                    onChange={e => setImportCsvText(e.target.value)}
                    placeholder={`"id","username","email","balance"...\n"usr_123","Alchemist","test@domain.com",1000...`}
                    className="w-full p-3 bg-[#1c120c] text-emerald-300 border border-sepia/25 rounded-xl font-mono text-xs focus:outline-none focus:border-amber-700"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold">⚠️ ВАЖНО:</div>
                  <div>• Записи с совпадающим первичным ключом (например, `id`) будут автоматически обновлены (UPSERT / ON CONFLICT DO UPDATE).</div>
                  <div>• Первая строка CSV обязательно должна содержать названия колонок таблицы.</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-sepia/10 hover:bg-sepia/20 text-sepia rounded font-bold uppercase tracking-wider text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleImportCsvSubmit}
                  disabled={isImporting || !importCsvText.trim()}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold uppercase tracking-wider rounded text-xs shadow transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  {isImporting ? 'Импорт...' : 'Выполнить Импорт CSV'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* JSON Backup Restore Modal */}
        {isRestoreModalOpen && (
          <div className="fixed inset-0 z-[6000] overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl parchment-card p-6 border-2 border-indigo-800 shadow-2xl text-sepia my-auto"
            >
              <button
                onClick={() => setIsRestoreModalOpen(false)}
                className="absolute top-4 right-4 text-sepia/40 hover:text-sepia transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-900">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-lg text-indigo-950 uppercase">
                    Восстановление Базы Данных (JSON Бэкап)
                  </h3>
                  <p className="text-xs text-sepia/70">
                    Загрузите файл <code className="bg-amber-100 px-1 rounded text-amber-900">.json</code> с бэкапом базы данных или вставьте JSON содержимое напрямую.
                  </p>
                </div>
              </div>

              <div className="space-y-4 my-4 font-mono text-xs">
                <div>
                  <label className="block font-bold text-sepia mb-1">Ссылка на файл бэкапа (.json URL):</label>
                  <input
                    type="url"
                    value={restoreJsonUrl}
                    onChange={e => setRestoreJsonUrl(e.target.value)}
                    placeholder="https://file.pro-talk.ru/tgf/...json"
                    className="w-full p-2.5 bg-white border border-sepia/25 rounded text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sepia mb-1">Или загрузить файл бэкапа (.json):</label>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleJsonBackupFileUpload}
                    className="w-full p-2 bg-white border border-sepia/25 rounded text-xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sepia mb-1">Или вставьте содержимое JSON бэкапа:</label>
                  <textarea
                    rows={7}
                    value={restoreJsonText}
                    onChange={e => setRestoreJsonText(e.target.value)}
                    placeholder={`{\n  "meta": { "app": "AiHim Alchimia" },\n  "tables": {\n    "users": [ ... ],\n    "transactions": [ ... ]\n  }\n}`}
                    className="w-full p-3 bg-[#1c120c] text-indigo-200 border border-sepia/25 rounded-xl font-mono text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {restoreProgress && (
                  <div className="p-3 bg-indigo-100/80 border border-indigo-300 rounded-lg text-[11px] font-bold text-indigo-950">
                    {restoreProgress}
                  </div>
                )}

                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                    <Zap size={14} className="text-indigo-700" />
                    ПРАВИЛА ВОССТАНОВЛЕНИЯ ДАННЫХ:
                  </div>
                  <div>• Записи с совпадающим первичным ключом (`id` или `name`) <strong>автоматически обновятся</strong>.</div>
                  <div>• Большие бэкапы загружаются пакетами по 25 записей без превышения лимита запроса.</div>
                  <div>• После загрузки бэкапа балансы всех пользователей будут пересчитаны автоматически.</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsRestoreModalOpen(false)}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-sepia/10 hover:bg-sepia/20 text-sepia rounded font-bold uppercase tracking-wider text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleRestoreJsonSubmit}
                  disabled={isRestoring || (!restoreJsonText.trim() && !restoreJsonUrl.trim())}
                  className="px-5 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white font-bold uppercase tracking-wider rounded-lg text-xs shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload size={14} />
                  {isRestoring ? (restoreProgress || 'Восстановление...') : 'Выполнить Восстановление Бэкапа'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Universal Alchemy Admin Confirmation & Alert Modal */}
        {adminModal.isOpen && (
          <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="parchment-card max-w-lg w-full p-6 bg-[#f7f2e7] border-2 border-gold/50 shadow-2xl space-y-4 relative rounded-xl"
            >
              <div className="flex items-center justify-between border-b border-sepia/20 pb-3">
                <h3 className="text-lg font-gothic text-gold uppercase tracking-wider flex items-center gap-2 font-bold">
                  {adminModal.isDanger ? (
                    <AlertTriangle className="text-rose-600 shrink-0 animate-bounce" size={24} />
                  ) : (
                    <HelpCircle className="text-gold shrink-0" size={24} />
                  )}
                  {adminModal.title}
                </h3>
                <button
                  onClick={() => setAdminModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1 hover:bg-sepia/10 rounded text-sepia/60 hover:text-sepia transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="text-[14px] text-sepia/90 leading-relaxed space-y-3 font-medium">
                <div>{adminModal.message}</div>
                {adminModal.warningText && (
                  <div className="p-3 bg-rose-100/90 border-2 border-rose-300 rounded-xl text-rose-950 text-[13px] font-bold flex items-start gap-2.5 shadow-sm">
                    <AlertTriangle size={20} className="shrink-0 text-rose-700 mt-0.5" />
                    <div>{adminModal.warningText}</div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sepia/20">
                {adminModal.onConfirm ? (
                  <>
                    <button
                      onClick={() => setAdminModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-4 py-2.5 bg-sepia/10 hover:bg-sepia/20 text-sepia font-gothic text-xs uppercase font-bold rounded-lg transition"
                    >
                      {adminModal.cancelLabel || 'Отмена'}
                    </button>
                    <button
                      onClick={() => {
                        const action = adminModal.onConfirm;
                        setAdminModal(prev => ({ ...prev, isOpen: false }));
                        if (action) action();
                      }}
                      className={`px-5 py-2.5 font-gothic text-xs uppercase font-bold rounded-lg shadow-md transition active:scale-95 flex items-center gap-1.5 ${
                        adminModal.isDanger
                          ? 'bg-rose-700 hover:bg-rose-800 text-white border border-rose-900'
                          : 'bg-gold hover:bg-gold-light text-ink border border-gold/40'
                      }`}
                    >
                      {adminModal.isDanger && <Trash2 size={14} />}
                      {adminModal.confirmLabel || 'Подтвердить'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setAdminModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-6 py-2.5 bg-gold hover:bg-gold-light text-ink font-gothic text-xs uppercase font-bold rounded-lg shadow transition active:scale-95"
                  >
                    Понятно
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
