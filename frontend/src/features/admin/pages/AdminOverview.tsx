import { Link } from "react-router-dom";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage } from "../../discovery/components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import type { AdminSummary, AdminPage } from "../admin-model";
export function AdminOverview({ token }: { token: string }) {
  const stats = usePersonalQuery<AdminSummary>(token, "admin/summary");
  const pending = usePersonalQuery<AdminPage>(
    token,
    "admin/clubs?scope=requests&status=pending&page=1&limit=5",
  );
  return (
    <>
      <div className="ad-heading">
        <div>
          <h1>Đề nghị và cộng đồng</h1>
          <p>
            Theo dõi hồ sơ thành lập, đưa những cộng đồng mới đến với sinh viên.
          </p>
        </div>
        <Link className="ad-primary" to="/admin/club-requests?status=pending">
          Xét duyệt đề nghị →
        </Link>
      </div>
      {stats.data ? (
        <dl className="ad-stats">
          <div>
            <dt>Đang chờ xét duyệt</dt>
            <dd>{stats.data.pending}</dd>
          </div>
          <div>
            <dt>CLB đang công khai</dt>
            <dd>{stats.data.published}</dd>
          </div>
          <div>
            <dt>Đề nghị đã từ chối</dt>
            <dd>{stats.data.rejected}</dd>
          </div>
        </dl>
      ) : (
        <PersonalState {...stats} />
      )}
      <section className="ad-panel">
        <div className="ad-section-heading">
          <div>
            <h2>Hồ sơ cần xem xét</h2>
            <p>Những đề nghị mới nhất đang chờ quyết định.</p>
          </div>
          <Link to="/admin/club-requests?status=pending">Xem tất cả →</Link>
        </div>
        {pending.data?.items.length ? (
          <div className="ad-rows">
            {pending.data.items.map((c) => (
              <Link
                key={c.club_id}
                className="ad-overview-row"
                to={`/admin/club-requests/${c.club_id}`}
              >
                <ContentImage src={c.logo_url} alt="" />
                <span>
                  <strong>{c.name}</strong>
                  <small>Gửi {publicDate(c.created_at)}</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <PersonalState
            {...pending}
            empty="Không có đề nghị đang chờ xét duyệt."
          />
        )}
      </section>
      <p className="ad-note">
        Quản trị viên xét duyệt việc thành lập CLB. Bài viết, hoạt động và thành
        viên được chủ nhiệm quản lý trong từng CLB.
      </p>
    </>
  );
}
