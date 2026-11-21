import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { CompleteProfileGuard } from "./complete-profile.guard";

@Module({
  providers: [UsersService, CompleteProfileGuard],
  controllers: [UsersController],
  exports: [UsersService, CompleteProfileGuard],
})
export class UsersModule {}
