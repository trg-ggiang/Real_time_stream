import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceAccess } from "./workspace-access.service";
import { WorkspacePeople } from "./workspace-people.service";
import { WorkspaceContent } from "./workspace-content.service";
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceAccess, WorkspacePeople, WorkspaceContent],
})
export class WorkspaceModule {}
