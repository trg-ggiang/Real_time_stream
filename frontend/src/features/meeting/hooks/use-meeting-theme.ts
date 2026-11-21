import { useCallback, useEffect, useState } from 'react';

export type MeetingTheme = 'light' | 'dark';
const preferenceKey = 'rts.meeting-theme.v1';
function systemTheme(): MeetingTheme {
  return window.matchMedia ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 'dark';
}

export function useMeetingTheme() {
  const [theme, updateTheme] = useState<MeetingTheme>(() => {
    try { const saved = localStorage.getItem(preferenceKey); return saved === 'light' || saved === 'dark' ? saved : systemTheme(); }
    catch { return systemTheme(); }
  });
  const setTheme = useCallback((next: MeetingTheme) => {
    try { localStorage.setItem(preferenceKey, next); } catch { /* Optional persistence. */ }
    updateTheme(next);
  }, []);
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta) meta.content = theme === 'light' ? '#ffffff' : '#1a1a1e';
    return () => { if (meta && previous !== undefined) meta.content = previous; };
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== preferenceKey) return;
      if (event.newValue === 'light' || event.newValue === 'dark') updateTheme(event.newValue);
      else if (event.newValue === null) updateTheme(systemTheme());
    };
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const followSystem = () => {
      try { if (!localStorage.getItem(preferenceKey)) updateTheme(systemTheme()); } catch { updateTheme(systemTheme()); }
    };
    window.addEventListener('storage', sync);
    media?.addEventListener('change', followSystem);
    return () => { window.removeEventListener('storage', sync); media?.removeEventListener('change', followSystem); };
  }, []);
  return { theme, setTheme };
}
