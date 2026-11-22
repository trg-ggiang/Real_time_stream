// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingManagement } from './MeetingManagement';
import { meetingRequest } from '../services/meetings-api';

vi.mock('../services/meetings-api', async importOriginal => ({
  ...await importOriginal<typeof import('../services/meetings-api')>(), meetingRequest: vi.fn(),
}));
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}
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

it.each(['host', 'moderator', 'participant', undefined] as const)('shows session end only for an explicit host (%s)', async role => {
  vi.mocked(meetingRequest).mockResolvedValue([]);
  render(<MeetingManagement accessToken="token" overview={{
    meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'CLB' },
    membership: role ? { role, userId: 'viewer', invitedAt: '2026-11-21T00:00:00Z' } : undefined,
    sessions: [{ session_id: 'session', meeting_id: 'meeting', status: 'ongoing', scheduled_start_at: null, scheduled_end_at: null }],
  }} sessionId="session" knownMembers={[]} onMembersChanged={vi.fn()} onChanged={async () => {}}
    onError={vi.fn()} onSessionEnded={vi.fn()} />);
  await act(async () => {});
  expect(!!screen.queryByRole('button', { name: 'Kết thúc buổi họp' })).toBe(role === 'host');
});

it('lets the in-call host moderate current attendees even when the overview omits membership', async () => {
  vi.mocked(meetingRequest).mockImplementation(async (_token, path) => {
    if (path.endsWith('/session/members')) return [
      { meeting_member_id: 'owner', user_id: 'owner', role: 'host', users: { display_name: 'Chủ phòng' } },
      { meeting_member_id: 'target', user_id: 'target', role: 'moderator', users: { display_name: 'Bình' } },
      { meeting_member_id: 'offline', user_id: 'offline', role: 'participant', users: { display_name: 'Chi' } },
    ] as any;
    return [] as any;
  });
  render(<MeetingManagement accessToken="token" inCallHost showSessionMembers onlineUsers={new Set(['owner', 'target'])} overview={{
    meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'CLB' },
    sessions: [{ session_id: 'session', meeting_id: 'meeting', status: 'ongoing', scheduled_start_at: null, scheduled_end_at: null }],
  }} sessionId="session" knownMembers={[]} onMembersChanged={vi.fn()} onChanged={async () => {}}
    onError={vi.fn()} onSessionEnded={vi.fn()} />);
  await act(async () => {});
  expect(screen.getByText('Bình')).toBeTruthy();
  expect(screen.queryByText('Chi')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Tắt mic' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Loại' })).toHaveLength(1);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tắt mic' })); });
  expect(meetingRequest).toHaveBeenCalledWith('token', '/meeting/sessions/session/members/target/mute', expect.objectContaining({ method: 'POST' }));
  fireEvent.click(screen.getByRole('button', { name: 'Loại' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(meetingRequest).not.toHaveBeenCalledWith('token', '/meeting/sessions/session/members/target/remove', expect.anything());
});

it.each(['moderator', 'participant'] as const)('does not offer row moderation to %s', async role => {
  vi.mocked(meetingRequest).mockResolvedValue([]);
  render(<MeetingManagement accessToken="token" onlineUsers={new Set(['other'])} overview={{
    meeting: { meetingId: 'meeting', meetingCode: 'ABCDEFGHIJ', title: 'CLB' },
    membership: { role, userId: 'viewer', invitedAt: null },
    sessions: [{ session_id: 'session', meeting_id: 'meeting', status: 'ongoing', scheduled_start_at: null, scheduled_end_at: null }],
  }} sessionId="session" knownMembers={[{ meeting_member_id: 'other-member', user_id: 'other', role: 'participant', invited_at: null,
    users: { display_name: 'Bình', email: '' } }]} onMembersChanged={vi.fn()} onChanged={async () => {}}
    onError={vi.fn()} onSessionEnded={vi.fn()} />);
  await act(async () => {});
  expect(screen.getByText('Bình')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Tắt mic' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Loại' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Kết thúc buổi họp' })).toBeNull();
});
