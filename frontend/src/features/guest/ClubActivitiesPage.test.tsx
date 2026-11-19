// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    { membership_id: 'm-alpha', club: { club_id: 'alpha', name: 'CLB Alpha' }, role: 'member' },
    { membership_id: 'm-beta', club: { club_id: 'beta', name: 'CLB Beta' }, role: 'chairperson' },
  ];
  const request = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      const context = clubs.find(({ club }) => url === '/api/workspace/' + club.club_id);
      if (context) return { club: context.club, membership: context };
      return { items: url.startsWith('/api/me/clubs?') ? clubs : [], hasMore: false };
    },
  }));
  vi.stubGlobal('fetch', request);
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng công khai' });
  expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual([
    'Câu lạc bộ', 'Hoạt động', 'Bài viết', 'Không gian sinh hoạt',
  ]);
  fireEvent.click(screen.getByLabelText('Menu tài khoản của An'));
  fireEvent.click(screen.getByRole('link', { name: 'CLB của tôi' }));
  fireEvent.click(await screen.findByRole('link', { name: /CLB Alpha/ }));
  fireEvent.click(await screen.findByRole('link', { name: 'Hoạt động' }));
  expect((await screen.findByRole('link', { name: /Tạo hoạt động/ })).getAttribute('href')).toBe('/workspace/alpha/activities/new');
  expect(screen.queryByRole('link', { name: 'Duyệt nội dung' })).toBeNull();

  fireEvent.click(await screen.findByRole('link', { name: 'Mở CLB Beta' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Duyệt nội dung' }));
  fireEvent.click(await screen.findByRole('link', { name: /Xem hoạt động chờ duyệt/ }));
  await waitFor(() => expect(request).toHaveBeenCalledWith(
    '/api/workspace/beta/content/activities?list=review&page=1&limit=12',
    expect.objectContaining({ headers: { Authorization: 'Bearer session' } }),
  ));
});
