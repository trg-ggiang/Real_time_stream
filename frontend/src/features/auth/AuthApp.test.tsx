// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthApp } from './AuthApp';

vi.mock('../meeting/MeetingPage', () => ({
  MeetingPage: ({ accessToken, displayName, onLogout }: { accessToken: string; displayName: string; onLogout: () => void }) =>
    <div><span>{displayName}</span><span data-testid="token">{accessToken}</span><button onClick={onLogout}>Đăng xuất</button></div>,
}));
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.unstubAllGlobals(); });

it('restores and persists the shared theme preference on the login screen', () => {
  localStorage.setItem('rts.meeting-theme.v1', 'dark');
  const first = render(<AuthApp />);
  expect(screen.getByRole('button', { name: 'Giao diện tối' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Giao diện sáng' }));
  expect(localStorage.getItem('rts.meeting-theme.v1')).toBe('light');
  first.unmount(); render(<AuthApp />);
  expect(screen.getByRole('button', { name: 'Giao diện sáng' }).getAttribute('aria-pressed')).toBe('true');
});

it('restores login after remount and removes the saved session on logout', async () => {
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    access_token: token, user: { userId: 'u1', email: 'a@test.dev', displayName: 'Restored', avatarUrl: null },
  }) });
  vi.stubGlobal('fetch', fetchMock);
  const first = render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await screen.findByText('Restored');
  first.unmount();
  const second = render(<AuthApp />);
  expect(screen.getByText('Restored')).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Đăng xuất'));
  second.unmount();
  render(<AuthApp />);
  expect(screen.queryByText('Restored')).toBeNull();
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
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    access_token: 'app-jwt', user: { userId: 'u1', email: 'a@test.dev', displayName: 'Tester', avatarUrl: null },
  }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await waitFor(() => expect(screen.getByText('Tester')).toBeTruthy());
  expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@test.dev', password: 'password123' });
  expect(screen.getByTestId('token').textContent).toBe('app-jwt');
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
