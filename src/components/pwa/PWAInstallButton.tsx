import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, X, Compass } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { canPromptInstall, isInstalled, isIOS, isAndroid, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleInstallClick = async () => {
    if (canPromptInstall) {
      const ok = await promptInstall();
      if (ok) return;
    }
    setShowGuideModal(true);
  };

  return (
    <div className="rounded-2xl border border-gold/40 bg-transparent backdrop-blur-md p-5 sm:p-6 shadow-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <img
            src="/file/41/pwa_icon_192x192.png"
            alt="Иконка приложения AIhim"
            className="w-14 h-14 rounded-2xl border border-gold/40 shadow-sm shrink-0 object-cover"
          />
          <div className="min-w-0">
            <h3 className="text-[17px] font-gothic text-sepia font-bold flex items-center gap-2 flex-wrap">
              <Smartphone size={18} className="text-gold shrink-0" />
              <span>Приложение AIhim на телефон</span>
            </h3>
            <p className="text-[14px] text-sepia/85 mt-1 leading-relaxed">
              Установите иконку лаборатории на рабочий стол Android или iPhone, чтобы запускать AIhim в один тап без рамки браузера и стабильно получать пуш-уведомления.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          {isInstalled ? (
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600/40 bg-emerald-500/10 text-emerald-900 font-bold text-[14px] w-full sm:w-auto">
              <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
              <span>Приложение установлено</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gold/90 hover:bg-gold text-ink font-gothic font-bold text-[14px] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={18} className="shrink-0" />
              <span>
                {canPromptInstall
                  ? 'Установить на устройство'
                  : isIOS
                    ? 'Установить на iPhone / iPad'
                    : isAndroid
                      ? 'Установить на Android'
                      : 'Установить приложение PWA'}
              </span>
            </button>
          )}
        </div>
      </div>

      {!isInstalled && (
        <div className="mt-4 pt-3 border-t border-sepia/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px] text-sepia/80">
          <span>
            {isIOS
              ? 'Для iPhone и iPad установка выполняется через меню «Поделиться» в Safari.'
              : 'Поддерживается установка в Chrome, Яндекс Браузере, Edge и Safari.'}
          </span>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="text-left sm:text-right font-bold text-sepia hover:text-gold underline cursor-pointer text-[14px] shrink-0"
          >
            Пошаговая инструкция для Android и iPhone
          </button>
        </div>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[950] flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border-2 border-gold/50 bg-parchment/75 backdrop-blur-xl p-5 sm:p-6 shadow-2xl text-sepia relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              aria-label="Закрыть инструкцию"
              className="p-2 rounded-lg text-sepia/70 hover:text-sepia hover:bg-sepia/10 absolute top-3 right-3 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h4 className="text-[19px] font-gothic font-bold text-sepia pr-8 mb-3">
              Установка AIhim на рабочий стол телефона
            </h4>

            <div className="space-y-4 text-[14px] leading-relaxed">
              <div className="p-4 rounded-xl border border-sepia/20 bg-transparent space-y-2">
                <div className="font-bold text-sepia flex items-center gap-2 text-[15px]">
                  <Compass size={18} className="text-gold shrink-0" />
                  <span>Для iPhone и iPad (браузер Safari)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sepia/90">
                  <li>Откройте сайт AIhim в стандартном браузере Safari.</li>
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0">2.</span>
                    <span>
                      Нажмите внизу экрана значок <Share size={15} className="inline text-gold mx-0.5" /> <strong>«Поделиться»</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0">3.</span>
                    <span>
                      Пролистайте вниз и выберите <PlusSquare size={15} className="inline text-gold mx-0.5" /> <strong>«На экран «Домой»»</strong>.
                    </span>
                  </li>
                  <li>Нажмите <strong>«Добавить»</strong> и запускайте игру с иконки — после этого на iOS заработают и мобильные пуш-уведомления.</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl border border-sepia/20 bg-transparent space-y-2">
                <div className="font-bold text-sepia flex items-center gap-2 text-[15px]">
                  <Smartphone size={18} className="text-gold shrink-0" />
                  <span>Для Android (Chrome, Яндекс Браузер, Edge)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sepia/90">
                  <li>Нажмите кнопку «Установить на устройство» в профиле или меню браузера (три точки в углу экрана).</li>
                  <li>Выберите пункт <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</li>
                  <li>Подтвердите установку — иконка AIhim появится среди ваших приложений.</li>
                </ol>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 rounded-xl border border-sepia/30 bg-transparent hover:bg-sepia/10 font-bold text-sepia text-[14px] cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
