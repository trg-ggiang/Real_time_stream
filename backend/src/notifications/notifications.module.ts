import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";
@Module({ imports: [AuthModule, UsersModule, JwtModule.register({})], controllers: [NotificationsController], providers: [NotificationsService, NotificationsGateway] })
export class NotificationsModule {}
