import { adminDate } from "../components/AdminTools";
import { AdminCharts } from "../components/AdminCharts";
import { Link } from "react-router-dom";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage } from "../../discovery/components/PublicContent";
import type { AdminSummary, AdminPage } from "../admin-model";

export function AdminOverview({ token }: { token: string }) {
  const stats = usePersonalQuery<AdminSummary>(token, "admin/summary");
  const pending = usePersonalQuery<AdminPage>(
    token,
    "admin/clubs?scope=requests&status=pending&page=1&limit=5",
  );
  return (
    <div className="ad-overview">
      <div className="ad-heading">
        <div>
          <h1>Tổng quan hệ thống</h1>
        </div>
        <div className="ad-actions"><button onClick={() => { stats.retry(); pending.retry(); }} disabled={stats.loading || pending.loading}>Tải lại số liệu</button><Link className="ad-primary" to="/admin/club-requests?status=pending">
          Xét duyệt đề nghị
        </Link></div>
      </div>
      {stats.data ? <AdminCharts data={stats.data} /> : stats.loading ? <div className="ad-chart-grid" role="status" aria-label="Đang tải biểu đồ">{[0, 1, 2].map(index => <div key={index} className={`ad-panel ad-chart-skeleton${index === 2 ? ' ad-content-chart' : ''}`} aria-hidden="true"><span /><div /></div>)}</div> : <PersonalState {...stats} showDiscoveryLink={false} />}
      <section className="ad-panel">
        <div className="ad-section-heading">
          <div>
            <h2>Hồ sơ cần xem xét</h2>
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
                <ContentImage src={c.logo_url} alt="" fallbackText={c.name.trim().charAt(0).toLocaleUpperCase("vi-VN")} />
                <span className="ad-overview-club">
                  <strong>{c.name}</strong>
                  <small>Gửi {adminDate(c.created_at)}</small>
                </span>
                <span className="ad-pending-badge">Chờ duyệt</span>
                <span className="ad-review-action">Xem xét <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </div>
        ) : (
          <PersonalState
            {...pending}
            showDiscoveryLink={false}
            empty="Không có đề nghị đang chờ xét duyệt."
          />
        )}
      </section>
    </div>
  );
}
