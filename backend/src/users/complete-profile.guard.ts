import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UsersService } from "./users.service";

export const requiredProfileFields = [
  "full_name",
  "student_code",
  "school_or_faculty",
  "major",
  "cohort",
] as const;
export const profileIsComplete = (profile: Record<string, unknown>) =>
  requiredProfileFields.every(
    (key) =>
      typeof profile[key] === "string" &&
      (profile[key] as string).trim().length > 0,
  );

@Injectable()
export class CompleteProfileGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}
  async canActivate(context: ExecutionContext) {
    const userId = context.switchToHttp().getRequest().user?.userId;
    if (!userId || !profileIsComplete(await this.users.getProfile(userId))) {
      throw new ForbiddenException({
        code: "PROFILE_INCOMPLETE",
        message: "Hoàn thiện hồ sơ sinh viên trước khi tiếp tục.",
      });
    }
    return true;
  }
}
