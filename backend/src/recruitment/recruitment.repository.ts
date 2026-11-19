import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class RecruitmentRepository {
  constructor(private readonly supabase: SupabaseService) {}
  get db() { return this.supabase.client; }
  check(error: { code?: string; message?: string; details?: string } | null): void {
    if (!error) return;
    const codes: Record<string, string> = {
      WINDOW_CLOSED: "Đợt tuyển chưa mở hoặc đã hết hạn nhận đơn.",
      ALREADY_MEMBER: "Bạn đã là thành viên của CLB này.",
      FORM_CHANGED: "Biểu mẫu đã thay đổi. Vui lòng tải lại trước khi nộp.",
      FORM_INVALID: "Một số câu trả lời chưa hợp lệ. Vui lòng kiểm tra lại biểu mẫu.",
      APPLICATION_EXISTS: "Bạn đã nộp đơn cho đợt tuyển này.",
      ACK_REQUIRED: "Đã có đơn ứng tuyển. Hãy xác nhận trước khi tạo phiên bản biểu mẫu mới.",
      INVALID_FILE: "File đính kèm không hợp lệ hoặc đã hết thời gian chờ. Vui lòng tải lại file.",
      INVALID_STATE: "Trạng thái đã thay đổi. Vui lòng tải lại dữ liệu.",
    };
    const code = error.message && Object.hasOwn(codes, error.message) ? error.message : undefined;
    const message = code ? codes[code] : "Dữ liệu đã thay đổi hoặc chưa đáp ứng điều kiện. Vui lòng kiểm tra và thử lại.";
    if (error.code === "42501") throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này.");
    if (error.code === "P0002") throw new NotFoundException("Không tìm thấy nội dung yêu cầu.");
    if (error.code === "22023") throw new BadRequestException({ code: code || "INVALID_INPUT", message });
    if (["23505", "23503", "23514", "40001", "P0001", "40P01"].includes(error.code || "")) throw new ConflictException({ code: code || "DATA_CONFLICT", message });
    throw new ServiceUnavailableException("Tính năng tuyển thành viên tạm thời chưa sẵn sàng. Vui lòng thử lại.");
  }
  async rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await this.db.rpc(name, args);
    this.check(result.error);
    // PostgREST table/composite functions may return a one-row array;
    // the list RPC returns a scalar JSON object containing items/stats.
    const value = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : result.data;
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new ServiceUnavailableException("Phản hồi dữ liệu tuyển dụng chưa hợp lệ. Vui lòng tải lại trạng thái.");
    return value as T;
  }
  async chair(userId: string, clubId: string) {
    const r = await this.db.from("club_memberships").select("membership_id,clubs!inner(status)")
      .eq("user_id", userId).eq("club_id", clubId).eq("role", "chairperson").eq("status", "active").eq("clubs.status", "published").maybeSingle();
    this.check(r.error);
    if (!r.data) throw new ForbiddenException("Chỉ chủ nhiệm của CLB này được quản lý tuyển thành viên.");
  }
  async campaign(id: string, clubId?: string) {
    const q = this.db.from("recruitment_campaigns").select("*").eq("campaign_id", id);
    if (clubId) q.eq("club_id", clubId);
    const r = await q.maybeSingle(); this.check(r.error);
    if (!r.data) throw new NotFoundException("Không tìm thấy đợt tuyển.");
    return r.data;
  }
}
