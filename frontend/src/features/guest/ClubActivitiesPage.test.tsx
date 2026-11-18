// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from './GuestLanding';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps frequently used channels visible and lets a chairperson draft a channel', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '/workspace/beta/channels/general');
  const request = vi.fn(async (url: string, _options?: RequestInit) => ({ ok: true, json: async () =>
    url.startsWith('/api/workspace/') && !url.includes('/content/')
      ? { club: { club_id: 'beta', name: 'CLB Beta', summary: 'Cộng đồng học tập', mission: 'Mục tiêu riêng', contact_email: 'club@test.dev' }, membership: { membership_id: 'mb', user_id: 'student', role: 'chairperson' } }
      : url.includes('/content/activities') ? { items: [{ activity_id: 'event', title: 'Ngày hội CLB', starts_at: '2099-06-12T09:00:00Z' }], hasMore: false }
      : { items: [], hasMore: false },
  }));
  vi.stubGlobal('fetch', request);
  const onMeeting = vi.fn();
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={onMeeting} />);
  await screen.findByRole('heading', { name: 'thảo-luận' });
  const rail = screen.getByLabelText('CLB đã tham gia');
  expect(rail.firstElementChild).toBe(within(rail).getByRole('link', { name: 'Trang chủ' }));
  expect(rail.lastElementChild).toBe(within(rail).getByLabelText('Mở menu tài khoản của An').parentElement);
  fireEvent.click(within(rail).getByLabelText('Mở menu tài khoản của An'));
  expect(within(rail).getByRole('link', { name: 'Tài khoản' })).toBeTruthy();
  expect(within(rail).getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  expect(screen.getByLabelText('Xem nhanh CLB')).toBeTruthy();
  const quickPanel = screen.getByLabelText('Xem nhanh CLB');
  expect(within(quickPanel).getByText('Cộng đồng học tập')).toBeTruthy();
  expect(await within(quickPanel).findByText('Ngày hội CLB')).toBeTruthy();
  quickPanel.querySelectorAll('section').forEach(section => {
    expect(within(section as HTMLElement).queryByRole('link')).toBeNull();
    expect(within(section as HTMLElement).queryByRole('button')).toBeNull();
  });
  expect(within(quickPanel).queryByText('Mục tiêu riêng')).toBeNull();
  expect(within(quickPanel).queryByText('club@test.dev')).toBeNull();
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng CLB' });
  const channelArea = within(navigation).getByRole('group', { name: 'Danh sách kênh' });
  expect(within(channelArea).getByRole('link', { name: '# thảo-luận' })).toBeTruthy();
  expect(navigation.lastElementChild).toBe(within(navigation).getByText('Công việc CLB').closest('details'));
  expect(within(navigation).queryByText('Khác')).toBeNull();
  fireEvent.click(within(quickPanel).getByText('Khác'));
  expect(within(quickPanel).getByRole('link', { name: 'Thành viên' })).toBeTruthy();
  expect(within(quickPanel).getByRole('link', { name: 'Cơ cấu CLB' })).toBeTruthy();
  expect(within(navigation).getByRole('link', { name: 'Phòng chung' })).toBeTruthy();
  expect(within(navigation).getByRole('link', { name: 'Họp nhóm' })).toBeTruthy();
  fireEvent.click(within(navigation).getByRole('button', { name: 'Tạo kênh văn bản' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên kênh' }), { target: { value: 'ý-tưởng' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
  await screen.findByRole('heading', { name: 'ý-tưởng' });
  expect(screen.getByText(/Kênh chưa được tạo trên hệ thống/)).toBeTruthy();
  expect(within(navigation).getByRole('link', { name: '# ý-tưởng' })).toBeTruthy();
  fireEvent.click(within(navigation).getByRole('link', { name: 'Phòng chung' }));
  await screen.findByRole('heading', { name: 'Phòng chung' });
  fireEvent.click(screen.getByRole('button', { name: 'Mở công cụ gọi nhanh ↗' }));
  expect(onMeeting).toHaveBeenCalledTimes(1);
  expect(request.mock.calls.every(([, options]) => !options || options.method !== 'POST')).toBe(true);
});

it('opens joined clubs from the student header and shows chairperson tools only in that club', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const clubs = [
    { membership_id: 'ma', club: { club_id: 'alpha', name: 'CLB Alpha' }, role: 'member' },
    { membership_id: 'mb', club: { club_id: 'beta', name: 'CLB Beta' }, role: 'chairperson' },
  ];
  const request = vi.fn(async (url: string, _options?: RequestInit) => ({ ok: true, json: async () =>
    url.startsWith('/api/me/clubs') ? { items: clubs, total: 2, hasMore: false }
      : url.startsWith('/api/workspace/') && !url.includes('/content/') ? { club: { club_id: url.split('/')[3], name: url.includes('beta') ? 'CLB Beta' : 'CLB Alpha', summary: '' }, membership: { membership_id: url.includes('beta') ? 'mb' : 'ma', user_id: 'student', role: url.includes('beta') ? 'chairperson' : 'member' } }
        : { items: [], hasMore: false },
  }));
  vi.stubGlobal('fetch', request);
  const onMeeting = vi.fn();
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" onMeeting={onMeeting} />);
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng công khai' });
  expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual([
    'Câu lạc bộ', 'Hoạt động', 'Bài viết', 'Không gian sinh hoạt',
  ]);
  fireEvent.click(within(navigation).getByRole('link', { name: 'Không gian sinh hoạt' }));
  await screen.findByRole('heading', { name: 'thảo-luận' });
  expect(screen.getByRole('link', { name: 'Mở CLB Alpha' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Viết bài' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Duyệt nội dung' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Mở CLB Beta' }));
  await screen.findByRole('heading', { name: 'thảo-luận' });
  expect(screen.getByRole('link', { name: 'Mở CLB Beta' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Duyệt nội dung' })).toBeTruthy();
  expect(request).toHaveBeenCalledWith('/api/workspace/beta', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer session' }) }));
  fireEvent.click(screen.getByRole('link', { name: '# thảo-luận' }));
  expect(await screen.findByRole('heading', { name: 'thảo-luận' })).toBeTruthy();
  expect((screen.getByRole('textbox', { name: 'Nhắn tin trong thảo-luận' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Điều hướng CLB' })).getByRole('link', { name: 'Tạo họp định kỳ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở công cụ tạo họp định kỳ ↗' }));
  expect(onMeeting).toHaveBeenCalledTimes(1);
  expect(request.mock.calls.every(([, options]) => !options || options.method !== 'POST')).toBe(true);
});

it('shows the club shell immediately when the student has not joined a club', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '/workspace');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: [], total: 0, hasMore: false }) })));
  render(<GuestLanding viewer={{ displayName: 'An' }} accessToken="session" />);
  expect(screen.getByLabelText('CLB đã tham gia')).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Điều hướng CLB' })).toBeTruthy();
  await screen.findByText('Bạn chưa tham gia CLB nào.');
  expect(screen.getByRole('link', { name: 'Tạo CLB mới' })).toBeTruthy();
});
