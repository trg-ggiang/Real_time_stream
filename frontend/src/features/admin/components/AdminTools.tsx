import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { PaginationButton } from '../../../shared/components/PaginationButton';

export const adminDate = (value?: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Chưa có';

export function AdminDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), label = useId();
  useEffect(() => {
    const element = ref.current, previous = document.activeElement;
    if (element?.showModal) element.showModal(); else if (element) element.open = true;
    return () => { element?.close?.(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog className="ad-dialog" ref={ref} aria-labelledby={label} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id={label}>{title}</h2><button type="button" aria-label="Đóng chi tiết" onClick={onClose}><X size={20} /></button></header>{children}
  </dialog>;
}

export function AdminPagination({ page, hasMore, loading, onPage }: { page: number; hasMore?: boolean; loading: boolean; onPage: (page: number) => void }) {
  return <nav className="ad-pagination" aria-label="Phân trang"><PaginationButton direction="previous" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} /><span>Trang {page}</span><PaginationButton direction="next" disabled={!hasMore || loading} onClick={() => onPage(page + 1)} /></nav>;
}

export function exportAdminCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    const text = String(value ?? '');
    return '"' + (/^[\s]*[=+@\-]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
  };
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
