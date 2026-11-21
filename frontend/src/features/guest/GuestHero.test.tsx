// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuestHero } from './GuestHero';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('moves the large image into the small frame every five seconds and loops', () => {
  vi.useFakeTimers();
  const { container } = render(<GuestHero />);
  const large = () => container.querySelector('.guest-hero-slide.is-current img')?.getAttribute('src');
  const small = () => container.querySelector('.guest-hero-slide.is-previous img')?.getAttribute('src');
  const first = large();
  act(() => vi.advanceTimersByTime(4999));
  expect(large()).toBe(first);
  act(() => vi.advanceTimersByTime(1));
  expect(small()).toBe(first);
  expect(large()).toContain('sinno');
  act(() => vi.advanceTimersByTime(5000));
  expect(large()).toContain('hbac');
  act(() => vi.advanceTimersByTime(5000));
  expect(large()).toContain('tech');
  act(() => vi.advanceTimersByTime(5000));
  expect(large()).toBe(first);
});

it('supports dot selection and continues automatically without pause controls', () => {
  vi.useFakeTimers();
  render(<GuestHero />);
  fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 4' }));
  expect(screen.getByRole('button', { name: 'Xem ảnh 4' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.mouseEnter(screen.getByRole('region', { name: 'Cộng đồng sinh viên Bách khoa' }));
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('button', { name: 'Xem ảnh 1' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('button', { name: /Tạm dừng/ })).toBeNull();
});
