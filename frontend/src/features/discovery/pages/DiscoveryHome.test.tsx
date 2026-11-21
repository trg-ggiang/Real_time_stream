// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { DiscoveryHome } from './DiscoveryHome';

vi.mock('../hooks/use-public-query', () => ({
  useCollection: () => ({ loading: true, data: null, error: null }),
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('renders the rotating two-frame slideshow on the actual landing page', () => {
  vi.useFakeTimers();
  const { container } = render(<MemoryRouter><DiscoveryHome /></MemoryRouter>);
  const current = () => container.querySelector('.guest-hero-slide.is-current img')?.getAttribute('src');
  const first = current();
  expect(first).toContain('campus-bright');
  act(() => vi.advanceTimersByTime(5000));
  expect(current()).toContain('sinno');
  expect(container.querySelector('.guest-hero-slide.is-previous img')?.getAttribute('src')).toBe(first);
  fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 3' }));
  expect(current()).toContain('hbac');
});
