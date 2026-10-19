import { afterEach, expect, it, vi } from 'vitest';
import { requestJoinCredentials } from './token-api';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([
  ['', '/api/livekit/token'],
  ['https://api.example.test/', 'https://api.example.test/api/livekit/token'],
])('routes requests with API base %s', async (base, expected) => {
  vi.stubEnv('VITE_API_URL', base);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token: 'synthetic-token', serverUrl: 'wss://test.livekit.cloud', roomName: 'test-room', participantIdentity: 'test-participant' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  await requestJoinCredentials(new AbortController().signal);
  expect(fetchMock).toHaveBeenCalledWith(expected, expect.objectContaining({ method: 'POST' }));
});
