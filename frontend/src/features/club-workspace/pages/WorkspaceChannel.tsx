import { Link, useParams } from "react-router-dom";
import { useClub } from "../workspace-context";

export type DraftChannel = { id: string; name: string; kind: "text" | "voice" };

const channels: Record<string, { title: string; description: string; kind: "text" | "voice" }> = {
  announcements: { title: "thông-báo", description: "Cập nhật từ ban chủ nhiệm và những việc cần biết.", kind: "text" },
  general: { title: "thảo-luận", description: "Nơi các thành viên cùng trao đổi.", kind: "text" },
  resources: { title: "tài-liệu", description: "Tài liệu và nội dung hữu ích cho CLB.", kind: "text" },
  questions: { title: "hỏi-đáp", description: "Câu hỏi và kinh nghiệm trong CLB.", kind: "text" },
  "voice-general": { title: "Phòng chung", description: "Lối vào nhanh cho cuộc gọi của CLB.", kind: "voice" },
  "voice-team": { title: "Họp nhóm", description: "Lối vào nhanh cho buổi trao đổi nhóm.", kind: "voice" },
};

export function WorkspaceChannel({ drafts = [] }: { drafts?: DraftChannel[] }) {
  const { channel } = useParams();
  const { club, clubId, onMeeting } = useClub();
  const draft = drafts.find(item => item.id === channel);
  const selected = draft ? { title: draft.name, description: "Kênh đang được phác thảo trên trình duyệt này.", kind: draft.kind } : channels[channel || ""];
  if (!selected) return <div className="cw-panel"><h1>Không tìm thấy kênh</h1><Link className="cw-link" to={`/workspace/${clubId}`}>Về tổng quan →</Link></div>;
  return <section className="cw-channel" aria-label={`Kênh ${selected.title}`}>
    <header className="cw-channel-header"><span className="cw-channel-hash" aria-hidden="true">{selected.kind === "voice" ? "◖" : "#"}</span><div><h1>{selected.title}</h1><p>{selected.description}</p></div><span className="cw-channel-club">{club.name}</span></header>
    {selected.kind === "voice" ? <div className="cw-voice-content"><div className="cw-channel-empty"><span className="cw-channel-empty-symbol" aria-hidden="true">◖</span><h2>Sẵn sàng kết nối?</h2><p>Vào nhanh công cụ họp để bắt đầu cuộc gọi. Phòng họp hiện được quản lý theo tài khoản và chưa gắn riêng với kênh này.</p><button className="cw-primary" onClick={onMeeting}>Mở công cụ gọi nhanh ↗</button></div></div> : <>
      <div className="cw-channel-history"><div className="cw-channel-empty"><span className="cw-channel-empty-symbol" aria-hidden="true">#</span><h2>Bắt đầu ở #{selected.title}</h2><p>Kênh này đang được chuẩn bị. Tin nhắn sẽ xuất hiện trực tiếp tại đây khi chức năng trao đổi của CLB được kết nối.</p>{channel === "announcements" && <Link to={`/workspace/${clubId}/posts`}>Xem bài viết của CLB →</Link>}</div></div>
      <div className="cw-channel-composer"><input aria-label={`Nhắn tin trong ${selected.title}`} placeholder={`Nhắn tin trong #${selected.title}`} disabled /><span>Chưa thể gửi tin nhắn</span></div>
    </>}
    {draft && <p className="cw-draft-notice">Bản nháp chỉ lưu trong phiên trình duyệt này. Kênh chưa được tạo trên hệ thống.</p>}
  </section>;
}
