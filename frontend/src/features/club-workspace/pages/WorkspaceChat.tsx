import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Smiley } from '@phosphor-icons/react/dist/csr/Smiley';
import { Paperclip } from '@phosphor-icons/react/dist/csr/Paperclip';
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
import { ChannelMessageAttachment, DraftChannelAttachment, channelFileAccept, channelFileError, pastedChannelImages } from './ChannelAttachments';
import { ChannelMessageText } from './ChannelMessageText';

export function WorkspaceChannel({ channels }: { channels: ReturnType<typeof usePersonalQuery<WorkspaceList<ClubChannel>>> }) {
  const { channel } = useParams();
  const { token, clubId } = useClub();
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

const messageLengthLimit = 2000;
const emojis = [
  ['😀', 'Cười'], ['😂', 'Cười ra nước mắt'], ['😊', 'Mỉm cười'], ['😍', 'Yêu thích'],
  ['😮', 'Bất ngờ'], ['😢', 'Buồn'], ['🤔', 'Suy nghĩ'], ['❤️', 'Trái tim'],
  ['👍', 'Đồng ý'], ['👏', 'Vỗ tay'], ['🙌', 'Hoan hô'], ['🙏', 'Cảm ơn'],
  ['🎉', 'Chúc mừng'], ['🔥', 'Bùng cháy'], ['✅', 'Hoàn thành'], ['👋', 'Chào'],
] as const;

function ChannelChat({ channel }: { channel: ClubChannel }) {
  const { token, clubId, club } = useClub();
  const [items, setItems] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiPickerId = useId();
  const emojiToggle = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useUnsavedChanges(text.trim().length > 0 || files.length > 0);
  const [cursor, setCursor] = useState<ChannelHistory['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const retryKey = useRef<{ text: string; id: string; files: typeof files } | null>(null);
  const mutation = useWorkspaceMutation();
  const composerDisabled = mutation.busy || denied || loading;
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
  function insertEmoji(emoji: string) {
    const field = composer.current;
    if (!field || composerDisabled) return;
    const { selectionStart: start, selectionEnd: end } = field;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setEmojiOpen(false);
    field.focus();
    if (next.length > messageLengthLimit) return;
    setText(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      if (composer.current === field && document.activeElement === field) field.setSelectionRange(caret, caret);
    });
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if ((!content && !files.length) || composerDisabled) return;
    setEmojiOpen(false);
    setFileError('');
    if (!retryKey.current || retryKey.current.text !== content || retryKey.current.files !== files) {
      retryKey.current = { text: content, id: crypto.randomUUID(), files };
    }
    const id = retryKey.current.id;
    const result = await mutation.run(signal => {
      if (files.length) {
        const form = new FormData();
        form.append('content', content);
        form.append('client_message_id', id);
        for (const { file } of files) form.append('files', file);
        return workspaceRequest<{ item: ChannelMessage }>(token, clubId, path + '/attachments', {
          method: 'POST', signal, body: form, timeoutMs: 90000,
        });
      }
      return workspaceRequest<{ item: ChannelMessage }>(token, clubId, path, {
        method: 'POST', signal, body: JSON.stringify({ content, client_message_id: id }),
      });
    });
    if (result) {
      setItems(previous => mergeChannelMessages(previous, [result.item])); setText(''); setFiles([]); retryKey.current = null;
      requestAnimationFrame(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; });
    }
  }

  function addFiles(added: File[]) {
    if (composerDisabled || !added.length) return;
    const problem = channelFileError([...files.map(item => item.file), ...added]);
    setFileError(problem);
    if (!problem) setFiles([...files, ...added.map(file => ({ id: crypto.randomUUID(), file }))]);
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
        {(item.deleted_at || item.content) && <p>{item.deleted_at ? 'Tin nhắn đã được gỡ.' : <ChannelMessageText content={item.content} />}</p>}
        {!item.deleted_at && !!item.attachments?.length && <ul className="cw-message-attachments">
          {item.attachments.map(attachment => <ChannelMessageAttachment key={attachment.attachment_id}
            attachment={attachment} channelId={channel.channel_id} />)}
        </ul>}</div>
      </article>;
      })}
    </div>
    <form className="cw-channel-composer cw-live-composer" onSubmit={event => void send(event)}>
      {!!files.length && <ul className="cw-draft-attachments" aria-label="Tệp đính kèm đang soạn">
        {files.map(({ id, file }) => <DraftChannelAttachment key={id} file={file} disabled={composerDisabled}
          onRemove={() => { setFiles(items => items.filter(item => item.id !== id)); setFileError(''); }} />)}
      </ul>}
      <div className="cw-emoji-control" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setEmojiOpen(false);
      }} onKeyDown={event => {
        if (event.key !== 'Escape' || !emojiOpen) return;
        event.preventDefault();
        event.stopPropagation();
        setEmojiOpen(false);
        emojiToggle.current?.focus();
      }}>
        <button ref={emojiToggle} type="button" className="cw-emoji-toggle" aria-label="Chọn emoji"
          aria-controls={emojiPickerId} aria-expanded={emojiOpen && !composerDisabled} disabled={composerDisabled}
          onClick={() => setEmojiOpen(value => !value)}>
          <Smiley size={22} aria-hidden="true" />
        </button>
        <div id={emojiPickerId} role="group" aria-label="Emoji" className="cw-emoji-picker" hidden={!emojiOpen || composerDisabled}>
          {emojis.map(([emoji, label]) => (
            <button type="button" key={emoji} aria-label={label} title={label} onClick={() => insertEmoji(emoji)}>{emoji}</button>
          ))}
        </div>
      </div>
      <button type="button" className="cw-emoji-toggle" aria-label="Đính kèm ảnh hoặc tệp" title="Đính kèm ảnh hoặc tệp"
        disabled={composerDisabled} onClick={() => fileInput.current?.click()}><Paperclip size={21} aria-hidden="true" /></button>
      <input hidden ref={fileInput} type="file" multiple accept={channelFileAccept} aria-label="Tệp đính kèm"
        disabled={composerDisabled} onChange={event => {
          const input = event.currentTarget;
          addFiles(Array.from(input.files ?? []));
          input.value = '';
        }} />
      <textarea ref={composer} aria-label={`Nhắn tin trong ${channelLabel(channel)}`} placeholder={`Nhắn tin trong ${channelLabel(channel)}`} value={text} onChange={event => setText(event.target.value)} onPaste={event => {
        const images = pastedChannelImages(event.clipboardData);
        if (!images.length) return;
        event.preventDefault();
        addFiles(images);
      }} onKeyDown={event => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (!event.repeat) event.currentTarget.form?.requestSubmit();
      }} maxLength={messageLengthLimit} disabled={composerDisabled} rows={2} />
      <button className="cw-primary" disabled={(!text.trim() && !files.length) || composerDisabled}>{mutation.busy ? 'Đang gửi…' : 'Gửi'}</button>
      {fileError && <p role="alert">{fileError}</p>}
      {mutation.error && <p role="alert">{mutation.error} Nội dung được giữ lại để bạn kiểm tra và gửi lại.</p>}
    </form>
  </section>;
}
