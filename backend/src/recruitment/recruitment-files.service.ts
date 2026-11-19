import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RecruitmentRepository } from "./recruitment.repository";
import { FilePurposeDto } from "./recruitment.dto";
import { detectedMime, FILE_LIMIT, FILE_MIME_TYPES } from "./recruitment-validation";

export interface UploadedRecruitmentFile { buffer: Buffer; size: number; mimetype: string; originalname: string }
@Injectable()
export class RecruitmentFiles implements OnModuleInit, OnModuleDestroy {
  private sweep?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(private readonly repo: RecruitmentRepository) {}
  onModuleInit() {
    this.sweep = setInterval(() => { void this.cleanup().catch(() => { /* Retry next sweep; never log private paths or tokens. */ }); }, 15 * 60_000);
    this.sweep.unref();
  }
  onModuleDestroy() { if (this.sweep) clearInterval(this.sweep); }
  async upload(actor: string, campaignId: string, input: FilePurposeDto, file?: UploadedRecruitmentFile) {
    if (!file?.buffer?.length || file.size > FILE_LIMIT || file.size !== file.buffer.length) throw new BadRequestException("File không hợp lệ hoặc vượt quá 5 MB.");
    const mime = detectedMime(file.buffer);
    if (!mime || mime !== file.mimetype || !FILE_MIME_TYPES.includes(mime)) throw new BadRequestException("Chỉ nhận PDF, JPG, PNG hoặc WebP đúng định dạng.");
    const campaign = await this.repo.campaign(campaignId);
    if (campaign.deleted_at) throw new NotFoundException("Đợt tuyển không còn tồn tại.");
    if (input.purpose === "cover") {
      await this.repo.chair(actor, campaign.club_id);
      if (mime === "application/pdf" || !input.expected_updated_at) throw new BadRequestException("Ảnh bìa phải là ảnh và có phiên bản dữ liệu hiện tại.");
    } else {
      const now = Date.now();
      if (campaign.status !== "open" || now < Date.parse(campaign.application_opens_at) || now >= Date.parse(campaign.application_closes_at)) this.repo.check({ code: "P0001", message: "WINDOW_CLOSED" });
      const [club, membership, application] = await Promise.all([
        this.repo.db.from("clubs").select("club_id").eq("club_id", campaign.club_id).eq("status", "published").maybeSingle(),
        this.repo.db.from("club_memberships").select("membership_id").eq("club_id", campaign.club_id).eq("user_id", actor).eq("status", "active").maybeSingle(),
        this.repo.db.from("recruitment_applications").select("status").eq("campaign_id", campaignId).eq("applicant_id", actor).maybeSingle(),
      ]);
      for (const result of [club, membership, application]) this.repo.check(result.error);
      if (!club.data) throw new NotFoundException("CLB không còn công khai.");
      if (membership.data) this.repo.check({ code: "P0001", message: "ALREADY_MEMBER" });
      if (application.data && application.data.status !== "draft") this.repo.check({ code: "P0001", message: "APPLICATION_EXISTS" });
      const q = await this.repo.db.from("recruitment_questions").select("question_id,question_type,validation,recruitment_department_id,form_version_id").eq("question_id", input.question_id || "00000000-0000-0000-0000-000000000000").maybeSingle();
      this.repo.check(q.error);
      if (!q.data || q.data.question_type !== "file") throw new BadRequestException("Không tìm thấy câu hỏi tải file.");
      const d = await this.repo.db.from("recruitment_departments").select("current_form_version_id").eq("recruitment_department_id", q.data.recruitment_department_id).eq("campaign_id", campaignId).maybeSingle();
      this.repo.check(d.error);
      if (d.data?.current_form_version_id !== q.data.form_version_id) this.repo.check({ code: "40001", message: "FORM_CHANGED" });
      const rules = q.data.validation || {};
      if (file.size > (rules.max_size_bytes ?? FILE_LIMIT) || (rules.allowed_mime_types && !rules.allowed_mime_types.includes(mime))) throw new BadRequestException("File không đáp ứng loại hoặc dung lượng mà câu hỏi cho phép.");
    }
    const id = randomUUID(), bucket = input.purpose === "cover" ? "recruitment-covers" : "recruitment-attachments";
    const extension = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[mime];
    const objectPath = `${campaignId}/${id}.${extension}`;
    const name = file.originalname.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 200).trim() || `attachment.${extension}`;
    const uploaded = await this.repo.db.storage.from(bucket).upload(objectPath, file.buffer, { contentType: mime, upsert: false, cacheControl: input.purpose === "cover" ? "3600" : "0" });
    if (uploaded.error) throw new ServiceUnavailableException("Chưa tải được file lên. Vui lòng thử lại.");
    const saved = await this.repo.db.from("recruitment_files").insert({ file_id: id, campaign_id: campaignId, uploaded_by: actor,
      question_id: input.purpose === "answer" ? input.question_id : null, purpose: input.purpose, bucket, object_path: objectPath,
      file_name: name, mime_type: mime, size_bytes: file.size }).select("file_id,file_name,mime_type,size_bytes,expires_at").single();
    if (saved.error) {
      await this.repo.db.storage.from(bucket).remove([objectPath]);
      this.repo.check(saved.error);
    }
    if (input.purpose === "cover") {
      const url = this.repo.db.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
      const campaign = await this.repo.rpc("recruitment_attach_cover", { p_actor: actor, p_campaign: campaignId, p_file: id, p_url: url, p_expected: input.expected_updated_at });
      return { file: saved.data, campaign };
    }
    return { file: saved.data };
  }
  async download(actor: string, id: string) {
    const r = await this.repo.db.from("recruitment_files").select("*").eq("file_id", id).neq("state", "deleting").maybeSingle();
    this.repo.check(r.error);
    if (!r.data) throw new NotFoundException("File không còn tồn tại.");
    const file = r.data;
    if (file.uploaded_by !== actor) {
      const campaign = await this.repo.campaign(file.campaign_id);
      await this.repo.chair(actor, campaign.club_id);
      if (file.purpose === "answer" && !file.application_id) throw new ForbiddenException("File này chưa được gửi cùng đơn ứng tuyển.");
    }
    if (file.state === "staged" && Date.parse(file.expires_at) <= Date.now()) throw new NotFoundException("File chờ tải lên đã hết hạn.");
    const signed = await this.repo.db.storage.from(file.bucket).createSignedUrl(file.object_path, 60, { download: file.file_name });
    if (signed.error) throw new ServiceUnavailableException("Chưa mở được file. Vui lòng thử lại.");
    return { url: signed.data.signedUrl, expires_in: 60 };
  }
  async cleanup() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const now = new Date().toISOString();
      const r = await this.repo.db.from("recruitment_files").select("file_id,bucket,object_path,state").in("state", ["staged", "deleting"]).is("application_id", null).lte("expires_at", now).limit(100);
      this.repo.check(r.error);
      for (const file of r.data || []) {
        // Claim before deleting: submission locks this same row and only attaches staged files.
        const claimed = await this.repo.db.from("recruitment_files").update({ state: "deleting" }).eq("file_id", file.file_id)
          .eq("state", file.state).is("application_id", null).lte("expires_at", now).select("file_id").maybeSingle();
        this.repo.check(claimed.error);
        if (!claimed.data) continue;
        const removed = await this.repo.db.storage.from(file.bucket).remove([file.object_path]);
        if (removed.error) continue;
        const deleted = await this.repo.db.from("recruitment_files").delete().eq("file_id", file.file_id).eq("state", "deleting");
        this.repo.check(deleted.error);
      }
    } finally { this.sweeping = false; }
  }
}
