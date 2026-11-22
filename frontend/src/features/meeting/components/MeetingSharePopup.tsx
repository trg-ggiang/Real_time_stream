import { useEffect } from 'react';
import type { MeetingShareResult } from '../services/meetings-api';
import './meeting-share-popup.css';

export function MeetingSharePopup({ result, dismiss }: {
  result: MeetingShareResult | null;
  dismiss: (value: null) => void;
}) {
  useEffect(() => {
    if (!result || result.manualLink) return;
    const timer = window.setTimeout(() => dismiss(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result, dismiss]);

  if (!result) return null;
  return <div className="meeting-share-popup">
    <p role={result.manualLink ? 'alert' : 'status'}>{result.message}</p>
    {result.manualLink && <input aria-label="Đường dẫn cuộc họp" readOnly value={result.manualLink}
      onFocus={event => event.currentTarget.select()} />}
    <button type="button" aria-label="Đóng thông báo chia sẻ" onClick={() => dismiss(null)}>×</button>
  </div>;
}
