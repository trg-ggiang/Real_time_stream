import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { safePublicUrl, publicDate, publicDateOnly } from "../../../shared/lib/content-format";
import {
  itemPath,
  type PublicItem,
  type Collection,
} from "../services/discovery-api";

export function ContentImage({
  src,
  alt = "",
  className = "",
  eager = false,
  showFallbackText = true,
  fallbackText = "uniCircle",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  eager?: boolean;
  showFallbackText?: boolean;
  fallbackText?: string;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  const url = safePublicUrl(src);
  return url && failed !== url ? (
    <img
      className={`${className} ${/logo\.(webp|png|jpg)/i.test(url) ? "dc-source-logo" : ""}`}
      src={url}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(url)}
    />
  ) : (
    <div
      className={`dc-image-fallback ${className}`}
      role="img"
      aria-label={alt || "Chưa có hình ảnh"}
    >
      {showFallbackText && <span>{fallbackText}</span>}
    </div>
  );
}
export function LinkedText({ text = "" }: { text?: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, index) => {
        if (!/^https?:\/\//i.test(part)) return part;
        const clean = part.replace(/[.,;:!?\)\]\}]+$/, "");
        const href = safePublicUrl(clean);
        return href ? (
          <span key={index}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {clean}
            </a>
            {part.slice(clean.length)}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}
export function QueryState({
  loading,
  error,
  retry,
  empty,
  notFound = false,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  empty?: string;
  notFound?: boolean;
}) {
  if (loading)
    return (
      <div className="dc-loading" role="status">
        <span />
        <span />
        <span />
        <p>Đang kết nối với cộng đồng…</p>
      </div>
    );
  if (error)
    return (
      <div className="dc-state" role="alert">
        <h2>
          {notFound ? "Nội dung chưa khả dụng" : "Chưa tải được nội dung"}
        </h2>
        <p>{error}</p>
        {!notFound && <button onClick={retry}>Thử lại</button>}{" "}
        <Link to="/">Về khám phá</Link>
      </div>
    );
  return empty ? (
    <div className="dc-state">
      <p>{empty}</p>
    </div>
  ) : null;
}
export function ClubCard({ item }: { item: PublicItem }) {
  return (
    <article className="dc-club-card">
      <Link
        to={itemPath("clubs", item)}
        className="dc-card-photo"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ContentImage
          src={item.cover_url || item.logo_url}
          className={!item.cover_url && item.logo_url ? "dc-club-photo-logo" : undefined}
        />
      </Link>
      <div className="dc-club-identity">
        <ContentImage src={item.logo_url} className="dc-logo" />
        <h3>
          <Link to={itemPath("clubs", item)}>{item.name}</Link>
        </h3>
      </div>
      <p>{item.summary || "Khám phá câu chuyện và hoạt động của CLB."}</p>
      <Link className="dc-inline" to={itemPath("clubs", item)}>
        Tìm hiểu CLB <ArrowUpRight aria-hidden="true" />
      </Link>
    </article>
  );
}
export function ActivityCard({ item }: { item: PublicItem }) {
  const day =
    item.starts_at && Number.isFinite(Date.parse(item.starts_at))
      ? new Date(item.starts_at)
      : null;
  const ended = item.ends_at && Date.parse(item.ends_at) < Date.now();
  return (
    <article className="dc-event">
      <Link
        to={itemPath("activities", item)}
        className="dc-event-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ContentImage src={item.cover_url} />
      </Link>
      <div className="dc-event-body">
        <time dateTime={item.starts_at} className="dc-date">
          {day ? (
            <>
              <strong>
                {day.toLocaleDateString("vi-VN", {
                  day: "numeric",
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </strong>
              <span>
                {day.toLocaleDateString("vi-VN", {
                  month: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </span>
            </>
          ) : (
            <span>Chờ lịch</span>
          )}
        </time>
        <div>
          <p className="dc-meta">{item.club_name}{item.entry_type==='recruitment'&&' · Tuyển thành viên'}</p>
          <h3>
            <Link to={itemPath("activities", item)}>{item.title}</Link>
          </h3>
          <p className="dc-meta">
            {item.entry_type==='recruitment'?'Ứng tuyển trực tuyến':item.location_name || "Xem thông tin địa điểm"}
            {item.lifecycle_status === "cancelled"
              ? " · Đã hủy"
              : ended
                ? (
                  <span className="dc-event-ended">
                    <span className="dc-event-status-separator">{" · "}</span>
                    Đã kết thúc
                  </span>
                )
                : ""}
          </p>
        </div>
      </div>
    </article>
  );
}
export function PostCard({
  item,
  featured = false,
  landing = false,
}: {
  item: PublicItem;
  featured?: boolean;
  landing?: boolean;
}) {
  return (
    <article className={`dc-post ${featured ? "dc-post-featured" : ""}`}>
      <Link
        to={itemPath("posts", item)}
        className="dc-post-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ContentImage src={item.cover_url} showFallbackText={!landing} />
      </Link>
      <div>
        <p className="dc-meta">
          {item.club_name} · {landing ? publicDateOnly(item.published_at) : publicDate(item.published_at)}
        </p>
        <h3>
          <Link to={itemPath("posts", item)}>{item.title}</Link>
        </h3>
        <p>{item.summary}</p>
        <Link className="dc-inline" to={itemPath("posts", item)}>
          Đọc câu chuyện <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
export function ContentCards({
  kind,
  items,
  landing = false,
}: {
  kind: Collection;
  items: PublicItem[];
  landing?: boolean;
}) {
  return (
    <div
      className={
        kind === "clubs"
          ? "dc-clubs-grid"
          : kind === "activities"
            ? "dc-events-grid"
            : "dc-posts-grid"
      }
    >
      {items.map((item, i) =>
        kind === "clubs" ? (
          <ClubCard key={item.club_id} item={item} />
        ) : kind === "activities" ? (
          <ActivityCard key={item.activity_id} item={item} />
        ) : (
          <PostCard key={item.post_id} item={item} featured={i === 0} landing={landing} />
        ),
      )}
    </div>
  );
}
