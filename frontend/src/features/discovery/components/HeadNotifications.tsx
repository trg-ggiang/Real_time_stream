import { useEffect, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { accountRequest } from "../../../shared/api/account-http";
import "./head-notifications.css";
import { sanitizeReturnTo } from '../../auth/redirect';
export function notificationTarget(data:{club_id?:string;href?:string}){
 const href=sanitizeReturnTo(data?.href);
 return href&&/^\/(?:workspace\/|me\/recruitment-applications(?:\/|$))/.test(href)?href:data?.club_id?`/workspace/${encodeURIComponent(data.club_id)}`:'/me/recruitment-applications';
}
interface Inbox {
  items: { notification_id: string; title: string; body: string; created_at: string; data: { club_id?: string;href?:string } }[];
  unread_count: number; read_through: string;
}
export function HeadNotifications({ token, panelRef }: { token?: string; panelRef: RefObject<HTMLDetailsElement | null> }) {
  const [inbox, setInbox] = useState<Inbox>(), [error, setError] = useState(""), [open, setOpen] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    void accountRequest<Inbox>(token, "me/head-notifications", { signal: abort.signal }).then(data => {
      if (!abort.signal.aborted) { setInbox(data); setError(""); }
    }).catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [token, attempt]);
  useEffect(() => {
    if (!token) return;
    const refresh = () => setAttempt(n => n + 1);
    const timer = setInterval(refresh, 15000); window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [token]);
  useEffect(() => {
    if (!open || !token || !inbox?.unread_count) return;
    const through = inbox.read_through, abort = new AbortController();
    void accountRequest(token, "me/head-notifications/read", { method: "PUT", signal: abort.signal, body: JSON.stringify({ through }) }).then(() => {
      if (!abort.signal.aborted) setInbox(current => current?.read_through === through ? { ...current, unread_count: 0 } : current);
    }).catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [open, token, inbox?.read_through, inbox?.unread_count]);
  return <details className="dc-notifications" ref={panelRef} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary aria-label="Thông báo"><Bell size={22} aria-hidden="true" />{!!inbox?.unread_count && <span className="dc-head-count" aria-label={`${inbox.unread_count} thông báo chưa đọc`}>{inbox.unread_count > 99 ? "99+" : inbox.unread_count}</span>}</summary>
    <div className="dc-account-menu dc-notification-panel"><h2>Thông báo</h2>
      {error && <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Thử lại</button></p>}
      {!inbox && !error && <p>{token ? "Đang tải thông báo…" : "Chưa có thông báo."}</p>}
      {inbox && !inbox.items.length && <p>Chưa có thông báo.</p>}
      {inbox?.items.map(item => <article className="dc-head-notification" key={item.notification_id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("vi-VN")}</small><Link to={notificationTarget(item.data)} onClick={() => { if (panelRef.current) panelRef.current.open = false; }}>{item.data?.href?'Xem chi tiết →':'Mở CLB →'}</Link></article>)}
    </div>
  </details>;
}
