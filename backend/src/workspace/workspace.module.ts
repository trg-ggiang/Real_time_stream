import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceAccess } from "./workspace-access.service";
import { WorkspacePeople } from "./workspace-people.service";
import { WorkspaceContent } from "./workspace-content.service";
import { WorkspaceChannels } from './workspace-channels.service';
import { WorkspaceChannelsController } from './workspace-channels.controller';
import { JwtModule } from '@nestjs/jwt';
import { WorkspaceChannelEvents } from './workspace-channel-events';
import { WorkspaceChannelGateway } from './workspace-channel.gateway';
import { MeetingsModule } from '../meetings/meetings.module';
import { WorkspaceAttention } from './workspace-attention.service';
@Module({
  imports: [AuthModule, UsersModule, MeetingsModule, JwtModule.register({})],
  controllers: [WorkspaceController, WorkspaceChannelsController],
  providers: [WorkspaceAccess, WorkspacePeople, WorkspaceContent, WorkspaceChannels, WorkspaceAttention, WorkspaceChannelEvents, WorkspaceChannelGateway],
})
export class WorkspaceModule {}
