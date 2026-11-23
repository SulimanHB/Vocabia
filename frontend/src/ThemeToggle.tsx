import { useState } from 'react';

const storageKey = 'vocabia.theme';

function initialDark() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// Interruptor sol/luna: sin elección guardada sigue al sistema; al pulsarlo fija el tema.
export function ThemeToggle({ label }: { label: string }) {
  const [dark, setDark] = useState(initialDark);

  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(storageKey, next); } catch { /* sin almacenamiento: dura hasta recargar */ }
    setDark(!dark);
  }

  return <button type="button" role="switch" aria-checked={dark} aria-label={label} title={label} className="theme-toggle" onClick={toggle}>
    <span className="theme-toggle-track" aria-hidden="true">
      <span className="theme-toggle-knob">
        <svg className="theme-icon theme-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
        <svg className="theme-icon theme-moon" viewBox="0 0 24 24"><path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" /></svg>
      </span>
    </span>
  </button>;
}
