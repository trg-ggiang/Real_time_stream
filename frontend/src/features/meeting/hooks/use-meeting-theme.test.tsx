// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useMeetingTheme } from './use-meeting-theme';

afterEach(() => { cleanup(); localStorage.clear(); });

it('persists an explicit theme and restores it after remount', () => {
  const first = renderHook(useMeetingTheme);
  act(() => first.result.current.setTheme('light'));
  expect(localStorage.getItem('rts.meeting-theme.v1')).toBe('light');
  first.unmount();
  const second = renderHook(useMeetingTheme);
  expect(second.result.current.theme).toBe('light');
  act(() => second.result.current.setTheme('dark'));
  second.unmount();
  expect(renderHook(useMeetingTheme).result.current.theme).toBe('dark');
});

it('synchronizes valid changes from other tabs and ignores invalid values', () => {
  const hook = renderHook(useMeetingTheme);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'rts.meeting-theme.v1', newValue: 'light' })));
  expect(hook.result.current.theme).toBe('light');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'rts.meeting-theme.v1', newValue: 'invalid' })));
  expect(hook.result.current.theme).toBe('light');
});
