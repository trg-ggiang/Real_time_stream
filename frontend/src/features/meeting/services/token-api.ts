import type { JoinCredentials } from '../types';

export async function requestJoinCredentials(
  signal: AbortSignal,
): Promise<JoinCredentials> {
  const baseUrl = (
    import.meta.env.VITE_API_URL?.trim() || ''
  ).replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/livekit/token`, {
    method: 'POST',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
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
    typeof data.participantIdentity !== 'string'
  ) {
    throw new Error('Máy chủ trả về thông tin phòng không hợp lệ.');
  }
  return data as JoinCredentials;
}
