import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { SupportNavigation } from './SupportShared';

const topics = [
  { id: 'all', title: 'Tất cả hướng dẫn', Icon: Question },
  { id: 'account', title: 'Tài khoản và hồ sơ', Icon: UserCircle },
  { id: 'clubs', title: 'Câu lạc bộ', Icon: UsersThree },
  { id: 'recruitment', title: 'Hoạt động và tuyển thành viên', Icon: ClipboardText },
  { id: 'meetings', title: 'Phòng họp trực tuyến', Icon: VideoCamera },
];
const questions = [
  { id: 'profile', topic: 'account', question: 'Tôi cập nhật thông tin cá nhân ở đâu?', answer: 'Mở menu avatar ở góc trên bên phải, chọn Không gian của tôi rồi vào Hồ sơ. Bạn có thể cập nhật thông tin sinh viên tại đây. Hãy điền đầy đủ các thông tin bắt buộc để sử dụng những chức năng yêu cầu hồ sơ hoàn chỉnh.', to: '/me/profile', action: 'Mở không gian cá nhân' },
  { id: 'club', topic: 'clubs', question: 'Làm thế nào để tham gia một câu lạc bộ?', answer: 'Tìm CLB trong mục Câu lạc bộ và mở đợt tuyển thành viên đang nhận đơn. Chọn ban muốn ứng tuyển, điền biểu mẫu rồi gửi đơn. Khi được duyệt, CLB sẽ xuất hiện trong Không gian sinh hoạt.', to: '/clubs', action: 'Khám phá câu lạc bộ' },
  { id: 'workspace', topic: 'clubs', question: 'Tôi xem các CLB đã tham gia ở đâu?', answer: 'Chọn Không gian sinh hoạt trên thanh điều hướng. Các CLB bạn đang là thành viên sẽ xuất hiện tại đây. Nếu không thấy một CLB, hãy kiểm tra kết quả ứng tuyển hoặc liên hệ chủ nhiệm CLB.', to: '/workspace', action: 'Mở không gian sinh hoạt' },
  { id: 'create', topic: 'clubs', question: 'Tôi muốn đề nghị thành lập CLB mới thì làm thế nào?', answer: 'Vào Không gian của tôi, mở mục đề nghị thành lập CLB và điền hồ sơ. Bạn cũng có thể dùng liên kết bên dưới. Trạng thái xét duyệt được hiển thị trong không gian cá nhân.', to: '/me/club-requests/new', action: 'Đề nghị thành lập CLB' },
  { id: 'applications', topic: 'recruitment', question: 'Tôi theo dõi kết quả ứng tuyển ở đâu?', answer: 'Mở mục đơn ứng tuyển trong Không gian của tôi để xem đơn đã gửi và trạng thái xét duyệt. Kết quả duyệt hoặc từ chối cũng được thông báo qua chiếc chuông trên trang chủ.', to: '/me/recruitment-applications', action: 'Xem đơn ứng tuyển' },
  { id: 'activities', topic: 'recruitment', question: 'Tôi tìm hoạt động đang diễn ra như thế nào?', answer: 'Mở mục Hoạt động, tìm theo tên và xem chi tiết để biết thời gian, địa điểm hoặc hướng dẫn tham gia. Bạn cần đăng nhập để thực hiện những thao tác đăng ký yêu cầu tài khoản.', to: '/activities', action: 'Khám phá hoạt động' },
  { id: 'media', topic: 'meetings', question: 'Vì sao camera hoặc microphone không hoạt động?', answer: 'Kiểm tra quyền camera và microphone trong trình duyệt, chọn đúng thiết bị rồi thử bật lại. Nếu đang thử từ điện thoại hoặc máy khác, hãy dùng liên kết HTTPS. Đóng ứng dụng khác đang sử dụng thiết bị nếu cần.' },
  { id: 'meeting-access', topic: 'meetings', question: 'Vì sao tôi phải chờ duyệt khi tham gia cuộc họp?', answer: 'Khi phòng chờ được bật, chủ phòng hoặc người điều hành cần duyệt yêu cầu của bạn. Với cuộc họp nội bộ CLB, bạn còn phải là thành viên đang hoạt động của CLB. Vai trò chủ nhiệm CLB không tự thay thế quyền chủ phòng của một cuộc họp.' },
  { id: 'report', topic: 'account', question: 'Tôi xem phản hồi cho báo cáo sự cố ở đâu?', answer: 'Mở Báo cáo của tôi trong khu vực hỗ trợ để xem trạng thái và phản hồi của quản trị viên. Bạn có thể mở lại báo cáo bằng mã đã nhận sau khi gửi.', to: '/help/reports', action: 'Theo dõi báo cáo' },
];
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export function HelpPage({ signedIn }: { signedIn: boolean }) {
  const [topic, setTopic] = useState('all'), [search, setSearch] = useState('');
  const visible = questions.filter(item => (topic === 'all' || item.topic === topic) && normalize(`${item.question} ${item.answer}`).includes(normalize(search.trim())));
  return <div className="uc-support"><div className="dc-container sp-container">
    <SupportNavigation current="Trợ giúp và hỗ trợ" signedIn={signedIn} />
    <section className="sp-hero"><div className="sp-eyebrow"><Question size={18} aria-hidden="true" /> TRUNG TÂM HỖ TRỢ</div><h1>Chúng mình có thể<br />giúp gì cho bạn?</h1><p>Tìm câu trả lời để trải nghiệm uniCircle dễ dàng hơn.</p>
      <label className="sp-search"><MagnifyingGlass size={23} aria-hidden="true" /><span className="dc-sr-only">Tìm kiếm hướng dẫn</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm câu hỏi, tính năng hoặc vấn đề…" maxLength={200} /><kbd aria-hidden="true">Tìm kiếm</kbd></label>
      <div className="sp-popular"><span>Thường tìm:</span>{[['clubs', 'Tham gia CLB'], ['meetings', 'Camera và mic'], ['recruitment', 'Đơn ứng tuyển']].map(([id, label]) => <button type="button" key={id} onClick={() => { setTopic(id); setSearch(''); }}>{label}</button>)}</div>
      <div className="sp-hero-orbit" aria-hidden="true"><Question weight="duotone" size={120} /></div>
    </section>
    <div className="sp-help-grid"><aside className="sp-topics"><h2>Chủ đề hỗ trợ</h2><nav aria-label="Chủ đề hỗ trợ">{topics.map(({ id, title, Icon }) => <button type="button" key={id} aria-pressed={id === topic} onClick={() => setTopic(id)}><Icon size={21} aria-hidden="true" /><span>{title}</span></button>)}</nav><div className="sp-topic-note"><p>Một báo cáo rõ ràng giúp chúng mình hỗ trợ bạn tốt hơn.</p><Link to="/report-issue">Báo cáo sự cố <ArrowUpRight size={16} aria-hidden="true" /></Link></div></aside>
      <section className="sp-faq" aria-labelledby="faq-title"><div className="sp-section-heading"><div><span className="sp-eyebrow">GIẢI ĐÁP NHANH</span><h2 id="faq-title">{topic === 'all' ? 'Câu hỏi thường gặp' : topics.find(item => item.id === topic)?.title}</h2></div><span className="sp-result-count" role="status">{visible.length} hướng dẫn</span></div>
        {visible.length ? <div className="sp-faq-list">{visible.map(item => <details key={item.id}><summary>{item.question}<CaretDown size={19} aria-hidden="true" /></summary><div><p>{item.answer}</p>{item.to && <Link to={item.to}>{item.action} <ArrowUpRight size={16} aria-hidden="true" /></Link>}</div></details>)}</div> : <div className="sp-empty"><MagnifyingGlass size={32} aria-hidden="true" /><h3>Chưa tìm thấy hướng dẫn phù hợp</h3><p>Thử từ khóa ngắn hơn hoặc chọn một chủ đề khác.</p><button type="button" onClick={() => { setSearch(''); setTopic('all'); }}>Xem tất cả hướng dẫn</button></div>}
      </section></div>
    <section className="sp-help-callout"><div className="sp-icon"><Question size={28} aria-hidden="true" /></div><div><h2>Vẫn cần thêm sự hỗ trợ?</h2><p>Gửi mô tả vấn đề. Chúng mình sẽ tiếp nhận và phản hồi ngay trong báo cáo của bạn.</p></div><Link className="sp-primary" to="/report-issue">Báo cáo sự cố <ArrowUpRight size={18} aria-hidden="true" /></Link></section>
  </div></div>;
}
