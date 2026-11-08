// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MeetingPage } from './MeetingPage';

const meetingSession = vi.hoisted(() => ({ join: vi.fn(), error: null as string | null }));

vi.mock('./hooks/use-meeting-session', () => ({
  useMeetingSession: () => ({
    credentials: null,
    isJoining: false,
    error: meetingSession.error ?? null,
    join: meetingSession.join,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  meetingSession.error = null;
});

it('automatically joins the room represented by the new tab URL', async () => {
  const roomId = '377f21cc-25b6-4396-b2e4-9b386c6f013b';
  render(
    <MeetingPage
      roomId={roomId}
      onUnauthorized={vi.fn()}
    />,
  );

  expect(screen.getByText(roomId)).toBeTruthy();
  expect(screen.getByRole('main').className).toBe('meeting-page');
  await vi.waitFor(() => expect(meetingSession.join).toHaveBeenCalledOnce());
});

it('shows an explicit retry action when connection fails', () => {
  meetingSession.error = 'Không kết nối được backend.';
  render(
    <MeetingPage
      roomId="377f21cc-25b6-4396-b2e4-9b386c6f013b"
      onUnauthorized={vi.fn()}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Chưa thể vào phòng' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toBe('Không kết nối được backend.');
  expect(screen.getByRole('button', { name: 'Thử kết nối lại' })).toBeTruthy();
});
