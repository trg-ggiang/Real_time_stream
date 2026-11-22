// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingManagement } from './MeetingManagement';
import { meetingRequest } from '../services/meetings-api';

vi.mock('../services/meetings-api', async importOriginal => ({
  ...await importOriginal<typeof import('../services/meetings-api')>(), meetingRequest: vi.fn(),
}));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it('reports pending requests while hidden, polls for new arrivals and updates the badge after approval', async () => {
  vi.useFakeTimers();
  const request = (id: string) => ({ requestId: id, meeting_member_id: id,
    meeting_members: { user_id: id, users: { display_name: id } } });
  let requests = [request('An')];
  vi.mocked(meetingRequest).mockImplementation(async (token, path) => {
    if (path.endsWith('/approve')) { requests = requests.filter(item => !path.includes('/' + item.meeting_member_id + '/')); return {}; }
    return [...requests] as any;
  });
  const onPendingCountChange = vi.fn();
  render(<div hidden><MeetingManagement accessToken="token" overview={{
    meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'CLB' },
    membership: { role: 'host', userId: 'host', invitedAt: null },
    sessions: [{ session_id: 'session', meeting_id: 'meeting', status: 'ongoing', scheduled_start_at: null, scheduled_end_at: null }],
  }} sessionId="session" knownMembers={[]} onMembersChanged={vi.fn()} onChanged={async () => {}}
    onError={vi.fn()} onSessionEnded={vi.fn()} onPendingCountChange={onPendingCountChange} /></div>);
  await act(async () => {});
  expect(onPendingCountChange).toHaveBeenLastCalledWith(1);
  requests.push(request('Binh'));
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(onPendingCountChange).toHaveBeenLastCalledWith(2);
  expect(screen.queryByText('Cho vào')).toBeNull();
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Duyệt', hidden: true })[0]); });
  expect(onPendingCountChange).toHaveBeenLastCalledWith(1);
});

it.each(['host', 'moderator', 'participant', undefined] as const)('shows session end only for an explicit host or moderator (%s)', async role => {
  vi.mocked(meetingRequest).mockResolvedValue([]);
  render(<MeetingManagement accessToken="token" overview={{
    meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'CLB' },
    membership: role ? { role, userId: 'viewer', invitedAt: '2026-11-21T00:00:00Z' } : undefined,
    sessions: [{ session_id: 'session', meeting_id: 'meeting', status: 'ongoing', scheduled_start_at: null, scheduled_end_at: null }],
  }} sessionId="session" knownMembers={[]} onMembersChanged={vi.fn()} onChanged={async () => {}}
    onError={vi.fn()} onSessionEnded={vi.fn()} />);
  await act(async () => {});
  expect(!!screen.queryByRole('button', { name: 'Kết thúc buổi họp' })).toBe(role === 'host' || role === 'moderator');
});
