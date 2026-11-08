export type WaitingParticipant = {
  userId: string;
  displayName: string;
};

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
}

export async function getWaitingParticipants(
  roomId: string,
  signal?: AbortSignal,
): Promise<WaitingParticipant[]> {
  const response = await fetch(
    `${apiBaseUrl()}/api/livekit/rooms/${encodeURIComponent(roomId)}/waiting`,
    { credentials: 'include', cache: 'no-store', signal },
  );
  if (!response.ok) throw new Error('Không thể tải danh sách chờ duyệt.');
  return response.json() as Promise<WaitingParticipant[]>;
}

export async function approveWaitingParticipant(
  roomId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/api/livekit/rooms/${encodeURIComponent(roomId)}/waiting/${encodeURIComponent(userId)}/approve`,
    { method: 'POST', credentials: 'include' },
  );
  if (!response.ok) throw new Error('Không thể duyệt người tham gia.');
}

export async function muteParticipantMicrophone(
  roomId: string,
  participantIdentity: string,
  muted: boolean,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/api/livekit/rooms/${encodeURIComponent(roomId)}/participants/mute-microphone`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIdentity, muted }),
    },
  );
  if (!response.ok) throw new Error('Không thể tắt mic người tham gia.');
}
