// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { channelRequest } from './channel-socket';
import { AccountApiError } from '../../../shared/api/account-http';

it('explains acknowledgement timeouts without pretending delivery succeeded', async () => {
  const socket = { connected: true, timeout: () => ({ emitWithAck: vi.fn().mockRejectedValue(new Error('operation has timed out')) }) } as unknown as Socket;
  await expect(channelRequest(socket, 'channel:send', {})).rejects.toThrow('Nội dung được giữ lại');
});
it('preserves access denial and does not send while offline', async () => {
  const emit = vi.fn().mockResolvedValue({ ok: false, code: 403, message: 'Không có quyền' });
  const socket = { connected: true, timeout: () => ({ emitWithAck: emit }) } as unknown as Socket;
  await expect(channelRequest(socket, 'channel:send', {})).rejects.toBeInstanceOf(AccountApiError);
  socket.connected = false;
  await expect(channelRequest(socket, 'channel:send', {})).rejects.toThrow('Chat chưa kết nối');
  expect(emit).toHaveBeenCalledTimes(1);
});
