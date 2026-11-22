import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useClub } from "../workspace-context";
import { useWorkspaceMutation } from "../use-workspace-mutation";
import {
  workspaceRequest,
  type WorkspaceContext,
} from "../services/workspace-api";
import {
  ContentImage,
  LinkedText,
} from "../../discovery/components/PublicContent";
import { useUnsavedChanges } from "../../../shared/lib/use-unsaved-changes";
import { ImageUpload } from '../../../shared/components/ImageUpload';
import { useAutoDismiss } from '../../../shared/lib/use-auto-dismiss';
export { MeetingsEntry, RecurringMeetings } from "./WorkspaceMeetingsEntries";
export function ClubInformation() {
  const { club, clubId, token, membership, reload, notify } = useClub();
  const [values, setValues] = useState({
    contact_email: club.contact_email || "",
    contact_phone: club.contact_phone || "",
    logo_url: club.logo_url || "",
    cover_url: club.cover_url || "",
  });
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  useAutoDismiss(message, () => setMessage(''));
  const mutation = useWorkspaceMutation();
  useUnsavedChanges(dirty);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (uploading) return;
    const r = await mutation.run((signal) =>
      workspaceRequest<WorkspaceContext>(token, clubId, "contact", {
        method: "PATCH",
        signal,
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(values).map(([k, v]) => [k, v.trim() || null]),
          ),
        ),
      }),
    );
    if (r) {
      setDirty(false);
      setMessage("Đã cập nhật thông tin liên hệ và ảnh.");
      notify("Đã cập nhật thông tin liên hệ và ảnh.");
      reload();
    }
  }
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>Thông tin CLB</h1>
          <p>
            Tên, giới thiệu và sứ mệnh đã được duyệt. Chức năng gửi thay đổi các
            mục này để quản trị viên xét duyệt sẽ được bổ sung sau.
          </p>
        </div>
      </div>
      <div className="cw-info-grid">
        <section className="cw-panel">
          <ContentImage
            src={club.cover_url || club.logo_url}
            className="cw-info-cover"
            alt="Ảnh CLB"
          />
          <h2>{club.name}</h2>
          <p>{club.summary}</p>
          <div className="cw-long-text">
            <LinkedText text={club.description} />
          </div>
          {club.mission && (
            <>
              <h2>Sứ mệnh</h2>
              <p>{club.mission}</p>
            </>
          )}
        </section>
        <form className="cw-panel" onSubmit={save}>
          <h2>Liên hệ và hình ảnh</h2>
          {(
            [
              ["contact_email", "Email", "email", 320],
              ["contact_phone", "Điện thoại", "tel", 32],
            ] as const
          ).map(([key, label, type, limit]) => (
            <label key={key}>
              {label}
              <input
                type={type}
                maxLength={limit}
                value={values[key]}
                disabled={membership.role !== "chairperson" || mutation.busy}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [key]: e.target.value }));
                  setDirty(true);
                  setMessage("");
                }}
              />
            </label>
          ))}
          {(['logo_url', 'cover_url'] as const).map(key => <ImageUpload key={key} token={token} label={key === 'logo_url' ? 'Logo CLB' : 'Ảnh bìa CLB'} value={values[key]} disabled={membership.role !== 'chairperson' || mutation.busy || uploading} onBusyChange={setUploading} onChange={url => { setValues(v => ({ ...v, [key]: url })); setDirty(true); setMessage(''); }} />)}
          <p className="cw-muted">
            Chọn ảnh từ thiết bị; hệ thống tự lưu đường dẫn ảnh. Chỉ chủ nhiệm được lưu các thay đổi này.
          </p>
          {membership.role === "chairperson" && (
            <button className="cw-primary" disabled={!dirty || mutation.busy || uploading}>
              Lưu thông tin
            </button>
          )}
          {mutation.error && (
            <p role="alert" className="cw-error">
              {mutation.error}
            </p>
          )}
          {message && (
            <p role="status" className="cw-success">
              {message}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
export function ReviewHome() {
  const { clubId } = useClub();
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>Những nội dung chờ duyệt</h1>
          <p>
            Quyết định trong CLB này; không phải hàng đợi admin duyệt thành lập
            CLB.
          </p>
        </div>
      </div>
      <div className="cw-home-grid">
        <section className="cw-panel">
          <h2>Bài viết</h2>
          <p>
            Đọc bản gửi của thành viên, duyệt đăng hoặc yêu cầu chỉnh sửa kèm lý
            do.
          </p>
          <Link
            className="cw-link"
            to={`/workspace/${clubId}/posts?list=review`}
          >
            Xem bài viết chờ duyệt →
          </Link>
        </section>
        <section className="cw-panel">
          <h2>Hoạt động</h2>
          <p>
            Kiểm tra thời gian, địa điểm và thông tin đăng ký trước khi công
            khai.
          </p>
          <Link
            className="cw-link"
            to={`/workspace/${clubId}/activities?list=review`}
          >
            Xem hoạt động chờ duyệt →
          </Link>
        </section>
      </div>
    </>
  );
}
