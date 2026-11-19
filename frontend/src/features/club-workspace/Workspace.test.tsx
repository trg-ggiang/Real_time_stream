// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from '../guest/GuestLanding';
import { mergeChannelMessages } from './pages/WorkspaceChat';
import type { ChannelMessage } from './services/workspace-api';

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.removeItem('unicircle.workspace-theme'); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture() {
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
    if (url.startsWith('/api/me/clubs')) data = { items: [
      { membership_id: 'ma', club: { club_id: 'alpha', name: 'CLB Alpha' }, role: 'member' },
      { membership_id: 'mb', club: { club_id: 'beta', name: 'CLB Beta' }, role: 'chairperson' },
    ] };
    else if (url.endsWith('/messages')) data = { items: [], hasMore: false, cursor: null };
    else if (url.endsWith('/channels')) data = { items: [{ channel_id: 'real-general', name: 'Chung', kind: 'general', description: 'Kênh thật' }] };
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
  fireEvent.click(within(nav).getByRole('link', { name: 'Tạo họp định kỳ' }));
  await screen.findByRole('heading', { name: 'Họp theo lịch' });
  expect(screen.getByLabelText('Lặp lại')).toBeTruthy();
  expect(fetcher.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
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
