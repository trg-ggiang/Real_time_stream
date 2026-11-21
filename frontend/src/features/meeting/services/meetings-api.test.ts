import { afterEach, expect, it, vi } from 'vitest';
import { meetingRequest, MeetingApiError, parseMeetingCode } from './meetings-api';
import { UnauthorizedError } from './token-api';
afterEach(() => vi.unstubAllGlobals());

it.each([
  ['INVALID_SCHEDULE_TIME', 'Giờ bắt đầu phải ở tương lai'],
  ['SINGLE_SESSION_EXISTS', 'đã có một buổi'],
])('shows the specific scheduling conflict for %s', async (code, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({code})}));
  await expect(meetingRequest('jwt','/meeting/sessions',{method:'POST',body:{}})).rejects.toThrow(message);
});

it('extracts a meeting code from invitation URLs without navigating to the supplied host', () => {
  expect(parseMeetingCode(' https://example.test/?meeting=abcd123456&session=x ')).toBe('ABCD123456');
  expect(() => parseMeetingCode('https://example.test/')).toThrow('10 chữ/số');
  expect(() => parseMeetingCode('../admin')).toThrow();
});

it('preserves denial cooldown data and distinguishes expired authentication', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ retryAt: '2099-01-01T00:00:00Z' }) })
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }));
  await expect(meetingRequest('synthetic-jwt', '/ABCDEFGHIJ/join')).rejects.toMatchObject({ status: 429, retryAt: '2099-01-01T00:00:00Z' });
  await expect(meetingRequest('synthetic-jwt', '/ABCDEFGHIJ/sessions')).rejects.toBeInstanceOf(UnauthorizedError);
});

it('allows the unchanged overview contract without requiring invented role or settings fields', async () => {
  const overview = { meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'Team' }, sessions: [] };
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => overview });
  vi.stubGlobal('fetch', fetch);
  expect(await meetingRequest('synthetic-jwt', '/ABCDEFGHIJ/sessions')).toEqual(overview);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/meetings/ABCDEFGHIJ/sessions');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-jwt');
  expect(MeetingApiError).toBeDefined();
});
