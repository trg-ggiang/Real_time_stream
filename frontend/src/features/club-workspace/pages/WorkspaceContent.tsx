import { PaginationButton } from "../../../shared/components/PaginationButton";
import { confirmAction } from '../../../shared/lib/confirm-action';
import { ImageUpload } from '../../../shared/components/ImageUpload';
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useClub } from "../workspace-context";
import { useWorkspaceMutation } from "../use-workspace-mutation";
import {
  contentId,
  contentStatus,
  workspaceRequest,
  type ContentItem,
  type ContentKind,
  type WorkspaceList,
} from "../services/workspace-api";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import {
  ContentImage,
  LinkedText,
} from "../../discovery/components/PublicContent";
import { publicDate, publicDateOnly, publicDateRange, publicTime } from "../../../shared/lib/content-format";
import { useUnsavedChanges } from "../../../shared/lib/use-unsaved-changes";
export function ContentList({ kind }: { kind: ContentKind }) {
  const { token, clubId, membership } = useClub();
  const [params, setParams] = useSearchParams();
  const list = ["mine", "review"].includes(params.get("list") || "")
    ? params.get("list")!
    : "published";
  const raw = Number(params.get("page") || 1),
    page = Number.isInteger(raw) ? Math.max(1, Math.min(10000, raw)) : 1;
  const result = usePersonalQuery<WorkspaceList<ContentItem>>(
    token,
    `workspace/${clubId}/content/${kind}?list=${list}&page=${page}&limit=12`,
  );
  const base = `/workspace/${clubId}/${kind}`;
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>{kind === "posts" ? "Bài viết CLB" : "Hoạt động CLB"}</h1>
          <p>
            {list === "review"
              ? "Đọc và quyết định cho từng nội dung gửi duyệt."
              : list === "mine"
                ? "Bản nháp, nội dung đã gửi và những phản hồi dành cho bạn."
                : "Những nội dung đã được duyệt trong cộng đồng."}
          </p>
        </div>
        <Link className="cw-primary" to={`${base}/new`}>
          {kind === "posts" ? "Soạn bài viết" : "Tạo hoạt động"} ↗
        </Link>
      </div>
      <nav className="cw-tabs" aria-label="Danh sách nội dung">
        {[
          ["published", "Đã đăng"],
          ["mine", "Của tôi"],
          ...(membership.role === "chairperson"
            ? [["review", "Chờ duyệt"]]
            : []),
        ].map(([key, label]) => (
          <Link
            key={key}
            aria-current={list === key ? "page" : undefined}
            to={key === "published" ? base : `${base}?list=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {result.data?.items.length ? (
        <div className="cw-content-list">
          {result.data.items.map((item) => (
            <article key={contentId(item)}>
              <ContentImage src={item.cover_url} alt="" />
              <div>
                <span className={`cw-status ${item.publication_status}`}>
                  {contentStatus(item.publication_status)}
                </span>
                <h2>
                  <Link to={`${base}/${contentId(item)}`}>{item.title}</Link>
                </h2>
                <p>{item.summary}</p>
                <small>
                  Cập nhật {publicDate(item.updated_at)}
                  {kind === "posts" && item.visibility === "internal"
                    ? " · Nội bộ CLB"
                    : ""}
                </small>
              </div>
              <Link to={`${base}/${contentId(item)}`}>Xem nội dung →</Link>
            </article>
          ))}
        </div>
      ) : (
        <PersonalState {...result} empty="Chưa có nội dung trong mục này." />
      )}
      <nav className="cw-pagination" aria-label="Phân trang nội dung">
        <PaginationButton direction="previous" disabled={page === 1 || result.loading}
          onClick={() => setParams({ list, page: String(page - 1) })} />
        <span>Trang {page}</span>
        <PaginationButton direction="next" disabled={!result.data?.hasMore || result.loading}
          onClick={() => setParams({ list, page: String(page + 1) })} />
      </nav>
    </>
  );
}
export function ContentDetail({ kind }: { kind: ContentKind }) {
  const { id = "" } = useParams();
  const { token, clubId, membership } = useClub();
  const result = usePersonalQuery<{ item: ContentItem }>(
    token,
    `workspace/${clubId}/content/${kind}/${id}`,
  );
  const mutation = useWorkspaceMutation();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const item = result.data?.item;
  const base = `/workspace/${clubId}/${kind}`;
  async function review(decision: string) {
    if (
      !item ||
      !(await confirmAction(
        decision === "published"
          ? "Duyệt và đăng nội dung này?"
          : "Gửi yêu cầu chỉnh sửa cho tác giả?",
      ))
    )
      return;
    const r = await mutation.run((signal) =>
      workspaceRequest<{ item: ContentItem }>(
        token,
        clubId,
        `content/${kind}/${id}/review`,
        {
          method: "PATCH",
          signal,
          body: JSON.stringify({
            decision,
            reason:
              decision === "changes_requested" ? reason.trim() : undefined,
            expected_updated_at: item.updated_at,
          }),
        },
      ),
    );
    if (r) {
      setMessage(
        decision === "published"
          ? "Đã duyệt nội dung."
          : "Đã gửi phản hồi cho tác giả.",
      );
      result.retry();
    }
  }
  if (!item) return <PersonalState {...result} />;
  const own =
    item[kind === "posts" ? "author_id" : "created_by"] === membership.user_id;
  return (
    <>
      <Link className="cw-back" to={base}>
        ← {kind === "posts" ? "Bài viết" : "Hoạt động"}
      </Link>
      <div className="cw-heading">
        <div>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
        </div>
        {own && (
          <Link className="cw-primary" to={`${base}/${id}/edit`}>
            Sửa nội dung
          </Link>
        )}
      </div>
      {message && (
        <p className="cw-success" role="status">
          {message}
        </p>
      )}
      {item.cover_url && (
        <ContentImage
          src={item.cover_url}
          className="cw-detail-image"
          alt="Ảnh nội dung CLB"
        />
      )}
      <article className="cw-panel cw-reading cw-detail-card" data-status={item.publication_status}>
        <header className="cw-detail-card-top"><h2>{kind === 'activities' ? 'Thông tin hoạt động' : 'Nội dung bài viết'}</h2><span className={`cw-status ${item.publication_status}`}>{contentStatus(item.publication_status)}</span></header>
        <div className="cw-detail-card-body">
          <div className="cw-long-text">
            <LinkedText text={item.content || item.description} />
          </div>
          {kind === "activities" && (
            <dl>
              <dt>Thời gian</dt>
              <dd><time dateTime={item.starts_at}>{publicDateRange(item.starts_at, item.ends_at)}</time><small className="cw-detail-clock">{[publicTime(item.starts_at), publicTime(item.ends_at)].filter(Boolean).join('–')}</small></dd>
              <dt>Địa điểm</dt>
              <dd>{item.location_name || "Trực tuyến"}</dd>
              <dt>Hạn đăng ký</dt>
              <dd>
                <time dateTime={item.registration_closes_at || item.starts_at}>{publicDateOnly(item.registration_closes_at || item.starts_at)}</time><small className="cw-detail-clock">{publicTime(item.registration_closes_at || item.starts_at)}</small>
              </dd>
              {item.join_url && (
                <>
                  <dt>Đường dẫn tổ chức</dt>
                  <dd>
                    <LinkedText text={item.join_url} />
                  </dd>
                </>
              )}
            </dl>
          )}
          {kind === 'posts' && <dl><dt>{item.published_at ? 'Ngày đăng' : 'Cập nhật'}</dt><dd><time dateTime={item.published_at || item.updated_at}>{publicDateOnly(item.published_at || item.updated_at)}</time></dd></dl>}
        </div>
        <footer className="cw-detail-card-footer">
          {item.review_note && (
            <>
              <h3>Phản hồi của chủ nhiệm</h3>
              <p>{item.review_note}</p>
            </>
          )}
          {own && item.publication_status === "published" && (
            <p className="cw-muted">
              Sửa bài đã đăng sẽ đưa nội dung về nháp và ẩn bản công khai cho
              đến khi duyệt lại.
            </p>
          )}
          {membership.role === "chairperson" &&
            item.publication_status === "pending_review" && (
              <>
                <h2>Xét duyệt</h2>
                <label>
                  Lý do cần chỉnh sửa
                  <textarea
                    value={reason}
                    maxLength={1000}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={mutation.busy}
                  />
                </label>
                <div className="cw-actions">
                  <button
                    className="cw-primary"
                    disabled={mutation.busy}
                    onClick={() => review("published")}
                  >
                    Duyệt và đăng
                  </button>
                  <button
                    disabled={mutation.busy || !reason.trim()}
                    onClick={() => review("changes_requested")}
                  >
                    Yêu cầu chỉnh sửa
                  </button>
                </div>
              </>
            )}
          {mutation.error && (
            <p role="alert" className="cw-error">
              {mutation.error}
            </p>
          )}
          {item.publication_status === "published" &&
            (kind === "activities" || item.visibility === "public") && (
              <Link className="cw-link" to={`/${kind}/${id}`}>
                Xem trang công khai ↗
              </Link>
            )}
        </footer>
      </article>
    </>
  );
}
const localTime = (value?: string | null) =>
  value
    ? new Date(value)
        .toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
        .replace(" ", "T")
        .slice(0, 16)
    : "";
export function ContentEditor({ kind }: { kind: ContentKind }) {
  const { id } = useParams();
  const { token, clubId, membership } = useClub();
  const navigate = useNavigate();
  const mutation = useWorkspaceMutation();
  const [uploading, setUploading] = useState(false);
  const busy = mutation.busy || uploading;
  const initialId = useRef(id || crypto.randomUUID());
  const [values, setValues] = useState<Record<string, string>>({
    format: "onsite",
    visibility: "public",
  });
  const [version, setVersion] = useState("");
  const [loaded, setLoaded] = useState(!id);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const savedId = useRef<string | null>(id || null);
  useUnsavedChanges(dirty && !saved);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoaded(false);
    void workspaceRequest<{ item: ContentItem }>(
      token,
      clubId,
      `content/${kind}/${id}`,
      { signal: controller.signal },
    )
      .then(({ item }) => {
        if (controller.signal.aborted) return;
        if (
          item[kind === "posts" ? "author_id" : "created_by"] !==
          membership.user_id
        ) {
          setLoadError("Chỉ tác giả được sửa nội dung của mình.");
          return;
        }
        const next = Object.fromEntries(
          Object.entries(item).map(([k, v]) => [k, v == null ? "" : String(v)]),
        );
        for (const k of [
          "starts_at",
          "ends_at",
          "registration_opens_at",
          "registration_closes_at",
        ])
          next[k] = localTime(next[k]);
        setValues(next);
        setVersion(item.updated_at);
        setLoaded(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e.message);
      });
    return () => controller.abort();
  }, [token, clubId, kind, id, membership.user_id, attempt]);
  function field(
    key: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      min?: number;
      max?: number;
      multiline?: boolean;
    } = {},
  ) {
    return (
      <label key={key}>
        {label}
        {options.required ? " *" : ""}
        {options.multiline ? (
          <textarea
            aria-label={label}
            value={values[key] || ""}
            required={options.required}
            minLength={options.min}
            maxLength={options.max || 50000}
            disabled={busy}
            onChange={(e) => change(key, e.target.value)}
          />
        ) : (
          <input
            aria-label={label}
            type={options.type || "text"}
            value={values[key] || ""}
            required={options.required}
            minLength={options.min}
            maxLength={options.max}
            min={options.type === "number" ? 1 : undefined}
            disabled={busy}
            onChange={(e) => change(key, e.target.value)}
          />
        )}
      </label>
    );
  }
  function change(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setSaved(false);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const action =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
      "draft";
    const payload: Record<string, unknown> = {
      title: values.title?.trim(),
      summary: values.summary?.trim(),
      cover_url: values.cover_url?.trim() || null,
      [kind === "posts" ? "post_id" : "activity_id"]: initialId.current,
      ...(version && { expected_updated_at: version }),
    };
    if (kind === "posts")
      Object.assign(payload, {
        content: values.content?.trim(),
        visibility: values.visibility,
      });
    else {
      Object.assign(payload, {
        description: values.description?.trim(),
        format: values.format,
        location_name: values.location_name?.trim() || null,
        location_address: values.location_address?.trim() || null,
        join_url: values.join_url?.trim() || null,
        capacity: values.capacity ? Number(values.capacity) : null,
      });
      for (const key of [
        "starts_at",
        "ends_at",
        "registration_opens_at",
        "registration_closes_at",
      ])
        payload[key] = values[key] ? `${values[key]}:00+07:00` : null;
    }
    const result = await mutation.run(async (signal) => {
      const path = savedId.current ? `${kind}/${savedId.current}` : kind;
      const draft = await workspaceRequest<{ item: ContentItem }>(
        token,
        clubId,
        path,
        {
          method: savedId.current ? "PATCH" : "POST",
          signal,
          body: JSON.stringify(payload),
        },
      );
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      savedId.current = contentId(draft.item);
      setVersion(draft.item.updated_at);
      if (action === "submit")
        return workspaceRequest<{ item: ContentItem }>(
          token,
          clubId,
          `content/${kind}/${savedId.current}/submit`,
          {
            method: "POST",
            signal,
            body: JSON.stringify({
              expected_updated_at: draft.item.updated_at,
            }),
          },
        );
      return draft;
    });
    if (result) {
      setSaved(true);
      setDirty(false);
      navigate(`/workspace/${clubId}/${kind}/${contentId(result.item)}`, {
        replace: true,
      });
    }
  }
  if (!loaded)
    return (
      <>
        <h1>Sửa nội dung</h1>
        <PersonalState
          loading={!loadError}
          error={loadError}
          retry={() => {
            setLoadError("");
            setAttempt((n) => n + 1);
          }}
        />
      </>
    );
  return (
    <>
      <Link className="cw-back" to={`/workspace/${clubId}/${kind}?list=mine`}>
        ← Nội dung của tôi
      </Link>
      <div className="cw-heading">
        <div>
          <h1>
            {id
              ? "Sửa nội dung"
              : kind === "posts"
                ? "Viết câu chuyện CLB"
                : "Tạo một hoạt động mới"}
          </h1>
          <p>
            {kind === "activities" && membership.role === "chairperson"
              ? "Bạn có thể lưu nháp hoặc đăng ngay với quyền chủ nhiệm."
              : "Lưu nháp để viết tiếp; gửi duyệt khi nội dung đã sẵn sàng."}
          </p>
        </div>
      </div>
      <form
        className="cw-panel cw-editor"
        onSubmit={save}
        aria-busy={busy}
      >
        <div className="cw-form-grid">
          {field("title", "Tiêu đề", { required: true, min: 2, max: 200 })}
          {field("summary", "Tóm tắt", { required: true, min: 10, max: 500 })}
          {field(
            kind === "posts" ? "content" : "description",
            "Nội dung chi tiết",
            { required: true, min: 10, multiline: true },
          )}
          <ImageUpload token={token} label="Ảnh bìa" value={values.cover_url} disabled={busy} onBusyChange={setUploading} onChange={url => change('cover_url', url)} />
          {kind === "posts" ? (
            <label>
              Phạm vi bài viết
              <select
                value={values.visibility}
                onChange={(e) => change("visibility", e.target.value)}
                disabled={busy}
              >
                <option value="public">Công khai</option>
                <option value="internal">Nội bộ CLB</option>
              </select>
            </label>
          ) : (
            <>
              {field("starts_at", "Bắt đầu (giờ Việt Nam)", {
                type: "datetime-local",
                required: true,
              })}
              {field("ends_at", "Kết thúc (giờ Việt Nam)", {
                type: "datetime-local",
                required: true,
              })}
              <label>
                Hình thức
                <select
                  value={values.format}
                  onChange={(e) => change("format", e.target.value)}
                  disabled={busy}
                >
                  <option value="onsite">Trực tiếp</option>
                  <option value="online">Trực tuyến</option>
                  <option value="hybrid">Kết hợp</option>
                </select>
              </label>
              {values.format !== "online" &&
                field("location_name", "Địa điểm", {
                  required: true,
                  max: 200,
                })}
              {values.format !== "online" &&
                field("location_address", "Địa chỉ", { max: 1000 })}
              {values.format !== "onsite" &&
                field("join_url", "Đường dẫn trực tuyến", {
                  type: "url",
                  required: true,
                  max: 2048,
                })}
              {field("capacity", "Sức chứa (để trống nếu không giới hạn)", {
                type: "number",
              })}
              {field("registration_opens_at", "Mở đăng ký (giờ Việt Nam)", {
                type: "datetime-local",
              })}
              {field("registration_closes_at", "Đóng đăng ký (giờ Việt Nam)", {
                type: "datetime-local",
              })}
            </>
          )}
        </div>
        {mutation.error && (
          <p className="cw-error" role="alert">
            {mutation.error} Nếu đã có bản nháp, mở Của tôi để kiểm tra trước
            khi gửi lại.
          </p>
        )}
        <div className="cw-actions">
          <button type="submit" value="draft" disabled={busy}>
            Lưu bản nháp
          </button>
          <button
            type="submit"
            value="submit"
            className="cw-primary"
            disabled={busy}
          >
            {busy
              ? "Đang lưu…"
              : kind === "activities" && membership.role === "chairperson"
                ? "Đăng hoạt động"
                : "Gửi duyệt"}
          </button>
        </div>
        <p className="cw-muted">
          Sửa nội dung đã đăng sẽ chuyển về nháp. Bài viết public chỉ mang tên
          CLB; tác giả phục vụ xử lý nội bộ.
        </p>
      </form>
    </>
  );
}
