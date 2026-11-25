import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl border border-amber-700/40 bg-transparent backdrop-blur-md text-sepia text-[14px] font-semibold flex items-center justify-center gap-2 shadow-sm">
      <WifiOff size={17} className="text-amber-800 shrink-0" />
      <span>Автономный режим PWA: сохранённые страницы и статьи блога доступны без интернета.</span>
    </div>
  );
};
