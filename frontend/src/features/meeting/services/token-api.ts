import type { JoinCredentials } from '../types';

export class UnauthorizedError extends Error {}

export async function requestJoinCredentials(
  signal: AbortSignal,
  accessToken: string,
  sessionId?: string,
): Promise<JoinCredentials> {
  const baseUrl = (
    import.meta.env.VITE_API_URL?.trim() || ''
  ).replace(/\/$/, '');
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const response = await fetch(`${baseUrl}/api/livekit/token${query}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
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
    if (response.status === 403) throw new Error('Bạn chưa được chấp nhận vào phiên này hoặc phiên đã kết thúc.');
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
    typeof data.participantIdentity !== 'string' ||
    (sessionId !== undefined && (!('sessionId' in data) || data.sessionId !== sessionId))
  ) {
    throw new Error('Máy chủ trả về thông tin phòng không hợp lệ.');
  }
  return data as JoinCredentials;
}
