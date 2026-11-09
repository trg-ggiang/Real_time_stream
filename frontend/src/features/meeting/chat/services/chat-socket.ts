import { io, type Socket } from 'socket.io-client';
import type { ChatResult } from '../types';

export function createChatSocket(accessToken: string, sessionId: string, participantIdentity: string) {
  const base = (import.meta.env.VITE_API_URL?.trim() || window.location.origin).replace(/\/$/, '');
  return io(`${base}/chat`, {
    autoConnect: false, transports: ['websocket'], forceNew: true,
    auth: { token: accessToken, sessionId, participantIdentity },
    timeout: 10_000, reconnectionDelay: 1000, reconnectionDelayMax: 5000,
  });
}

export async function chatRequest<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  if (!socket.connected) throw new Error('Chat chưa kết nối. Vui lòng thử lại khi có mạng.');
  const result = await socket.timeout(10_000).emitWithAck(event, payload) as ChatResult<T>;
  if (!result || typeof result.ok !== 'boolean') throw new Error('Phản hồi chat không hợp lệ.');
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
