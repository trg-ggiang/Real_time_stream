import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ConnectionState } from 'livekit-client';
import { useConnectionState } from '@livekit/components-react';
import type { JoinCredentials } from '../../types';
import { useMeetingChat } from '../hooks/use-meeting-chat';

export function MeetingChat({ credentials, accessToken, children }: {
  credentials: JoinCredentials; accessToken: string; children: ReactNode;
}) {
  const connected = useConnectionState() === ConnectionState.Connected;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [newBelow, setNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const firstPosition = useRef(true);
  const previousCount = useRef(0);
  const chat = useMeetingChat(accessToken, credentials.sessionId, credentials.participantIdentity, connected, open);

  function scrollToBottom() {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    nearBottom.current = true; setNewBelow(false);
  }

  useEffect(() => {
    if (!open) { firstPosition.current = true; return; }
    if (nearBottom.current || firstPosition.current) { scrollToBottom(); firstPosition.current = false; }
    else if (chat.messages.length > previousCount.current) setNewBelow(true);
    previousCount.current = chat.messages.length;
  }, [open, chat.messages, chat.outbox]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft;
    // Snapshot the text: don't erase text typed while acknowledgement is pending.
    if (await chat.send(content)) setDraft(current => current === content ? '' : current);
  }

  async function older() {
    const list = listRef.current;
    const oldHeight = list?.scrollHeight ?? 0;
    const oldTop = list?.scrollTop ?? 0;
    nearBottom.current = false;
    await chat.loadOlder();
    requestAnimationFrame(() => { if (list) list.scrollTop = oldTop + list.scrollHeight - oldHeight; });
  }

  if (!credentials.sessionId) return <>
    {children}
    <p className="chat-session-hint">Phòng PoC chưa gắn session. Chọn phiên họp trong danh sách để sử dụng chat có lịch sử.</p>
  </>;

  return <>
    <div className="meeting-chat-toolbar">
      <button type="button" className="secondary" aria-expanded={open} aria-controls="meeting-chat-panel" onClick={() => setOpen(value => !value)}>
        {open ? 'Đóng chat' : 'Chat trong phòng'}{!open && chat.unread > 0 ? ` (${chat.unread})` : ''}
      </button>
      <span role="status">{chat.status === 'connected' ? chat.syncing ? 'Đang đồng bộ tin nhắn…' : 'Chat đã kết nối' : chat.status === 'connecting' ? 'Đang kết nối chat…' : 'Chat chưa kết nối'}</span>
    </div>
    <div className={`meeting-workspace${open ? ' has-chat' : ''}`}>
      <div className="meeting-workspace-media">{children}</div>
      {open && <section id="meeting-chat-panel" className="meeting-chat-panel" aria-label="Chat trong phiên họp">
        <div className="chat-panel-heading"><strong>Chat trong phiên họp</strong><button type="button" className="secondary" onClick={chat.reconnect} disabled={!connected}>Kết nối lại</button></div>
        {chat.error && <p className="notice error" role="alert">{chat.error}</p>}
        <div ref={listRef} className="chat-message-list" onScroll={() => {
          const list = listRef.current;
          if (list) nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
          if (nearBottom.current) setNewBelow(false);
        }}>
          {chat.hasOlder && <button type="button" className="chat-load-older secondary" disabled={chat.loadingOlder || chat.status !== 'connected'} onClick={() => void older()}>{chat.loadingOlder ? 'Đang tải…' : 'Tải tin nhắn cũ'}</button>}
          {!chat.messages.length && !chat.syncing && <p className="chat-empty">Chưa có tin nhắn trong phiên này.</p>}
          <ol aria-label="Tin nhắn">
            {chat.messages.map(message => <li key={message.id} className={message.senderId === chat.ownUserId ? 'chat-message own' : 'chat-message'}>
              <div className="chat-message-meta"><strong>{message.senderId === chat.ownUserId ? 'Bạn' : message.senderName}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>
              <p>{message.content}</p>
            </li>)}
            {chat.outbox.map(message => <li key={message.clientMessageId} className="chat-message own"><strong>Bạn</strong><p>{message.content}</p>
              <span>{message.status === 'sending' ? 'Đang gửi…' : 'Chưa xác nhận đã gửi'}</span>
              {message.status === 'failed' && <button type="button" className="secondary" disabled={chat.status !== 'connected'} onClick={() => void chat.send(message.content, message.clientMessageId)}>Thử lại</button>}
            </li>)}
          </ol>
        </div>
        {newBelow && <button type="button" className="secondary" onClick={scrollToBottom}>Có tin mới — xem cuối</button>}
        <form className="chat-composer" onSubmit={event => void submit(event)}>
          <label htmlFor="chat-message-input">Tin nhắn</label>
          <textarea id="chat-message-input" value={draft} rows={3} placeholder="Nhắn với mọi người trong phiên họp…"
            onChange={event => setDraft(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
            }} />
          <div className="chat-composer-actions"><small>{Array.from(draft).length}/2000 · Shift+Enter xuống dòng</small><button type="submit" disabled={chat.status !== 'connected' || chat.outbox.some(message => message.status === 'sending') || !draft.trim() || Array.from(draft.trim()).length > 2000}>Gửi</button></div>
        </form>
      </section>}
    </div>
  </>;
}
