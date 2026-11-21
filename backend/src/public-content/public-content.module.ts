import { AdminModule } from "../admin/admin.module";
import { Module } from "@nestjs/common";
import { PublicContentController } from "./public-content.controller";
import { PublicContentService } from "./public-content.service";
import { ClubActivitiesController } from "./club-activities.controller";
import { ClubActivitiesService } from "./club-activities.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule, AdminModule],
  controllers: [PublicContentController, ClubActivitiesController],
  providers: [PublicContentService, ClubActivitiesService],
})
export class PublicContentModule {}
