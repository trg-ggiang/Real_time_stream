import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ImagesController, ImagesService } from './images.controller';

@Module({ imports: [AuthModule, UsersModule], controllers: [ImagesController], providers: [ImagesService] })
export class MediaModule {}
