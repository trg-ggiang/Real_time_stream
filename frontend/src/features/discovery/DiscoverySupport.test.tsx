// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DiscoveryApp } from './DiscoveryApp';

vi.mock('./pages/DiscoveryHome', () => ({ DiscoveryHome: () => <h1>Trang chủ demo</h1> }));
vi.mock('./components/HeadNotifications', () => ({ HeadNotifications: () => null }));
vi.mock('./hooks/use-discovery-motion', () => ({ useDiscoveryMotion: () => {} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('replaces only the requested avatar entries, closes the dropdown on navigation and preserves logout', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const logout = vi.fn();
  render(<MemoryRouter><DiscoveryApp viewer={{ displayName: 'Minh Hải' }} accessToken="token" role="student" onLogout={logout} /></MemoryRouter>);
  const summary = screen.getByLabelText('Menu tài khoản của Minh Hải');
  fireEvent.click(summary);
  const details = summary.closest('details')!;
  const menu = within(details);
  expect(menu.getByRole('link', { name: 'Không gian của tôi' }).getAttribute('href')).toBe('/me');
  expect(menu.getByRole('link', { name: 'Trợ giúp và hỗ trợ' }).getAttribute('href')).toBe('/help');
  expect(menu.getByRole('link', { name: 'Báo cáo sự cố' }).getAttribute('href')).toBe('/report-issue');
  for (const label of ['CLB của tôi', 'Tạo CLB', 'Cuộc họp']) expect(menu.queryByText(label)).toBeNull();
  fireEvent.click(menu.getByRole('link', { name: 'Trợ giúp và hỗ trợ' }));
  expect(screen.getByRole('heading', { name: /Chúng mình có thể/ })).toBeTruthy();
  expect(details.open).toBe(false);
  fireEvent.click(summary);
  fireEvent.click(menu.getByRole('button', { name: 'Đăng xuất' }));
  expect(logout).toHaveBeenCalledTimes(1);
});
