import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useClub } from "../workspace-context";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage, LinkedText } from "../../discovery/components/PublicContent";
import { publicDate, publicDateOnly } from "../../../shared/lib/content-format";
import { recruitmentStatus, type RecruitmentCampaign, type WorkspaceList } from "../services/workspace-api";

export function RecruitmentActivities({ list }: { list: string }) {
  const { token, clubId } = useClub();
  const [page, setPage] = useState(1);
  const location = useLocation();
  const result = usePersonalQuery<WorkspaceList<RecruitmentCampaign>>(token, `workspace/${clubId}/recruitment?list=${list}&page=${page}&limit=12`);
  const items = result.data?.items || [];
  if (list === "review") return null;
  return <>
    {location.state?.recruitmentPublished && <p role="status" className="cw-success">Đã lưu mẫu đơn và đăng đợt tuyển lên Hoạt động CLB.</p>}
    {result.error && <PersonalState {...result} />}
    {!!items.length && <section aria-label="Đợt tuyển thành viên">
      <h2>Đợt tuyển thành viên</h2>
      <div className="cw-content-list">{items.map(item => <article key={item.campaign_id}>
        <ContentImage src={item.cover_url} alt="" />
        <div><span className={`cw-status ${item.status === "draft" ? "draft" : "published"}`}>{recruitmentStatus(item.status)}</span>
          <h2><Link to={`/recruitment/${item.campaign_id}`}>{item.title}</Link></h2>
          <p>{item.description.length > 250 ? `${item.description.slice(0, 250)}…` : item.description}</p>
          <small>Nhận đơn {publicDateOnly(item.application_opens_at)} – {publicDateOnly(item.application_closes_at)}</small>
        </div>
        <Link to={`/recruitment/${item.campaign_id}`}>Xem chi tiết →</Link>
      </article>)}</div>
      {(page > 1 || result.data?.hasMore) && <nav className="cw-pagination" aria-label="Phân trang đợt tuyển">
        <button disabled={page === 1 || result.loading} onClick={() => setPage(p => p - 1)}>← Trước</button><span>Trang {page}</span>
        <button disabled={!result.data?.hasMore || result.loading} onClick={() => setPage(p => p + 1)}>Sau →</button>
      </nav>}
    </section>}
  </>;
}

export function RecruitmentDetail() {
  const { token, clubId } = useClub();
  const { id = "" } = useParams();
  const result = usePersonalQuery<{ item: RecruitmentCampaign }>(token, `workspace/${clubId}/recruitment/${id}`);
  const item = result.data?.item;
  if (!item) return <PersonalState {...result} />;
  return <>
    <Link className="cw-back" to={`/workspace/${clubId}/activities`}>← Hoạt động CLB</Link>
    <header className="cw-heading"><div><span className={`cw-status ${item.status === "draft" ? "draft" : "published"}`}>{recruitmentStatus(item.status)}</span><h1>{item.title}</h1></div></header>
    {item.cover_url && <ContentImage src={item.cover_url} className="cw-detail-image" alt="Ảnh bìa đợt tuyển" />}
    <article className="cw-panel cw-reading">
      <div className="cw-long-text"><LinkedText text={item.description} /></div>
      <dl><dt>Mở đơn</dt><dd>{publicDate(item.application_opens_at)}</dd><dt>Đóng đơn</dt><dd>{publicDate(item.application_closes_at)}</dd></dl>
    </article>
    {item.departments?.map(department => <section className="cw-panel cw-reading" key={department.recruitment_department_id}>
      <h2>{department.club_departments.name}</h2><p>Chỉ tiêu: {department.target_quantity ?? "Không giới hạn"} thành viên</p>
      <h3>Mô tả công việc</h3><div className="cw-long-text"><LinkedText text={department.description} /></div>
      <h3>Yêu cầu</h3><div className="cw-long-text"><LinkedText text={department.requirements || "Chưa có yêu cầu."} /></div>
      <h3>Mẫu đơn</h3>
      {department.recruitment_questions.length ? <ol>{[...department.recruitment_questions].sort((a, b) => a.sort_order - b.sort_order).map(question => <li key={question.question_id}>
        <p>{question.question_text}</p>{question.help_text && <p>{question.help_text}</p>}
        <small>{question.is_required ? "Bắt buộc" : "Tùy chọn"} · Tối đa {question.max_length.toLocaleString("vi-VN")} ký tự</small>
      </li>)}</ol> : <p>Ban này chưa có câu hỏi.</p>}
    </section>)}
    <Link className="cw-primary" to={`/recruitment/${item.campaign_id}`}>Xem chi tiết và đăng ký →</Link>
  </>;
}
