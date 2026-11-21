import { io, type Socket } from 'socket.io-client';
import { AccountApiError } from '../../../shared/api/account-http';

export function createChannelSocket(token: string, clubId: string, channelId: string) {
  const base = (import.meta.env.VITE_API_URL?.trim() || window.location.origin).replace(/\/$/, '');
  return io(`${base}/workspace-chat`, { autoConnect: false, forceNew: true, transports: ['websocket'],
    auth: { token, clubId, channelId }, timeout: 10_000, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
}

export async function channelRequest<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  if (!socket.connected) throw new Error('Chat chưa kết nối. Nội dung đang soạn vẫn được giữ.');
  let response: unknown;
  try { response = await socket.timeout(15_000).emitWithAck(event, payload); }
  catch { throw new Error('Chưa nhận được xác nhận gửi tin. Nội dung được giữ lại; bạn có thể thử gửi lại.'); }
  const result = response as
    { ok: true; data: T } | { ok: false; code: number; message: string };
  if (!result || typeof result.ok !== 'boolean') throw new Error('Phản hồi chat không hợp lệ.');
  if (!result.ok) throw new AccountApiError(result.code, result.message);
  return result.data;
}
