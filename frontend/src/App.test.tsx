// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
vi.mock('./features/guest/GuestLanding', () => ({ GuestLanding: () => <div>Public landing</div> }));
vi.mock('./features/auth/AuthApp', () => ({ AuthApp: () => <div>Account screen</div> }));
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
it('opens the public landing by default', () => { render(<App />); expect(screen.getByText('Public landing')).toBeTruthy(); });
it.each(['login', 'register'])('opens an explicit %s link', async mode => {
  window.history.replaceState({}, '', `/?mode=${mode}`);
  render(<App />);
  expect(await screen.findByText('Account screen')).toBeTruthy();
});
it('keeps valid existing sessions in the authenticated application', async () => {
  const access_token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  sessionStorage.setItem('rts.auth-session.v1', JSON.stringify({ access_token, user: { userId: 'u', email: 'test@example.com', displayName: 'User' } }));
  render(<App />);
  expect(await screen.findByText('Account screen')).toBeTruthy();
});
