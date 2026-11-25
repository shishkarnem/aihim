import React, { useEffect, useState } from 'react';
import { Check, Save, Tag } from 'lucide-react';

interface AppVersionControlProps {
  compact?: boolean;
  readOnly?: boolean;
  onVersionSaved?: (newVersion: string) => void;
}

export const AppVersionControl: React.FC<AppVersionControlProps> = ({
  compact = false,
  readOnly = false,
  onVersionSaved
}) => {
  const [versionInput, setVersionInput] = useState<string>(() => {
    return localStorage.getItem('aihim_app_version') || '1.32';
  });
  const [savedVersion, setSavedVersion] = useState<string>(() => {
    return localStorage.getItem('aihim_app_version') || '1.32';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/app-version', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.version) {
          const clean = String(data.version).replace(/^v/i, '').trim() || '1.32';
          setVersionInput(clean);
          setSavedVersion(clean);
          localStorage.setItem('aihim_app_version', clean);
        }
      })
      .catch(() => {});

    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        const clean = String(custom.detail).replace(/^v/i, '').trim() || '1.32';
        setVersionInput(clean);
        setSavedVersion(clean);
      }
    };
    window.addEventListener('alchimia:version_updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('alchimia:version_updated', onUpdated);
    };
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (readOnly) return;
    const clean = versionInput.trim().replace(/^v/i, '');
    if (!clean) {
      setErrorMsg('Укажите номер версии');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const res = await fetch('/api/app-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: clean })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.version) {
        throw new Error(data?.error || 'Не удалось сохранить версию');
      }

      const finalVer = String(data.version);
      setVersionInput(finalVer);
      setSavedVersion(finalVer);
      localStorage.setItem('aihim_app_version', finalVer);
      window.dispatchEvent(new CustomEvent('alchimia:version_updated', { detail: finalVer }));
      onVersionSaved?.(finalVer);
      setFeedback(`Версия v${finalVer} сохранена`);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка сохранения версии');
    } finally {
      setIsSaving(false);
    }
  };

  if (compact) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-wrap items-center gap-2 bg-transparent border border-sepia/25 rounded-full px-3 py-1.5 text-[14px]"
      >
        <Tag size={15} className="text-amber-800 shrink-0" />
        <span className="text-[14px] text-sepia/80 font-medium">Версия:</span>
        <div className="flex items-center gap-1">
          <span className="text-[14px] font-mono text-sepia/70">v</span>
          <input
            type="text"
            value={versionInput}
            disabled={readOnly || isSaving}
            onChange={e => setVersionInput(e.target.value)}
            placeholder="1.32"
            aria-label="Версия приложения"
            className="w-20 px-2 py-0.5 text-[14px] font-mono font-semibold text-sepia bg-transparent border border-sepia/30 rounded-full focus:outline-none focus:border-amber-700"
          />
        </div>
        {!readOnly && (
          <button
            type="submit"
            disabled={isSaving || versionInput.trim().replace(/^v/i, '') === savedVersion}
            className="px-3 py-1 rounded-full bg-amber-800 text-parchment hover:bg-amber-900 disabled:opacity-45 text-[14px] font-medium transition-all flex items-center gap-1 cursor-pointer"
          >
            {feedback ? <Check size={14} /> : <Save size={14} />}
            <span>{isSaving ? 'Сохранение...' : feedback ? 'Сохранено' : 'Применить'}</span>
          </button>
        )}
        {errorMsg && <span className="text-[14px] text-red-700">{errorMsg}</span>}
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="parchment-card p-5 border border-gold/30 bg-transparent flex flex-col gap-3 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sepia/15 pb-2.5">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-amber-800 shrink-0" />
          <h4 className="text-[16px] font-semibold text-sepia">Версия приложения AiHim</h4>
        </div>
        <span className="px-3.5 py-1 rounded-full border border-gold/40 bg-transparent text-[14px] font-mono font-semibold text-amber-900">
          Текущая: v{savedVersion}
        </span>
      </div>

      <p className="text-[14px] text-sepia/80 leading-relaxed">
        Укажите номер сборки (например, 1.33). Значение сохраняется в PostgreSQL и сразу обновляется в подвале сайта, панелях администратора и метаданных резервных копий.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-sepia/25 bg-transparent">
          <span className="text-[14px] font-mono text-sepia/70 font-semibold">v</span>
          <input
            type="text"
            value={versionInput}
            disabled={readOnly || isSaving}
            onChange={e => setVersionInput(e.target.value)}
            placeholder="1.32"
            aria-label="Номер версии"
            className="w-28 bg-transparent text-[15px] font-mono font-bold text-sepia focus:outline-none"
          />
        </div>

        {!readOnly && (
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-tl-2xl rounded-br-2xl rounded-tr-sm rounded-bl-sm bg-amber-800 hover:bg-amber-900 text-parchment text-[14px] font-semibold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            <span>{isSaving ? 'Сохранение...' : 'Сохранить версию'}</span>
          </button>
        )}

        {feedback && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-700/40 text-amber-900 text-[14px] font-medium">
            <Check size={14} />
            {feedback}
          </span>
        )}
        {errorMsg && <span className="text-[14px] text-red-700">{errorMsg}</span>}
      </div>
    </form>
  );
};
