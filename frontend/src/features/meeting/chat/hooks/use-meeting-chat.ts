import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { chatRequest, createChatSocket } from '../services/chat-socket';
import { mergeMessages, messageCursor, type ChatCursor, type ChatMessage, type HistoryPage, type OutgoingMessage } from '../types';

export function useMeetingChat(accessToken: string, sessionId: string | undefined,
  participantIdentity: string, active: boolean, open: boolean) {
  const ownUserId = participantIdentity.split(':')[0];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [outbox, setOutbox] = useState<OutgoingMessage[]>([]);
  const [status, setStatus] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const messageRef = useRef<ChatMessage[]>([]);
  const initialized = useRef(false);
  const checkpoint = useRef<ChatCursor | undefined>(undefined);
  const synchronizing = useRef(true);
  const openRef = useRef(open);
  const mounted = useRef(true);
  const sending = useRef(new Map<string, symbol>());
  const olderBusy = useRef(false);
  openRef.current = open;

  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    messageRef.current = []; checkpoint.current = undefined; initialized.current = false;
    synchronizing.current = true; sending.current.clear(); olderBusy.current = false;
    setMessages([]); setOutbox([]); setUnread(0); setHasOlder(false); setLoadingOlder(false); setError(null);
  }, [accessToken, sessionId, ownUserId]);

  const accept = useCallback((incoming: ChatMessage[], live = false) => {
    const known = new Set(messageRef.current.map(message => message.id));
    if (live && !openRef.current) setUnread(value => value + incoming.filter(message =>
      !known.has(message.id) && message.senderId !== ownUserId).length);
    const merged = mergeMessages(messageRef.current, incoming);
    messageRef.current = merged; setMessages(merged);
    const confirmed = new Set(incoming.filter(message => message.senderId === ownUserId).map(message => message.clientMessageId));
    for (const id of confirmed) sending.current.delete(id);
    setOutbox(current => current.filter(message => !confirmed.has(message.clientMessageId)));
  }, [ownUserId]);

  useEffect(() => {
    if (!active || !sessionId) {
      setStatus('offline');
      setOutbox(current => current.map(message => ({ ...message, status: 'failed' })));
      return;
    }
    const socket = createChatSocket(accessToken, sessionId, participantIdentity);
    socketRef.current = socket;
    let generation = 0;
    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let pollBusy = false;
    let pollRequested = false;
    const valid = (run: number) => !disposed && socket.connected && run === generation;

    async function synchronize() {
      const run = ++generation;
      synchronizing.current = true;
      setStatus('connected'); setSyncing(true); setError(null);
      // Capture the cursor before accepting live events during history fetch.
      let cursor = checkpoint.current;
      try {
        const latest = await chatRequest<HistoryPage>(socket, 'chat:history', {});
        if (!valid(run)) return;
        accept(latest.messages, initialized.current);
        if (!initialized.current) { setHasOlder(latest.hasMore); initialized.current = true; }
        // Walk every missed page, rather than assuming the newest 50 are enough.
        if (cursor) {
          let more = true;
          while (more) {
            const page = await chatRequest<HistoryPage>(socket, 'chat:history', { after: cursor });
            if (!valid(run)) return;
            accept(page.messages, true);
            more = page.hasMore && page.messages.length > 0;
            if (page.messages.length) {
              cursor = messageCursor(page.messages[page.messages.length - 1]);
              checkpoint.current = cursor; // Resume here if a later page fails.
            }
          }
        }
        if (messageRef.current.length) checkpoint.current = messageCursor(messageRef.current[messageRef.current.length - 1]);
        synchronizing.current = false;
      } catch (cause) {
        if (valid(run)) setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử. Hãy kết nối lại.');
      } finally { if (valid(run)) setSyncing(false); }
    }

    // Socket.IO provides low-latency delivery within a backend process. Poll the
    // persisted history as a recovery path for messages saved by another process.
    async function pollHistory() {
      if (disposed) return;
      pollRequested = false;
      if (synchronizing.current) { pollRequested = true; return; }
      if (socket.connected && !pollBusy && !synchronizing.current) {
        pollBusy = true;
        try {
          let cursor = checkpoint.current;
          let more = true;
          while (more && !disposed && socket.connected) {
            const page = await chatRequest<HistoryPage>(socket, 'chat:history', cursor ? { after: cursor } : {});
            if (disposed || !socket.connected) return;
            accept(page.messages, true);
            more = page.hasMore && page.messages.length > 0;
            if (page.messages.length) {
              cursor = messageCursor(page.messages[page.messages.length - 1]);
              checkpoint.current = cursor;
            }
          }
        } catch {
          // Keep the current transcript and retry on the next polling tick.
        } finally {
          pollBusy = false;
        }
      }
      if (!disposed) pollTimer = setTimeout(() => { pollTimer = undefined; void pollHistory(); }, 3000);
    }

    socket.on('chat:message', (message: ChatMessage) => {
      if (!disposed && socket.connected && message.sessionId === sessionId) {
        accept([message], true);
        if (!synchronizing.current && messageRef.current.length) checkpoint.current = messageCursor(messageRef.current[messageRef.current.length - 1]);
      }
    });
    socket.on('connect', () => {
      void synchronize().finally(() => {
        if (pollRequested && !disposed) void pollHistory();
      });
      if (!pollTimer) pollTimer = setTimeout(() => { pollTimer = undefined; void pollHistory(); }, 3000);
    });
    socket.on('disconnect', () => {
      sending.current.clear();
      generation++; setStatus('offline'); setSyncing(false);
      setOutbox(current => current.map(message => ({ ...message, status: 'failed' })));
    });
    socket.on('connect_error', (cause: Error) => { setStatus('offline'); setError(cause.message || 'Không kết nối được chat.'); });
    socket.on('chat:revoked', () => {
      messageRef.current = []; checkpoint.current = undefined; initialized.current = false;
      setMessages([]); setUnread(0); setHasOlder(false);
      setError('Quyền chat đã kết thúc. Kiểm tra phiên họp hoặc đăng nhập lại.');
      socket.disconnect();
    });
    setStatus('connecting'); socket.connect();
    return () => { disposed = true; generation++; if (pollTimer) clearTimeout(pollTimer); olderBusy.current = false; setLoadingOlder(false); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [accessToken, sessionId, participantIdentity, active, accept]);

  const send = useCallback(async (content: string, clientMessageId: string = crypto.randomUUID()): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket?.connected) { setError('Chat chưa kết nối. Nội dung đang soạn vẫn được giữ.'); return false; }
    if (sending.current.size > 0) return false;
    const text = content.trim();
    if (!text || Array.from(text).length > 2000) { setError('Tin nhắn cần có nội dung và tối đa 2.000 ký tự.'); return false; }
    const attempt = Symbol(clientMessageId);
    sending.current.set(clientMessageId, attempt); setError(null);
    setOutbox(current => [...current.filter(message => message.clientMessageId !== clientMessageId), { content: text, clientMessageId, status: 'sending' }]);
    try {
      const message = await chatRequest<ChatMessage>(socket, 'chat:send', { content: text, clientMessageId });
      if (mounted.current && socketRef.current === socket && socket.connected) accept([message]);
    } catch (cause) {
      if (mounted.current && socketRef.current === socket && sending.current.get(clientMessageId) === attempt && !messageRef.current.some(message => message.senderId === ownUserId && message.clientMessageId === clientMessageId)) {
        setOutbox(current => current.map(message => message.clientMessageId === clientMessageId ? { ...message, status: 'failed' } : message));
        setError(cause instanceof Error ? cause.message : 'Chưa xác nhận được tin nhắn. Hãy thử lại.');
      }
    } finally { if (sending.current.get(clientMessageId) === attempt) sending.current.delete(clientMessageId); }
    return mounted.current && socketRef.current === socket; // Keep content in the outbox on acknowledgement timeout; don't clear a different room's draft.
  }, [accept, ownUserId]);

  const loadOlder = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected || olderBusy.current || !messageRef.current.length) return;
    olderBusy.current = true; setLoadingOlder(true);
    try {
      const page = await chatRequest<HistoryPage>(socket, 'chat:history', { before: messageCursor(messageRef.current[0]) });
      if (mounted.current && socketRef.current === socket && socket.connected) { accept(page.messages); setHasOlder(page.hasMore); }
    } catch (cause) { if (mounted.current && socketRef.current === socket) setError(cause instanceof Error ? cause.message : 'Không tải được tin cũ.'); }
    finally { if (mounted.current && socketRef.current === socket) { olderBusy.current = false; setLoadingOlder(false); } }
  }, [accept]);

  const reconnect = () => {
    const socket = socketRef.current;
    if (socket) { socket.disconnect(); setStatus('connecting'); socket.connect(); }
  };
  return { messages, outbox, status, error, hasOlder, loadingOlder, syncing, unread, ownUserId, send, loadOlder, reconnect };
}
