// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthApp } from './AuthApp';

vi.mock('../meeting/MeetingPage', () => ({
  MeetingPage: ({ roomId, onUnauthorized }: { roomId: string; onUnauthorized: () => void }) =>
    <div><span data-testid="room-id">{roomId}</span><button onClick={onUnauthorized}>Unauthorized</button></div>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function unauthorizedResponse() {
  return Promise.resolve({ ok: false, status: 401 });
}

it('logs in with a cookie-backed session and restores a direct meeting URL', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/api/auth/me')) return unauthorizedResponse();
    if (url.endsWith('/api/auth/logout')) return Promise.resolve({ ok: true, status: 204 });
    return Promise.resolve({
      ok: true,
      json: async () => ({
        user: { userId: 'u1', email: 'a@test.dev', displayName: 'Tester', avatarUrl: null },
      }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);

  await screen.findByLabelText('Email');
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Phòng họp' })).toBeTruthy());

  const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/auth/login'));
  expect(loginCall?.[1]).toEqual(expect.objectContaining({ credentials: 'include' }));
  expect(JSON.parse(loginCall?.[1].body)).toEqual({ email: 'a@test.dev', password: 'password123' });

  const roomId = '377f21cc-25b6-4396-b2e4-9b386c6f013b';
  window.history.pushState(null, '', `/meeting/${roomId}`);
  fireEvent.popState(window);
  expect(screen.getByTestId('room-id').textContent).toBe(roomId);

  fireEvent.click(screen.getByText('Unauthorized'));
  await screen.findByLabelText('Mật khẩu');
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/api/auth/logout'))).toBe(true);
});

it('aborts authentication on unmount and ignores late success', async () => {
  let resolve!: (value: unknown) => void;
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/api/auth/me')) return unauthorizedResponse();
    return new Promise((done) => { resolve = done; });
  });
  vi.stubGlobal('fetch', fetchMock);
  const { unmount } = render(<AuthApp />);
  await screen.findByLabelText('Email');
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/auth/login'));
  const signal = loginCall?.[1].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({ user: { userId: 'u', email: 'e', displayName: 'Late' } }) }));
  expect(screen.queryByText('Late')).toBeNull();
});

it('validates registration inline without sending invalid credentials and toggles password visibility', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    url.endsWith('/api/auth/me') ? unauthorizedResponse() : Promise.resolve({ ok: true }),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  await screen.findByLabelText('Email');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/api/auth/register'))).toBe(false);
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
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/api/auth/me')) return unauthorizedResponse();
    return new Promise((done) => { resolve = done; });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AuthApp />);
  await screen.findByLabelText('Email');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: ' Tester ' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@test.dev' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
  const form = screen.getByLabelText('Email').closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  const registerCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/auth/register'));
  expect(registerCalls).toHaveLength(1);
  expect(registerCalls[0][1]).toEqual(expect.objectContaining({ credentials: 'include' }));
  expect(JSON.parse(registerCalls[0][1].body)).toEqual({
    email: 'a@test.dev',
    password: 'password123',
    displayName: 'Tester',
  });
  expect((screen.getByRole('button', { name: 'Đang xử lý…' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ ok: false, status: 409 }));
  expect(screen.getByRole('alert').textContent).toBe('Email đã được sử dụng.');
  expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(false);
});
