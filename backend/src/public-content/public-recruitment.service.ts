import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { UsersService } from "../users/users.service";
import { SubmitRecruitmentApplicationDto } from "./recruitment-application.dto";

const campaignFields = "campaign_id,club_id,title,description,cover_url,application_opens_at,application_closes_at,status";
const departmentFields = "recruitment_department_id,department_id,description,requirements,target_quantity,club_departments(name),recruitment_questions(question_id,question_text,help_text,is_required,max_length,sort_order)";

@Injectable()
export class PublicRecruitmentService {
  private readonly logger = new Logger(PublicRecruitmentService.name);
  constructor(private readonly supabase: SupabaseService, private readonly users: UsersService) {}
  private get db() { return this.supabase.client; }

  async list(page: number, limit: number) {
    const result = await this.db.from("recruitment_campaigns")
      .select("campaign_id,club_id,title,description,cover_url,application_opens_at,application_closes_at", { count: "exact" })
      .eq("status", "open").order("updated_at", { ascending: false }).order("campaign_id")
      .range((page - 1) * limit, page * limit - 1);
    if (result.error) throw new ServiceUnavailableException("Chưa tải được các đợt tuyển. Vui lòng thử lại.");
    const clubIds = [...new Set((result.data ?? []).map(row => row.club_id))];
    const clubs = clubIds.length
      ? await this.db.from("clubs").select("club_id,name,logo_url").eq("status", "published").in("club_id", clubIds)
      : { data: [], error: null };
    if (clubs.error) throw new ServiceUnavailableException("Chưa tải được thông tin câu lạc bộ.");
    const clubById = new Map((clubs.data ?? []).map(club => [club.club_id, club]));
    const items = (result.data ?? []).flatMap(row => {
      const club = clubById.get(row.club_id);
      return club ? [{ ...row, club_name: club.name, club_logo_url: club.logo_url ?? null }] : [];
    });
    return { items, page, limit, total: result.count ?? 0, hasMore: page * limit < (result.count ?? 0) };
  }

  async detail(campaignId: string) {
    const campaign = await this.db.from("recruitment_campaigns").select(campaignFields)
      .eq("campaign_id", campaignId).in("status", ["open", "closed", "completed"]).maybeSingle();
    if (campaign.error) throw new ServiceUnavailableException("Chưa tải được đợt tuyển. Vui lòng thử lại.");
    if (!campaign.data) throw new NotFoundException("Đợt tuyển không tồn tại hoặc chưa được công khai.");
    const [club, departments] = await Promise.all([
      this.db.from("clubs").select("club_id,name,logo_url").eq("club_id", campaign.data.club_id).eq("status", "published").maybeSingle(),
      this.db.from("recruitment_departments").select(departmentFields).eq("campaign_id", campaignId).order("recruitment_department_id"),
    ]);
    if (club.error || departments.error) throw new ServiceUnavailableException("Chưa tải được thông tin đợt tuyển. Vui lòng thử lại.");
    if (!club.data) throw new NotFoundException("Câu lạc bộ chưa được công khai.");
    return { item: { ...campaign.data, club_name: club.data.name, club_logo_url: club.data.logo_url ?? null,
      departments: departments.data ?? [] } };
  }

  async apply(userId: string, campaignId: string, input: SubmitRecruitmentApplicationDto) {
    const { item } = await this.detail(campaignId);
    const now = Date.now();
    if (item.status !== "open" || now < Date.parse(item.application_opens_at) || now >= Date.parse(item.application_closes_at))
      throw new ConflictException("Đợt tuyển hiện không nhận đơn.");
    const profile = await this.users.getProfile(userId);
    if (![profile.full_name, profile.student_code, profile.school_or_faculty, profile.major, profile.cohort]
      .every(value => typeof value === "string" && value.trim()))
      throw new BadRequestException("Hãy hoàn thiện họ tên, mã sinh viên, trường/khoa, ngành và khóa trong hồ sơ trước khi nộp đơn.");
    const department = item.departments.find(row => row.recruitment_department_id === input.recruitment_department_id);
    if (!department) throw new BadRequestException("Chọn một ban đang tuyển trong đợt này.");
    const questions = [...(department.recruitment_questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const known = new Set(questions.map(question => question.question_id));
    const answerKeys = Object.keys(input.answers ?? {});
    if (answerKeys.some(key => !known.has(key))) throw new BadRequestException("Biểu mẫu đã thay đổi. Tải lại trước khi nộp.");
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const value = input.answers[question.question_id];
      if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
        if (question.is_required) throw new BadRequestException(`Vui lòng trả lời: ${question.question_text}`);
        continue;
      }
      if (typeof value !== "string" || value.trim().length > question.max_length)
        throw new BadRequestException(`Câu trả lời không hợp lệ: ${question.question_text}`);
      answers[question.question_id] = value.trim();
    }
    const application = await this.db.from("recruitment_applications").insert({
      campaign_id: campaignId,
      recruitment_department_id: department.recruitment_department_id,
      applicant_id: userId,
      profile_snapshot: null,
      status: "draft",
      submitted_at: null,
      decided_by: null,
      decided_at: null,
      admitted_membership_id: null,
      withdrawn_at: null,
      result_message: null,
      updated_by: userId,
    }).select("application_id").single();
    if (application.error?.code === "23505") throw new ConflictException("Bạn đã nộp đơn vào ban này trong đợt tuyển.");
    this.throwApplicationWriteError(application.error, "create-empty-draft");
    if (!application.data) throw new ServiceUnavailableException("Chưa tạo được hồ sơ ứng tuyển. Vui lòng thử lại.");
    const submittedAt = new Date().toISOString();
    const answerRows = Object.entries(answers).map(([questionId, answerText]) => ({
      application_id: application.data.application_id,
      question_id: questionId,
      answer_text: answerText,
      updated_by: userId,
    }));
    if (answerRows.length) {
      const answerResult = await this.db.from("application_answers").insert(answerRows);
      this.throwApplicationWriteError(answerResult.error, "save-answers");
    }
    const submitted = await this.db.from("recruitment_applications").update({
      status: "submitted",
      submitted_at: submittedAt,
      updated_by: userId,
      updated_at: submittedAt,
    }).eq("application_id", application.data.application_id).eq("applicant_id", userId).eq("status", "draft")
      .select("application_id,status,submitted_at").single();
    this.throwApplicationWriteError(submitted.error, "submit-draft");
    if (!submitted.data) throw new ServiceUnavailableException("Chưa xác nhận được đơn ứng tuyển. Hãy kiểm tra danh sách đơn trước khi gửi lại.");
    return { application: submitted.data };
  }

  private throwApplicationWriteError(error: { code?: string; message?: string } | null, stage: string) {
    if (!error) return;
    this.logger.error(`Recruitment application ${stage} failed (Supabase code ${error.code || "unknown"}): ${error.message || "unknown error"}`);
    if (["42P01", "PGRST205"].includes(error.code || ""))
      throw new ServiceUnavailableException("Thiếu bảng nhận đơn trong cơ sở dữ liệu. Vui lòng báo quản trị viên.");
    if (error.code === "PGRST204")
      throw new ServiceUnavailableException("Cột lưu đơn chưa khớp với schema database. Vui lòng báo quản trị viên kiểm tra cấu trúc bảng.");
    throw new ServiceUnavailableException("Chưa gửi được đơn ứng tuyển. Vui lòng thử lại.");
  }
}
