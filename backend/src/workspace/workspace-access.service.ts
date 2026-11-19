import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
export const workspaceClubFields =
  "club_id,name,summary,description,mission,logo_url,cover_url,contact_email,contact_phone,status";
@Injectable()
export class WorkspaceAccess {
  private readonly logger = new Logger(WorkspaceAccess.name);
  constructor(readonly supabase: SupabaseService) {}
  check(error: { code?: string } | null, operation = "workspace query") {
    if (!error) return;
    if (["23505", "23503", "23514", "P0001"].includes(error.code || ""))
      throw new ConflictException(
        "Dữ liệu đã thay đổi hoặc không thỏa điều kiện nghiệp vụ. Tải lại trước khi thử lại.",
      );
    this.logger.error(`${operation} failed (Supabase code ${error.code || "unknown"})`);
    throw new ServiceUnavailableException(
      "Không xử lý được dữ liệu CLB. Vui lòng thử lại.",
    );
  }
  async require(userId: string, clubId: string, chair = false) {
    const [membership, club] = await Promise.all([
      this.supabase.client
        .from("club_memberships")
        .select("membership_id,user_id,club_id,role,department_id")
        .eq("user_id", userId)
        .eq("club_id", clubId)
        .eq("status", "active")
        .maybeSingle(),
      this.supabase.client
        .from("clubs")
        .select(workspaceClubFields)
        .eq("club_id", clubId)
        .eq("status", "published")
        .maybeSingle(),
    ]);
    this.check(membership.error, "workspace membership lookup");
    this.check(club.error, "workspace club lookup");
    if (
      !membership.data ||
      !club.data ||
      (chair && membership.data.role !== "chairperson")
    )
      throw new ForbiddenException(
        "Bạn không có quyền thực hiện trong CLB này.",
      );
    return { membership: membership.data, club: club.data };
  }
}
