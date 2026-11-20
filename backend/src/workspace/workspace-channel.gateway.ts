import { ForbiddenException, HttpException, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { parseChatDto } from '../chat/dto/chat.dto';
import { UsersService } from '../users/users.service';
import { profileIsComplete } from '../users/complete-profile.guard';
import { WorkspaceChannels } from './workspace-channels.service';
import { ChannelMessageDto } from './workspace-channels.controller';
import { ChannelSavedEvent, WorkspaceChannelEvents } from './workspace-channel-events';

class ChannelHandshake {
  @IsString() @MaxLength(4096) token!: string;
  @IsUUID() clubId!: string;
  @IsUUID() channelId!: string;
}
interface Identity { userId: string; clubId: string; channelId: string; expiresAt: number }
function failure(error: unknown) {
  return { ok: false as const, code: error instanceof HttpException ? error.getStatus() : 503,
    message: error instanceof HttpException ? error.message : 'Chat tạm thời không khả dụng. Hãy thử lại.' };
}

@WebSocketGateway({ namespace: '/workspace-chat', transports: ['websocket'], maxHttpBufferSize: 16_384 })
export class WorkspaceChannelGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private server!: Namespace;
  private sweep?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;
  private readonly expirations = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly limits = new Map<string, number[]>();
  constructor(private readonly channels: WorkspaceChannels, private readonly events: WorkspaceChannelEvents,
    private readonly users: UsersService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  afterInit(server: Namespace) {
    this.server = server;
    server.use((socket, next) => { void this.authenticate(socket.handshake.auth).then(identity => {
      socket.data.identity = identity; next();
    }).catch(error => next(Object.assign(new Error(failure(error).message), { data: failure(error) }))); });
    this.unsubscribe = this.events.subscribe(event => { void this.deliver(event); });
    this.sweep = setInterval(() => {
      for (const socket of server.sockets.values()) void this.recheck(socket);
      for (const [userId, times] of this.limits) if (!times.some(time => time > Date.now() - 60_000)) this.limits.delete(userId);
    }, 30_000);
    this.sweep.unref();
  }

  private async authenticate(raw: unknown): Promise<Identity> {
    const auth = await parseChatDto(ChannelHandshake, raw);
    let payload: { sub: string; exp: number };
    try { payload = await this.jwt.verifyAsync(auth.token, { secret: this.config.getOrThrow<string>('JWT_SECRET'), algorithms: ['HS256'] }); }
    catch { throw new UnauthorizedException('Phiên đăng nhập hết hạn hoặc không hợp lệ.'); }
    if (typeof payload.sub !== 'string' || !Number.isFinite(payload.exp) || !await this.users.findById(payload.sub)) throw new UnauthorizedException();
    await this.profile(payload.sub);
    const identity = { userId: payload.sub, clubId: auth.clubId, channelId: auth.channelId, expiresAt: payload.exp * 1000 };
    await this.require(identity);
    return identity;
  }
  private async profile(userId: string) {
    if (!profileIsComplete(await this.users.getProfile(userId))) throw new ForbiddenException('Hoàn thiện hồ sơ sinh viên trước khi tiếp tục.');
  }
  private async require(identity: Identity) {
    if (!identity || identity.expiresAt <= Date.now()) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    return this.channels.requireChannel(identity.userId, identity.clubId, identity.channelId);
  }
  handleConnection(socket: Socket) {
    const identity = socket.data.identity as Identity;
    if (!identity) { socket.disconnect(true); return; }
    const timer = setTimeout(() => this.revoke(socket), Math.min(Math.max(0, identity.expiresAt - Date.now()), 2_147_483_647));
    timer.unref(); this.expirations.set(socket.id, timer);
  }
  handleDisconnect(socket: Socket) { clearTimeout(this.expirations.get(socket.id)); this.expirations.delete(socket.id); }
  private revoke(socket: Socket) {
    socket.emit('channel:revoked', { code: 403, message: 'Quyền truy cập kênh đã kết thúc. Hãy kiểm tra tài khoản hoặc đăng nhập lại.' });
    socket.disconnect(true);
  }
  private async recheck(socket: Socket) {
    try { await this.require(socket.data.identity); return socket.connected; }
    catch { this.revoke(socket); return false; }
  }
  private async deliver(event: ChannelSavedEvent) {
    const peers = [...this.server.sockets.values()].filter(peer => peer.data.identity?.clubId === event.clubId && peer.data.identity?.channelId === event.channelId);
    await Promise.all(peers.map(async peer => {
      try {
        const context = await this.require(peer.data.identity);
        if (!peer.connected) return;
        const { client_message_id, ...message } = event.message;
        const mine = context.membership.membership_id === message.sender_membership_id;
        peer.emit('channel:message', { ...message, mine, ...(mine ? { client_message_id } : {}) });
      } catch { this.revoke(peer); }
    }));
  }
  @SubscribeMessage('channel:send')
  async send(@ConnectedSocket() socket: Socket, @MessageBody() raw: unknown) {
    try {
      const identity = socket.data.identity as Identity;
      if (!identity || identity.expiresAt <= Date.now()) throw new UnauthorizedException();
      const times = (this.limits.get(identity.userId) || []).filter(time => time > Date.now() - 60_000);
      if (times.length >= 30) return { ok: false as const, code: 429, message: 'Bạn gửi quá nhanh. Hãy chờ một chút.' };
      times.push(Date.now()); this.limits.set(identity.userId, times);
      const body = await parseChatDto(ChannelMessageDto, raw);
      await this.profile(identity.userId);
      // send revalidates channel access and binds the sender; the client cannot choose a recipient or author.
      return { ok: true as const, data: await this.channels.send(identity.userId, identity.clubId, identity.channelId, body) };
    } catch (error) { return failure(error); }
  }
  onModuleDestroy() {
    this.unsubscribe?.(); if (this.sweep) clearInterval(this.sweep);
    for (const timer of this.expirations.values()) clearTimeout(timer);
    this.expirations.clear(); this.limits.clear();
  }
}
