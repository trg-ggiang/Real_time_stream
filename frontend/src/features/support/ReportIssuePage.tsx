import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Flag } from '@phosphor-icons/react/dist/csr/Flag';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Lightbulb } from '@phosphor-icons/react/dist/csr/Lightbulb';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { categories, createReport, reportCode, type Category, type ReportDraft, type SupportReport } from './support-api';
import { ReportStatusBadge, SupportLogin, SupportNavigation } from './SupportShared';

function ReportForm({ token, displayName }: { token: string; displayName?: string }) {
  const location = useLocation();
  const source = (location.state as { pagePath?: unknown } | null)?.pagePath;
  const initialPath = typeof source === 'string' && /^\/(?!\/)[^?#\\\s]*$/.test(source) ? source.slice(0, 500) : '';
  const [category, setCategory] = useState<Category | ''>('');
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [steps, setSteps] = useState('');
  const [pagePath, setPagePath] = useState(initialPath), [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState<SupportReport | null>(null);
  const id = useRef(crypto.randomUUID()), request = useRef<AbortController | null>(null);
  const receipt = useRef<HTMLElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (saved) receipt.current?.focus(); }, [saved]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (request.current) return;
    if (!category || title.trim().length < 5 || description.trim().length < 20) {
      setError('Chọn nhóm sự cố, nhập tiêu đề ít nhất 5 ký tự và mô tả ít nhất 20 ký tự.'); return;
    }
    if (pagePath.trim() && !/^\/(?!\/)[^?#\\\s]*$/.test(pagePath.trim())) {
      setError('Nhập đường dẫn trong uniCircle, ví dụ /workspace. Không kèm phần sau dấu ? hoặc #.'); return;
    }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    const draft: ReportDraft = { report_id: id.current, category, title: title.trim(), description: description.trim(),
      steps: steps.trim(), page_path: pagePath.trim(), priority };
    try {
      const response = await createReport(token, draft, controller.signal);
      if (!controller.signal.aborted) setSaved(response.item);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chưa gửi được báo cáo. Hãy thử lại.');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (saved) return <section className="sp-card sp-receipt" ref={receipt} tabIndex={-1} aria-labelledby="receipt-title">
    <span className="sp-success-icon"><CheckCircle size={42} weight="duotone" aria-hidden="true" /></span><h2 id="receipt-title">Đã tiếp nhận báo cáo của bạn</h2><p>Cảm ơn bạn đã giúp uniCircle tốt hơn. Bạn có thể theo dõi trạng thái và phản hồi từ quản trị viên trong Báo cáo của tôi.</p>
    <div className="sp-receipt-code"><span>Mã báo cáo</span><strong>{reportCode(saved.report_id)}</strong><ReportStatusBadge status={saved.status} /></div>
    <div className="sp-actions"><Link className="sp-primary" to={`/help/reports/${saved.report_id}`}>Theo dõi báo cáo <ArrowRight size={18} aria-hidden="true" /></Link><button type="button" onClick={() => { id.current = crypto.randomUUID(); setSaved(null); setTitle(''); setDescription(''); setSteps(''); setCategory(''); setPriority('normal'); }}>Gửi báo cáo khác</button></div>
  </section>;

  return <div className="sp-report-grid"><form className="sp-card sp-form" onSubmit={submit} aria-label="Báo cáo sự cố">
    <div className="sp-form-heading"><span className="sp-icon"><Flag size={23} aria-hidden="true" /></span><div><h2>Thông tin sự cố</h2><p>Các mục có dấu <span aria-hidden="true">*</span> là bắt buộc.</p></div></div>
    <fieldset disabled={busy}><legend className="dc-sr-only">Nội dung báo cáo</legend>
      <label htmlFor="report-category">Bạn gặp vấn đề ở đâu? <span aria-hidden="true">*</span></label><select id="report-category" required value={category} onChange={event => setCategory(event.target.value as Category | '')}><option value="">Chọn nhóm sự cố</option>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
      <label htmlFor="report-title">Tiêu đề sự cố <span aria-hidden="true">*</span></label><input id="report-title" required minLength={5} maxLength={150} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ví dụ: Không bật được microphone trong phòng họp" />
      <label htmlFor="report-description">Mô tả chi tiết <span aria-hidden="true">*</span></label><textarea id="report-description" required minLength={20} maxLength={5000} rows={6} value={description} onChange={event => setDescription(event.target.value)} aria-describedby="description-hint" placeholder="Bạn đang thực hiện thao tác gì? Điều gì xảy ra và bạn mong đợi kết quả như thế nào?" /><div className="sp-field-hint" id="description-hint"><span>Tối thiểu 20 ký tự. Không đưa mật khẩu hoặc mã xác thực vào báo cáo.</span><span>{description.length}/5000</span></div>
      <label htmlFor="report-steps">Các bước gặp sự cố <span className="sp-optional">Không bắt buộc</span></label><textarea id="report-steps" maxLength={3000} rows={3} value={steps} onChange={event => setSteps(event.target.value)} placeholder={'1. Mở trang…\n2. Nhấn vào…\n3. Sự cố xuất hiện…'} />
      <label htmlFor="report-path">Trang xảy ra sự cố <span className="sp-optional">Không bắt buộc</span></label><input id="report-path" maxLength={500} value={pagePath} onChange={event => setPagePath(event.target.value)} placeholder="Ví dụ: /workspace" aria-describedby="path-hint" /><p className="sp-field-hint" id="path-hint">Chỉ nhập đường dẫn trong website, không kèm tham số truy cập.</p>
      <div className="sp-field-label" id="impact-label">Mức độ ảnh hưởng</div><div className="sp-priorities" role="radiogroup" aria-labelledby="impact-label">{([['normal', 'Thông thường', 'Tôi vẫn có thể sử dụng các tính năng khác.'], ['high', 'Ảnh hưởng nhiều', 'Tôi không thể tiếp tục thao tác cần thiết.']] as const).map(([value, label, hint]) => <label key={value} className={priority === value ? 'is-selected' : ''}><input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}</div>
    </fieldset>
    {error && <div className="sp-error" role="alert"><p>{error}</p><Link to="/help/reports">Kiểm tra báo cáo đã gửi</Link></div>}
    <div className="sp-form-footer"><p>Gửi với tài khoản <strong>{displayName || 'của bạn'}</strong></p><button className="sp-primary" type="submit" disabled={busy}><PaperPlaneTilt size={19} aria-hidden="true" />{busy ? 'Đang gửi báo cáo…' : 'Gửi báo cáo'}</button></div>
  </form><aside className="sp-report-aside"><section className="sp-card sp-guidance"><span className="sp-icon"><Lightbulb size={25} aria-hidden="true" /></span><h2>Giúp chúng mình hiểu rõ hơn</h2><p>Một vài chi tiết nhỏ sẽ giúp việc kiểm tra nhanh và chính xác hơn.</p><ol><li><strong>Mô tả điều bạn nhìn thấy</strong><span>Ghi lại thông báo lỗi hoặc tính năng không hoạt động.</span></li><li><strong>Cho biết cách lặp lại</strong><span>Liệt kê các thao tác dẫn đến sự cố.</span></li><li><strong>Theo dõi phản hồi</strong><span>Quản trị viên sẽ cập nhật ngay trong báo cáo của bạn.</span></li></ol></section><div className="sp-aside-help"><h3>Có thể bạn đã có câu trả lời</h3><p>Xem hướng dẫn về tài khoản, CLB và phòng họp trước khi gửi báo cáo.</p><Link to="/help">Mở trung tâm trợ giúp <ArrowRight size={16} aria-hidden="true" /></Link></div></aside></div>;
}

export function ReportIssuePage({ token, displayName }: { token?: string; displayName?: string }) {
  return <div className="uc-support"><div className="dc-container sp-container"><SupportNavigation current="Báo cáo sự cố" signedIn={!!token} /><header className="sp-page-heading"><span className="sp-eyebrow">CHÚNG MÌNH LUÔN LẮNG NGHE</span><h1>Bạn gặp sự cố gì?</h1><p>Chia sẻ vấn đề bạn gặp phải để cùng xây dựng một uniCircle tốt hơn.</p></header>{token ? <ReportForm token={token} displayName={displayName} /> : <SupportLogin returnTo="/report-issue" />}</div></div>;
}
