import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PersonalController } from "./personal.controller";
import { PersonalService } from "./personal.service";
import { HeadNotifications } from "./head-notifications.service";
import { HeadNotificationsController } from "./head-notifications.controller";
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PersonalController, HeadNotificationsController],
  providers: [PersonalService, HeadNotifications],
})
export class PersonalModule {}
