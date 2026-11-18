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
export function MeetingsEntry() {
  const { club, onMeeting } = useClub();
  return (
    <>
      <div className="cw-heading">
        <div>
          <h1>Gặp nhau, cùng trao đổi</h1>
          <p>Mở công cụ họp trực tuyến từ không gian {club.name}.</p>
        </div>
      </div>
      <section className="cw-panel cw-meeting-entry">
        <h2>Camera, màn hình và cuộc trò chuyện</h2>
        <p>
          Mọi thành viên có thể tạo phòng. Quyền host/moderator được quản lý
          trong từng cuộc họp, độc lập với vai trò CLB.
        </p>
        <button className="cw-primary" onClick={onMeeting}>
          Mở công cụ phòng họp ↗
        </button>
        <p className="cw-muted">
          Công cụ họp hiện hiển thị phòng theo tài khoản, chưa có danh sách
          phòng riêng cho từng CLB. Rời công cụ họp sẽ quay về trang này.
        </p>
      </section>
    </>
  );
}
export function RecurringMeetings() {
  const { club, onMeeting } = useClub();
  return <>
    <div className="cw-heading"><div><span className="cw-eyebrow">Lịch sinh hoạt</span><h1>Họp định kỳ</h1><p>Tạo chuỗi buổi họp và chọn lịch lặp trong công cụ họp hiện có.</p></div></div>
    <section className="cw-panel cw-meeting-entry"><h2>Lên lịch họp cho {club.name}</h2><p>Công cụ họp hỗ trợ tạo cuộc họp lặp hằng ngày, hằng tuần, hằng tháng hoặc hằng năm. Chọn “Họp theo lịch” rồi thiết lập chu kỳ và buổi đầu tiên.</p><button className="cw-primary" onClick={onMeeting}>Mở công cụ tạo họp định kỳ ↗</button><p className="cw-muted">Cuộc họp được lưu theo tài khoản. Công cụ hiện chưa gắn cuộc họp với CLB này, nên thành viên khác cần được mời bằng đường dẫn hoặc mã họp.</p></section>
  </>;
}
export function ClubInformation() {
  const { club, clubId, token, membership, reload } = useClub();
  const [values, setValues] = useState({
    contact_email: club.contact_email || "",
    contact_phone: club.contact_phone || "",
    logo_url: club.logo_url || "",
    cover_url: club.cover_url || "",
  });
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const mutation = useWorkspaceMutation();
  useUnsavedChanges(dirty);
  async function save(e: FormEvent) {
    e.preventDefault();
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
              ["logo_url", "URL logo", "url", 2048],
              ["cover_url", "URL ảnh bìa", "url", 2048],
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
          <p className="cw-muted">
            Ảnh dùng URL công khai, chưa có upload file. Chỉ chủ nhiệm được lưu
            các thay đổi này.
          </p>
          {membership.role === "chairperson" && (
            <button className="cw-primary" disabled={!dirty || mutation.busy}>
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
