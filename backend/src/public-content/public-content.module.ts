import { Module } from '@nestjs/common';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';
import { ClubActivitiesController } from './club-activities.controller';
import { ClubActivitiesService } from './club-activities.service';

@Module({
  controllers: [PublicContentController, ClubActivitiesController],
  providers: [PublicContentService, ClubActivitiesService],
})
export class PublicContentModule {}
