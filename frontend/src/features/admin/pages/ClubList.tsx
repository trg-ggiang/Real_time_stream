import { Link } from "react-router-dom";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage } from "../../discovery/components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { clubStatus, type AdminPage } from "../admin-model";
export function ClubList({
  token,
  directory = false,
}: {
  token: string;
  directory?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status") || (directory ? "all" : "pending");
  const allowed = directory
    ? ["all", "published", "suspended", "archived"]
    : ["all", "pending", "published", "rejected"];
  const status = allowed.includes(raw) ? raw : directory ? "all" : "pending";
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.get("page"))) || 1),
  );
  const q = (params.get("q") || "").slice(0, 100);
  const result = usePersonalQuery<AdminPage>(
    token,
    `admin/clubs?scope=${directory ? "directory" : "requests"}&status=${status}&page=${page}&limit=12&q=${encodeURIComponent(q)}`,
  );
  const base = directory ? "/admin/clubs" : "/admin/club-requests";
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("q") || "").trim();
    setParams({ status, q: text });
  }
  return (
    <>
      <div className="ad-heading">
        <div>
          <h1>{directory ? "Danh sách CLB" : "Đề nghị thành lập CLB"}</h1>
          <p>
            {directory
              ? "Các CLB đã được duyệt và trạng thái vận hành hiện tại."
              : "Đọc hồ sơ, ghi nhận quyết định và phản hồi cho người gửi."}
          </p>
        </div>
        <button onClick={result.retry} disabled={result.loading}>
          Tải lại
        </button>
      </div>
      <nav className="ad-tabs" aria-label="Lọc trạng thái">
        {allowed.map((s) => (
          <Link
            key={s}
            aria-current={status === s ? "page" : undefined}
            to={`${base}?${new URLSearchParams({ status: s, ...(q ? { q } : {}) })}`}
          >
            {s === "all" ? "Tất cả" : clubStatus(s)}
          </Link>
        ))}
      </nav>
      <form className="ad-search" key={`${status}:${q}`} onSubmit={search}>
        <label htmlFor="admin-search">
          Tìm theo tên CLB
          <input
            id="admin-search"
            name="q"
            defaultValue={q}
            placeholder="Nhập tên câu lạc bộ…"
            maxLength={100}
          />
        </label>
        <button type="submit">Tìm kiếm</button>
        {q && <Link to={`${base}?status=${status}`}>Xóa tìm kiếm</Link>}
      </form>
      <section className="ad-panel ad-list-panel" aria-busy={result.loading}>
        <div className="ad-section-heading">
          <h2>
            {q
              ? `Kết quả cho “${q}”`
              : directory
                ? "Cộng đồng trên nền tảng"
                : "Hồ sơ đề nghị"}
          </h2>
          <span>
            {result.data ? `${result.data.total} kết quả` : "Đang tải…"}
          </span>
        </div>
        {result.data?.items.length ? (
          <div className="ad-club-list">
            {result.data.items.map((c) => (
              <article key={c.club_id}>
                <ContentImage src={c.logo_url} alt="" />
                <div>
                  <span className={`ad-status ${c.status}`}>
                    {clubStatus(c.status)}
                  </span>
                  <h3>
                    <Link to={`${base}/${c.club_id}`}>{c.name}</Link>
                  </h3>
                  <p>{c.summary}</p>
                  <small>
                    Gửi {publicDate(c.created_at)}
                    {c.reviewed_at
                      ? ` · Xét duyệt ${publicDate(c.reviewed_at)}`
                      : ""}
                  </small>
                </div>
                <Link className="ad-row-action" to={`${base}/${c.club_id}`}>
                  {c.status === "pending" ? "Xem xét hồ sơ" : "Xem chi tiết"} →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <PersonalState
            {...result}
            empty={
              q
                ? "Không có CLB phù hợp. Thử tên khác hoặc xóa tìm kiếm."
                : "Chưa có hồ sơ trong mục này."
            }
          />
        )}
      </section>
      <nav className="ad-pagination" aria-label="Phân trang">
        <button
          disabled={page === 1 || result.loading}
          onClick={() => setParams({ status, q, page: String(page - 1) })}
        >
          ← Trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!result.data?.hasMore || result.loading}
          onClick={() => setParams({ status, q, page: String(page + 1) })}
        >
          Sau →
        </button>
      </nav>
    </>
  );
}
