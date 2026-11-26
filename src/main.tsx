import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  if ('caches' in window) {
    window.caches.delete('aihim-blog-api').catch(() => {});
  }
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      try {
        const lastReload = Number(window.sessionStorage.getItem('aihim_sw_reload_at') || 0);
        if (Date.now() - lastReload < 15000) return;
        window.sessionStorage.setItem('aihim_sw_reload_at', String(Date.now()));
      } catch {
        // ignore storage errors
      }
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => {
            r.update().catch(() => {});
          });
        })
        .catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
