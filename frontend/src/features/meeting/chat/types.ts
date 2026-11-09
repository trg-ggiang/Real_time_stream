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
export interface HistoryPage { messages: ChatMessage[]; hasMore: boolean; }
export interface OutgoingMessage { clientMessageId: string; content: string; status: 'sending' | 'failed'; }
export type ChatResult<T> = { ok: true; data: T } | { ok: false; code: number; message: string };
export const messageCursor = (message: ChatMessage): ChatCursor => ({ id: message.id, createdAt: message.createdAt });
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
