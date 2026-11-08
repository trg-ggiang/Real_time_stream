import type { JoinCredentials, WaitingRoomStatus } from '../types';

export class UnauthorizedError extends Error {}

export async function requestJoinCredentials(
  signal: AbortSignal,
  roomId: string,
): Promise<JoinCredentials | WaitingRoomStatus> {
  const baseUrl = (
    import.meta.env.VITE_API_URL?.trim() || ''
  ).replace(/\/$/, '');
  const response = await fetch(
    `${baseUrl}/api/livekit/rooms/${encodeURIComponent(roomId)}/token`,
    {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal,
    },
  );
  if (!response.ok) {
    if (response.status === 401) throw new UnauthorizedError('Phiên đăng nhập hết hạn. Hãy đăng nhập lại.');
    if (response.status === 429)
      throw new Error(
        'Bạn tham gia quá nhiều lần. Vui lòng thử lại sau một phút.',
      );
    if (response.status === 503)
      throw new Error(
        'Phòng thử nghiệm chưa sẵn sàng. Hãy kiểm tra cấu hình LiveKit ở backend.',
      );
    throw new Error('Không thể cấp quyền vào phòng. Vui lòng thử lại.');
  }
  const data: unknown = await response.json();
  if (data && typeof data === 'object' && 'waiting' in data && data.waiting === true) {
    return { waiting: true };
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('token' in data) ||
    typeof data.token !== 'string' ||
    !data.token ||
    !('serverUrl' in data) ||
    typeof data.serverUrl !== 'string' ||
    !data.serverUrl.startsWith('wss://') ||
    !('roomName' in data) ||
    typeof data.roomName !== 'string' ||
    !('participantIdentity' in data) ||
    typeof data.participantIdentity !== 'string' ||
    !('isHost' in data) ||
    typeof data.isHost !== 'boolean' ||
    !('settings' in data) ||
    typeof data.settings !== 'object' ||
    data.settings === null
  ) {
    throw new Error('Máy chủ trả về thông tin phòng không hợp lệ.');
  }
  const settings = data.settings as Record<string, unknown>;
  if (
    typeof settings.allowMic !== 'boolean' ||
    typeof settings.allowVideo !== 'boolean' ||
    typeof settings.waitingRoom !== 'boolean'
  ) {
    throw new Error('MĂ¡y chá»§ tráº£ vá» cĂ i Ä‘áº·t phĂ²ng khĂ´ng há»£p lá»‡.');
  }
  return data as JoinCredentials;
}
