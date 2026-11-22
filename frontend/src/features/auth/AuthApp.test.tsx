// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthApp } from './AuthApp';
import { App } from '../../App';

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

it('keeps each independent signed-in session when opening the meeting link in its own tab', async () => {
  const invite = '/?view=meeting&meeting=ABCDEF1234&session=invited-session';
  // Exercise each browser's login separately. Retain its tab storage across navigation.
  for (const id of ['first', 'second']) {
    sessionStorage.clear();
    localStorage.clear();
    history.replaceState(null, '', '/?mode=login');
    const user = { userId: id, email: `${id}@test.dev`, displayName: id, role: 'student' };
    const token = `header.${btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    const fetcher = vi.fn(async (url: string) => ({
      ok: true, json: async () => url.endsWith('/profile') ? completedProfile
        : url.endsWith('/auth/me') ? user : { access_token: token, user },
    }));
    vi.stubGlobal('fetch', fetcher);
    const login = render(<App />);
    const email = await screen.findByLabelText('Email');
    fireEvent.change(email, { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.submit(email.closest('form')!);
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('rts.auth-session.v1') ?? 'null')?.access_token).toBe(token));
    login.unmount();

    history.replaceState(null, '', invite);
    const meeting = render(<App />);
    expect((await screen.findByTestId('token')).textContent).toBe(token);
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(location.pathname + location.search).toBe(invite);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
    meeting.unmount();
  }
});

it.each([
  ['/me/clubs?mode=login&returnTo=%2Fadmin', 'user', 'admin', '/admin'],
  ['/me/clubs?mode=login&returnTo=%2Fadmin', 'admin', 'user', '/'],
  ['/me/clubs?mode=login&returnTo=https://evil.com', 'admin', null, '/me/clubs'],
  ['/?mode=login&returnTo=%2F', 'admin', null, '/admin'],
  ['/?mode=login&returnTo=%2F', 'user', 'user', '/'],
] as const)('resolves the destination for %s after the account check', async (url, loginRole, checkedRole, expected) => {
  window.history.replaceState(null, '', url);
  const user = { userId: 'u1', email: 'user@test.dev', displayName: 'Route User', role: loginRole };
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.endsWith('/auth/me')) {
      if (checkedRole === null) throw new Error('Account check unavailable');
      return { ok: true, json: async () => ({ ...user, role: checkedRole }) };
    }
    return { ok: true, json: async () => path.endsWith('/profile')
      ? completedProfile : { access_token: 'test-jwt', user } };
  }));
  render(<AuthApp />);
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(email.closest('form')!);
  await waitFor(() => expect(`${location.pathname}${location.search}${location.hash}`).toBe(expected));
});

it.each([
  ['/workspace/club/channels/general', 'student', 'admin', '/admin'],
  ['/me/clubs?page=2#list', 'student', 'admin', '/admin'],
  ['/admin/clubs', 'admin', 'student', '/'],
] as const)('clears the previous account URL on logout from %s before switching accounts', async (path, oldRole, nextRole, expected) => {
  history.replaceState(null, '', path);
  const oldUser = { userId: 'old', email: 'old@test.dev', displayName: 'Old User', role: oldRole };
  const nextUser = { userId: 'next', email: 'next@test.dev', displayName: 'Next User', role: nextRole };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/profile')) return { ok: true, json: async () => completedProfile };
    if (url.endsWith('/auth/me')) {
      const user = (options?.headers as Record<string, string>)?.Authorization?.includes('next-token') ? nextUser : oldUser;
      return { ok: true, json: async () => user };
    }
    const user = JSON.parse(String(options?.body)).email === nextUser.email ? nextUser : oldUser;
    return { ok: true, json: async () => ({ access_token: user === nextUser ? 'next-token' : 'old-token', user }) };
  }));
  const first = render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: oldUser.email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await screen.findByText('Trang chủ Old User');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
  expect(location.pathname + location.search + location.hash).toBe('/?mode=login');
  expect(sessionStorage.getItem('rts.auth-session.v1')).toBeNull();
  first.unmount();
  // A refresh must still open the login form, including at the App entry point.
  render(<App />);
  const email = await screen.findByLabelText('Email');
  fireEvent.change(email, { target: { value: nextUser.email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(email.closest('form')!);
  await screen.findByText('Trang chủ Next User');
  expect(location.pathname + location.search + location.hash).toBe(expected);
});

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
  await screen.findByLabelText('Mã sinh viên');
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
  expect(window.location.search).toBe('');
  expect(screen.getByLabelText('Mã sinh viên')).toBeTruthy();
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
  await screen.findByLabelText('Mã sinh viên');
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
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => url.includes('/profile')
    ? completedProfile : { access_token: 'app-jwt', user: { userId: 'u1', email: 'a@test.dev', displayName: 'Tester', avatarUrl: null } } }));
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await waitFor(() => expect(screen.getByText('Trang chủ Tester')).toBeTruthy());
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@test.dev', password: 'password123' });
  expect(screen.queryByTestId('token')).toBeNull();
  fireEvent.click(screen.getByText('Mở cuộc họp'));
  expect(location.pathname).toBe('/workspace');
  expect(screen.queryByTestId('token')).toBeNull();
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

it('opens login for an invite and returns to its exact session', async () => {
  const invite = '/?view=meeting&meeting=ABCDEFGHIJ&session=target-session';
  window.history.replaceState(null, '', invite);
  const user = { userId: 'member', email: 'member@example.test', displayName: 'Member', role: 'student' };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.endsWith('/profile') ? completedProfile : url.endsWith('/auth/me')
      ? user : { access_token: 'test-jwt', user },
  })));

  render(<App />);
  const email = await screen.findByLabelText('Email');
  fireEvent.change(email, { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(email.closest('form')!);

  expect((await screen.findByTestId('token')).textContent).toBe('test-jwt');
  expect(location.pathname + location.search).toBe(invite);
});
