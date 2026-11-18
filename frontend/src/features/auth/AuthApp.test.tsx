// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthApp } from './AuthApp';

vi.mock('../meeting/MeetingPage', () => ({
  MeetingPage: ({ accessToken, displayName, onLogout, onBack }: { accessToken: string; displayName: string; onLogout: () => void; onBack: () => void }) =>
    <div><span>{displayName}</span><span data-testid="token">{accessToken}</span><button onClick={onBack}>Trang chủ</button><button onClick={onLogout}>Đăng xuất</button></div>,
}));
vi.mock('../guest/GuestLanding', () => ({
  GuestLanding: ({ viewer, onMeeting, onLogout }: { viewer: { displayName: string }; onMeeting: () => void; onLogout: () => void }) =>
    <div><span>Trang chủ {viewer.displayName}</span><button onClick={onMeeting}>Mở cuộc họp</button><button onClick={onLogout}>Đăng xuất</button></div>,
}));
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
const completedProfile = { full_name: 'Test User', student_code: 'SV001', school_or_faculty: 'CNTT', major: 'IT', cohort: '2026' };

it('restores and persists the shared theme preference on the login screen', () => {
  localStorage.setItem('rts.meeting-theme.v1', 'dark');
  const first = render(<AuthApp />);
  expect(screen.getByRole('button', { name: 'Giao diện tối' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Giao diện sáng' }));
  expect(localStorage.getItem('rts.meeting-theme.v1')).toBe('light');
  first.unmount(); render(<AuthApp />);
  expect(screen.getByRole('button', { name: 'Giao diện sáng' }).getAttribute('aria-pressed')).toBe('true');
});

it('shows registration when the visitor explicitly opens the register link with an older session', () => {
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  sessionStorage.setItem('rts.auth-session.v1', JSON.stringify({ access_token: token, user: { userId: 'old', email: 'old@test.dev', displayName: 'Old' } }));
  window.history.replaceState(null, '', '/?mode=register');
  try {
    render(<AuthApp />);
    expect(screen.getByLabelText('Tên hiển thị')).toBeTruthy();
    expect(screen.queryByText('Old')).toBeNull();
  } finally { window.history.replaceState(null, '', '/'); }
});

it('shows student profile after a successful new registration', async () => {
  window.history.replaceState(null, '', '/?mode=register');
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url.includes('/profile')
    ? { full_name: null, student_code: null, school_or_faculty: null, major: null, cohort: null }
    : { access_token: 'new-jwt', user: { userId: 'new', email: 'new@test.dev', displayName: 'New User', avatarUrl: null } } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'New User' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await screen.findByRole('heading', { name: /Một chút về bạn/ });
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
  expect(window.location.search).toBe('');
  expect(await screen.findByLabelText('Mã sinh viên')).toBeTruthy();
  expect(screen.queryByTestId('token')).toBeNull();
});

it('keeps an incomplete account on the profile form until save succeeds', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => Promise.resolve({ ok: true, json: async () =>
    url.includes('/profile') ? options?.method === 'PATCH' ? { ...JSON.parse(String(options.body)) } : {} :
      { access_token: 'student-jwt', user: { userId: 'student', email: 's@test.dev', displayName: 'Student', avatarUrl: null } } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 's@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await screen.findByRole('heading', { name: /Một chút về bạn/ });
  await screen.findByLabelText('Họ và tên');
  expect(screen.queryByTestId('token')).toBeNull();
  for (const [label, value] of [['Họ và tên', 'Sinh Vien'], ['Mã sinh viên', 'SV01'], ['Trường / khoa', 'CNTT'], ['Ngành học', 'IT'], ['Khóa', '2026']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await screen.findByText('Trang chủ Student');
  expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/users/me/profile' && options.method === 'PATCH')).toBe(true);
});

it('restores login after remount and removes the saved session on logout', async () => {
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url.includes('/profile')
    ? completedProfile : { access_token: token, user: { userId: 'u1', email: 'a@test.dev', displayName: 'Restored', avatarUrl: null } } }));
  vi.stubGlobal('fetch', fetchMock);
  const first = render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await screen.findByText('Trang chủ Restored');
  first.unmount();
  const second = render(<AuthApp />);
  await screen.findByText('Trang chủ Restored');
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login')).toHaveLength(1);
  fireEvent.click(screen.getByText('Đăng xuất'));
  second.unmount();
  render(<AuthApp />);
  expect(screen.queryByText('Trang chủ Restored')).toBeNull();
});

it.each(['{bad json', JSON.stringify({ access_token: 'broken', user: {} }), JSON.stringify({
  access_token: `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`,
  user: { userId: 'u', email: 'e', displayName: 'Expired' },
})])('discards malformed or expired saved sessions', value => {
  sessionStorage.setItem('rts.auth-session.v1', value);
  render(<AuthApp />);
  expect(screen.getByLabelText('Email')).toBeTruthy();
  expect(sessionStorage.getItem('rts.auth-session.v1')).toBeNull();
});

it('logs in with the API contract and clears the in-memory session on logout', async () => {
  window.history.replaceState(null, '', '/?mode=login');
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url.includes('/profile')
    ? completedProfile : { access_token: 'app-jwt', user: { userId: 'u1', email: 'a@test.dev', displayName: 'Tester', avatarUrl: null } } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await waitFor(() => expect(screen.getByText('Trang chủ Tester')).toBeTruthy());
  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@test.dev', password: 'password123' });
  expect(screen.queryByTestId('token')).toBeNull();
  fireEvent.click(screen.getByText('Mở cuộc họp'));
  expect(screen.getByTestId('token').textContent).toBe('app-jwt');
  expect(window.location.search).toContain('view=meeting');
  fireEvent.click(screen.getByRole('button', { name: 'Trang chủ' }));
  expect(screen.getByText('Trang chủ Tester')).toBeTruthy();
  expect(window.location.search).not.toContain('view=meeting');
  fireEvent.click(screen.getByText('Mở cuộc họp'));
  window.history.back();
  await waitFor(() => expect(window.location.search).not.toContain('view=meeting'));
  expect(await screen.findByText('Trang chủ Tester')).toBeTruthy();
  fireEvent.click(screen.getByText('Đăng xuất'));
  expect(screen.queryByText('Tester')).toBeNull();
  expect(screen.getByLabelText('Mật khẩu')).toBeTruthy();
});

it('aborts authentication on unmount and ignores late success', async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
  vi.stubGlobal('fetch', fetchMock);
  const { unmount } = render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({ access_token: 'jwt', user: { userId: 'u', email: 'e', displayName: 'Late' } }) }));
  expect(screen.queryByText('Late')).toBeNull();
});

it('validates registration inline without sending invalid data and toggles password visibility', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Tên hiển thị').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(screen.getByLabelText('Tên hiển thị'));
  expect(screen.getByText('Nhập địa chỉ email hợp lệ.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(screen.getByLabelText('Mật khẩu').getAttribute('type')).toBe('text');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(screen.getByLabelText('Mật khẩu').getAttribute('type')).toBe('password');
  expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('');
});

it('sends registration fields, prevents double submit, and keeps a useful server error', async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: ' Tester ' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  const form = screen.getByLabelText('Email').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@test.dev', password: 'password123', displayName: 'Tester' });
  expect((screen.getByRole('button', { name: 'Đang xử lý…' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ ok: false, status: 409 }));
  expect(screen.getByRole('alert').textContent).toBe('Email đã được sử dụng.');
  expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(false);
});
