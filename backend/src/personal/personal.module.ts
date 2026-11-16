import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PersonalController } from "./personal.controller";
import { PersonalService } from "./personal.service";
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}
