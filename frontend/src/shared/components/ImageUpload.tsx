import { useEffect, useId, useRef, useState } from 'react';
import { accountRequest } from '../api/account-http';
import { ImageFilePicker } from './ImageFilePicker';

export function ImageUpload({ token, label, value, onChange, disabled, onBusyChange }: {
  token: string; label: string; value?: string; onChange: (url: string) => void;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0]; input.value = '';
    if (!file || busy || disabled) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
      setError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.'); return;
    }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await accountRequest<{ url: string }>(token, 'media/images', { method: 'POST', body: form, timeoutMs: 90000, signal: controller.signal });
      if (!controller.signal.aborted) onChange(result.url);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chưa tải được ảnh.'); }
    finally { if (!controller.signal.aborted) { setBusy(false); onBusyChange?.(false); } request.current = null; }
  }
  return <div className="uc-image-upload">
    <label htmlFor={id}>{label}</label>
    {value && <img src={value} width={320} height={130} alt={`Xem trước ${label.toLocaleLowerCase('vi')}`} />}
    <ImageFilePicker id={id} aria-label={label} accept="image/jpeg,image/png,image/webp" disabled={disabled} busy={busy} hasImage={Boolean(value)} onChange={event => void upload(event.currentTarget)} />
    <small role="status" aria-live="polite">{busy ? 'Đang tải ảnh lên…' : 'JPG, PNG, WebP · tối đa 5 MB. Ảnh được lưu khi tải lên hoàn tất.'}</small>
    {value && <button type="button" disabled={disabled || busy} onClick={() => onChange('')}>Bỏ ảnh</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
