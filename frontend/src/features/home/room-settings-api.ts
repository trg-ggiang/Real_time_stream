import type { RoomPermissions } from './RoomPermissionForm';

function apiBaseUrl() {
  return (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
}

export async function saveRoomPermissions(roomId: string, settings: RoomPermissions): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/api/livekit/rooms/${encodeURIComponent(roomId)}/settings`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, waitingRoom: true }),
  });
  if (!response.ok) throw new Error('Không thể lưu thiết lập phòng. Hãy thử lại.');
}
