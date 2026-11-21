import { PaginationButton } from "../../../shared/components/PaginationButton";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { ContentImage } from "../../discovery/components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import { usePersonalQuery } from "../use-personal-query";
import {
  type ClubRequest,
  type Follow,
  type Membership,
  type PrivatePage,
  type RegisteredActivity,
} from "../services/personal-api";
import { PersonalEmpty, PersonalState } from "../components/PersonalState";

const labels = {
  pending: "Chờ xét duyệt",
  published: "Đã duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  suspended: "Tạm dừng",
  archived: "Đã lưu trữ",
};
export const requestStatus = (status: string) =>
  labels[status as keyof typeof labels] || "Đang cập nhật";
type ClubTab = "joined" | "pending" | "managed";

export function PersonalClubsPage({ token }: { token: string }) {
  const [tab, setTab] = useState<ClubTab>("joined");
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    token,
    "me/clubs?page=1&limit=24",
  );
  const requests = usePersonalQuery<PrivatePage<ClubRequest>>(
    token,
    "me/club-requests?page=1&limit=24",
  );
  const joined = clubs.data?.items ?? [];
  const managed = joined.filter((club) => club.role === "chairperson");
  const pending = requests.data?.items.filter((request) => request.status === "pending") ?? [];
  const entries = tab === "managed" ? managed : joined;
  return (
    <section className="ps-clubs-page">
      <div className="ps-clubs-heading">
        <div>
          <h1>CLB của tôi</h1>
          <p>Những cộng đồng bạn đang đồng hành.</p>
        </div>
        <Link className="ps-primary" to="/me/club-requests/new">
          <Plus size={18} aria-hidden="true" />Tạo câu lạc bộ
        </Link>
      </div>
      <div className="ps-club-tabs" role="tablist" aria-label="Danh sách CLB">
        <button role="tab" aria-selected={tab === "joined"} className={tab === "joined" ? "active" : ""} onClick={() => setTab("joined")}>
          Đã tham gia <span className="ps-tab-count">({clubs.data?.total ?? "…"})</span>
        </button>
        <button role="tab" aria-selected={tab === "pending"} className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
          Đang chờ duyệt <span className="ps-tab-count">({requests.data ? pending.length : "…"})</span>
        </button>
        <button role="tab" aria-selected={tab === "managed"} className={tab === "managed" ? "active" : ""} onClick={() => setTab("managed")}>
          Đang quản lý <span className="ps-tab-count">({clubs.data ? managed.length : "…"})</span>
        </button>
      </div>
      <div className="ps-club-tab-content" role="tabpanel">
        {tab === "pending" ? (
          pending.length ? <div className="ps-club-cards">{pending.map((request) => (
            <Link className="ps-club-card" to={`/me/club-requests/${request.club_id}`} key={request.club_id}>
              <div className="ps-club-card-media"><ContentImage src={request.cover_url} alt="" fallbackText={request.name.trim().charAt(0).toLocaleUpperCase("vi-VN")} /></div>
              <div className="ps-club-card-copy"><strong>{request.name}</strong><small>{requestStatus(request.status)} · Gửi ngày {publicDate(request.created_at)}</small><span className="ps-club-card-link">Xem yêu cầu <ArrowRight size={15} aria-hidden="true" /></span></div>
            </Link>
          ))}</div> : requests.loading ? <p className="ps-club-empty">Đang tải đề nghị…</p> : <PersonalEmpty><p>Bạn chưa có đề nghị CLB nào đang chờ duyệt.</p></PersonalEmpty>
        ) : entries.length ? (
          <div className="ps-club-cards">{entries.map((membership) => (
            <Link className="ps-club-card" to={`/workspace/${membership.club.club_id}`} key={membership.membership_id}>
              <div className="ps-club-card-media"><ContentImage src={membership.club.cover_url} alt="" fallbackText={membership.club.name.trim().charAt(0).toLocaleUpperCase("vi-VN")} /></div>
              <div className="ps-club-card-copy"><strong>{membership.club.name}</strong><small className="ps-status ps-club-role">{membership.role === "chairperson" ? "Chủ nhiệm · Đang quản lý" : membership.role === "head" ? "Trưởng ban" : "Thành viên"}</small><span className="ps-club-card-link ps-club-card-action">Mở không gian <ArrowRight size={15} aria-hidden="true" /></span></div>
            </Link>
          ))}</div>
        ) : clubs.loading ? <p className="ps-club-empty">Đang tải CLB…</p> : <PersonalEmpty><p>{tab === "managed" ? "Bạn chưa quản lý CLB nào." : "Bạn chưa tham gia CLB nào."}</p></PersonalEmpty>}
      </div>
    </section>
  );
}

type ActivityTab = "registered" | "clubs" | "completed";

export function PersonalActivitiesPage({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<ActivityTab>("registered");
  const [view, setView] = useState<"list" | "calendar">("list");
  const raw = Number(params.get("page") || 1);
  const page = Number.isInteger(raw) ? Math.min(10000, Math.max(1, raw)) : 1;
  const registrations = usePersonalQuery<PrivatePage<RegisteredActivity>>(
    token,
    `me/registrations?page=${page}&limit=24`,
  );
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    token,
    "me/clubs?page=1&limit=24",
  );
  const rows = registrations.data?.items ?? [];
  const memberClubIds = new Set(clubs.data?.items.map((club) => club.club.club_id) ?? []);
  const registered = rows.filter((row) => row.status === "registered");
  const fromMemberClubs = registered.filter((row) => row.activity && memberClubIds.has(row.activity.club_id));
  const completed = registered.filter((row) => row.activity && (row.activity.lifecycle_status === "completed" || Date.parse(row.activity.ends_at) < Date.now()));
  const visibleRows = tab === "clubs" ? fromMemberClubs : tab === "completed" ? completed : registered;
  const tabs: [ActivityTab, string, number | string][] = [
    ["registered", "Đã đăng ký", registrations.data ? registered.length : "…"],
    ["clubs", "Từ CLB đã tham gia", clubs.data && registrations.data ? fromMemberClubs.length : "…"],
    ["completed", "Đã hoàn thành", registrations.data ? completed.length : "…"],
  ];
  return (
    <section className="ps-activities-page">
      <div className="ps-activities-heading">
        <div><h1>Hoạt động của tôi</h1><p>Lưu giữ trải nghiệm và lên lịch cho những điều mới.</p></div>
        <div className="ps-activity-view-toggle" role="group" aria-label="Kiểu hiển thị hoạt động">
          <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} aria-label="Xem dạng danh sách" title="Xem dạng danh sách" onClick={() => setView("list")}><ListBullets size={19} /></button>
          <button className={view === "calendar" ? "active" : ""} aria-pressed={view === "calendar"} aria-label="Xem dạng lịch" title="Xem dạng lịch" onClick={() => setView("calendar")}><CalendarBlank size={19} /></button>
        </div>
      </div>
      <div className="ps-activity-tabs" role="tablist" aria-label="Lọc hoạt động">
        {tabs.map(([id, label, count]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label} <span className="ps-tab-count">({count})</span></button>)}
      </div>
      {registrations.error ? <PersonalState {...registrations} /> : visibleRows.length ? (
        <div className={view === "calendar" ? "ps-activity-list is-calendar" : "ps-activity-list"}>
          {visibleRows.map((row) => <article className="ps-activity-item" key={row.registration_id}>
            <ContentImage src={row.activity?.cover_url} alt="" />
            <div className="ps-activity-copy">
              <span className={`ps-status ${row.status}`}>{row.status === "registered" ? "Đã đăng ký" : "Đã hủy"}</span>
              <h2>{row.activity ? <Link to={`/activities/${row.activity_id}`}>{row.activity.title}</Link> : "Hoạt động không còn công khai"}</h2>
              <p>{row.activity ? `${row.activity.club_name} · ${publicDate(row.activity.starts_at)}` : "Lịch sử đăng ký vẫn được giữ; nội dung riêng tư không hiển thị."}</p>
            </div>
            {row.activity && <Link className="ps-text-link" to={`/activities/${row.activity_id}`}>Chi tiết <ArrowRight size={16} /></Link>}
          </article>)}
        </div>
      ) : registrations.loading || clubs.loading ? <p className="ps-activity-empty">Đang tải hoạt động…</p> : <PersonalEmpty><p>{tab === "clubs" ? "Chưa có hoạt động từ các CLB bạn tham gia." : tab === "completed" ? "Chưa có hoạt động nào đã hoàn thành." : "Bạn chưa đăng ký hoạt động nào."}</p></PersonalEmpty>}
      {registrations.data && registrations.data.total > registrations.data.limit && (
        <nav className="ps-pagination" aria-label="Phân trang hoạt động">
          <PaginationButton direction="previous" disabled={page <= 1 || registrations.loading} onClick={() => setParams({ page: String(page - 1) })} />
          <span>Trang {page}</span>
          <PaginationButton direction="next" disabled={!registrations.data?.hasMore || registrations.loading} onClick={() => setParams({ page: String(page + 1) })} />
        </nav>
      )}
    </section>
  );
}

type ListKind = "clubs" | "follows" | "registrations";
export function PersonalLists({
  token,
  kind,
}: {
  token: string;
  kind: ListKind;
}) {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("page") || 1);
  const page = Number.isInteger(raw) ? Math.min(10000, Math.max(1, raw)) : 1;
  const state = usePersonalQuery<
    PrivatePage<Membership | Follow | RegisteredActivity>
  >(token, `me/${kind}?page=${page}&limit=12`);
  const titles = {
    clubs: "CLB tham gia",
    follows: "Đang quan tâm",
    registrations: "Hoạt động đã đăng ký",
  };
  return (
    <>
      <div className="ps-heading">
        <div>
          <h1>{titles[kind]}</h1>
          <p>
            {kind === "clubs"
              ? "Vai trò được xác định riêng trong từng CLB."
              : kind === "follows"
                ? "Lưu một CLB để tìm lại. Quan tâm không đồng nghĩa là thành viên."
                : "Theo dõi đăng ký và mở chi tiết để quản lý việc tham gia."}
          </p>
        </div>
        {kind === "clubs" && (
          <Link className="ps-primary" to="/me/club-requests/new">
            Tạo câu lạc bộ ↗
          </Link>
        )}
      </div>
      <p className="ps-count" hidden={kind === "follows" && state.data?.total === 0}>
        {state.data ? `${state.data.total} mục · Trang ${page}` : "Đang tải…"}
      </p>
      {state.data?.items.length ? (
        <div className={kind === "follows" ? "ps-follow-grid" : "ps-object-list"}>
          {state.data.items.map((row) => {
            if (kind === "follows") {
              const item = row as Follow;
              return (
                <article className="ps-follow-card" key={item.club.club_id}>
                  <Link className="ps-follow-cover" to={`/clubs/${item.club.club_id}`} tabIndex={-1} aria-hidden="true">
                    <ContentImage src={item.club.cover_url || item.club.logo_url} alt="" />
                  </Link>
                  <div className="ps-follow-copy">
                    <div className="ps-follow-identity">
                      <ContentImage src={item.club.logo_url} alt="" className="ps-follow-logo" />
                      <h2><Link to={`/clubs/${item.club.club_id}`}>{item.club.name}</Link></h2>
                    </div>
                    <p className="ps-follow-status">Đang quan tâm</p>
                    {item.club.summary && <p className="ps-follow-summary">{item.club.summary}</p>}
                    <Link className="ps-text-link" to={`/clubs/${item.club.club_id}`}>Xem CLB <ArrowRight size={15} aria-hidden="true" /></Link>
                  </div>
                </article>
              );
            }
            if (kind === "clubs") {
              const item = row as Membership & Follow;
              return (
                <article className="ps-object" key={item.club.club_id}>
                  <ContentImage
                    src={item.club.logo_url || item.club.cover_url}
                    alt=""
                    className="ps-object-image"
                  />
                  <div>
                    <h2>
                      <Link to={`/clubs/${item.club.club_id}`}>
                        {item.club.name}
                      </Link>
                    </h2>
                    <p>
                      {kind === "clubs"
                        ? item.role === "chairperson"
                          ? "Chủ nhiệm · Có quyền quản lý CLB này"
                          : "Thành viên"
                        : "Đang quan tâm"}
                    </p>
                    <p className="ps-small">{item.club.summary}</p>
                  </div>
                  {kind === "clubs" ? (
                    <Link
                      className="ps-text-link"
                      to={`/workspace/${item.club.club_id}`}
                    >
                      Mở không gian →
                    </Link>
                  ) : null}
                </article>
              );
            }
            const item = row as RegisteredActivity;
            return (
              <article className="ps-object" key={item.registration_id}>
                <ContentImage
                  src={item.activity?.cover_url}
                  alt=""
                  className="ps-object-image"
                />
                <div>
                  <span className={`ps-status ${item.status}`}>
                    {item.status === "registered" ? "Đã đăng ký" : "Đã hủy"}
                  </span>
                  <h2>
                    {item.activity ? (
                      <Link to={`/activities/${item.activity_id}`}>
                        {item.activity.title}
                      </Link>
                    ) : (
                      "Hoạt động không còn công khai"
                    )}
                  </h2>
                  <p>
                    {item.activity
                      ? `${item.activity.club_name} · ${publicDate(item.activity.starts_at)}`
                      : "Lịch sử đăng ký vẫn được giữ; nội dung riêng tư không hiển thị."}
                  </p>
                  {item.activity?.lifecycle_status === "cancelled" && (
                    <p>Hoạt động đã bị hủy bởi CLB.</p>
                  )}
                </div>
                {item.activity && (
                  <Link
                    className="ps-text-link"
                    to={`/activities/${item.activity_id}`}
                  >
                    Quản lý đăng ký →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <PersonalState
          {...state}
          empty={
            kind === "clubs"
              ? "Bạn chưa là thành viên CLB nào. Hãy khám phá cộng đồng và tìm hiểu cách tham gia từ từng CLB."
              : kind === "follows"
                ? "Chưa có CLB quan tâm. Mở trang CLB và bấm Quan tâm để lưu tại đây."
                : kind === "registrations"
                  ? "Bạn chưa có đăng ký hoạt động nào."
                  : "Bạn chưa gửi đề nghị thành lập CLB."
          }
        />
      )}
      {state.data && state.data.total > state.data.limit && (
        <nav className="ps-pagination" aria-label="Phân trang cá nhân">
          <PaginationButton direction="previous" disabled={page <= 1 || state.loading}
            onClick={() => setParams({ page: String(page - 1) })} />
          <span>Trang {page}</span>
          <PaginationButton direction="next" disabled={!state.data?.hasMore || state.loading}
            onClick={() => setParams({ page: String(page + 1) })} />
        </nav>
      )}
    </>
  );
}

export function PersonalOverview({
  token,
  displayName,
}: {
  token: string;
  displayName: string;
}) {
  const clubs = usePersonalQuery<PrivatePage<Membership>>(
    token,
    "me/clubs?page=1&limit=24",
  );
  const registrations = usePersonalQuery<PrivatePage<RegisteredActivity>>(
    token,
    "me/registrations?page=1&limit=3",
  );
  const requests = usePersonalQuery<PrivatePage<ClubRequest>>(
    token,
    "me/club-requests?page=1&limit=24",
  );
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[nameParts.length - 1] || displayName;
  const pendingRequests = requests.data?.items.filter((request) => request.status === "pending").length ?? 0;
  return (
    <div className="ps-overview">
      <section className="ps-overview-hero">
        <div>
          <span className="ps-overview-eyebrow">MỖI NGÀY, MỘT KẾT NỐI MỚI</span>
          <h1>Chào {firstName}, ngày mới tốt lành!</h1>
          <p>Đây là những điều đang diễn ra trong cộng đồng của bạn.</p>
        </div>
        <Link className="ps-primary" to="/clubs">Khám phá CLB <ArrowRight size={18} /></Link>
      </section>
      <section className="ps-stat-grid" aria-label="Tóm tắt tài khoản">
        <article className="ps-stat-card"><strong>{clubs.data?.total ?? "—"}</strong><span className="ps-stat-icon blue"><Users size={19} /></span><small>CLB đã tham gia</small></article>
        <article className="ps-stat-card"><strong>{clubs.data ? clubs.data.items.filter((club) => club.role === "chairperson").length : "—"}</strong><span className="ps-stat-icon purple"><ShieldCheck size={19} /></span><small>CLB đang quản lý</small></article>
        <article className="ps-stat-card"><strong>{requests.data ? pendingRequests : "—"}</strong><span className="ps-stat-icon amber"><Clock size={19} /></span><small>Yêu cầu chờ duyệt</small></article>
        <article className="ps-stat-card"><strong>{registrations.data?.total ?? "—"}</strong><span className="ps-stat-icon green"><CalendarBlank size={19} /></span><small>Hoạt động đã đăng ký</small></article>
      </section>
      <Link className="ps-journey-banner" to="/activities">
        <Sparkle size={31} aria-hidden="true" />
        <span><strong>Hành trình của bạn đang tiếp diễn</strong><small>Đừng bỏ lỡ những người bạn mới và các trải nghiệm thú vị.</small></span>
        <span className="ps-journey-action">Khám phá hoạt động <ArrowRight size={17} /></span>
      </Link>
      <section className="ps-community-section">
        <div className="ps-community-heading"><h2>Cộng đồng của bạn</h2><Link to="/me/clubs">Xem tất cả <ArrowRight size={17} /></Link></div>
        {clubs.data?.items.length ? (
          <div className="ps-community-list">{clubs.data.items.slice(0, 3).map((m) => (
            <Link className="ps-community-card" to={`/workspace/${m.club.club_id}`} key={m.membership_id}>
              <ContentImage
                src={m.club.logo_url}
                alt=""
                fallbackText={m.club.name.trim().charAt(0).toLocaleUpperCase("vi-VN")}
              />
              <span><strong>{m.club.name}</strong><small>{m.role === "chairperson" ? "Chủ nhiệm" : m.role === "head" ? "Trưởng ban" : "Thành viên"}</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}</div>
        ) : <PersonalState {...clubs} empty="Bạn chưa tham gia CLB nào. Hãy khám phá cộng đồng và tìm hiểu cách tham gia từ từng CLB." />}
      </section>
    </div>
  );
}
