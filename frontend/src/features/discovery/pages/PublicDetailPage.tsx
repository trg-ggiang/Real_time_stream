import { Link, useLocation, useParams } from "react-router-dom";
import { authFormHref } from "../../auth/redirect";
import { AccountAction } from "../../personal/components/AccountAction";
import "../../personal/personal.css";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { usePublicDetail } from "../hooks/use-public-query";
import {
  ContentImage,
  LinkedText,
  QueryState,
} from "../components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import type { Collection } from "../services/discovery-api";

export function PublicDetailPage({
  kind,
  signedIn,
  accessToken,
}: {
  kind: Collection;
  signedIn: boolean;
  accessToken?: string;
}) {
  const { id = "" } = useParams();
  const location = useLocation();
  const result = usePublicDetail(kind, id);
  const item = result.data;
  const login = authFormHref("login", `${location.pathname}${location.search}${location.hash}`);
  if (!item)
    return (
      <div className="dc-container dc-detail-state">
        <QueryState {...result} />
      </div>
    );
  const club = kind === "clubs";
  const ended = Boolean(item.ends_at && Date.parse(item.ends_at) <= Date.now());
  const cancelled = item.lifecycle_status === "cancelled";
  return (
    <article className="dc-container dc-detail-page">
      <Link className="dc-back" to={`/${kind}`}>
        ←{" "}
        {club ? "Câu lạc bộ" : kind === "activities" ? "Hoạt động" : "Bài viết"}
      </Link>
      <div className="dc-detail-heading">
        {item.club_name && (
          <Link className="dc-owner" to={`/clubs/${item.club_id}`}>
            {item.club_name}
          </Link>
        )}
        <h1>{item.name || item.title}</h1>
        <p>{item.summary}</p>
        {kind === "posts" && (
          <p className="dc-meta">Đăng ngày {publicDate(item.published_at)}</p>
        )}
      </div>
      <ContentImage
        src={item.cover_url || item.logo_url}
        alt={`Ảnh ${item.name || item.title}`}
        className={`dc-detail-cover ${!item.cover_url && item.logo_url ? "dc-contain" : ""}`}
        eager
      />
      <div className="dc-detail-columns">
        <div className="dc-detail-copy">
          <h2>
            {club
              ? "Một cộng đồng, nhiều câu chuyện"
              : kind === "activities"
                ? "Về hoạt động"
                : "Câu chuyện"}
          </h2>
          <div className="dc-rich-text">
            <LinkedText
              text={
                item.content ||
                item.description ||
                "Nội dung đang được cập nhật."
              }
            />
          </div>
          {item.mission && (
            <>
              <h2>Điều chúng mình hướng đến</h2>
              <div className="dc-rich-text">
                <LinkedText text={item.mission} />
              </div>
            </>
          )}
          {club && (
            <div className="dc-detail-more">
              <h2>Tiếp tục khám phá</h2>
              <Link to="/activities">
                Hoạt động cộng đồng <ArrowUpRight aria-hidden="true" />
              </Link>
              <Link to="/posts">
                Bài viết từ các CLB <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
        <aside className="dc-detail-aside">
          <div className="dc-information">
            <h2>
              {club
                ? "Kết nối với CLB"
                : kind === "activities"
                  ? "Thông tin tham gia"
                  : "Được chia sẻ bởi CLB"}
            </h2>
            {kind === "activities" && (
              <dl>
                <dt>Bắt đầu</dt>
                <dd>{publicDate(item.starts_at)}</dd>
                <dt>Kết thúc</dt>
                <dd>{publicDate(item.ends_at)}</dd>
                <dt>Hình thức</dt>
                <dd>
                  {{
                    onsite: "Trực tiếp",
                    offline: "Trực tiếp",
                    online: "Trực tuyến",
                    hybrid: "Kết hợp",
                  }[item.format || ""] || "Đang cập nhật"}
                </dd>
                <dt>Địa điểm</dt>
                <dd>
                  {[item.location_name, item.location_address]
                    .filter(Boolean)
                    .join(", ") || "Xem hướng dẫn từ CLB"}
                </dd>
                <dt>Hạn đăng ký</dt>
                <dd>
                  {publicDate(item.registration_closes_at || item.starts_at)}
                </dd>
                <dt>Sức chứa</dt>
                <dd>
                  {item.capacity == null
                    ? "Không giới hạn theo cấu hình"
                    : `${item.capacity} người`}
                </dd>
              </dl>
            )}
            {item.contact_email && (
              <p>
                <span className="dc-meta">Email liên hệ</span>
                <br />
                {item.contact_email}
              </p>
            )}
            {item.contact_phone && (
              <p>
                <span className="dc-meta">Điện thoại</span>
                <br />
                {item.contact_phone}
              </p>
            )}
            {kind !== "posts" && (
              <>
                {signedIn && accessToken ? (
                  <AccountAction
                    key={`${kind}:${id}`}
                    token={accessToken}
                    id={id}
                    kind={club ? "follow" : "registration"}
                    unavailable={
                      !club &&
                      (ended ||
                        cancelled ||
                        (!!item.registration_closes_at &&
                          Date.parse(item.registration_closes_at) <=
                            Date.now()))
                    }
                  />
                ) : cancelled || ended ? (
                  <p className="dc-event-status">
                    {cancelled ? "Hoạt động đã hủy" : "Hoạt động đã kết thúc"}
                  </p>
                ) : (
                  <a className="dc-button" href={login}>
                    Đăng nhập để {club ? "quan tâm" : "đăng ký"}{" "}
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
                <p className="dc-meta">
                  {club
                    ? "Quan tâm giúp lưu CLB, không đồng nghĩa trở thành thành viên."
                    : "Tài khoản và hồ sơ sinh viên hoàn chỉnh là điều kiện để đăng ký."}
                </p>
              </>
            )}
            {kind === "posts" && (
              <Link className="dc-inline" to={`/clubs/${item.club_id}`}>
                Tìm hiểu CLB <ArrowUpRight aria-hidden="true" />
              </Link>
            )}
          </div>
          <p className="dc-meta">
            Nội dung công khai phục vụ dự án mô phỏng. Xem nguồn tham khảo và
            hướng dẫn chi tiết trong phần mô tả trước khi tham gia.
          </p>
        </aside>
      </div>
    </article>
  );
}
