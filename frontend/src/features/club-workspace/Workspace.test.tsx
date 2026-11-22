// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from '../guest/GuestLanding';
import { mergeChannelMessages } from './pages/WorkspaceChat';
import type { ChannelMessage } from './services/workspace-api';

const { channelSockets } = vi.hoisted(() => ({ channelSockets: [] as any[] }));
vi.mock('./services/channel-socket', async importOriginal => {
  const original = await importOriginal<typeof import('./services/channel-socket')>();
  return { ...original, createChannelSocket: (_token: string, clubId: string, channelId: string) => {
    const handlers = new Map<string, Set<(...args: any[]) => void>>();
    const socket = {
      connected: false,
      on(event: string, callback: (...args: any[]) => void) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event)!.add(callback); return this; },
      receive(event: string, ...args: any[]) { handlers.get(event)?.forEach(callback => callback(...args)); },
      connect() { this.connected = true; queueMicrotask(() => this.receive('connect')); return this; },
      disconnect() { this.connected = false; this.receive('disconnect'); return this; },
      removeAllListeners() { handlers.clear(); },
      timeout() { return this; },
      async emitWithAck(event: string, body: unknown) {
        if (event !== 'channel:send') throw new Error('Unexpected socket event');
        const response = await fetch(`/api/workspace/${clubId}/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify(body) });
        return { ok: response.ok, data: await response.json() };
      },
    };
    channelSockets.push(socket);
    return socket;
  } };
});

afterEach(() => { cleanup(); vi.useRealTimers(); channelSockets.length = 0; sessionStorage.clear(); localStorage.removeItem('unicircle.workspace-theme'); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture(meetings: unknown[] = [], historyItems: unknown[] = []) {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  let failedSend = false;
  const postBodies: { content: string; client_message_id: string }[] = [];
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const role = url.includes('/beta') ? 'chairperson' : 'member';
    if (options?.method === 'POST' && url.endsWith('/messages')) {
      const body = JSON.parse(String(options.body)); postBodies.push(body);
      if (!failedSend) { failedSend = true; throw new TypeError('Network unavailable'); }
      return { ok: true, json: async () => ({ item: { message_id: 'sent', sender: 'An', mine: true, content: body.content, created_at: '2026-11-19T01:00:00Z' } }) };
    }
    let data: unknown;
    if (options?.method === 'POST' && url.endsWith('/messages/attachments')) {
      const body = options.body as FormData;
      if (!failedSend) { failedSend = true; throw new TypeError('Network unavailable'); }
      data = { item: {
        message_id: 'with-files', sender: 'An', mine: true, content: body.get('content'), created_at: '2026-11-20T01:00:00Z',
        attachments: body.getAll('files').map((value, index) => {
          const file = value as File;
          return { attachment_id: 'attachment-' + index, original_name: file.name, mime_type: file.type, size_bytes: file.size };
        }),
      } };
    }
    else if (url.includes('/attachments/') && url.endsWith('?mode=preview')) data = { url: 'https://storage.example/photo' };
    else if (url.includes('/attachments/')) data = { url: 'https://storage.example/download' };
    else if (url.startsWith('/api/me/clubs')) data = { items: [
      { membership_id: 'ma', club: { club_id: 'alpha', name: 'CLB Alpha' }, role: 'member' },
      { membership_id: 'mb', club: { club_id: 'beta', name: 'CLB Beta' }, role: 'chairperson' },
    ] };
    else if (url.includes('/meetings?')) data = { items: meetings, hasMore: false };
    else if (url.endsWith('/messages')) data = { items: historyItems, hasMore: false, cursor: null };
    else if (url.endsWith('/channels')) data = { items: [
      { channel_id: 'real-general', name: 'Chung', kind: 'general', description: 'Kênh thật' },
      { channel_id: 'discussion', name: 'Thảo luận', kind: 'department', description: 'Kênh ban' },
    ] };
    else if (/^\/api\/workspace\/[^/?]+$/.test(url)) data = { club: { club_id: url.split('/')[3], name: 'CLB', summary: 'Cùng học tập' }, membership: { membership_id: 'm', user_id: 'student', role } };
    else data = { items: [], hasMore: false };
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, postBodies };
}

it('uses persisted channels, shows chair tools by club, and opens the existing schedule form', async () => {
  const { fetcher } = fixture();
  history.replaceState(null, '', '/workspace/alpha/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Chung' });
  expect(screen.queryByRole('link', { name: 'Duyệt nội dung' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Tạo bản nháp' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mở CLB Beta' }));
  await screen.findByRole('link', { name: 'Duyệt nội dung' });
  await waitFor(() => expect(location.pathname).toBe('/workspace/beta/channels/real-general'));
  expect(screen.getByRole('link', { name: 'Quản lý ban và kênh' }).getAttribute('href')).toBe('/workspace/beta/departments');
  const nav = screen.getByRole('navigation', { name: 'Điều hướng CLB' });
  fireEvent.click(within(nav).getByRole('link', { name: 'Họp theo lịch' }));
  await screen.findByRole('heading', { name: 'Họp theo lịch' });
  expect(screen.getByLabelText('Lặp lại')).toBeTruthy();
  expect(fetcher.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});

it('keeps club order and the channel list stable while switching channels', async () => {
  const { fetcher } = fixture();
  history.replaceState(null, '', '/workspace/alpha/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  await screen.findByRole('heading', { name: 'Chung' });
  const rail = screen.getByRole('complementary', { name: 'CLB đã tham gia' });
  expect(within(rail).getAllByRole('link', { name: /^Mở CLB/ }).map(link => link.getAttribute('aria-label')))
    .toEqual(['Mở CLB Alpha', 'Mở CLB Beta']);
  fireEvent.click(within(rail).getByRole('link', { name: 'Mở CLB Beta' }));
  await screen.findByRole('link', { name: 'Duyệt nội dung' });
  expect(within(screen.getByRole('complementary', { name: 'CLB đã tham gia' }))
    .getAllByRole('link', { name: /^Mở CLB/ }).map(link => link.getAttribute('aria-label')))
    .toEqual(['Mở CLB Alpha', 'Mở CLB Beta']);
  await screen.findByRole('heading', { name: 'Chung' });
  const nav = screen.getByRole('navigation', { name: 'Điều hướng CLB' });
  expect(within(nav).queryByRole('link', { name: /^Phòng họp$/ })).toBeNull();
  expect(within(nav).queryByRole('link', { name: 'Tạo họp định kỳ' })).toBeNull();
  expect(within(nav).getAllByRole('link', { name: 'Phòng họp CLB' })).toHaveLength(1);
  expect(within(nav).getAllByRole('link', { name: 'Họp theo lịch' })).toHaveLength(1);
  const channelRequests = () => fetcher.mock.calls.filter(([url]) => url === '/api/workspace/beta/channels').length;
  expect(channelRequests()).toBe(1);
  fireEvent.click(within(nav).getByRole('link', { name: 'Ban Thảo luận' }));
  await screen.findByRole('heading', { name: 'Ban Thảo luận' });
  expect(channelRequests()).toBe(1);
  fireEvent.click(within(nav).getByRole('link', { name: 'Chung' }));
  await screen.findByRole('heading', { name: 'Chung' });
  expect(channelRequests()).toBe(1);
});

it('keeps the workspace shell mounted while another club loads without exposing the old club tools', async () => {
  const { fetcher } = fixture();
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  await screen.findByRole('heading', { name: 'Chung' });
  await screen.findByRole('link', { name: 'Duyệt nội dung' });
  fireEvent.click(screen.getByRole('button', { name: 'Chế độ tối' }));
  const rail = screen.getByRole('complementary', { name: 'CLB đã tham gia' });
  const shell = rail.closest('.cw-app');
  const main = document.getElementById('workspace-content');
  const respond = fetcher.getMockImplementation()!;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  fetcher.mockImplementation(async (url, options) => {
    if (url === '/api/workspace/alpha') await pending;
    return respond(url, options);
  });
  fireEvent.click(within(rail).getByRole('link', { name: 'Mở CLB Alpha' }));
  await screen.findByText('Đang kiểm tra quyền…');
  expect(screen.getByRole('complementary', { name: 'CLB đã tham gia' })).toBe(rail);
  expect(rail.closest('.cw-app')).toBe(shell);
  expect(document.getElementById('workspace-content')).toBe(main);
  expect(shell?.getAttribute('data-theme')).toBe('dark');
  expect(screen.queryByRole('link', { name: 'Duyệt nội dung' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Nhắn tin trong Chung' })).toBeNull();
  await act(async () => { release(); });
  await screen.findByRole('heading', { name: 'Chung' });
  expect(screen.getByRole('complementary', { name: 'CLB đã tham gia' })).toBe(rail);
  expect(screen.queryByRole('link', { name: 'Duyệt nội dung' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Mở CLB Alpha' }).getAttribute('aria-current')).toBe('page');
});

it('links meeting invites and external URLs without swallowing adjacent message text', async () => {
  const invite = location.origin + '/?view=meeting&meeting=ABCDEFGHIJ&session=buoi-1';
  const website = 'https://example.test/Buoi_(1)?a=one&b=two#note';
  const content = `Mở phòng (${invite}).\nĐọc ${website}!\nftp://example.test/file https://?`;
  fixture([], [{ message_id: 'link', sender_membership_id: 'm2', sender: 'Bình', content, created_at: '2026-11-20T01:00:00Z' }]);
  history.replaceState(null, '', '/workspace/alpha/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);

  const panel = within(await screen.findByLabelText('Lịch sử tin nhắn'));
  const meetingLink = await panel.findByRole('link', { name: invite });
  expect(meetingLink.getAttribute('href')).toBe(invite);
  expect(meetingLink.hasAttribute('target')).toBe(false);
  const external = panel.getByRole('link', { name: website });
  expect(external.getAttribute('href')).toBe(website);
  expect(external.getAttribute('target')).toBe('_blank');
  expect(external.getAttribute('rel')).toBe('noopener noreferrer');
  expect(panel.getAllByRole('link')).toHaveLength(2);
  expect(meetingLink.closest('p')?.textContent).toBe(content);
});

it('pastes a screenshot, retains the draft on retry, and keeps image downloads in the viewer', async () => {
  const { fetcher } = fixture();
  const create = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const dialogPrototype = HTMLDialogElement.prototype;
  const showModal = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(dialogPrototype, 'close');
  Object.defineProperties(URL, {
    createObjectURL: { value: vi.fn(() => 'blob:preview'), configurable: true },
    revokeObjectURL: { value: vi.fn(), configurable: true },
  });
  Object.defineProperties(dialogPrototype, {
    showModal: { value(this: HTMLDialogElement) { this.open = true; }, configurable: true },
    close: { value(this: HTMLDialogElement) { this.open = false; }, configurable: true },
  });
  try {
    history.replaceState(null, '', '/workspace/alpha/channels/general');
    render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
    const attach = await screen.findByRole<HTMLButtonElement>('button', { name: 'Đính kèm ảnh hoặc tệp' });
    await waitFor(() => expect(attach.disabled).toBe(false));
    const input = screen.getByLabelText('Tệp đính kèm');
    const file = new File(['photos'], 'image.png', { type: 'image/png' });
    const document = new File(['pdf'], 'Lịch họp.pdf', { type: 'application/pdf' });
    const extra = new File(['pdf'], 'Ghi chú.pdf', { type: 'application/pdf' });
    const field = screen.getByRole('textbox', { name: 'Nhắn tin trong Chung' });
    expect(fireEvent.paste(field, { clipboardData: { items: [{ kind: 'string', type: 'text/plain' }], files: [] } })).toBe(true);
    expect(fireEvent.paste(field, { clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }], files: [file],
    } })).toBe(false);
    fireEvent.change(input, { target: { files: [document, extra] } });
    const draft = screen.getByRole('list', { name: 'Tệp đính kèm đang soạn' });
    expect(within(draft).getByRole('img', { name: 'Ảnh đang soạn' })).toBeTruthy();
    expect(within(draft).queryByText('anh-da-dan.png')).toBeNull();
    fireEvent.click(within(draft).getByRole('button', { name: 'Bỏ tệp Ghi chú.pdf' }));
    expect(within(draft).queryByText('Ghi chú.pdf')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    await screen.findByRole('alert');
    expect(within(draft).getByRole('img', { name: 'Ảnh đang soạn' })).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Enter' });

    const historyPanel = screen.getByLabelText('Lịch sử tin nhắn');
    const preview = await within(historyPanel).findByRole('img', { name: 'Ảnh đính kèm' });
    expect(preview.getAttribute('src')).toBe('https://storage.example/photo');
    expect(within(historyPanel).queryByText('anh-da-dan.png')).toBeNull();
    expect(within(historyPanel).getByRole('button', { name: 'Tải xuống Lịch họp.pdf' })).toBeTruthy();
    expect(within(historyPanel).queryByRole('button', { name: 'Tải ảnh xuống' })).toBeNull();
    fireEvent.click(within(historyPanel).getByRole('button', { name: 'Xem ảnh lớn' }));
    const viewer = screen.getByRole('dialog', { name: 'Xem ảnh đính kèm' });
    await within(viewer).findByRole('img', { name: 'Ảnh đính kèm' });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(within(viewer).getByRole('button', { name: 'Tải ảnh xuống' }));
    await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));
    expect((anchorClick.mock.contexts[0] as HTMLAnchorElement).href).toBe('https://storage.example/download');
    fireEvent.click(within(viewer).getByRole('button', { name: 'Đóng ảnh' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Tệp đính kèm đang soạn' })).toBeNull();
    const sent = fetcher.mock.calls.filter(([url]) => url.endsWith('/messages/attachments'));
    expect(sent).toHaveLength(2);
    const [first, second] = sent.map(([, opts]) => opts?.body as FormData);
    expect(first.get('content')).toBe('');
    expect(first.getAll('files').map(file => (file as File).name)).toEqual(['anh-da-dan.png', 'Lịch họp.pdf']);
    expect(second.get('client_message_id')).toBe(first.get('client_message_id'));
    expect(sent[0][1]?.headers).not.toHaveProperty('Content-Type');
  } finally {
    cleanup();
    if (create) Object.defineProperty(URL, 'createObjectURL', create);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revoke) Object.defineProperty(URL, 'revokeObjectURL', revoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
    if (showModal) Object.defineProperty(dialogPrototype, 'showModal', showModal);
    else Reflect.deleteProperty(dialogPrototype, 'showModal');
    if (close) Object.defineProperty(dialogPrototype, 'close', close);
    else Reflect.deleteProperty(dialogPrototype, 'close');
  }
});

it('keeps failed message text and reuses its retry key, then renders the saved message', async () => {
  const { postBodies } = fixture();
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const field = await screen.findByRole('textbox', { name: 'Nhắn tin trong Chung' });
  await waitFor(() => expect((field as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(field, { target: { value: 'Xin chào CLB' } });
  fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
  expect(postBodies).toHaveLength(0);
  fireEvent.keyDown(field, { key: 'Enter' });
  await screen.findByRole('alert');
  expect((field as HTMLTextAreaElement).value).toBe('Xin chào CLB');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await screen.findByText('Xin chào CLB');
  expect(postBodies).toHaveLength(2);
  expect(postBodies[0].client_message_id).toBe(postBodies[1].client_message_id);
  expect((field as HTMLTextAreaElement).value).toBe('');
});

it('merges message updates and tombstones without duplicates', () => {
  const old = { message_id: 'a', content: 'old', created_at: '2026-11-19T00:00:00Z' } as ChannelMessage;
  const incoming = { ...old, content: '', deleted_at: '2026-11-19T00:01:00Z' };
  expect(mergeChannelMessages([old], [incoming])).toEqual([incoming]);
});

it('shows a pending message immediately and replaces it once the server confirms it', async () => {
  const { fetcher } = fixture();
  const read = fetcher.getMockImplementation()!;
  let finish!: (value: any) => void;
  fetcher.mockImplementation((url, options) => {
    if (options?.method === 'POST' && url.endsWith('/messages')) {
      return new Promise(resolve => { finish = resolve; });
    }
    return read(url, options);
  });
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const field = await screen.findByRole('textbox', { name: 'Nhắn tin trong Chung' });
  await waitFor(() => expect((field as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(field, { target: { value: 'Tin nhắn chờ xác nhận' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  expect(screen.getByRole('article', { name: 'Tin nhắn đang gửi' })).toBeTruthy();
  expect(within(screen.getByRole('article', { name: 'Tin nhắn đang gửi' })).getByText('Tin nhắn chờ xác nhận')).toBeTruthy();
  await act(async () => finish({ ok: true, json: async () => ({ item: {
    message_id: 'confirmed', sender_membership_id: 'm', sender: 'An', mine: true,
    content: 'Tin nhắn chờ xác nhận', created_at: '2026-11-20T01:00:00Z',
  } }) }));
  await waitFor(() => expect(screen.queryByRole('article', { name: 'Tin nhắn đang gửi' })).toBeNull());
  expect(screen.getAllByText('Tin nhắn chờ xác nhận')).toHaveLength(1);
  expect((field as HTMLTextAreaElement).value).toBe('');
});

it('receives pushed messages immediately and retains the draft while disconnected', async () => {
  fixture();
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const field = await screen.findByRole('textbox', { name: 'Nhắn tin trong Chung' });
  await waitFor(() => expect((field as HTMLTextAreaElement).disabled).toBe(false));
  await act(async () => channelSockets.at(-1).receive('channel:message', {
    message_id: 'pushed', channel_id: 'real-general', sender_membership_id: 'other', sender: 'Bình',
    content: 'Nhận ngay qua socket', created_at: '2026-11-20T01:00:00Z', mine: false,
  }));
  expect(screen.getByText('Nhận ngay qua socket')).toBeTruthy();
  fireEvent.change(field, { target: { value: 'Bản nháp đang viết' } });
  await act(async () => channelSockets.at(-1).disconnect());
  expect((field as HTMLTextAreaElement).value).toBe('Bản nháp đang viết');
  expect((field as HTMLTextAreaElement).disabled).toBe(true);
});

it('shows a message saved by another client even when its socket event is lost', async () => {
  const messages: ChannelMessage[] = [];
  fixture([], messages);
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const field = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Nhắn tin trong Chung' });
  await waitFor(() => expect(field.disabled).toBe(false));
  const socket = channelSockets.at(-1);
  expect(socket?.connected).toBe(true);
  const item: ChannelMessage = {
    message_id: 'missed-push', channel_id: 'real-general', sender_membership_id: 'other',
    sender: 'Binh', content: 'Tin mới từ máy khác', created_at: '2026-11-20T01:00:00Z', mine: false,
    avatar_url: null, edited_at: null, deleted_at: null,
  };
  messages.push(item);
  expect(screen.queryByText(item.content)).toBeNull();
  expect(await screen.findByText(item.content, {}, { timeout: 4200 })).toBeTruthy();
  await act(async () => socket.receive('channel:message', item));
  expect(screen.getAllByText(item.content)).toHaveLength(1);
});

it('walks missed history pages after reconnect and clears messages when channel access is revoked', async () => {
  const old = { message_id: 'old', channel_id: 'real-general', sender_membership_id: 'other', sender: 'Bình', content: 'Tin cũ', created_at: '2026-11-20T01:00:00Z' };
  const { fetcher } = fixture([], [old]);
  const read = fetcher.getMockImplementation()!;
  let reconnecting = false;
  const cursor = { before: '2026-11-20T01:02:00Z', before_id: 'cursor' };
  fetcher.mockImplementation(async (url, options) => {
    if (reconnecting && url.endsWith('/messages')) return { ok: true, json: async () => ({
      items: [{ ...old, message_id: 'newest', content: 'Tin mới nhất', created_at: '2026-11-20T01:03:00Z' }], hasMore: true, cursor,
    }) };
    if (url.includes('/messages?')) return { ok: true, json: async () => ({
      items: [old, { ...old, message_id: 'missed', content: 'Tin ở trang bị bỏ lỡ', created_at: '2026-11-20T01:01:00Z' }], hasMore: false, cursor: null,
    }) };
    return read(url, options);
  });
  history.replaceState(null, '', '/workspace/beta/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  await screen.findByText('Tin cũ');
  const socket = channelSockets.at(-1);
  await act(async () => socket.disconnect());
  reconnecting = true;
  await act(async () => socket.connect());
  await screen.findByText('Tin ở trang bị bỏ lỡ');
  expect(screen.getByText('Tin mới nhất')).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url.includes('before_id=cursor'))).toBe(true);
  await act(async () => socket.receive('channel:revoked', { message: 'Không còn quyền truy cập' }));
  expect(screen.queryByText('Tin cũ')).toBeNull();
  expect(screen.queryByText('Tin mới nhất')).toBeNull();
});

it('binds scheduled meetings to the club and retries a failed schedule without recreating the room', async () => {
  const { fetcher } = fixture();
  const read = fetcher.getMockImplementation()!;
  let rooms = 0, schedules = 0;
  fetcher.mockImplementation(async (url, options) => {
    if (url === '/api/meetings' && options?.method === 'POST') {
      rooms++;
      expect(JSON.parse(String(options.body)).clubId).toBe('beta');
      return { ok: true, json: async () => ({ meeting_id: 'room', meeting_code: 'CODE' }) };
    }
    if (url === '/api/meetings/room/sessions' && options?.method === 'POST') {
      schedules++;
      if (schedules === 1) throw new TypeError('Network unavailable');
      return { ok: true, json: async () => ({ sessions: [] }) };
    }
    return read(url, options);
  });
  history.replaceState(null, '', '/workspace/beta/recurring-meetings');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={vi.fn()} />);
  const title = await screen.findByRole('textbox', { name: 'Tên cuộc họp' });
  fireEvent.change(title, { target: { value: 'Họp CLB' } });
  fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: new Date(Date.now() + 172800000).toISOString().slice(0, 16) } });
  fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: new Date(Date.now() + 176400000).toISOString().slice(0, 16) } });
  fireEvent.change(screen.getByLabelText('Lặp lại'), { target: { value: 'WEEKLY' } });
  fireEvent.submit(title.closest('form')!);
  await screen.findByText(/Phòng CODE đã tồn tại/);
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và lưu lại lịch' }));
  await screen.findByText(/Đã tạo lịch họp CODE/);
  expect(rooms).toBe(1);
  expect(schedules).toBe(2);
});

it('switches and restores the workspace theme while the information panel is collapsed', async () => {
  fixture();
  history.replaceState(null, '', '/workspace/alpha/channels/general');
  const view = <GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />;
  const first = render(view);
  await screen.findByRole('heading', { name: 'Chung' });
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thông tin CLB' }));

  const toggle = screen.getByRole('button', { name: 'Chế độ tối' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(toggle.closest('.cw-app')?.getAttribute('data-theme')).toBe('dark');

  first.unmount();
  render(view);
  const restored = await screen.findByRole('button', { name: 'Chế độ tối' });
  expect(restored.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(restored);
  expect(restored.closest('.cw-app')?.getAttribute('data-theme')).toBe('light');
});

it.each(['/workspace/alpha/meetings', '/workspace/alpha/recurring-meetings'])('opens a pasted invite on %s using the existing meeting view', async path => {
  const { fetcher } = fixture();
  history.replaceState(null, '', path);
  const onMeeting = vi.fn();
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={onMeeting} />);
  const input = await screen.findByRole('textbox', { name: 'Mã hoặc đường dẫn mời' });
  fireEvent.change(input, { target: { value: ' https://other.example/?view=meeting&meeting=abcd123456&session=invited-session ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mở cuộc họp' }));
  expect(onMeeting).toHaveBeenCalledOnce();
  expect(location.origin).not.toContain('other.example');
  expect(new URLSearchParams(location.search).get('meeting')).toBe('ABCD123456');
  expect(new URLSearchParams(location.search).get('session')).toBe('invited-session');
  expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

it('rejects invalid meeting links and clears a previous session when opening a code', async () => {
  fixture();
  history.replaceState(null, '', '/workspace/alpha/meetings?session=old-session');
  const onMeeting = vi.fn();
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={onMeeting} />);
  const input = await screen.findByRole('textbox', { name: 'Mã hoặc đường dẫn mời' });
  fireEvent.change(input, { target: { value: 'https://example.com/no-meeting' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mở cuộc họp' }));
  expect(screen.getByRole('alert').textContent).toContain('10 chữ/số');
  expect(onMeeting).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'abcd123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mở cuộc họp' }));
  expect(onMeeting).toHaveBeenCalledOnce();
  expect(new URLSearchParams(location.search).get('meeting')).toBe('ABCD123456');
  expect(new URLSearchParams(location.search).has('session')).toBe(false);
});

it('copies the exact workspace session and keeps direct room navigation', async () => {
  fixture([{
    meeting_id: 'meeting', meeting_code: 'ABCDEFGHIJ', title: 'Họp CLB',
    meeting_sessions: [{ session_id: 'session-one', status: 'ongoing' }, { session_id: 'session-two', status: 'scheduled' }],
  }]);
  history.replaceState(null, '', '/workspace/alpha/meetings');
  const onMeeting = vi.fn();
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  try {
    render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={onMeeting} />);
    const buttons = await screen.findAllByRole('button', { name: 'Sao chép link buổi' });
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(location.origin + '/?view=meeting&meeting=ABCDEFGHIJ&session=session-two'));
    expect(onMeeting).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mở buổi họp' })[1]);
    expect(onMeeting).toHaveBeenCalledOnce();
    expect(new URLSearchParams(location.search).get('session')).toBe('session-two');
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('inserts emoji at the selection and sends a standalone emoji through the chat API', async () => {
  const { postBodies } = fixture();
  history.replaceState(null, '', '/workspace/alpha/channels/general');
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const field = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Nhắn tin trong Chung' });
  await waitFor(() => expect(field.disabled).toBe(false));
  const picker = screen.getByRole('button', { name: 'Chọn emoji' });

  fireEvent.change(field, { target: { value: 'Chào nhóm' } });
  field.setSelectionRange(5, 5);
  fireEvent.click(picker);
  fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }));
  expect(field.value).toBe('Chào 👍nhóm');
  expect(picker.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(field);
  expect(postBodies).toHaveLength(0);

  fireEvent.change(field, { target: { value: '' } });
  fireEvent.click(picker);
  fireEvent.click(screen.getByRole('button', { name: 'Chúc mừng' }));
  fireEvent.keyDown(field, { key: 'Enter' });
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await within(screen.getByLabelText('Lịch sử tin nhắn')).findByText('🎉');
  expect(postBodies).toHaveLength(2);
  expect(postBodies[0].content).toBe('🎉');
  expect(postBodies[1]).toEqual(postBodies[0]);
});
