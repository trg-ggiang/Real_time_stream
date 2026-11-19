// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestLanding } from './GuestLanding';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
