import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { UsersModule } from '../users/users.module';

@Module({ imports: [UsersModule], controllers: [MeetingsController], providers: [MeetingsService], exports: [MeetingsService] })
export class MeetingsModule {}
