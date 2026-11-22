import { useEffect, useId, useRef, type ReactNode } from 'react';
import '../lib/confirm-action.css';

export function ConfirmationDialog({ title, busy, danger, confirmLabel = 'Xác nhận', onConfirm, onCancel, children }: {
  title: string;
  busy?: boolean;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    element.dataset.theme = element.closest('[data-theme]')?.getAttribute('data-theme') || 'light';
    if (typeof element.showModal === 'function') element.showModal();
    else element.open = true;
    cancel.current?.focus();
    return () => {
      if (typeof element.close === 'function') element.close();
      else element.open = false;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return <dialog ref={dialog} className="uc-confirm uc-confirm-form" aria-modal="true" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault();
    if (!busy) onCancel();
  }}>
    <form onSubmit={event => { event.preventDefault(); if (!busy) onConfirm(); }}>
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className="uc-confirm-actions">
        <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>Hủy</button>
        <button type="submit" disabled={busy} className="uc-confirm-accept" data-danger={danger || undefined}>
          {busy ? 'Đang xử lý…' : confirmLabel}
        </button>
      </div>
    </form>
  </dialog>;
}
