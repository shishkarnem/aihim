import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cpu, Server, Send, RefreshCw, AlertTriangle, CheckCircle2, Shield, Terminal, Globe, Key, Clock, Copy, Check } from 'lucide-react';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'proxy' | 'logs' | 'system'>('telegram');
  const [targetChatId, setTargetChatId] = useState<string>('169262990');
  const [diagData, setDiagData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Proxy settings state
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState<string>('https://aihim.shishkarnem.workers.dev');
  const [isSavingProxy, setIsSavingProxy] = useState<boolean>(false);
  const [proxySaveSuccess, setProxySaveSuccess] = useState<boolean>(false);

  // Copy state
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Fetch full Telegram diagnosis
  const runDiagnostics = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/diagnose-telegram?targetChatId=${encodeURIComponent(targetChatId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDiagData(data);
        if (data.config?.apiBaseUrl) {
          setApiBaseUrlInput(data.config.apiBaseUrl);
        }
      } else {
        setErrorMsg(data.error || 'Ошибка при вызове сервера');
      }
    } catch (err: any) {
      setErrorMsg(`Сетевая ошибка запроса: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  // Save Telegram Proxy/Base URL
  const handleSaveProxy = async () => {
    setIsSavingProxy(true);
    setProxySaveSuccess(false);
    try {
      // Get existing config first
      const getRes = await fetch('/api/admin/bot-settings');
      let currentConfig = {};
      if (getRes.ok) {
        const getJson = await getRes.json().catch(() => ({}));
        currentConfig = getJson?.config || {};
      }

      const updatedConfig = {
        ...currentConfig,
        apiBaseUrl: apiBaseUrlInput.trim() || 'https://api.telegram.org'
      };

      const saveRes = await fetch('/api/admin/bot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      const saveData = await saveRes.json().catch(() => ({}));

      if (saveRes.ok && (saveData.success || saveData.config)) {
        setProxySaveSuccess(true);
        setTimeout(() => setProxySaveSuccess(false), 3000);
        runDiagnostics();
      } else {
        alert(saveData.error || saveData.message || 'Не удалось сохранить настройки (ошибка сервера)');
      }
    } catch (e: any) {
      alert(`Ошибка при сохранении: ${e.message}`);
    } finally {
      setIsSavingProxy(false);
    }
  };

  const handleCopyLogs = () => {
    if (diagData) {
      navigator.clipboard.writeText(JSON.stringify(diagData, null, 2));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-4xl bg-[#121110] border-2 border-gold/40 rounded-2xl shadow-2xl text-parchment overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gold/20 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold/10 border border-gold/30 text-gold">
                <Terminal size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-gothic text-xl text-gold tracking-wide uppercase font-bold">
                    Диагностика Сервера & Telegram
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold/20 border border-gold/40 text-gold font-mono uppercase font-bold">
                    Ctrl + [
                  </span>
                </div>
                <p className="text-xs text-sepia/70 mt-0.5">
                  Мониторинг соединений, DNS, токена и логов отправки в Telegram API
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-sepia/60 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
              title="Закрыть (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gold/20 bg-black/20 overflow-x-auto text-xs sm:text-sm font-mono">
            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
                activeTab === 'telegram'
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-transparent text-sepia/60 hover:text-parchment'
              }`}
            >
              <Send size={15} />
              <span>Тест Telegram API</span>
            </button>

            <button
              onClick={() => setActiveTab('proxy')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
                activeTab === 'proxy'
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-transparent text-sepia/60 hover:text-parchment'
              }`}
            >
              <Globe size={15} />
              <span>Прокси / Base URL</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-transparent text-sepia/60 hover:text-parchment'
              }`}
            >
              <Clock size={15} />
              <span>Логи отправок</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold transition-all whitespace-nowrap ${
                activeTab === 'system'
                  ? 'border-gold text-gold bg-gold/10'
                  : 'border-transparent text-sepia/60 hover:text-parchment'
              }`}
            >
              <Server size={15} />
              <span>Система</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-5 text-sm">
            {/* TAB 1: Telegram API Test */}
            {activeTab === 'telegram' && (
              <div className="space-y-5">
                {/* Control Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-black/40 border border-gold/20 rounded-xl">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-mono text-sepia/70 uppercase font-bold whitespace-nowrap">
                      Тестовый Chat ID:
                    </span>
                    <input
                      type="text"
                      value={targetChatId}
                      onChange={(e) => setTargetChatId(e.target.value)}
                      placeholder="169262990"
                      className="bg-black/60 border border-gold/30 rounded-lg px-3 py-1.5 text-gold font-mono text-xs w-36 focus:border-gold outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={runDiagnostics}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/50 rounded-xl font-bold transition-all disabled:opacity-50 text-xs uppercase"
                    >
                      <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                      <span>{isLoading ? 'Проверка...' : 'Запустить тест'}</span>
                    </button>

                    {diagData && (
                      <button
                        onClick={handleCopyLogs}
                        className="flex items-center gap-1.5 px-3 py-2 bg-black/50 border border-gold/30 rounded-xl text-sepia/80 hover:text-gold text-xs font-mono"
                        title="Скопировать JSON отчета"
                      >
                        {copiedText ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        <span>{copiedText ? 'Скопировано!' : 'JSON'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl text-red-300 flex items-start gap-3 text-xs font-mono">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold uppercase text-red-400">Ошибка диагностики</p>
                      <p className="mt-1">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* Results breakdown */}
                {diagData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bot Token & Config */}
                    <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-bold text-sepia/70 font-mono">1. Конфигурация Бота</span>
                        {diagData.config?.hasToken ? (
                          <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> ТОКЕН ЗАДАНО
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> НЕТ ТОКЕНА
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs space-y-1 text-sepia/90">
                        <div className="flex justify-between">
                          <span className="text-sepia/50">Токен:</span>
                          <span className="text-gold">{diagData.config?.maskedToken}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sepia/50">Бот:</span>
                          <span>{diagData.config?.botUsername}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sepia/50">Base URL:</span>
                          <span className="text-blue-300 break-all">{diagData.config?.apiBaseUrl}</span>
                        </div>
                      </div>
                    </div>

                    {/* DNS Resolution */}
                    <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-bold text-sepia/70 font-mono">2. DNS Разрешение</span>
                        {!diagData.dnsLookup?.error ? (
                          <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> DNS OK
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> ОШИБКА DNS
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs space-y-1 text-sepia/90">
                        <div className="flex justify-between">
                          <span className="text-sepia/50">Хост:</span>
                          <span>{diagData.dnsLookup?.host}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-sepia/50">IP Адреса:</span>
                          <div className="text-right">
                            {diagData.dnsLookup?.addresses?.length > 0 ? (
                              diagData.dnsLookup.addresses.map((a: any, idx: number) => (
                                <div key={idx} className="text-gold">
                                  {a.address} <span className="text-[10px] text-sepia/50">(IPv{a.family})</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-red-400">Не удалось резолвить IP</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* getMe API Call */}
                    <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-bold text-sepia/70 font-mono">3. Проверка getMe()</span>
                        {diagData.getMeTest?.ok ? (
                          <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> {diagData.getMeTest?.durationMs}ms
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> ОШИБКА
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs space-y-1 text-sepia/90">
                        {diagData.getMeTest?.ok ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sepia/50">Имя бота:</span>
                              <span className="text-gold">{diagData.getMeTest?.botInfo?.first_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sepia/50">Юзернейм:</span>
                              <span>@{diagData.getMeTest?.botInfo?.username}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sepia/50">Bot ID:</span>
                              <span>{diagData.getMeTest?.botInfo?.id}</span>
                            </div>
                          </>
                        ) : (
                          <div className="p-2 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-[11px] leading-tight">
                            {diagData.getMeTest?.description || diagData.getMeTest?.error}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Send Message Test */}
                    <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-bold text-sepia/70 font-mono">4. Тестовая отправка</span>
                        {diagData.sendMessageTest?.ok ? (
                          <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> УСПЕШНО
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> НЕ ОТПРАВЛЕНО
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs space-y-1 text-sepia/90">
                        <div className="flex justify-between">
                          <span className="text-sepia/50">Получатель ID:</span>
                          <span className="text-gold">{diagData.sendMessageTest?.targetChatId}</span>
                        </div>
                        {diagData.sendMessageTest?.ok ? (
                          <div className="text-green-400 text-[11px]">
                            {diagData.sendMessageTest?.description || 'Сообщение получено в Telegram!'}
                          </div>
                        ) : (
                          <div className="p-2 bg-red-950/40 border border-red-500/30 rounded text-red-300 text-[11px] leading-tight">
                            {diagData.sendMessageTest?.errorMsg || diagData.sendMessageTest?.description || 'Ошибка сети/доставки'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Network Error Advice Banner if getMe failed */}
                {diagData && (!diagData.getMeTest?.ok || !diagData.sendMessageTest?.ok) && (
                  <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-400 font-bold uppercase font-mono">
                      <AlertTriangle size={16} />
                      <span>Почему возникает "Ошибка сети" / "fetch failed"?</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sepia/90 leading-relaxed font-mono text-[12px]">
                      <li>
                        <b>Блокировка Telegram на хостинге:</b> В РФ на некоторых серверах (Beget, TimeWeb, Reg.ru, VDS) домен <code className="text-gold">api.telegram.org</code> заблокирован или сбрасывается провайдером.
                      </li>
                      <li>
                        <b>Решение:</b> Перейдите во вкладку <b>"Прокси / Base URL"</b> и укажите рабочий reverse proxy для Telegram API (например, <code className="text-gold">https://tg-proxy.my-domain.com</code> или custom Cloudflare worker).
                      </li>
                      <li>
                        <b>Неверный токен:</b> Проверьте, что токен бота в настройках указан без пробелов и лишних символов.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Proxy / Custom Base URL */}
            {activeTab === 'proxy' && (
              <div className="space-y-5">
                <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-3">
                  <h3 className="text-sm font-bold text-gold uppercase font-mono flex items-center gap-2">
                    <Globe size={16} />
                    <span>Настройка Telegram API Base URL / Прокси</span>
                  </h3>
                  <p className="text-xs text-sepia/80 leading-relaxed font-mono">
                    Если ваш сервер хостинга или VDS заблокирован для прямого подключения к <code className="text-gold">api.telegram.org</code> (выдает <code className="text-red-400 font-bold">ETIMEDOUT</code>), укажите адрес прокси-сервера или бесплатного Cloudflare Worker.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase font-bold text-sepia/70 font-mono">
                      Базовый URL Telegram API:
                    </label>
                    <input
                      type="text"
                      value={apiBaseUrlInput}
                      onChange={(e) => setApiBaseUrlInput(e.target.value)}
                      placeholder="https://eu1.account.dialog.ai.atiks.org"
                      className="w-full bg-black/60 border border-gold/40 rounded-xl px-4 py-2.5 text-gold font-mono text-xs focus:border-gold outline-none"
                    />
                    
                    {/* URL Routing Preview */}
                    <div className="p-2.5 bg-black/50 border border-gold/10 rounded-lg space-y-1 text-[11px] font-mono text-sepia/70">
                      <div>
                        • API Запросы: <code className="text-gold font-bold">{apiBaseUrlInput.trim().replace(/\/+$/, '').replace(/\/bot$/, '') || 'https://...'}/bot&lt;ТОКЕН&gt;/getMe</code>
                      </div>
                      <div>
                        • Отправка сообщений: <code className="text-gold font-bold">{apiBaseUrlInput.trim().replace(/\/+$/, '').replace(/\/bot$/, '') || 'https://...'}/bot&lt;ТОКЕН&gt;/sendMessage</code>
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] uppercase font-bold text-sepia/60 font-mono">Выбор прокси-метода (быстрые пресеты):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setApiBaseUrlInput('https://eu1.account.dialog.ai.atiks.org')}
                        className={`px-3 py-2 border rounded-xl font-bold transition-all flex items-center justify-between text-left ${
                          apiBaseUrlInput.includes('atiks.org')
                            ? 'bg-gold/20 border-gold text-gold shadow-md shadow-gold/10'
                            : 'bg-black/40 border-gold/30 text-sepia/80 hover:border-gold hover:text-gold'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gold">Метод 1: Atiks Proxy</span>
                          <span className="text-[10px] text-sepia/60">eu1.account.dialog.ai.atiks.org</span>
                        </div>
                        {apiBaseUrlInput.includes('atiks.org') && <CheckCircle2 size={15} className="text-green-400 shrink-0 ml-2" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setApiBaseUrlInput('https://aihim.shishkarnem.workers.dev')}
                        className={`px-3 py-2 border rounded-xl font-bold transition-all flex items-center justify-between text-left ${
                          apiBaseUrlInput.includes('workers.dev')
                            ? 'bg-gold/20 border-gold text-gold shadow-md shadow-gold/10'
                            : 'bg-black/40 border-gold/30 text-sepia/80 hover:border-gold hover:text-gold'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gold">Метод 2: Cloudflare Worker</span>
                          <span className="text-[10px] text-sepia/60">aihim.shishkarnem.workers.dev</span>
                        </div>
                        {apiBaseUrlInput.includes('workers.dev') && <CheckCircle2 size={15} className="text-green-400 shrink-0 ml-2" />}
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setApiBaseUrlInput('https://api.telegram.org')}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                          apiBaseUrlInput.includes('api.telegram.org')
                            ? 'bg-gold/20 border-gold text-gold'
                            : 'bg-black/40 border-gold/20 text-sepia/60 hover:text-gold hover:border-gold/40'
                        }`}
                      >
                        <span>Прямое подключение без прокси (api.telegram.org)</span>
                        {apiBaseUrlInput.includes('api.telegram.org') && <CheckCircle2 size={13} className="text-green-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <button
                      onClick={handleSaveProxy}
                      disabled={isSavingProxy}
                      className="px-5 py-2.5 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/50 rounded-xl font-bold transition-all text-xs uppercase font-mono flex items-center gap-2"
                    >
                      {isSavingProxy && <RefreshCw size={14} className="animate-spin" />}
                      <span>{isSavingProxy ? 'Сохранение...' : 'Сохранить и применить'}</span>
                    </button>

                    {proxySaveSuccess && (
                      <span className="text-xs text-green-400 font-bold font-mono flex items-center gap-1">
                        <CheckCircle2 size={14} /> Настройки обновлены!
                      </span>
                    )}
                  </div>
                </div>

                {/* Cloudflare Worker Instructions */}
                <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-gold flex items-center gap-2">
                      <Shield size={15} />
                      <span>Собственный 100% надежный прокси за 1 минуту (Cloudflare Workers)</span>
                    </span>
                    <button
                      onClick={() => {
                        const cfScript = `export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'api.telegram.org';
    const newReq = new Request(url, request);
    return fetch(newReq);
  }
};`;
                        navigator.clipboard.writeText(cfScript);
                        alert('Скрипт Cloudflare Worker скопирован в буфер обмена!');
                      }}
                      className="px-3 py-1 bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold rounded-lg text-[11px] flex items-center gap-1"
                    >
                      <Copy size={12} /> Скопировать код скрипта
                    </button>
                  </div>

                  <ol className="list-decimal list-inside space-y-1.5 text-sepia/80 text-[11px] leading-relaxed">
                    <li>Зайдите на <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-gold underline">dash.cloudflare.com</a> (создайте бесплатный аккаунт).</li>
                    <li>Перейдите в раздел <b>Workers & Pages</b> → Нажмите <b>Create Application</b> → <b>Create Worker</b>.</li>
                    <li>Вставьте код скрипта (копируется по кнопке выше) и нажмите <b>Deploy</b>.</li>
                    <li>Скопируйте полученную ссылку (например <code className="text-gold">https://my-tg-proxy.my-subdomain.workers.dev</code>) и вставьте ее в поле выше!</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 3: Mailing Logs */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs uppercase font-bold text-gold font-mono">
                    Последние 15 записей в журнале отправки (mailing_logs)
                  </h3>
                  <button
                    onClick={runDiagnostics}
                    className="text-xs text-sepia/70 hover:text-gold font-mono flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Обновить
                  </button>
                </div>

                <div className="overflow-x-auto border border-gold/20 rounded-xl bg-black/40">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-black/60 text-sepia/70 uppercase border-b border-gold/20 text-[11px]">
                      <tr>
                        <th className="p-3">Время</th>
                        <th className="p-3">Получатель</th>
                        <th className="p-3">Статус</th>
                        <th className="p-3">Детали / Ошибка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/10">
                      {diagData?.recentLogs?.length > 0 ? (
                        diagData.recentLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gold/5 transition-colors">
                            <td className="p-3 whitespace-nowrap text-sepia/60">
                              {new Date(log.timestamp).toLocaleString('ru-RU')}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className="text-gold">{log.recipientName || 'Пользователь'}</span>
                              <span className="text-[10px] text-sepia/50 block">ID: {log.recipientId}</span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {log.status === 'success' ? (
                                <span className="px-2 py-0.5 bg-green-950/60 text-green-400 border border-green-500/30 rounded text-[10px] uppercase font-bold">
                                  Успешно
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-500/30 rounded text-[10px] uppercase font-bold">
                                  Ошибка
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-red-300 text-[11px] max-w-xs break-all">
                              {log.errorMsg || '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-sepia/50">
                            Записи рассылок отсутствуют в базе данных
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: System Info */}
            {activeTab === 'system' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                    <span className="text-xs uppercase font-bold text-gold">Окружение Node.js</span>
                    <div className="space-y-1 text-sepia/80">
                      <div className="flex justify-between">
                        <span className="text-sepia/50">Node Версия:</span>
                        <span className="text-gold">{diagData?.systemInfo?.nodeVersion || 'v20.x'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sepia/50">Платформа:</span>
                        <span>{diagData?.systemInfo?.platform} ({diagData?.systemInfo?.arch})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sepia/50">Аптайм сервера:</span>
                        <span>{diagData?.systemInfo?.uptime} сек.</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 border border-gold/20 rounded-xl space-y-2">
                    <span className="text-xs uppercase font-bold text-gold">Использование памяти</span>
                    <div className="space-y-1 text-sepia/80">
                      <div className="flex justify-between">
                        <span className="text-sepia/50">Heap Used:</span>
                        <span>{diagData?.systemInfo?.memoryUsage ? `${Math.round(diagData.systemInfo.memoryUsage.heapUsed / 1024 / 1024)} MB` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sepia/50">Heap Total:</span>
                        <span>{diagData?.systemInfo?.memoryUsage ? `${Math.round(diagData.systemInfo.memoryUsage.heapTotal / 1024 / 1024)} MB` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-black/40 border-t border-gold/20 flex items-center justify-between text-xs font-mono text-sepia/60">
            <span>Клавиша <kbd className="bg-gold/20 px-1.5 py-0.5 rounded text-gold border border-gold/40">Ctrl + [</kbd> открывает эту панель из любого места</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg uppercase font-bold transition-colors"
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
