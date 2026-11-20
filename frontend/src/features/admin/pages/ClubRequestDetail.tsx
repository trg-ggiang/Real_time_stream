import { Link } from "react-router-dom";
import { usePersonalQuery } from "../../personal/use-personal-query";
import { PersonalState } from "../../personal/components/PersonalState";
import {
  ContentImage,
} from "../../discovery/components/PublicContent";
import { publicDate } from "../../../shared/lib/content-format";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { accountRequest } from "../../../shared/api/account-http";
import { useAccountMutation } from "../../../shared/lib/use-account-mutation";
import { useUnsavedChanges } from "../../../shared/lib/use-unsaved-changes";
import { clubStatus, type AdminDetail } from "../admin-model";
export function RequestDetailRoute({
  token,
  directory,
}: {
  token: string;
  directory?: boolean;
}) {
  const { id = "" } = useParams();
  return (
    <RequestDetail
      key={`${token}:${id}`}
      id={id}
      token={token}
      directory={directory}
    />
  );
}
function RequestDetail({
  id,
  token,
  directory,
}: {
  id: string;
  token: string;
  directory?: boolean;
}) {
  const result = usePersonalQuery<AdminDetail>(token, `admin/clubs/${id}`);
  const mutation = useAccountMutation();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const item = result.data?.item;
  useUnsavedChanges(!!reason && item?.status === "pending");
  async function decide(decision: "approve" | "reject") {
    if (
      !item ||
      !window.confirm(
        decision === "approve"
          ? `Duyệt và công khai ${item.name}?`
          : `Từ chối đề nghị ${item.name}?`,
      )
    )
      return;
    const r = await mutation.run((signal) =>
      accountRequest<{ item: AdminDetail["item"] }>(
        token,
        `admin/clubs/${id}/decision`,
        {
          method: "PATCH",
          signal,
          body: JSON.stringify({
            decision,
            expected_updated_at: item.updated_at,
            ...(decision === "reject" ? { reason: reason.trim() } : {}),
          }),
        },
      ),
    );
    if (r) {
      setReason("");
      setMessage(
        decision === "approve"
          ? "Đã duyệt CLB. Trang công khai sẽ hiển thị khi tải lại."
          : "Đã từ chối đề nghị và lưu lý do cho người gửi.",
      );
      result.retry();
    }
  }
  if (!item)
    return (
      <>
        <h1>Hồ sơ CLB</h1>
        <PersonalState {...result} showDiscoveryLink={false} />
        <Link to="/admin/club-requests">← Danh sách đề nghị</Link>
      </>
    );
  const { creator, reviewer } = result.data!;
  return (
    <>
      <Link
        className="ad-back"
        to={directory ? "/admin/clubs" : "/admin/club-requests"}
      >
        ← {directory ? "Danh sách CLB" : "Danh sách đề nghị"}
      </Link>
      <div className="ad-heading">
        <div>
          <h1>{item.name}</h1>
          <p>{item.summary}</p>
        </div>
        <span className={`ad-status ${item.status}`}>
          {clubStatus(item.status)}
        </span>
      </div>
      {message && (
        <p className="ad-success" role="status">
          {message}
        </p>
      )}
      <div className="ad-detail-grid">
        <article className="ad-panel ad-reading">
          <ContentImage
            src={item.cover_url || item.logo_url}
            alt="Ảnh giới thiệu CLB"
            className="ad-cover"
          />
          <h2>Giới thiệu CLB</h2>
          {item.description}
          {!!item.category_names?.length && (
            <p><strong>Loại CLB:</strong> {item.category_names.join(", ")}</p>
          )}
          {item.mission && (
            <>
              <h2>Sứ mệnh</h2>
              {item.mission}
            </>
          )}
          <h2>Thông tin liên hệ</h2>
          <dl className="ad-meta">
            <dt>Email</dt>
            <dd>
              {item.contact_email || "Chưa cung cấp"}
            </dd>
            <dt>Điện thoại</dt>
            <dd>{item.contact_phone || "Chưa cung cấp"}</dd>
          </dl>
        </article>
        <aside className="ad-review-column">
          <section className="ad-panel">
            <h2>Thông tin hồ sơ</h2>
            <dl className="ad-meta">
              <dt>Người gửi</dt>
              <dd>
                {creator?.display_name || "Không còn thông tin người gửi"}
              </dd>
              <dt>Email tài khoản</dt>
              <dd>{creator?.email || "—"}</dd>
              <dt>Ngày gửi</dt>
              <dd>{publicDate(item.created_at)}</dd>
              <dt>Cập nhật lần cuối</dt>
              <dd>{publicDate(item.updated_at)}</dd>
            </dl>
          </section>
          <section className="ad-panel">
            <h2>
              {item.status === "pending"
                ? "Quyết định xét duyệt"
                : "Kết quả xét duyệt"}
            </h2>
            {item.status === "pending" ? (
              <>
                <p>
                  Đọc nội dung và liên hệ trước khi công khai CLB cho sinh viên.
                </p>
                <label>
                  Lý do từ chối
                  <textarea
                    aria-label="Lý do từ chối"
                    value={reason}
                    maxLength={2000}
                    disabled={mutation.busy}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <p className="ad-note">
                  Bắt buộc khi từ chối. Người gửi xem được lý do và có thể tạo
                  đề nghị mới.
                </p>
                <div className="ad-actions">
                  <button
                    className="ad-primary"
                    disabled={mutation.busy}
                    onClick={() => decide("approve")}
                  >
                    {mutation.busy ? "Đang xử lý…" : "Duyệt và công khai"}
                  </button>
                  <button
                    className="ad-reject"
                    disabled={mutation.busy || !reason.trim()}
                    onClick={() => decide("reject")}
                  >
                    Từ chối đề nghị
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>{clubStatus(item.status)}</p>
                <dl className="ad-meta">
                  <dt>Người xét duyệt</dt>
                  <dd>{reviewer?.display_name || "Chưa có thông tin"}</dd>
                  <dt>Thời điểm xét duyệt</dt>
                  <dd>
                    {item.reviewed_at
                      ? publicDate(item.reviewed_at)
                      : "Chưa có thông tin"}
                  </dd>
                </dl>
                {item.review_note && (
                  <div className="ad-review-note">
                    <h3>Phản hồi đã lưu</h3>
                    <p>{item.review_note}</p>
                  </div>
                )}
                <p className="ad-note">
                  Hồ sơ đã có kết quả; không thể duyệt hoặc từ chối lại tại đây.
                </p>
              </>
            )}
            {mutation.error && (
              <p className="ad-error" role="alert">
                {mutation.error}
              </p>
            )}
            <button
              className="ad-refresh"
              disabled={mutation.busy || result.loading}
              onClick={result.retry}
            >
              Tải lại trạng thái hồ sơ
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
