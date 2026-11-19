import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AccountApiError } from '../../../shared/api/account-http';
import { useUnsavedChanges } from '../../../shared/lib/use-unsaved-changes';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { PersonalState } from '../../personal/components/PersonalState';
import { useClub } from '../workspace-context';
import { useWorkspaceMutation } from '../use-workspace-mutation';
import { workspaceRequest, type ChannelHistory, type ChannelMessage, type ClubChannel, type WorkspaceList } from '../services/workspace-api';
import { channelLabel } from '../channel-label';
import { ContentImage } from '../../discovery/components/PublicContent';

export function WorkspaceChannel() {
  const { channel } = useParams();
  const { token, clubId } = useClub();
  const channels = usePersonalQuery<WorkspaceList<ClubChannel>>(token, `workspace/${clubId}/channels`);
  const selected = channels.data?.items.find(item => item.channel_id === channel || (channel === 'general' && item.kind === 'general'));
  if (!channels.data) return <PersonalState {...channels} />;
  if (selected && channel === 'general') return <Navigate replace to={`/workspace/${clubId}/channels/${selected.channel_id}`} />;
  if (!selected) return <div className="cw-panel"><h1>Không thể mở kênh</h1><p>Kênh không tồn tại hoặc bạn không có quyền truy cập.</p><Link to={`/workspace/${clubId}`}>Về tổng quan CLB</Link></div>;
  return <ChannelChat key={`${token}:${selected.channel_id}`} channel={selected} />;
}

export function mergeChannelMessages(old: ChannelMessage[], incoming: ChannelMessage[]) {
  return [...new Map([...old, ...incoming].map(message => [message.message_id, message])).values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.message_id.localeCompare(b.message_id));
}

function ChannelChat({ channel }: { channel: ClubChannel }) {
  const { token, clubId, club } = useClub();
  const [items, setItems] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [text, setText] = useState('');
  useUnsavedChanges(text.trim().length > 0);
  const [cursor, setCursor] = useState<ChannelHistory['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const retryKey = useRef<{ text: string; id: string } | null>(null);
  const mutation = useWorkspaceMutation();
  const path = `channels/${channel.channel_id}/messages`;
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number;
    let initial = true;
    async function poll() {
      if (document.hidden) { timer = window.setTimeout(poll, 3000); return; }
      const follow = !history.current || history.current.scrollHeight - history.current.scrollTop - history.current.clientHeight < 100;
      try {
        const result = await workspaceRequest<ChannelHistory>(token, clubId, path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(previous => mergeChannelMessages(previous, result.items));
        if (initial) { setCursor(result.cursor); setHasMore(result.hasMore); }
        setError(''); setDenied(false); setLoading(false);
        if (initial || follow) requestAnimationFrame(() => { if (!controller.signal.aborted && history.current) history.current.scrollTop = history.current.scrollHeight; });
        initial = false;
      } catch (cause) {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(cause instanceof Error ? cause.message : 'Chưa tải được tin nhắn.');
        if (cause instanceof AccountApiError && [401, 403, 404].includes(cause.status)) { setItems([]); setDenied(true); }
      }
      if (!controller.signal.aborted) timer = window.setTimeout(poll, 3000);
    }
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [token, clubId, path, refresh]);

  async function older() {
    if (!cursor || olderBusy) return;
    setOlderBusy(true);
    try {
      const result = await workspaceRequest<ChannelHistory>(token, clubId, `${path}?${new URLSearchParams(cursor)}`);
      setItems(previous => mergeChannelMessages(previous, result.items)); setCursor(result.cursor); setHasMore(result.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tải được tin nhắn cũ.'); }
    finally { setOlderBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || mutation.busy || denied) return;
    if (!retryKey.current || retryKey.current.text !== content) retryKey.current = { text: content, id: crypto.randomUUID() };
    const id = retryKey.current.id;
    const result = await mutation.run(signal => workspaceRequest<{ item: ChannelMessage }>(token, clubId, path, {
      method: 'POST', signal, body: JSON.stringify({ content, client_message_id: id }),
    }));
    if (result) {
      setItems(previous => mergeChannelMessages(previous, [result.item])); setText(''); retryKey.current = null;
      requestAnimationFrame(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; });
    }
  }
  return <section className="cw-channel" aria-label={`Kênh ${channelLabel(channel)}`}>
    <header className="cw-channel-header"><div><h1>{channelLabel(channel)}</h1><p>{channel.description || 'Trao đổi cùng các thành viên được phép truy cập kênh.'}</p></div><span className="cw-channel-club">{club.name}</span></header>
    <div className="cw-channel-history cw-live-history" ref={history} aria-label="Lịch sử tin nhắn">
      {hasMore && <button className="cw-link" disabled={olderBusy} onClick={() => void older()}>{olderBusy ? 'Đang tải…' : 'Tin nhắn cũ hơn'}</button>}
      {loading && <p role="status">Đang tải tin nhắn…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setRefresh(value => value + 1)}>Thử lại</button></div>}
      {!loading && !error && !items.length && <div className="cw-channel-empty"><h2>Bắt đầu ở {channelLabel(channel)}</h2><p>Chưa có tin nhắn. Gửi lời chào đầu tiên đến CLB.</p></div>}
      {items.map((item, index) => {
        const continued = index > 0 && items[index - 1].sender_membership_id === item.sender_membership_id;
        return <article className={`cw-message${item.mine ? ' is-mine' : ''}${continued ? ' is-continuation' : ''}`} key={item.message_id} tabIndex={0} aria-label={`${item.sender}, ${new Date(item.created_at).toLocaleString('vi-VN')}`}>
        {continued ? <span className="cw-message-avatar-space" aria-hidden="true" /> : <ContentImage className="cw-message-avatar" src={item.avatar_url} fallbackText={Array.from(item.sender.trim())[0] || '?'} />}
        <div className="cw-message-body">{!continued && <header className="cw-message-meta"><strong>{item.sender}</strong><time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString('vi-VN')}>{new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></header>}
        <p>{item.deleted_at ? 'Tin nhắn đã được gỡ.' : item.content}</p></div>
      </article>;
      })}
    </div>
    <form className="cw-channel-composer cw-live-composer" onSubmit={event => void send(event)}>
      <textarea aria-label={`Nhắn tin trong ${channelLabel(channel)}`} placeholder={`Nhắn tin trong ${channelLabel(channel)}`} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (!event.repeat) event.currentTarget.form?.requestSubmit();
      }} maxLength={2000} disabled={mutation.busy || denied || loading} rows={2} />
      <button className="cw-primary" disabled={!text.trim() || mutation.busy || denied || loading}>{mutation.busy ? 'Đang gửi…' : 'Gửi'}</button>
      {mutation.error && <p role="alert">{mutation.error} Nội dung được giữ lại để bạn kiểm tra và gửi lại.</p>}
    </form>
  </section>;
}
