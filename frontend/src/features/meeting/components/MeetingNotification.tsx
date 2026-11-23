import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAutoDismiss } from '../../../shared/lib/use-auto-dismiss';
import './meeting-notification.css';

const NoticeTarget = createContext<HTMLDivElement | null>(null);

export function MeetingNotificationTarget({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <NoticeTarget.Provider value={target}>
    {children}
    <div ref={setTarget} className="meeting-notification-stack" />
  </NoticeTarget.Provider>;
}

type NoticeProps = {
  message: string;
  kind?: 'info' | 'success' | 'warning' | 'error';
  manualLink?: string;
  onClose?: () => void;
};

function NotificationCard({ message, kind = 'info', manualLink, onClose }: NoticeProps) {
  const target = useContext(NoticeTarget);
  const [dismissed, setDismissed] = useState(false);
  const dismiss = useCallback(() => { setDismissed(true); onClose?.(); }, [onClose]);
  useAutoDismiss(manualLink || dismissed ? '' : message, dismiss, 5000);
  if (dismissed) return null;

  const card = <div className="meeting-notification" data-kind={kind} data-manual={Boolean(manualLink)}>
    <div className="meeting-notification-content">
      <p role={kind === 'error' || manualLink ? 'alert' : 'status'}>{message}</p>
      {manualLink ? <input aria-label="Đường dẫn cuộc họp" readOnly value={manualLink}
        onFocus={event => event.currentTarget.select()} /> : null}
    </div>
    <button type="button" aria-label="Đóng thông báo" onClick={dismiss}>×</button>
  </div>;
  return target ? createPortal(card, target) : <div className="meeting-notification-stack">{card}</div>;
}

export function MeetingNotification(props: NoticeProps) {
  return props.message ? <NotificationCard key={JSON.stringify([props.message, props.kind, props.manualLink])} {...props} /> : null;
}
