// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Navbar } from '../../../components/Navbar';
import { Sidebar } from '../../../components/Sidebar';

afterEach(cleanup);

it('keeps Home first in the vertical sidebar and navigates to the meeting', () => {
  render(
    <Sidebar
      currentPath="/"
      displayName="Lan"
      onLogout={vi.fn()}
    />,
  );

  const home = screen.getByRole('link', { name: 'Home' });
  const meeting = screen.getByRole('link', { name: 'Phòng họp' });
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng chính' });

  expect(screen.getByRole('complementary', { name: 'Thanh điều hướng' })).toBeTruthy();
  expect(document.querySelector('.sidebar-brand-mark')).toBeNull();
  expect(navigation.firstElementChild).toBe(home);
  expect(home.getAttribute('href')).toBe('/');
  expect(home.querySelector('img')?.getAttribute('src')).toBe('/icon/home.svg');
  expect(home.getAttribute('aria-current')).toBe('page');

  expect(meeting.getAttribute('href')).toBe('/meeting/new');
  expect(meeting.getAttribute('target')).toBe('_blank');
  expect(meeting.getAttribute('rel')).toBe('noopener noreferrer');
  expect(meeting.getAttribute('aria-current')).toBeNull();
});

it('shows the signed-in initial and logs out from the top navbar menu', () => {
  const onLogout = vi.fn();
  render(<Navbar displayName="Lan" onLogout={onLogout} />);
  const account = screen.getByRole('button', { name: 'Tài khoản Lan' });

  expect(screen.getByRole('banner')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Real-time Stream — Home' })
    .querySelector('img')?.getAttribute('src')).toBe('/icon/video-camera.svg');
  expect(screen.getByRole('link', { name: 'Real-time Stream — Home' }).getAttribute('href')).toBe('/');
  expect(account.textContent).toBe('L');
  fireEvent.click(account);
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));
  expect(onLogout).toHaveBeenCalledOnce();
});

it('closes the navbar account dropdown with Escape or outside click', () => {
  render(<Navbar displayName="Lan" onLogout={vi.fn()} />);
  const account = screen.getByRole('button', { name: 'Tài khoản Lan' });

  fireEvent.click(account);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();

  fireEvent.click(account);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
});
