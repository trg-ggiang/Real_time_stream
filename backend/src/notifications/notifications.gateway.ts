import { OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway } from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "./notifications.service";
@WebSocketGateway({ namespace: "/notifications", transports: ["websocket"], maxHttpBufferSize: 4096 })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private server?: Namespace;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService, private readonly users: UsersService, private readonly notifications: NotificationsService) {}
  private readonly changed = (actor: string) => { this.server?.to(`user:${actor}`).emit("notifications:changed"); };
  async authenticate(raw: unknown) {
    if (!raw || typeof raw !== "object" || !("token" in raw) || typeof raw.token !== "string" || raw.token.length > 4096) throw new Error("Phiên đăng nhập không hợp lệ.");
    const p = await this.jwt.verifyAsync<{ sub: string; exp: number }>(raw.token, { secret: this.config.getOrThrow<string>("JWT_SECRET"), algorithms: ["HS256"] });
    if (typeof p.sub !== "string" || !Number.isFinite(p.exp) || p.exp * 1000 <= Date.now() || !await this.users.findById(p.sub)) throw new Error("Phiên đăng nhập không hợp lệ.");
    return { userId: p.sub, expiresAt: p.exp * 1000 };
  }
  afterInit(server: Namespace) {
    this.server = server;
    server.use((socket, next) => { void this.authenticate(socket.handshake.auth).then(identity => { socket.data.notificationIdentity = identity; next(); }).catch(() => next(new Error("Phiên đăng nhập hết hạn hoặc không hợp lệ."))); });
    this.notifications.events.on("changed", this.changed);
  }
  handleConnection(socket: Socket) {
    const identity = socket.data.notificationIdentity;
    if (!identity) { socket.disconnect(true); return; }
    void socket.join(`user:${identity.userId}`);
    const timer = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(2147483647, identity.expiresAt - Date.now())));
    timer.unref(); this.timers.set(socket.id, timer);
  }
  handleDisconnect(socket: Socket) { clearTimeout(this.timers.get(socket.id)); this.timers.delete(socket.id); }
  onModuleDestroy() { this.notifications.events.off("changed", this.changed); for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }
}
