import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { accountRequest } from "../../../shared/api/account-http";
import { useUnsavedChanges } from "../../../shared/lib/use-unsaved-changes";
import { publicDate } from "../../../shared/lib/content-format";
import {
  ContentImage,
  LinkedText,
} from "../../discovery/components/PublicContent";
import { usePersonalQuery } from "../use-personal-query";
import { ClubCategoryPicker } from "../../discovery/components/ClubCategoryPicker";
import { type ClubRequest } from "../services/personal-api";
import { PersonalState } from "../components/PersonalState";
import { requestStatus } from "./PersonalLists";

const requestFields = [
  { key: "name", label: "Tên CLB", limit: 120, min: 2, required: true },
  {
    key: "summary",
    label: "Giới thiệu ngắn",
    limit: 300,
    min: 10,
    required: true,
  },
  {
    key: "description",
    label: "Mô tả chi tiết",
    limit: 5000,
    min: 20,
    required: true,
    multiline: true,
  },
  { key: "mission", label: "Sứ mệnh", limit: 2000, min: 10, multiline: true },
  { key: "contact_email", label: "Email liên hệ", limit: 254, type: "email" },
  { key: "contact_phone", label: "Điện thoại liên hệ", limit: 32, type: "tel" },
  { key: "logo_url", label: "URL logo", limit: 2048, type: "url" },
  { key: "cover_url", label: "URL ảnh bìa", limit: 2048, type: "url" },
];
export function NewClubRequest({ token }: { token: string }) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useUnsavedChanges(!sent && (categoryIds.length > 0 || Object.values(values).some((v) => Boolean(v))));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uncertain || mutation.current) return;
    setError("");
    const body = Object.fromEntries(
      Object.entries(values)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );
    if (
      requestFields.some(
        (f) => f.required && (!body[f.key] || body[f.key].length < f.min!),
      )
    ) {
      setError("Điền đầy đủ tên, giới thiệu và mô tả CLB.");
      return;
    }
    if (
      ["logo_url", "cover_url"].some(
        (key) => body[key] && !/^https?:\/\//i.test(body[key]),
      )
    ) {
      setError("URL ảnh phải bắt đầu bằng http:// hoặc https://.");
      return;
    }
    if (!categoryIds.length) {
      setError("Chọn ít nhất một loại CLB.");
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const result = await accountRequest<{ club: { club_id: string } }>(
        token,
        "public/clubs",
        {
          method: "POST",
          body: JSON.stringify({ ...body, category_ids: categoryIds }),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (!result.club?.club_id)
        throw new Error(
          "Chưa xác nhận được mã đề nghị. Kiểm tra lịch sử trước khi gửi lại.",
        );
      setSent(true);
      navigate(`/me/club-requests/${result.club.club_id}`, { replace: true });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error ? cause.message : "Không gửi được đề nghị.",
      );
      // Network/5xx may have committed. Do not offer blind POST retries without idempotency.
      if (!(
        cause instanceof Error &&
        "status" in cause &&
        [400, 401, 403, 409, 429].includes(Number(cause.status))
      ))
        setUncertain(true);
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <div className="ps-heading">
        <div>
          <Link className="ps-back" to="/me/clubs">
            ← CLB tham gia
          </Link>
          <h1>Đưa CLB đến cộng đồng</h1>
          <p>
            Gửi thông tin để admin xét duyệt. CLB chỉ xuất hiện công khai sau
            khi được chấp thuận.
          </p>
        </div>
      </div>
      <form className="ps-request-form" onSubmit={submit} aria-busy={busy}>
        <div className="ps-form-grid">
          {requestFields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.required ? " *" : ""}
              {field.multiline ? (
                <textarea
                  aria-label={field.label}
                  required={field.required}
                  minLength={field.min}
                  maxLength={field.limit}
                  value={values[field.key] || ""}
                  disabled={busy || uncertain}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                />
              ) : (
                <input
                  aria-label={field.label}
                  type={field.type || "text"}
                  required={field.required}
                  minLength={field.min}
                  maxLength={field.limit}
                  value={values[field.key] || ""}
                  disabled={busy || uncertain}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>
        <ClubCategoryPicker selected={categoryIds} onChange={setCategoryIds} disabled={busy || uncertain} />
        <p className="ps-small">
          Ảnh hiện được lưu bằng URL công khai; chưa hỗ trợ tải file. Không nhập
          đơn vị trực thuộc hay fanpage riêng khi API chưa lưu được các trường
          đó.
        </p>
        {(values.logo_url || values.cover_url) && (
          <div className="ps-preview">
            <ContentImage
              src={values.logo_url || values.cover_url}
              alt="Xem trước ảnh CLB"
            />
          </div>
        )}
        {error && (
          <p className="ps-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="ps-small">
            Chưa xác nhận được kết quả.{" "}
            <Link to="/me/club-requests">Kiểm tra danh sách đề nghị</Link> trước
            khi tạo đề nghị khác để tránh gửi trùng.
          </p>
        )}
        <div className="ps-form-actions">
          <span>
            Đề nghị bị từ chối được giữ làm lịch sử. Lần sau bạn tạo đề nghị
            mới.
          </span>
          <button
            className="ps-primary"
            type="submit"
            disabled={busy || uncertain}
          >
            {busy ? "Đang gửi…" : "Gửi đề nghị xét duyệt"}
          </button>
        </div>
      </form>
    </>
  );
}
export function ClubRequestDetail({ token }: { token: string }) {
  const { id = "" } = useParams();
  const state = usePersonalQuery<{ item: ClubRequest }>(
    token,
    `me/club-requests/${id}`,
  );
  const item = state.data?.item;
  return (
    <>
      <div className="ps-heading">
        <div>
          <Link className="ps-back" to="/me/clubs">
            ← CLB tham gia
          </Link>
          <h1>{item?.name || "Hồ sơ đề nghị CLB"}</h1>
          <p>Chỉ bạn và người có quyền xét duyệt mới xem hồ sơ đề nghị này.</p>
        </div>
        <button onClick={state.retry} disabled={state.loading}>
          Cập nhật trạng thái
        </button>
      </div>
      {item ? (
        <div className="ps-request-detail">
          <section className="ps-panel">
            <span className={`ps-status ${item.status}`}>
              {requestStatus(item.status)}
            </span>
            <h2>Thông tin đã gửi</h2>
            <p className="ps-small">Gửi lúc {publicDate(item.created_at)}</p>
            <p>{item.summary}</p>
            {!!item.category_names?.length && (
              <p><strong>Loại CLB:</strong> {item.category_names.join(", ")}</p>
            )}
            <div className="ps-long-text">
              <LinkedText text={item.description} />
            </div>
            {item.mission && (
              <>
                <h2>Sứ mệnh</h2>
                <p>{item.mission}</p>
              </>
            )}
            {item.contact_email && <p>Email: {item.contact_email}</p>}
            {item.contact_phone && <p>Điện thoại: {item.contact_phone}</p>}
          </section>
          <aside className="ps-panel">
            <h2>Kết quả xét duyệt</h2>
            {item.status === "pending" ? (
              <p>
                Admin chưa có quyết định. Bạn có thể cập nhật trạng thái tại
                đây, không cần gửi lại đề nghị.
              </p>
            ) : (
              <>
                <p>Cập nhật lúc {publicDate(item.reviewed_at)}</p>
                <p>{item.review_note || "Không có ghi chú bổ sung."}</p>
              </>
            )}
            {item.status === "rejected" && (
              <>
                <p>
                  Đề nghị này đã kết thúc. Nếu muốn đăng ký lại, hãy tạo hồ sơ
                  mới.
                </p>
                <Link className="ps-primary" to="/me/club-requests/new">
                  Tạo đề nghị mới →
                </Link>
              </>
            )}
            {["published", "approved"].includes(item.status) && (
              <>
                <Link className="ps-text-link" to={`/clubs/${item.club_id}`}>
                  Xem trang công khai →
                </Link>
                <Link
                  className="ps-text-link"
                  to={`/workspace/${item.club_id}`}
                >
                  Mở không gian CLB →
                </Link>
              </>
            )}
          </aside>
        </div>
      ) : (
        <PersonalState {...state} />
      )}
    </>
  );
}
