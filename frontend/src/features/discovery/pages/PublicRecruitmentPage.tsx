import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { authFormHref } from "../../auth/redirect";
import { accountRequest } from "../../../shared/api/account-http";
import { publicGet } from "../../../shared/api/public-http";
import { profileComplete, normalizeProfile, type StudentProfile } from "../../profile/profile-model";
import { ContentImage, LinkedText, QueryState } from "../components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import "./public-recruitment.css";

interface RecruitmentQuestion {
  question_id: string;
  question_text: string;
  help_text: string | null;
  is_required: boolean;
  max_length: number;
  sort_order: number;
}
interface RecruitmentDepartment {
  recruitment_department_id: string;
  department_id: string;
  description: string;
  requirements: string;
  target_quantity: number | null;
  club_departments: { name: string };
  recruitment_questions: RecruitmentQuestion[];
}
interface RecruitmentItem {
  campaign_id: string;
  club_id: string;
  club_name: string;
  club_logo_url: string | null;
  title: string;
  description: string;
  cover_url: string | null;
  application_opens_at: string;
  application_closes_at: string;
  status: string;
  departments: RecruitmentDepartment[];
}

interface RecruitmentListItem extends Omit<RecruitmentItem, "status" | "departments"> {}

export function PublicRecruitmentCollection() {
  const [items, setItems] = useState<RecruitmentListItem[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void publicGet<{ items: RecruitmentListItem[] }>("recruitment?page=1&limit=6", controller.signal)
      .then(result => { if (!controller.signal.aborted) setItems(result.items); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tải được đợt tuyển."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  if (!loading && !error && !items.length) return null;
  return <section className="dc-recruitment-feed" aria-labelledby="recruitment-feed-title">
    <header><div><span className="dc-meta">Cơ hội tham gia</span><h2 id="recruitment-feed-title">Đợt tuyển thành viên</h2></div><p>Khám phá các ban đang tìm đồng đội mới.</p></header>
    {loading ? <p role="status">Đang tải đợt tuyển…</p> : error ? <div role="alert"><p>{error}</p><button className="dc-clear" onClick={() => setAttempt(value => value + 1)}>Thử tải lại</button></div> : <div className="dc-recruitment-feed-grid">{items.map(item => <article key={item.campaign_id}>
      <Link to={`/recruitment/${item.campaign_id}`} className="dc-recruitment-feed-cover"><ContentImage src={item.cover_url} alt="" /></Link>
      <div><Link className="dc-meta" to={`/clubs/${item.club_id}`}>{item.club_name}</Link><h3><Link to={`/recruitment/${item.campaign_id}`}>{item.title}</Link></h3><p>{item.description}</p><Link className="dc-inline" to={`/recruitment/${item.campaign_id}`}>Xem chi tiết <ArrowUpRight aria-hidden="true" /></Link></div>
    </article>)}</div>}
  </section>;
}

export function PublicRecruitmentPage({ accessToken }: { accessToken?: string }) {
  const { id = "" } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<RecruitmentItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [applyingTo, setApplyingTo] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void publicGet<{ item: RecruitmentItem }>(`recruitment/${id}`, controller.signal)
      .then(result => { if (!controller.signal.aborted) setItem(result.item); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa tải được đợt tuyển."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  const requestedDepartment = new URLSearchParams(location.search).get("department") || "";
  useEffect(() => {
    if (new URLSearchParams(location.search).get("apply") === "1" && item?.departments.some(row => row.recruitment_department_id === requestedDepartment))
      setApplyingTo(requestedDepartment);
  }, [item, location.search, requestedDepartment]);

  useEffect(() => {
    if (!applyingTo || !accessToken) return;
    const controller = new AbortController();
    setProfile(null);
    setProfileLoading(true);
    setProfileError("");
    setSubmissionError("");
    void accountRequest<StudentProfile>(accessToken, "users/me/profile", { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setProfile(normalizeProfile(value)); })
      .catch(cause => { if (!controller.signal.aborted) setProfileError(cause instanceof Error ? cause.message : "Chưa tải được hồ sơ sinh viên."); })
      .finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
    return () => controller.abort();
  }, [accessToken, applyingTo]);

  const now = Date.now();
  const accepting = !!item && item.status === "open" && now >= Date.parse(item.application_opens_at) && now <= Date.parse(item.application_closes_at);
  const selectedDepartment = item?.departments.find(row => row.recruitment_department_id === applyingTo);
  const loginPath = (departmentId: string) => `/recruitment/${id}?${new URLSearchParams({ apply: "1", department: departmentId })}`;

  function startApplication(departmentId: string) {
    setSubmissionError("");
    setSubmitted(false);
    setAnswers({});
    setPortfolioUrl("");
    if (!accessToken) {
      window.location.assign(authFormHref("login", loginPath(departmentId)));
      return;
    }
    setApplyingTo(current => current === departmentId ? "" : departmentId);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !item || !selectedDepartment || submitting) return;
    setSubmitting(true);
    setSubmissionError("");
    try {
      await accountRequest(accessToken, `public/recruitment/${item.campaign_id}/applications`, {
        method: "POST",
        body: JSON.stringify({ recruitment_department_id: selectedDepartment.recruitment_department_id, answers, portfolio_url: portfolioUrl.trim() || null }),
      });
      setSubmitted(true);
    } catch (cause) {
      setSubmissionError(cause instanceof Error ? cause.message : "Chưa nộp được đơn. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || error || !item) return <div className="dc-container dc-detail-state"><QueryState loading={loading} error={error} retry={() => setAttempt(value => value + 1)} /></div>;

  return <article className="dc-container dc-recruitment-page">
    <Link className="dc-back" to="/activities"><ArrowLeft aria-hidden="true" /> Tuyển thành viên</Link>
    <header className="dc-recruitment-heading">
      <Link className="dc-recruitment-club" to={`/clubs/${item.club_id}`}>
        {item.club_logo_url && <img src={item.club_logo_url} alt="" />}
        <span>{item.club_name}</span><ArrowUpRight aria-hidden="true" />
      </Link>
      <h1>{item.title}</h1>
      <p>{item.description}</p>
      <div className="dc-recruitment-dates"><span><small>Mở đơn</small>{publicDate(item.application_opens_at)}</span><span><small>Đóng đơn</small>{publicDate(item.application_closes_at)}</span></div>
    </header>
    <ContentImage src={item.cover_url} alt={`Ảnh bìa ${item.title}`} className="dc-recruitment-cover" eager />
    <div className="dc-recruitment-departments">
      <h2>Các ban đang tuyển</h2>
      {item.departments.map(department => <section className="dc-recruitment-department" key={department.recruitment_department_id}>
        <header><h3>{department.club_departments.name}</h3><span>{department.target_quantity ? `Tuyển ${department.target_quantity} thành viên` : "Đang nhận đơn"}</span></header>
        <h4>Mô tả công việc</h4><div className="dc-rich-text"><LinkedText text={department.description} /></div>
        <h4>Yêu cầu</h4><div className="dc-rich-text"><LinkedText text={department.requirements || "Chưa có yêu cầu cụ thể."} /></div>
        <h4>Câu hỏi ứng tuyển</h4>
        {department.recruitment_questions.length ? <ol className="dc-recruitment-question-list">{[...department.recruitment_questions].sort((a, b) => a.sort_order - b.sort_order).map(question => <li key={question.question_id}>
          <strong>{question.question_text}</strong>{question.is_required && <span aria-label="Bắt buộc"> *</span>}
          {question.help_text && <p>{question.help_text}</p>}
        </li>)}</ol> : <p>Ban này chưa có câu hỏi bắt buộc.</p>}
      </section>)}
    </div>
    <section className="dc-recruitment-selector" aria-labelledby="recruitment-select-title">
      <div><h2 id="recruitment-select-title">Chọn ban để đăng ký</h2><p>Biểu mẫu sẽ hiển thị các câu hỏi riêng của ban bạn chọn.</p></div>
      {accepting ? <div className="dc-recruitment-select-options" role="group" aria-label="Chọn ban ứng tuyển">
        {item.departments.map(department => <button key={department.recruitment_department_id} type="button"
          className={applyingTo === department.recruitment_department_id ? "selected" : ""}
          aria-pressed={applyingTo === department.recruitment_department_id}
          onClick={() => startApplication(department.recruitment_department_id)}>
          <span>{department.club_departments.name}</span><small>{department.recruitment_questions.length} câu hỏi</small>
        </button>)}
      </div> : <p className="dc-recruitment-closed">Đợt tuyển hiện không nhận đơn.</p>}
    </section>
    {selectedDepartment && <section className="dc-recruitment-application" aria-labelledby={`apply-${selectedDepartment.recruitment_department_id}`}>
      <h3 id={`apply-${selectedDepartment.recruitment_department_id}`}>Đơn ứng tuyển · {selectedDepartment.club_departments.name}</h3>
      {!accessToken ? <p>Đăng nhập để tiếp tục nộp đơn.</p> : profileLoading ? <p role="status">Đang tải hồ sơ sinh viên…</p> : profileError ? <p role="alert">{profileError}</p> : profile && !profileComplete(profile) ? <div className="dc-recruitment-profile-required"><p>Hoàn thiện hồ sơ sinh viên trước khi nộp đơn.</p><Link className="dc-button" to="/me/profile">Cập nhật hồ sơ</Link></div> : profile && <form onSubmit={event => void submit(event)} aria-busy={submitting}>
        <fieldset disabled={submitting || submitted}>
          <div className="dc-recruitment-profile"><h4>Thông tin sinh viên</h4><label>Họ và tên<input value={profile.full_name} readOnly /></label><label>Mã sinh viên<input value={profile.student_code} readOnly /></label></div>
          <div className="dc-recruitment-answers"><h4>Câu hỏi của ban · {selectedDepartment.club_departments.name}</h4>{[...selectedDepartment.recruitment_questions].sort((a, b) => a.sort_order - b.sort_order).map(question => <label key={question.question_id}>{question.question_text}{question.is_required && <span> *</span>}{question.help_text && <small>{question.help_text}</small>}<textarea required={question.is_required} maxLength={question.max_length} rows={4} value={answers[question.question_id] || ""} onChange={event => setAnswers(current => ({ ...current, [question.question_id]: event.target.value }))} /></label>)}
            <label>Đường dẫn CV hoặc portfolio (tùy chọn)<input type="url" inputMode="url" placeholder="Nhập đường dẫn (ví dụ: https://...)" value={portfolioUrl} onChange={event => setPortfolioUrl(event.target.value)} /></label>
          </div>
        </fieldset>
        {submissionError && <p role="alert" className="dc-recruitment-form-error">{submissionError}</p>}
        {submitted && <p role="status" className="dc-recruitment-form-success">Đã nộp đơn ứng tuyển vào {selectedDepartment.club_departments.name}. Đơn đã được chuyển tới hàng chờ xét duyệt của trưởng ban.</p>}
        <button className="dc-button dc-recruitment-submit" type="submit" disabled={submitting || submitted}>{submitting ? "Đang nộp đơn…" : submitted ? "Đã nộp đơn" : "Nộp đơn"}</button>
      </form>}
    </section>}
  </article>;
}
