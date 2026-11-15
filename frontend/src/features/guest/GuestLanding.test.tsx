// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from './GuestLanding';
import { safePublicUrl } from './public-content';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows the signed-in student landing and opens meetings only on request', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], hasMore: false }) }));
  const onMeeting = vi.fn();
  render(<GuestLanding viewer={{ displayName: 'An' }} onMeeting={onMeeting} onLogout={vi.fn()} />);
  expect(screen.getByText('Sinh viên · An')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Đăng nhập' })).toBeNull();
  expect(onMeeting).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cuộc họp' }));
  expect(onMeeting).toHaveBeenCalledTimes(1);
});
it('loads real public endpoints and shows honest empty states', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], hasMore: false }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<GuestLanding />);
  await screen.findByText(/Chưa có câu lạc bộ được công khai/);
  expect(screen.getByText(/Chưa có hoạt động công khai/)).toBeTruthy();
  expect(screen.getByText(/Chưa có bài viết công khai/)).toBeTruthy();
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/public/clubs?page=1&limit=12', '/api/public/activities?page=1&limit=12', '/api/public/posts?page=1&limit=12']);
  expect(screen.queryByText('CLB Âm nhạc')).toBeNull();
});
it('retries public request failures and never turns failures into demo data', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, json: async () => ({ items: [], hasMore: false }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<GuestLanding />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText(/Chưa có câu lạc bộ được công khai/);
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('rejects executable image URL schemes', () => {
  expect(safePublicUrl('javascript:alert(1)')).toBeUndefined();
  expect(safePublicUrl('data:text/html,content')).toBeUndefined();
  expect(safePublicUrl('https://example.com/club.jpg')).toBe('https://example.com/club.jpg');
});

it('links public HTTP URLs without executing HTML or script schemes', async () => {
  const proto = HTMLDialogElement.prototype;
  const originalShow = Object.getOwnPropertyDescriptor(proto, 'showModal');
  const originalClose = Object.getOwnPropertyDescriptor(proto, 'close');
  Object.defineProperty(proto, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(proto, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({
    items: url.includes('/clubs?') ? [{ club_id: 'one', name: 'Test club',
      description: 'Source: https://example.com/club?q=1&lang=vi. javascript:alert(1) <img src=x onerror=alert(1)>' }] : [], hasMore: false,
  }) })));
  try {
    render(<GuestLanding />);
    fireEvent.click(await screen.findByRole('button', { name: 'Test club' }));
    const link = screen.getByRole('link', { name: 'https://example.com/club?q=1&lang=vi' });
    expect(link.getAttribute('href')).toBe('https://example.com/club?q=1&lang=vi');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  } finally {
    cleanup();
    if (originalShow) Object.defineProperty(proto, 'showModal', originalShow); else Reflect.deleteProperty(proto, 'showModal');
    if (originalClose) Object.defineProperty(proto, 'close', originalClose); else Reflect.deleteProperty(proto, 'close');
  }
});
