import { Link, useSearchParams } from "react-router-dom";
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
import { PersonalState } from "../components/PersonalState";

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
type ListKind = "clubs" | "follows" | "registrations" | "club-requests";
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
    PrivatePage<Membership | Follow | RegisteredActivity | ClubRequest>
  >(token, `me/${kind}?page=${page}&limit=12`);
  const titles = {
    clubs: "CLB tham gia",
    follows: "Đang quan tâm",
    registrations: "Hoạt động đã đăng ký",
    "club-requests": "Đề nghị thành lập CLB",
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
                : kind === "registrations"
                  ? "Theo dõi đăng ký và mở chi tiết để quản lý việc tham gia."
                  : "Theo dõi mọi đề nghị đã gửi, kể cả những đề nghị đã bị từ chối."}
          </p>
        </div>
        {kind === "club-requests" && (
          <Link className="ps-primary" to="/me/club-requests/new">
            Tạo đề nghị mới ↗
          </Link>
        )}
      </div>
      <p className="ps-count">
        {state.data ? `${state.data.total} mục · Trang ${page}` : "Đang tải…"}
      </p>
      {state.data?.items.length ? (
        <div className="ps-object-list">
          {state.data.items.map((row) => {
            if (kind === "clubs" || kind === "follows") {
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
                  ) : (
                    <Link
                      className="ps-text-link"
                      to={`/clubs/${item.club.club_id}`}
                    >
                      Xem CLB →
                    </Link>
                  )}
                </article>
              );
            }
            if (kind === "registrations") {
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
            }
            const item = row as ClubRequest;
            return (
              <article className="ps-object" key={item.club_id}>
                <ContentImage
                  src={item.logo_url || item.cover_url}
                  alt=""
                  className="ps-object-image"
                />
                <div>
                  <span className={`ps-status ${item.status}`}>
                    {requestStatus(item.status)}
                  </span>
                  <h2>
                    <Link to={`/me/club-requests/${item.club_id}`}>
                      {item.name}
                    </Link>
                  </h2>
                  <p>Gửi lúc {publicDate(item.created_at)}</p>
                </div>
                <Link
                  className="ps-text-link"
                  to={`/me/club-requests/${item.club_id}`}
                >
                  Xem hồ sơ →
                </Link>
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
      <nav className="ps-pagination" aria-label="Phân trang cá nhân">
        <button
          disabled={page <= 1 || state.loading}
          onClick={() => setParams({ page: String(page - 1) })}
        >
          ← Trang trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!state.data?.hasMore || state.loading}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Trang sau →
        </button>
      </nav>
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
    "me/clubs?page=1&limit=3",
  );
  const registrations = usePersonalQuery<PrivatePage<RegisteredActivity>>(
    token,
    "me/registrations?page=1&limit=3",
  );
  const requests = usePersonalQuery<PrivatePage<ClubRequest>>(
    token,
    "me/club-requests?page=1&limit=3",
  );
  return (
    <>
      <div className="ps-heading">
        <div>
          <h1>Không gian của tôi</h1>
          <p>
            {displayName}, đây là những cộng đồng và hoạt động bạn đang gắn bó.
          </p>
        </div>
        <Link className="ps-text-link" to="/clubs">
          Khám phá thêm ↗
        </Link>
      </div>
      <div className="ps-overview-grid">
        <section className="ps-panel">
          <div className="ps-panel-title">
            <h2>CLB tham gia</h2>
            <Link to="/me/clubs">Xem tất cả →</Link>
          </div>
          {clubs.data?.items.length ? (
            clubs.data.items.map((m) => (
              <Link
                className="ps-summary-row"
                to={`/workspace/${m.club.club_id}`}
                key={m.membership_id}
              >
                <ContentImage src={m.club.logo_url} alt="" />
                <span>
                  <strong>{m.club.name}</strong>
                  <small>
                    {m.role === "chairperson" ? "Chủ nhiệm" : "Thành viên"}
                  </small>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))
          ) : (
            <PersonalState
              {...clubs}
              empty="Chưa tham gia CLB nào. Bắt đầu từ một cộng đồng bạn yêu thích."
            />
          )}
        </section>
        <section className="ps-panel">
          <div className="ps-panel-title">
            <h2>Đề nghị CLB</h2>
            <Link to="/me/club-requests">Theo dõi →</Link>
          </div>
          {requests.data?.items.length ? (
            requests.data.items.map((r) => (
              <Link
                className="ps-summary-row"
                to={`/me/club-requests/${r.club_id}`}
                key={r.club_id}
              >
                <span>
                  <strong>{r.name}</strong>
                  <small>{requestStatus(r.status)}</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))
          ) : (
            <PersonalState
              {...requests}
              empty="Bạn chưa gửi đề nghị thành lập CLB."
            />
          )}
          <Link className="ps-text-link" to="/me/club-requests/new">
            Gửi đề nghị mới ↗
          </Link>
        </section>
        <section className="ps-panel ps-wide">
          <div className="ps-panel-title">
            <h2>Đăng ký gần đây</h2>
            <Link to="/me/registrations">Xem tất cả →</Link>
          </div>
          {registrations.data?.items.length ? (
            registrations.data.items.map((r) => (
              <div className="ps-summary-row" key={r.registration_id}>
                <span>
                  <strong>
                    {r.activity?.title || "Hoạt động không còn công khai"}
                  </strong>
                  <small>
                    {r.status === "registered" ? "Đã đăng ký" : "Đã hủy"}
                    {r.activity ? ` · ${publicDate(r.activity.starts_at)}` : ""}
                  </small>
                </span>
                {r.activity && (
                  <Link to={`/activities/${r.activity_id}`}>
                    Xem chi tiết →
                  </Link>
                )}
              </div>
            ))
          ) : (
            <PersonalState
              {...registrations}
              empty="Chưa có đăng ký. Khám phá một hoạt động để bắt đầu."
            />
          )}
        </section>
      </div>
    </>
  );
}
