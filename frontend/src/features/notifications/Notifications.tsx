import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { accountRequest } from "../../shared/api/account-http";
import { sanitizeReturnTo } from "../auth/redirect";
import "./notifications.css";
export interface NotificationItem { notification_id: string; title: string; body: string; read_at: string | null; created_at: string; data: { href?: string } }
interface Inbox { items: NotificationItem[]; total: number; unread_count: number; hasMore: boolean }
export function notificationHref(item: NotificationItem) {
  const href = sanitizeReturnTo(item.data?.href);
  return href && /^\/(?:me|workspace|recruitments|clubs|activities|posts)(?:\/|$)/.test(href) ? href : "/me/notifications";
}
function useNotifications(token: string, page = 1, filter = "all") {
  const identity = `${token}:${page}:${filter}`;
  const [data, setData] = useState<{ identity: string; inbox: Inbox }>(), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => setRefresh(n => n + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    void accountRequest<Inbox>(token, `me/notifications?page=${page}&filter=${filter}`, { signal: abort.signal }).then(inbox => {
      if (!abort.signal.aborted) { setData({ identity, inbox }); setError(""); }
    }).catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [token, page, filter, refresh]);
  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
    const socket = io(`${base}/notifications`, { transports: ["websocket"], auth: { token }, reconnectionAttempts: 3, timeout: 5000 });
    socket.on("notifications:changed", retry); socket.on("connect", retry);
    // Persisted inbox is authoritative; polling covers offline tabs and multiple backend instances.
    const timer = setInterval(retry, 30000);
    window.addEventListener("focus", retry);
    return () => { socket.disconnect(); clearInterval(timer); window.removeEventListener("focus", retry); };
  }, [token, retry]);
  return { data: data?.identity === identity ? data.inbox : undefined, error, retry };
}
export function NotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [writeError, setWriteError] = useState("");
  const { data, error, retry } = useNotifications(token), navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function read(item?: NotificationItem) {
    if (busy) return;
    setBusy(true); setWriteError("");
    try {
      await accountRequest(token, `me/notifications/${item ? item.notification_id + "/read" : "read-all"}`, { method: "PATCH" });
      retry(); if (item) { setOpen(false); navigate(notificationHref(item)); }
    } catch (cause) { setWriteError(cause instanceof Error ? cause.message : "Chưa cập nhật được thông báo."); }
    finally { setBusy(false); }
  }
  return <div className="nt-bell" ref={container}><button type="button" className="nt-trigger" ref={trigger} aria-label={`Thông báo${data?.unread_count ? `, ${data.unread_count} chưa đọc` : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen(!open); if (!open) retry(); }}><Bell size={22} aria-hidden="true" />{!!data?.unread_count && <span className="nt-count">{data.unread_count > 99 ? "99+" : data.unread_count}</span>}</button>{open && <section className="nt-panel" role="dialog" aria-label="Thông báo"><div className="nt-heading"><h2>Thông báo</h2><button disabled={busy || !data?.unread_count} onClick={() => void read()}>Đọc tất cả</button></div>{(error || writeError) && <p role="alert">{writeError || error} <button onClick={retry}>Thử lại</button></p>}{!data && !error && <p role="status">Đang tải…</p>}{data?.items.slice(0, 6).map(item => <button disabled={busy} className={`nt-item ${item.read_at ? "" : "is-unread"}`} key={item.notification_id} onClick={() => void read(item)}><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString("vi-VN")}</small></button>)}{data && !data.items.length && <p>Chưa có thông báo.</p>}<Link to="/me/notifications" onClick={() => setOpen(false)}>Xem tất cả thông báo →</Link></section>}</div>;
}
export function NotificationsPage({ token }: { token: string }) {
  const [page, setPage] = useState(1), [filter, setFilter] = useState("all"), [busy, setBusy] = useState(false), [writeError, setWriteError] = useState("");
  const { data, error, retry } = useNotifications(token, page, filter);
  async function mark(item?: NotificationItem) {
    if (busy) return; setBusy(true); setWriteError("");
    try { await accountRequest(token, `me/notifications/${item ? item.notification_id + "/read" : "read-all"}`, { method: "PATCH" }); retry(); }
    catch (cause) { setWriteError(cause instanceof Error ? cause.message : "Chưa cập nhật được thông báo."); }
    finally { setBusy(false); }
  }
  return <section className="nt-page"><h1>Thông báo của tôi</h1><div className="nt-heading"><label>Hiển thị<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="unread">Chưa đọc</option></select></label><button disabled={busy || !data?.unread_count} onClick={() => void mark()}>Đánh dấu tất cả đã đọc</button></div>{(error || writeError) && <p role="alert">{writeError || error} <button onClick={retry}>Thử lại</button></p>}{!data && !error && <p role="status">Đang tải…</p>}{data?.items.map(item => <article key={item.notification_id} className={`nt-item ${item.read_at ? "" : "is-unread"}`}><h2><Link to={notificationHref(item)} onClick={() => void mark(item)}>{item.title}</Link></h2><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("vi-VN")}</small>{!item.read_at && <button disabled={busy} onClick={() => void mark(item)}>Đánh dấu đã đọc</button>}</article>)}{data && !data.items.length && <p>Chưa có thông báo phù hợp.</p>}<nav className="nt-heading" aria-label="Phân trang thông báo"><button disabled={page <= 1} onClick={() => setPage(n => n - 1)}>← Trang trước</button><span>Trang {page}</span><button disabled={!data?.hasMore} onClick={() => setPage(n => n + 1)}>Trang sau →</button></nav></section>;
}
