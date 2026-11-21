import { expect, it } from 'vitest';
import { publicDateRange, publicTime } from './content-format';

it('formats single dates and date ranges in Vietnam time', () => {
  expect(publicDateRange('2026-11-25T08:00:00+07:00', '2026-11-25T20:00:00+07:00')).toBe('25/11/2026');
  expect(publicDateRange('2026-11-25T08:00:00+07:00', '2026-12-02T20:00:00+07:00')).toBe('25/11–02/12/2026');
  expect(publicDateRange('2026-12-30T08:00:00+07:00', '2027-01-02T20:00:00+07:00')).toBe('30/12/2026–02/01/2027');
  expect(publicDateRange('2026-11-25T18:30:00Z')).toBe('26/11/2026');
  expect(publicDateRange(null, 'invalid')).toBe('Chưa cập nhật');
  expect(publicTime('2026-11-25T11:30:00Z')).toBe('18:30');
});
