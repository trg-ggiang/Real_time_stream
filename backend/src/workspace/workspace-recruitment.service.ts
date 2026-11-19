import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { WorkspaceAccess } from "./workspace-access.service";
import { PublishRecruitmentDto, RecruitmentApplicationReviewDto } from "./recruitment.dto";

const fields = "campaign_id,club_id,title,description,cover_url,application_opens_at,application_closes_at,status,created_by,updated_at";
const departmentFields = "recruitment_department_id,department_id,description,requirements,target_quantity,club_departments(name),recruitment_questions(question_id,question_text,help_text,is_required,max_length,sort_order)";
const bucket = "recruitment-covers";

@Injectable()
export class WorkspaceRecruitment {
  constructor(private readonly access: WorkspaceAccess) {}
  private get db() { return this.access.supabase.client; }

  async list(userId: string, clubId: string, list: string, page: number, limit: number) {
    if (list === "review") return this.applicationQueue(userId, clubId, page, limit);
    await this.access.require(userId, clubId);
    const query = this.db.from("recruitment_campaigns").select(fields, { count: "exact" }).eq("club_id", clubId);
    // Incomplete saves remain private drafts and never appear in the activity feed.
    if (list === "mine") query.eq("created_by", userId);
    else query.in("status", ["open", "closed", "completed"]);
    const result = await query.order("updated_at", { ascending: false }).order("campaign_id").range((page - 1) * limit, page * limit - 1);
    this.access.check(result.error);
    return { items: result.data ?? [], total: result.count ?? 0, hasMore: page * limit < (result.count ?? 0) };
  }

  private async campaign(clubId: string, id: string) {
    const result = await this.db.from("recruitment_campaigns").select(fields).eq("club_id", clubId).eq("campaign_id", id).maybeSingle();
    this.access.check(result.error);
    return result.data;
  }
  async detail(userId: string, clubId: string, id: string) {
    const ctx = await this.access.require(userId, clubId);
    const item = await this.campaign(clubId, id);
    if (!item || (item.status === "draft" && item.created_by !== userId && ctx.membership.role !== "chairperson"))
      throw new NotFoundException("Không tìm thấy đợt tuyển trong CLB này.");
    const departments = await this.db.from("recruitment_departments").select(departmentFields).eq("campaign_id", id).order("recruitment_department_id");
    this.access.check(departments.error);
    return { item: { ...item, departments: departments.data ?? [] } };
  }

  private async headReviewScope(userId: string, clubId: string) {
    const ctx = await this.access.require(userId, clubId);
    if (ctx.membership.role !== "head") throw new ForbiddenException("Chỉ trưởng ban được xem và xét duyệt đơn ứng tuyển.");
    const campaigns = await this.db.from("recruitment_campaigns").select("campaign_id,title").eq("club_id", clubId);
    this.access.check(campaigns.error);
    if (!campaigns.data?.length) return { membership: ctx.membership, departments: [], campaigns: [] };
    const departments = await this.db.from("recruitment_departments")
      .select("recruitment_department_id,campaign_id,department_id,club_departments(name),recruitment_questions(question_id,question_text)")
      .eq("department_id", ctx.membership.department_id)
      .in("campaign_id", campaigns.data.map(row => row.campaign_id));
    this.access.check(departments.error);
    return { membership: ctx.membership, departments: departments.data ?? [], campaigns: campaigns.data };
  }

  async applicationQueue(userId: string, clubId: string, page: number, limit: number) {
    const scope = await this.headReviewScope(userId, clubId);
    const ids = scope.departments.map(row => row.recruitment_department_id);
    if (!ids.length) return { items: [], total: 0, hasMore: false, page, limit };
    const result = await this.db.from("recruitment_applications")
      .select("application_id,campaign_id,recruitment_department_id,applicant_id,status,submitted_at,profile_snapshot,result_message", { count: "exact" })
      .in("recruitment_department_id", ids)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    this.access.check(result.error);
    const deptById = new Map(scope.departments.map(row => [row.recruitment_department_id, row]));
    const campaignById = new Map(scope.campaigns.map(row => [row.campaign_id, row]));
    const applicationIds = (result.data ?? []).map(row => row.application_id);
    const reviews = applicationIds.length
      ? await this.db.from("application_reviews").select("application_id,score,recommendation,internal_note,created_at")
        .in("application_id", applicationIds).eq("stage", "application").order("created_at", { ascending: false })
      : { data: [], error: null };
    this.access.check(reviews.error);
    const reviewByApplication = new Map<string, { application_id: string; score: number | null; recommendation: string; internal_note: string; created_at: string }>();
    for (const review of reviews.data ?? []) if (!reviewByApplication.has(review.application_id)) reviewByApplication.set(review.application_id, review);
    const items = (result.data ?? []).map(row => ({
      ...row,
      full_name: row.profile_snapshot?.full_name ?? "Ứng viên",
      student_code: row.profile_snapshot?.student_code ?? "",
      score: reviewByApplication.get(row.application_id)?.score ?? null,
      internal_note: reviewByApplication.get(row.application_id)?.internal_note ?? null,
      feedback: row.result_message ?? null,
      department_name: deptById.get(row.recruitment_department_id)?.club_departments?.[0]?.name ?? "Ban",
      campaign_title: campaignById.get(row.campaign_id)?.title ?? "Đợt tuyển",
    }));
    const total = result.count ?? 0;
    return { items, total, hasMore: page * limit < total, page, limit };
  }

  async applicationReviewDetail(userId: string, clubId: string, applicationId: string) {
    const scope = await this.headReviewScope(userId, clubId);
    const ids = scope.departments.map(row => row.recruitment_department_id);
    if (!ids.length) throw new NotFoundException("Không tìm thấy đơn ứng tuyển trong ban của bạn.");
    const result = await this.db.from("recruitment_applications")
      .select("application_id,campaign_id,recruitment_department_id,applicant_id,status,submitted_at,profile_snapshot,result_message")
      .eq("application_id", applicationId).in("recruitment_department_id", ids).maybeSingle();
    this.access.check(result.error);
    const application = result.data;
    if (!application) throw new NotFoundException("Không tìm thấy đơn ứng tuyển trong ban của bạn.");
    const department = scope.departments.find(row => row.recruitment_department_id === application.recruitment_department_id);
    const campaign = scope.campaigns.find(row => row.campaign_id === application.campaign_id);
    if (!department || !campaign) throw new NotFoundException("Không tìm thấy thông tin đợt tuyển.");
    const [answersResult, reviewResult] = await Promise.all([
      this.db.from("application_answers").select("question_id,answer_text").eq("application_id", applicationId),
      this.db.from("application_reviews").select("score,recommendation,internal_note,created_at")
        .eq("application_id", applicationId).eq("stage", "application").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    this.access.check(answersResult.error);
    this.access.check(reviewResult.error);
    const answers = Object.fromEntries((answersResult.data ?? []).map(row => [row.question_id, row.answer_text]));
    return { item: {
      ...application,
      full_name: application.profile_snapshot?.full_name ?? "Ứng viên",
      student_code: application.profile_snapshot?.student_code ?? "",
      portfolio_url: application.profile_snapshot?.portfolio_url ?? null,
      answers,
      score: reviewResult.data?.score ?? null,
      internal_note: reviewResult.data?.internal_note ?? null,
      feedback: application.result_message ?? null,
      campaign_title: campaign.title,
      department_name: department.club_departments?.[0]?.name ?? "Ban",
      questions: department.recruitment_questions ?? [],
    } };
  }

  async reviewApplication(userId: string, clubId: string, applicationId: string, input: RecruitmentApplicationReviewDto) {
    const { item } = await this.applicationReviewDetail(userId, clubId, applicationId);
    if (["accepted", "rejected", "withdrawn"].includes(item.status))
      throw new ConflictException("Đơn đã có kết quả cuối cùng và không thể sửa đánh giá.");
    const currentReview = await this.db.from("application_reviews").select("review_id")
      .eq("application_id", applicationId).eq("stage", "application").eq("reviewer_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    this.access.check(currentReview.error);
    const recommendation = input.status === "interviewing" ? "pass" : input.status === "rejected" ? "fail" : "undecided";
    const reviewData = {
      score: input.score ?? null,
      recommendation,
      internal_note: input.internal_note?.trim() || "Chưa có ghi chú nội bộ.",
      updated_at: new Date().toISOString(),
    };
    const review = currentReview.data
      ? await this.db.from("application_reviews").update(reviewData).eq("review_id", currentReview.data.review_id).select("review_id,recommendation,score,internal_note").single()
      : await this.db.from("application_reviews").insert({ ...reviewData, application_id: applicationId, reviewer_id: userId, stage: "application" }).select("review_id,recommendation,score,internal_note").single();
    this.access.check(review.error);
    if (!review.data) throw new ConflictException("Chưa lưu được đánh giá. Vui lòng tải lại hồ sơ.");
    const updatedAt = new Date().toISOString();
    const updated = await this.db.from("recruitment_applications").update({
      status: input.status,
      decided_by: ["accepted", "rejected"].includes(input.status) ? userId : null,
      decided_at: ["accepted", "rejected"].includes(input.status) ? updatedAt : null,
      result_message: input.feedback?.trim() || null,
      updated_by: userId,
      updated_at: updatedAt,
    }).eq("application_id", applicationId).in("status", ["submitted", "interviewing"])
      .select("application_id,status,result_message,decided_at").maybeSingle();
    this.access.check(updated.error);
    if (!updated.data) throw new ConflictException("Đơn đã được xử lý hoặc thay đổi. Tải lại danh sách trước khi tiếp tục.");
    return { application: { ...updated.data, score: review.data.score, internal_note: review.data.internal_note, recommendation: review.data.recommendation } };
  }

  async cover(userId: string, clubId: string, file?: { buffer: Buffer; mimetype: string; size: number }) {
    await this.access.require(userId, clubId, true);
    if (!file || !file.size || file.size > 10 * 1024 * 1024)
      throw new BadRequestException("Chọn ảnh PNG hoặc JPG có dung lượng tối đa 10 MB.");
    const png = file.mimetype === "image/png" && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = file.mimetype === "image/jpeg" && file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
    if (!png && !jpeg) throw new BadRequestException("Tệp ảnh PNG hoặc JPG không hợp lệ.");
    const storage = this.db.storage;
    const current = await storage.getBucket(bucket);
    if (current.error) {
      if (String(current.error.statusCode) !== "404") this.access.check({ code: "storage_lookup" });
      const created = await storage.createBucket(bucket, { public: true, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/png", "image/jpeg"] });
      if (created.error && !["409", "400"].includes(String(created.error.statusCode))) this.access.check({ code: "storage_setup" });
      const verified = await storage.getBucket(bucket);
      if (verified.error || !verified.data?.public) this.access.check({ code: "storage_setup" });
    } else if (!current.data?.public) this.access.check({ code: "storage_visibility" });
    const path = `${clubId}/${userId}/${createHash("sha256").update(file.buffer).digest("hex")}.${png ? "png" : "jpg"}`;
    const uploaded = await storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploaded.error && !["409", "Duplicate"].includes(String(uploaded.error.statusCode))) {
      // A repeated upload uses the same content hash. Verify an existing object
      // rather than assuming any generic 400 response means success.
      const existing = await storage.from(bucket).info(path);
      if (existing.error) this.access.check({ code: "storage_upload" });
    }
    return { cover_url: storage.from(bucket).getPublicUrl(path).data.publicUrl };
  }

  async publish(userId: string, clubId: string, input: PublishRecruitmentDto) {
    await this.access.require(userId, clubId, true);
    const payload = {
      title: input.title.trim(), description: input.description.trim(), cover_url: input.cover_url || null,
      application_opens_at: new Date(input.application_opens_at).toISOString(),
      application_closes_at: new Date(input.application_closes_at).toISOString(),
    };
    const departments = input.departments.map(d => ({ ...d, description: d.description.trim(), requirements: d.requirements.trim(),
      questions: d.questions.map(q => ({ ...q, question_text: q.question_text.trim(), help_text: q.help_text?.trim() || null })) }));
    if (payload.title.length < 2 || payload.description.length < 10 ||
      Date.parse(payload.application_closes_at) <= Date.parse(payload.application_opens_at) ||
      departments.some(d => !d.description || !d.requirements || d.questions.some(q => !q.question_text)))
      throw new BadRequestException("Điền đủ thông tin và chọn ngày đóng đơn sau ngày mở đơn.");
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!unique(departments.map(d => d.department_id)) || !unique(departments.map(d => d.recruitment_department_id)) ||
      !unique(departments.flatMap(d => d.questions.map(q => q.question_id))))
      throw new BadRequestException("Ban hoặc câu hỏi bị trùng mã.");
    const active = await this.db.from("club_departments").select("department_id,is_management").eq("club_id", clubId).eq("status", "active").in("department_id", departments.map(d => d.department_id));
    this.access.check(active.error);
    if (active.data?.some(d => d.is_management)) throw new BadRequestException("Ban quản lý không được mở tuyển thành viên. Bỏ chọn ban quản lý rồi đăng lại.");
    if (active.data?.length !== departments.length) throw new BadRequestException("Ban tuyển phải đang hoạt động và thuộc CLB này.");
    const conflict = () => new ConflictException("Đã có bản lưu khác với biểu mẫu này. Mở Của tôi trong Hoạt động CLB để kiểm tra trước khi đăng lại.");
    const assertPayload = (row: Record<string, unknown>) => {
      if (row.created_by !== userId || Object.entries(payload).some(([key, value]) => key.endsWith("_at")
        ? Date.parse(String(row[key])) !== Date.parse(String(value)) : (row[key] ?? null) !== value)) throw conflict();
    };
    let old = await this.campaign(clubId, input.campaign_id);
    if (!old) {
      const saved = await this.db.from("recruitment_campaigns").upsert({ ...payload, campaign_id: input.campaign_id, club_id: clubId, status: "draft", created_by: userId, updated_by: userId }, { onConflict: "campaign_id", ignoreDuplicates: true });
      this.access.check(saved.error);
      old = await this.campaign(clubId, input.campaign_id);
    }
    if (!old) throw conflict();
    assertPayload(old);
    if (!["draft", "open"].includes(old.status)) throw conflict();
    // Rows are insert-only, keyed by IDs retained by the browser across retries.
    // Failure at any stage leaves an unpublished draft; no partial public form.
    if (old.status === "draft") {
      const rows = departments.map(({ questions, ...d }) => ({ ...d, campaign_id: input.campaign_id, created_by: userId, updated_by: userId }));
      const saved = await this.db.from("recruitment_departments").upsert(rows, { onConflict: "recruitment_department_id", ignoreDuplicates: true });
      this.access.check(saved.error);
      const scope = await this.db.from("recruitment_departments").select("recruitment_department_id,department_id").eq("campaign_id", input.campaign_id);
      this.access.check(scope.error);
      if (departments.some(d => !scope.data?.some(row => row.recruitment_department_id === d.recruitment_department_id && row.department_id === d.department_id))) throw conflict();
      const questions = departments.flatMap(d => d.questions.map((q, index) => ({ ...q, recruitment_department_id: d.recruitment_department_id, sort_order: index + 1, created_by: userId, updated_by: userId })));
      if (questions.length) {
        const savedQuestions = await this.db.from("recruitment_questions").upsert(questions, { onConflict: "question_id", ignoreDuplicates: true });
        this.access.check(savedQuestions.error);
      }
    }
    const stored = await this.detail(userId, clubId, input.campaign_id);
    if (stored.item.departments.length !== departments.length) throw conflict();
    for (const expected of departments) {
      const actual = stored.item.departments.find(d => d.recruitment_department_id === expected.recruitment_department_id);
      if (!actual || ["department_id", "description", "requirements", "target_quantity"].some(k => (actual as Record<string, unknown>)[k] !== (expected as unknown as Record<string, unknown>)[k]) ||
        actual.recruitment_questions.length !== expected.questions.length || expected.questions.some((q, index) => {
          const found = actual.recruitment_questions.find(item => item.question_id === q.question_id);
          return !found || found.sort_order !== index + 1 || Object.entries(q).some(([k, v]) => (found as Record<string, unknown>)[k] !== v);
        })) throw conflict();
    }
    if (old.status === "open") return stored;
    await this.access.require(userId, clubId, true);
    const published = await this.db.from("recruitment_campaigns").update({ status: "open", updated_by: userId })
      .eq("club_id", clubId).eq("campaign_id", input.campaign_id).eq("created_by", userId).eq("status", "draft").eq("updated_at", stored.item.updated_at).select(fields).maybeSingle();
    this.access.check(published.error);
    if (!published.data) {
      const latest = await this.campaign(clubId, input.campaign_id);
      if (!latest || latest.status !== "open") throw conflict();
      assertPayload(latest);
    }
    return this.detail(userId, clubId, input.campaign_id);
  }
}
