import { HttpException, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ChatAccessService } from './chat-access.service';
import { ChatService } from './chat.service';
import { ChatIdentity, ChatResult } from './chat.types';

function failure(cause: unknown): { ok: false; code: number; message: string } {
  return { ok: false, code: cause instanceof HttpException ? cause.getStatus() : 503,
    message: cause instanceof HttpException ? cause.message : 'Chat tạm thời không khả dụng. Hãy thử lại.' };
}

@WebSocketGateway({ namespace: '/chat', transports: ['websocket'], maxHttpBufferSize: 16_384 })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() private server!: Namespace;
  private readonly expirations = new Map<string, ReturnType<typeof setTimeout>>();
  private sweep?: ReturnType<typeof setInterval>;
  constructor(private readonly access: ChatAccessService, private readonly chat: ChatService) {}

  afterInit(server: Namespace) {
    server.use((socket, next) => {
      void this.access.authenticate(socket.handshake.auth).then(identity => {
        socket.data.identity = identity; next();
      }).catch(cause => next(Object.assign(new Error(failure(cause).message), { data: failure(cause) })));
    });
    this.sweep = setInterval(() => {
      this.chat.pruneLimits();
      for (const socket of server.sockets.values()) void this.recheck(socket);
    }, 30_000);
    this.sweep.unref();
  }

  handleConnection(socket: Socket) {
    const identity = socket.data.identity as ChatIdentity;
    if (!identity) { socket.disconnect(true); return; }
    void socket.join(`session:${identity.sessionId}`);
    const timer = setTimeout(() => this.revoke(socket), Math.min(Math.max(0, identity.expiresAt - Date.now()), 2_147_483_647));
    timer.unref(); this.expirations.set(socket.id, timer);
  }

  handleDisconnect(socket: Socket) {
    clearTimeout(this.expirations.get(socket.id)); this.expirations.delete(socket.id);
  }

  private revoke(socket: Socket) {
    socket.emit('chat:revoked', { message: 'Quyền chat đã kết thúc. Kiểm tra phiên họp hoặc đăng nhập lại.' });
    socket.disconnect(true);
  }

  private async recheck(socket: Socket) {
    try { await this.access.requireAccess(socket.data.identity as ChatIdentity); return socket.connected; }
    catch { this.revoke(socket); return false; }
  }

  @SubscribeMessage('chat:send')
  async send(@ConnectedSocket() socket: Socket, @MessageBody() value: unknown): Promise<ChatResult<unknown>> {
    try {
      const identity = socket.data.identity as ChatIdentity;
      const message = await this.chat.send(identity, value);
      // Revalidate each recipient before delivery, including removal/session state.
      const recipients = [...this.server.sockets.values()].filter(peer => peer.data.identity?.sessionId === identity.sessionId);
      await Promise.all(recipients.map(async peer => {
        if (await this.recheck(peer)) peer.emit('chat:message', message);
      }));
      return { ok: true, data: message };
    } catch (cause) { return failure(cause); }
  }

  @SubscribeMessage('chat:history')
  async history(@ConnectedSocket() socket: Socket, @MessageBody() value: unknown): Promise<ChatResult<unknown>> {
    try { return { ok: true, data: await this.chat.history(socket.data.identity as ChatIdentity, value) }; }
    catch (cause) { return failure(cause); }
  }

  onModuleDestroy() {
    if (this.sweep) clearInterval(this.sweep);
    for (const timer of this.expirations.values()) clearTimeout(timer);
    this.expirations.clear();
  }
}
