import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
