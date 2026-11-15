import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { GuestHero } from './GuestHero';
import { publicDate, safePublicUrl, usePublicContent, type Collection, type PublicItem } from './public-content';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './guest.css';
import './guest-editorial.css';

const sectionNavigation = [
  { id: 'guest-clubs', label: 'Câu lạc bộ' },
  { id: 'guest-activities', label: 'Hoạt động' },
  { id: 'guest-posts', label: 'Bài viết' },
];
type ContentState = ReturnType<typeof usePublicContent>;
type Selection = { item: PublicItem; kind: Collection };

function LinkedText({ text = '' }: { text?: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const url = part.replace(/[.,;:!?\)\]\}]+$/, '');
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return part;
      return <span key={index}><a href={parsed.href} target="_blank" rel="noopener noreferrer">{url}</a>{part.slice(url.length)}</span>;
    } catch { return part; }
  })}</>;
}

function PublicImage({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = safePublicUrl(src);
  return url && !failed ? <img className={className} src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    : <div className={`${className} guest-image-placeholder`} aria-label={alt || 'Chưa có hình ảnh'}><span aria-hidden="true">u.</span></div>;
}
function CollectionStatus({ state, empty }: { state: ContentState; empty: string }) {
  if (state.loading) return <div className="guest-skeleton" role="status">Đang tải nội dung…</div>;
  if (state.error) return <div className="guest-empty" role="alert"><p>{state.error}</p><button className="guest-secondary" onClick={state.retry}>Thử lại</button></div>;
  if (!state.items.length) return <p className="guest-empty">{empty}</p>;
  return state.hasMore ? <button className="guest-secondary guest-more" onClick={state.loadMore}>Xem thêm</button> : null;
}
function ContentDialog({ selection, close, requestLogin, signedIn }: { selection: Selection; close: () => void; requestLogin: (message: string) => void; signedIn: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { item, kind } = selection;
  useEffect(() => { const element = ref.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog className="guest-dialog" ref={ref} onCancel={close} aria-labelledby="guest-detail-title">
    <button className="guest-dialog-close" aria-label="Đóng" onClick={close}><X size={24} /></button>
    <p className="guest-overline">{kind === 'clubs' ? 'Câu lạc bộ' : kind === 'activities' ? 'Hoạt động công khai' : 'Bài viết công khai'}</p>
    <h2 id="guest-detail-title">{item.name || item.title}</h2>
    {item.club_name && <p>{item.club_name}</p>}
    {safePublicUrl(item.cover_url) && <PublicImage key={item.cover_url} src={item.cover_url} alt="" className="guest-dialog-image" />}
    {item.summary && <p>{item.summary}</p>}
    <p className="guest-long-text"><LinkedText text={item.content || item.description} /></p>
    {item.mission && <><h3>Sứ mệnh</h3><p className="guest-long-text"><LinkedText text={item.mission} /></p></>}
    {kind === 'activities' && <dl className="guest-metadata">
      <dt>Bắt đầu</dt><dd>{publicDate(item.starts_at)}</dd><dt>Kết thúc</dt><dd>{publicDate(item.ends_at)}</dd>
      <dt>Hình thức</dt><dd>{item.format === 'online' ? 'Trực tuyến' : item.format === 'offline' ? 'Trực tiếp' : item.format === 'hybrid' ? 'Kết hợp' : item.format || 'Chưa cập nhật'}</dd>
      <dt>Địa điểm</dt><dd>{[item.location_name, item.location_address].filter(Boolean).join(', ') || 'Chưa cập nhật'}</dd>
      <dt>Mở đăng ký</dt><dd>{publicDate(item.registration_opens_at)}</dd><dt>Hạn đăng ký</dt><dd>{publicDate(item.registration_closes_at)}</dd>
      {item.capacity != null && <><dt>Số lượng tối đa</dt><dd>{item.capacity}</dd></>}
      <dt>Trạng thái</dt><dd>{{ scheduled: 'Sắp diễn ra', ongoing: 'Đang diễn ra', completed: 'Đã kết thúc', cancelled: 'Đã hủy' }[item.lifecycle_status || ''] || 'Xem thông báo của CLB'}</dd>
    </dl>}
    {item.contact_email && <p>Email liên hệ: {item.contact_email}</p>}
    {item.contact_phone && <p>Điện thoại liên hệ: {item.contact_phone}</p>}
    <div className="guest-dialog-actions">{!signedIn && <button className="guest-primary" onClick={() => requestLogin('Đăng nhập để thực hiện các thao tác với CLB và hoạt động.')}>Đăng nhập </button>}<button className="guest-secondary" onClick={close}>Tiếp tục khám phá</button></div>
  </dialog>;
}

export function GuestLanding({ viewer, onMeeting, onLogout }: { viewer?: { displayName: string }; onMeeting?: () => void; onLogout?: () => void } = {}) {
  const clubs = usePublicContent('clubs');
  const activities = usePublicContent('activities');
  const posts = usePublicContent('posts');
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const gateRef = useRef<HTMLDialogElement>(null);
  const query = search.trim().toLocaleLowerCase('vi');
  const visibleClubs = clubs.items.filter(item => `${item.name} ${item.summary} ${item.description}`.toLocaleLowerCase('vi').includes(query));
  function requestLogin(message: string) { setSelection(null); setGate(message); }
  useEffect(() => { if (!gate) return; const element = gateRef.current; element?.showModal(); return () => element?.close(); }, [gate]);
  useEffect(() => {
    const sections = sectionNavigation.map(({ id }) => document.getElementById(id));
    let frame = 0;
    const update = () => {
      frame = 0;
      const headerBottom = document.querySelector('.guest-header')?.getBoundingClientRect().bottom ?? 0;
      const readingLine = headerBottom + (window.innerHeight - headerBottom) * 0.2;
      let current: string | null = null;
      for (const section of sections) {
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top <= readingLine) current = section.id;
      }
      setActiveSection(current);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    sections.forEach(section => { if (section) observer?.observe(section); });
    update();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);
  return <div className="guest-landing" data-signed-in={!!viewer}>
    <a href="#guest-content" className="guest-skip">Đến nội dung</a>
    <header className="guest-header"><a className="guest-brand" href="/">uni<b>circle</b></a>
      <nav aria-label="Điều hướng công khai">{sectionNavigation.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>)}</nav>
      <div className="guest-auth">{viewer ? <><span className="guest-viewer">Sinh viên · {viewer.displayName}</span><button className="guest-primary" type="button" onClick={onMeeting}>Cuộc họp</button><button type="button" onClick={onLogout}>Đăng xuất</button></> : <><a href="/?mode=login">Đăng nhập</a><a className="guest-primary" href="/?mode=register">Đăng ký </a></>}</div>
    </header>
    <GuestHero />
    <main id="guest-content">
<section id="guest-clubs" className="guest-section"><h2>Cùng tần số, <span>cùng đam mê.</span></h2><div className="guest-toolbar"><label>Tìm CLB<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc sở thích…" /></label></div>
<div className="guest-club-grid">{visibleClubs.map(item => <article className="guest-club-card" key={item.club_id}><div className="guest-club-media"><PublicImage src={item.cover_url} alt="" /></div><div className="guest-club-copy"><button className="guest-card-title" onClick={() => setSelection({ item, kind: 'clubs' })}><span>{item.name}</span></button><p>{item.summary}</p><div className="guest-card-actions"><button className="guest-text-action" onClick={() => setSelection({ item, kind: 'clubs' })}>Xem CLB</button><button className="guest-save" aria-label={`Quan tâm ${item.name}`} onClick={() => requestLogin(`Đăng nhập để quan tâm ${item.name}.`)}>Quan tâm</button></div></div></article>)}</div>
        {!visibleClubs.length && clubs.items.length > 0 && <p className="guest-empty">Không có CLB phù hợp trong danh sách đã tải. Thử từ khóa khác hoặc tải thêm CLB.</p>}
        <CollectionStatus state={clubs} empty="Chưa có câu lạc bộ được công khai. Bạn có thể quay lại sau để khám phá." />
      </section>
      <section id="guest-activities" className="guest-section">
        <h2>Khám phá <span>các hoạt động.</span></h2>
        <div className="guest-event-agenda">{activities.items.map(item => <article key={item.activity_id} className="guest-event-row">
          <time className="guest-event-date" dateTime={item.starts_at}>{item.starts_at && Number.isFinite(Date.parse(item.starts_at)) ? <><strong>{new Date(item.starts_at).toLocaleDateString('vi-VN', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</strong><span>{new Date(item.starts_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}</span></> : <span>Chờ cập nhật</span>}</time>
          <div className="guest-event-image"><PublicImage src={item.cover_url} alt="" /></div>
          <div className="guest-event-copy">
            <div className="guest-card-eyeline" title={item.club_name}>{item.club_name}</div>
            <h3><button onClick={() => setSelection({ item, kind: 'activities' })}>{item.title}</button></h3>
            <p>{item.summary}</p>
            <div className="guest-event-details"><span>{item.location_name}</span>{item.lifecycle_status === 'completed' && <span>Đã kết thúc</span>}</div>
          </div>
          <div className="guest-event-actions"><button className="guest-text-action" onClick={() => setSelection({ item, kind: 'activities' })}>Xem hoạt động</button><button className="guest-save" aria-label={`Quan tâm ${item.title}`} onClick={() => requestLogin(`Đăng nhập để quan tâm hoạt động ${item.title}.`)}>Quan tâm</button></div>
        </article>)}</div>
        <CollectionStatus state={activities} empty="Chưa có hoạt động công khai. Lịch hoạt động mới sẽ xuất hiện tại đây." />
      </section>
      <section id="guest-posts" className="guest-section">
        <h2>Chuyện mới <span>từ các CLB.</span></h2>
        <div className="guest-story-layout">{posts.items.map((item, index) => <article key={item.post_id} className={`guest-story${index === 0 ? ' guest-story-featured' : ''}`}>
          <div className="guest-story-image"><PublicImage src={item.cover_url} alt="" /></div>
          <div className="guest-story-copy">
            <div className="guest-card-eyeline" title={item.club_name}>{item.club_name}</div>
            <h3><button onClick={() => setSelection({ item, kind: 'posts' })}>{item.title}</button></h3>
            <p>{item.summary}</p>
            <p className="guest-story-date">{publicDate(item.published_at)}</p>
            <button className="guest-text-action" onClick={() => setSelection({ item, kind: 'posts' })}>Đọc câu chuyện</button>
          </div>
        </article>)}</div>
        <CollectionStatus state={posts} empty="Chưa có bài viết công khai từ các CLB." />
      </section>
      <section className="guest-join"><h2>Câu chuyện sinh viên của bạn,<br /><span>còn nhiều trang để viết.</span></h2>{viewer ? <button className="guest-primary" type="button" onClick={onMeeting}>Mở cuộc họp</button> : <a className="guest-primary" href="/?mode=register">Đăng ký </a>}<p>{viewer ? 'Khám phá cộng đồng và kết nối với bạn bè.' : 'Tạo tài khoản để kết nối cùng cộng đồng.'}</p></section>
    </main><footer className="guest-footer"><a className="guest-brand" href="/">unicircle</a><p>Kết nối đam mê. Mở rộng thế giới.</p></footer>
    {selection && <ContentDialog selection={selection} close={() => setSelection(null)} requestLogin={requestLogin} signedIn={!!viewer} />}
    {gate && <dialog className="guest-dialog" ref={gateRef} onCancel={() => setGate(null)} aria-labelledby="guest-gate-title"><button className="guest-dialog-close" aria-label="Đóng" onClick={() => setGate(null)}><X size={24} /></button><h2 id="guest-gate-title">Một bước để kết nối</h2><p>{gate}</p><div className="guest-dialog-actions"><a className="guest-primary" href="/?mode=login">Đăng nhập </a><a className="guest-secondary" href="/?mode=register">Đăng ký</a></div><button className="guest-text-action" onClick={() => setGate(null)}>Tiếp tục khám phá</button></dialog>}
  </div>;
}
