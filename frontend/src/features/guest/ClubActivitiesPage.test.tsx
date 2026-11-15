// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from './GuestLanding';

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('opens the correct club from the signed-in navigation and only shows review for that club’s chairperson', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const clubs = [
    { club_id: 'alpha', name: 'CLB Alpha', role: 'member' },
    { club_id: 'beta', name: 'CLB Beta', role: 'chairperson' },
  ];
  const request = vi.fn(async (url: string) => ({
    ok: true, json: async () => ({ items: url === '/api/my-clubs' ? clubs : [], hasMore: false }),
  }));
  vi.stubGlobal('fetch', request);
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng công khai' });
  expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual([
    'Câu lạc bộ', 'CLB của tôi', 'Hoạt động', 'Bài viết',
  ]);

  function open(link: HTMLElement) {
    act(() => {
      history.replaceState(null, '', link.getAttribute('href'));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }
  open(within(navigation).getByRole('link', { name: 'CLB của tôi' }));
  open(await screen.findByRole('link', { name: 'CLB Alpha' }));
  expect(screen.getByRole('heading', { name: 'CLB Alpha' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tạo hoạt động' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xét duyệt' })).toBeNull();

  open(screen.getByRole('link', { name: '← CLB của tôi' }));
  open(await screen.findByRole('link', { name: 'CLB Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xét duyệt' }));
  await screen.findByText('Chưa có hoạt động trong mục này.');
  expect(request).toHaveBeenCalledWith('/api/my-clubs/beta/activities?list=pending_review&page=1',
    expect.objectContaining({ headers: { Authorization: 'Bearer session' } }));
});
