// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { useMeetingSession } from './use-meeting-session';

const credentials = {
  serverUrl: 'wss://unit-test.livekit.cloud',
  roomName: 'media-test-room',
  participantIdentity: 'test-participant',
  token: 'synthetic-token',
};

beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {},
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('meeting session', () => {
  it('clears ended sessions, preserves the disconnect message and allows rejoin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => credentials }),
    );
    const { result } = renderHook(useMeetingSession);
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.endSession('Connection lost'));
    expect(result.current.credentials).toBeNull();
    expect(result.current.error).toBe('Connection lost');
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.credentials).toEqual(credentials);
    expect(result.current.error).toBeNull();
  });
  it('issues one request for concurrent Join clicks, including under StrictMode', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => credentials });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useMeetingSession, { wrapper: StrictMode });
    await act(async () => {
      await Promise.all([result.current.join(), result.current.join()]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.credentials).toEqual(credentials);
    await act(async () => {
      await result.current.join();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.leave());
    expect(result.current.credentials).toBeNull();
    await act(async () => {
      await result.current.join();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a late token response after cancel and aborts pending work on unmount', async () => {
    let resolveRequest!: (value: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(useMeetingSession);
    let joining!: Promise<void>;
    act(() => {
      joining = result.current.join();
    });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    act(() => result.current.leave());
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolveRequest({ ok: true, json: async () => credentials });
      await joining;
    });
    expect(result.current.credentials).toBeNull();
    expect(result.current.error).toBeNull();
    act(() => {
      void result.current.join();
    });
    const nextSignal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    unmount();
    expect(nextSignal.aborted).toBe(true);
  });

  it.each([429, 503, 500])(
    'shows an actionable error and permits retry for HTTP %s',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status })
        .mockResolvedValueOnce({ ok: true, json: async () => credentials });
      vi.stubGlobal('fetch', fetchMock);
      const { result } = renderHook(useMeetingSession);
      await act(async () => {
        await result.current.join();
      });
      expect(result.current.error).toBeTruthy();
      expect(result.current.credentials).toBeNull();
      expect(result.current.isJoining).toBe(false);
      await act(async () => {
        await result.current.join();
      });
      expect(result.current.credentials).toEqual(credentials);
      expect(result.current.error).toBeNull();
    },
  );

  it('rejects malformed credentials instead of opening a room', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'invalid' }),
      }),
    );
    const { result } = renderHook(useMeetingSession);
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.credentials).toBeNull();
    expect(result.current.error).toContain('không hợp lệ');
  });

  it('blocks media access outside a secure browser context', async () => {
    vi.stubGlobal('isSecureContext', false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useMeetingSession);
    await act(async () => {
      await result.current.join();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toContain('HTTPS'));
  });
});
