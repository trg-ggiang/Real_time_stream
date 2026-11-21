import { useEffect, useId, useRef, useState } from 'react';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { MeetingThemeToggle } from './MeetingThemeToggle';
import type { MeetingTheme } from '../hooks/use-meeting-theme';

export function AccountSettings({ theme, onThemeChange, onLogout }: {
  theme: MeetingTheme; onThemeChange: (theme: MeetingTheme) => void; onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLButtonElement>('.account-settings-panel button')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return <div className="account-settings" ref={container} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="account-settings-trigger" aria-label="Cài đặt tài khoản" title="Cài đặt tài khoản"
      aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><GearSix size={22} aria-hidden="true" /></button>
    {open ? <section id={panelId} className="account-settings-panel" aria-label="Cài đặt tài khoản">
      <div className="account-settings-theme"><span>Giao diện</span><MeetingThemeToggle theme={theme} onChange={onThemeChange} /></div>
      <button type="button" className="account-settings-logout" disabled={busy} onClick={async () => {
        if (busy) return;
        setBusy(true); setError('');
        try { await onLogout(); } catch { setError('Chưa đăng xuất được. Hãy thử lại.'); setBusy(false); }
      }}><SignOut size={20} aria-hidden="true" />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
      {error ? <p role="alert">{error}</p> : null}
    </section> : null}
  </div>;
}
