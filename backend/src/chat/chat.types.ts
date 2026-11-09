export interface ChatCursor { createdAt: string; id: string; }
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  clientMessageId: string;
  createdAt: string;
}
export interface ChatIdentity {
  userId: string;
  sessionId: string;
  participantIdentity: string;
  expiresAt: number;
}
export interface HistoryPage { messages: ChatMessage[]; hasMore: boolean; }
export type ChatResult<T> = { ok: true; data: T } | { ok: false; code: number; message: string };
