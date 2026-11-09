import { useEffect, useId, useRef } from 'react';

export function ConfirmAction({ title, busy, onConfirm, onCancel }: {
  title: string; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), labelId = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="workspace-confirm" aria-labelledby={labelId} onCancel={event => {
    event.preventDefault(); if (!busy) onCancel();
  }}><h2 id={labelId}>{title}</h2><div><button type="button" disabled={busy} onClick={onCancel}>Hủy</button><button type="button" className="workspace-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div></dialog>;
}
