import { Link } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { XCircle } from "@phosphor-icons/react/dist/csr/XCircle";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import { ContentImage } from "../../discovery/components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import type { AdminSummary, AdminPage } from "../admin-model";

const summaries = [
  { key: "pending", label: "Đang chờ xét duyệt", to: "/admin/club-requests?status=pending", Icon: Clock },
  { key: "published", label: "CLB đang công khai", to: "/admin/clubs?status=published", Icon: CheckCircle },
  { key: "rejected", label: "Đề nghị đã từ chối", to: "/admin/club-requests?status=rejected", Icon: XCircle },
] as const;
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
        <section className="ad-stat-grid" aria-label="Số liệu quản trị">
          {summaries.map(({ key, label, to, Icon }) => (
            <Link className={`ad-stat-card ${key}`} to={to} key={key}>
              <Icon className="ad-stat-icon" size={24} aria-hidden="true" />
              <span>{label}</span>
              <strong>{stats.data?.[key]}</strong>
            </Link>
          ))}
        </section>
      ) : (
        <PersonalState {...stats} showDiscoveryLink={false} />
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
                <ContentImage src={c.logo_url} alt="" fallbackText={c.name.trim().charAt(0).toLocaleUpperCase("vi-VN")} />
                <span className="ad-overview-club">
                  <strong>{c.name}</strong>
                  <small>Gửi {publicDate(c.created_at)}</small>
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
      <p className="ad-note">
        Quản trị viên xét duyệt việc thành lập CLB. Bài viết, hoạt động và thành
        viên được chủ nhiệm quản lý trong từng CLB.
      </p>
    </div>
  );
}
