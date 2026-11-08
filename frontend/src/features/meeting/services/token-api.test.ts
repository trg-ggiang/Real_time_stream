import { afterEach, expect, it, vi } from 'vitest';
import { requestJoinCredentials } from './token-api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  ['', '/api/livekit/rooms/377f21cc-25b6-4396-b2e4-9b386c6f013b/token'],
  [
    'https://api.example.test/',
    'https://api.example.test/api/livekit/rooms/377f21cc-25b6-4396-b2e4-9b386c6f013b/token',
  ],
])('routes cookie-authenticated requests with API base %s', async (base, expected) => {
  vi.stubEnv('VITE_API_URL', base);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      token: 'synthetic-token',
      serverUrl: 'wss://test.livekit.cloud',
      roomName: '377f21cc-25b6-4396-b2e4-9b386c6f013b',
      participantIdentity: 'test-participant',
      isHost: false,
      settings: { allowMic: true, allowVideo: true, waitingRoom: false },
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  await requestJoinCredentials(
    new AbortController().signal,
    '377f21cc-25b6-4396-b2e4-9b386c6f013b',
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expected,
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});
