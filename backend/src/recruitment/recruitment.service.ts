import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { RecruitmentRepository } from "./recruitment.repository";
import {
  ApplicationPage, BulkDecisionDto, CampaignDto, DecisionDto, RecruitmentPage,
  RecruitingDepartmentDto, SaveFormDto, SubmitApplicationDto,
} from "./recruitment.dto";
import { publicApplicationStatus, validateAnswers, validateForm } from "./recruitment-validation";

const publicFields = "campaign_id,club_id,club_name,club_logo_url,title,description,cover_url,application_opens_at,application_closes_at,status,created_at,updated_at,summary,benefits,contact_email,contact_phone,published_at,effective_status,accepting_applications";
const questionFields = "question_id,field_id,form_version_id,question_text,help_text,question_type,is_required,options,validation,profile_field,sort_order";
export const applicationItem = (item: Record<string, any>) => ({ ...item, display_status: publicApplicationStatus(item.status) });

@Injectable()
export class RecruitmentService {
  constructor(readonly repo: RecruitmentRepository, private readonly users: UsersService) {}
  private page(items: unknown[], total: number | null, page: number, limit: number) {
    return { items, total: total ?? 0, page, limit, hasMore: page * limit < (total ?? 0) };
  }
  async publicList(q: RecruitmentPage) {
    const query = this.repo.db.from("public_recruitment_campaigns").select(publicFields, { count: "exact" });
    if (q.club_id) query.eq("club_id", q.club_id);
    if (q.status !== "all") query.eq("status", q.status);
    const search = q.q?.trim().replace(/[%_\\]/g, " ");
    if (search) query.ilike("title", `%${search}%`);
    const r = await query.order("created_at", { ascending: false }).order("campaign_id").range((q.page - 1) * q.limit, q.page * q.limit - 1);
    this.repo.check(r.error);
    return this.page(r.data || [], r.count, q.page, q.limit);
  }
  async publicDetail(id: string) {
    const r = await this.repo.db.from("public_recruitment_campaigns").select(publicFields).eq("campaign_id", id).maybeSingle();
    this.repo.check(r.error);
    if (!r.data) throw new NotFoundException("Đợt tuyển chưa được công khai hoặc không còn tồn tại.");
    const departments = await this.repo.db.from("public_recruitment_departments").select("*").eq("campaign_id", id).order("department_name");
    this.repo.check(departments.error);
    const configured = await this.repo.db.from("recruitment_departments").select("recruitment_department_id,current_form_version_id").eq("campaign_id", id);
    this.repo.check(configured.error);
    const forms = await Promise.all((departments.data || []).map(async (d: any) => {
      const current = configured.data?.find((x: any) => x.recruitment_department_id === d.recruitment_department_id);
      return { ...d, form_version_id: current?.current_form_version_id, questions: current?.current_form_version_id ? await this.questions(current.current_form_version_id) : [] };
    }));
    return { item: r.data, departments: forms };
  }
  async questions(versionId: string) {
    const r = await this.repo.db.from("recruitment_questions").select(questionFields).eq("form_version_id", versionId).order("sort_order");
    this.repo.check(r.error); return r.data || [];
  }
  async managedList(actor: string, club: string, q: RecruitmentPage) {
    await this.repo.chair(actor, club);
    const query = this.repo.db.from("recruitment_campaigns").select("*", { count: "exact" }).eq("club_id", club).is("deleted_at", null);
    if (q.status !== "all") query.eq("status", q.status);
    if (q.q?.trim()) query.ilike("title", `%${q.q.trim().replace(/[%_\\]/g, " ")}%`);
    const r = await query.order("created_at", { ascending: false }).order("campaign_id").range((q.page - 1) * q.limit, q.page * q.limit - 1);
    this.repo.check(r.error); return this.page(r.data || [], r.count, q.page, q.limit);
  }
  async managedDetail(actor: string, club: string, id: string) {
    await this.repo.chair(actor, club);
    const item = await this.repo.campaign(id, club);
    const [r, applications] = await Promise.all([
      this.repo.db.from("recruitment_departments").select("*,club_departments(name)").eq("campaign_id", id).order("created_at").order("recruitment_department_id"),
      this.repo.db.from("recruitment_applications").select("application_id", { count: "exact", head: true }).eq("campaign_id", id).not("submitted_at", "is", null),
    ]);
    this.repo.check(r.error); this.repo.check(applications.error);
    const departments = await Promise.all((r.data || []).map(async d => ({ ...d, questions: d.current_form_version_id ? await this.questions(d.current_form_version_id) : [] })));
    return { item, departments, application_count: applications.count ?? 0 };
  }
  async saveCampaign(actor: string, club: string, input: CampaignDto, id?: string) {
    if (Date.parse(input.application_closes_at) <= Date.parse(input.application_opens_at)) throw new BadRequestException("Ngày đóng đơn phải sau ngày mở đơn.");
    if (!input.title.trim() || input.description.trim().length < 10) throw new BadRequestException("Vui lòng nhập đầy đủ tiêu đề và mô tả đợt tuyển.");
    if (id && !input.expected_updated_at) throw new BadRequestException("Thiếu phiên bản dữ liệu. Vui lòng tải lại.");
    const { expected_updated_at, ...values } = input;
    const item = await this.repo.rpc("recruitment_save_campaign", { p_actor: actor, p_club: club, p_campaign: id || null, p_expected: expected_updated_at || null, p_input: values });
    return { item };
  }
  async campaignAction(actor: string, club: string, id: string, version: string, action: "open" | "close" | "archive") {
    const item = await this.repo.rpc("recruitment_campaign_action", { p_actor: actor, p_club: club, p_campaign: id, p_expected: version, p_action: action });
    return { item };
  }
  async addDepartment(actor: string, club: string, id: string, input: RecruitingDepartmentDto) {
    const { expected_updated_at, ...values } = input;
    const item = await this.repo.rpc("recruitment_add_department", { p_actor: actor, p_club: club, p_campaign: id, p_expected: expected_updated_at, p_input: values });
    return { item, campaign: await this.repo.campaign(id, club) };
  }
  async saveForm(actor: string, club: string, id: string, department: string, input: SaveFormDto) {
    validateForm(input.questions);
    const version = await this.repo.rpc("recruitment_save_form", { p_actor: actor, p_club: club, p_campaign: id, p_department: department,
      p_expected: input.expected_updated_at, p_questions: input.questions, p_ack: input.acknowledge_existing_applications });
    return { version, questions: await this.questions(version.form_version_id), campaign: await this.repo.campaign(id, club) };
  }
  async applicationContext(actor: string, id: string) {
    const campaign = await this.publicDetail(id);
    const [profile, user, application, membership] = await Promise.all([
      this.users.getProfile(actor), this.users.findById(actor),
      this.repo.db.from("recruitment_applications").select("application_id,status,updated_at").eq("campaign_id", id).eq("applicant_id", actor).maybeSingle(),
      this.repo.db.from("club_memberships").select("membership_id").eq("club_id", campaign.item.club_id).eq("user_id", actor).eq("status", "active").maybeSingle(),
    ]);
    this.repo.check(application.error); this.repo.check(membership.error);
    const submitted = application.data && application.data.status !== "draft";
    return { ...campaign, profile: { ...profile, email: user?.email }, application: submitted ? applicationItem(application.data!) : null,
      can_apply: campaign.item.accepting_applications && !submitted && !membership.data,
      unavailable_reason: submitted ? "APPLICATION_EXISTS" : membership.data ? "ALREADY_MEMBER" : campaign.item.accepting_applications ? null : "WINDOW_CLOSED" };
  }
  async submit(actor: string, id: string, input: SubmitApplicationDto) {
    const dept = await this.repo.db.from("recruitment_departments").select("current_form_version_id").eq("campaign_id", id).eq("recruitment_department_id", input.recruitment_department_id).maybeSingle();
    this.repo.check(dept.error);
    if (dept.data?.current_form_version_id !== input.form_version_id) this.repo.check({ code: "40001", message: "FORM_CHANGED" });
    validateAnswers(await this.questions(input.form_version_id) as any, input.answers);
    const item = await this.repo.rpc("recruitment_submit_application", { p_actor: actor, p_campaign: id, p_department: input.recruitment_department_id,
      p_version: input.form_version_id, p_answers: input.answers.map(a => ({ question_id: a.question_id, value: a.value ?? null })) });
    return { item: applicationItem(item) };
  }
  async mine(actor: string, q: ApplicationPage) {
    const query = this.repo.db.from("recruitment_applications").select("*,recruitment_campaigns(title,club_id,cover_url)", { count: "exact" })
      .eq("applicant_id", actor).not("submitted_at", "is", null).neq("status", "withdrawn");
    if (q.status === "pending") query.in("status", ["submitted", "interviewing"]);
    else if (q.status !== "all") query.eq("status", q.status === "approved" ? "accepted" : q.status);
    const r = await query.order("submitted_at", { ascending: q.sort === "oldest" }).order("application_id").range((q.page - 1) * q.limit, q.page * q.limit - 1);
    this.repo.check(r.error); return this.page((r.data || []).map(applicationItem), r.count, q.page, q.limit);
  }
  async applicationDetail(actor: string, id: string, scope?: { club: string; campaign: string }) {
    const query = this.repo.db.from("recruitment_applications").select("*").eq("application_id", id);
    if (!scope) query.eq("applicant_id", actor);
    else { await this.repo.chair(actor, scope.club); await this.repo.campaign(scope.campaign, scope.club); query.eq("campaign_id", scope.campaign); }
    const r = await query.maybeSingle(); this.repo.check(r.error);
    if (!r.data) throw new NotFoundException("Không tìm thấy đơn ứng tuyển của bạn hoặc bạn không có quyền xem.");
    const [questions, answers, files, department, campaign] = await Promise.all([
      this.questions(r.data.form_version_id),
      this.repo.db.from("application_answers").select("question_id,answer_value").eq("application_id", id),
      this.repo.db.from("recruitment_files").select("file_id,question_id,file_name,mime_type,size_bytes").eq("application_id", id).eq("state", "attached"),
      this.repo.db.from("recruitment_departments").select("club_departments(name)").eq("recruitment_department_id", r.data.recruitment_department_id).maybeSingle(),
      this.repo.campaign(r.data.campaign_id),
    ]);
    this.repo.check(answers.error); this.repo.check(files.error); this.repo.check(department.error);
    const names = department.data?.club_departments as { name: string } | { name: string }[] | null;
    return { item: applicationItem({ ...r.data, department_name: Array.isArray(names) ? names[0]?.name : names?.name, recruitment_campaigns: { title: campaign.title, club_id: campaign.club_id } }), questions, answers: answers.data || [], files: files.data || [] };
  }
  async applications(actor: string, club: string, campaign: string, q: ApplicationPage) {
    return this.repo.rpc("recruitment_list_applications", { p_actor: actor, p_club: club, p_campaign: campaign, p_page: q.page,
      p_limit: q.limit, p_search: q.q?.trim() || "", p_status: q.status, p_sort: q.sort });
  }
  async decide(actor: string, club: string, campaign: string, id: string, input: DecisionDto) {
    const item = await this.repo.rpc("recruitment_decide_application", { p_actor: actor, p_club: club, p_campaign: campaign, p_application: id,
      p_expected: input.expected_updated_at, p_decision: input.decision, p_reason: input.reason?.trim() || null, p_department: input.department_id || null });
    return { item: applicationItem(item) };
  }
  async bulkDecision(actor: string, club: string, campaign: string, input: BulkDecisionDto) {
    await this.repo.chair(actor, club); await this.repo.campaign(campaign, club);
    if (new Set(input.applications.map(a => a.application_id)).size !== input.applications.length) throw new BadRequestException("Danh sách có đơn bị chọn trùng.");
    const items = [];
    for (const a of input.applications) {
      try { items.push({ application_id: a.application_id, ok: true, ...(await this.decide(actor, club, campaign, a.application_id, { ...input, expected_updated_at: a.expected_updated_at })) }); }
      catch (error) {
        if (error instanceof ForbiddenException) throw error;
        items.push({ application_id: a.application_id, ok: false, message: error instanceof Error ? error.message : "Chưa xử lý được đơn." });
      }
    }
    return { items };
  }
  async exportCsv(actor: string, club: string, campaign: string, q: ApplicationPage) {
    const rows: any[] = [];
    for (let page = 1; ; page++) {
      const result = await this.applications(actor, club, campaign, { ...q, page, limit: 100 });
      rows.push(...result.items);
      if (!result.hasMore) break;
      if (page === 100) throw new BadRequestException("Danh sách quá lớn. Vui lòng lọc để xuất tối đa 10.000 đơn.");
    }
    const cell = (value: unknown) => { const s = String(value ?? ""); return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"'; };
    const values = [["Mã đơn", "Họ tên", "MSSV", "Email", "Trạng thái", "Ngày nộp", "Kết quả"],
      ...rows.map(a => [a.application_id, a.profile_snapshot?.full_name, a.profile_snapshot?.student_code, a.profile_snapshot?.email,
        ({ pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối" } as any)[a.display_status], a.submitted_at, a.result_message])];
    return "\uFEFF" + values.map(row => row.map(cell).join(",")).join("\r\n");
  }
}
