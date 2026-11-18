import { Link } from "react-router-dom";

const accountActions = [
  { to: "/me/profile", title: "Hồ sơ sinh viên", detail: "Xem và cập nhật thông tin dùng cho tài khoản của bạn.", action: "Chỉnh sửa" },
  { to: "/me/registrations", title: "Hoạt động đã đăng ký", detail: "Kiểm tra lịch tham gia và quản lý đăng ký của bạn.", action: "Xem hoạt động" },
  { to: "/me/follows", title: "CLB đang quan tâm", detail: "Những CLB bạn đã lưu để tìm lại khi cần.", action: "Xem danh sách" },
  { to: "/me/club-requests", title: "Đề nghị thành lập CLB", detail: "Theo dõi trạng thái các đề nghị bạn đã gửi.", action: "Xem đề nghị" },
];

export function AccountOverview({ displayName }: { displayName: string }) {
  return <>
    <div className="ps-heading ps-account-heading"><div><span className="ps-eyebrow">Tài khoản sinh viên</span><h1>Chào {displayName}</h1><p>Quản lý thông tin và những hoạt động liên quan trực tiếp đến bạn.</p></div></div>
    <section className="ps-account-section" aria-labelledby="account-tasks"><h2 id="account-tasks">Việc của bạn</h2><div className="ps-account-list">{accountActions.map(item =>
      <Link className="ps-account-row" key={item.to} to={item.to}><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="ps-account-action">{item.action} →</span></Link>
    )}</div></section>
    <section className="ps-account-workspace" aria-labelledby="account-workspace"><div><span className="ps-eyebrow">Cộng đồng</span><h2 id="account-workspace">Sinh hoạt cùng CLB</h2><p>Mở không gian sinh hoạt để xem các CLB bạn đã tham gia, kênh trao đổi và công việc trong từng CLB.</p></div><Link className="ps-primary" to="/workspace">Vào không gian sinh hoạt →</Link></section>
  </>;
}
