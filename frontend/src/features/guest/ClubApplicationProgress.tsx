import './club-application-progress.css';

export type ClubApplicationStatus = { club_id: string; name: string; status: string; created_at: string | null; reviewed_at?: string | null; review_note?: string | null };

export function ClubApplicationProgress({ request }: { request: ClubApplicationStatus }) {
  const approved = ['approved', 'published'].includes(request.status);
  const rejected = request.status === 'rejected';
  const final = approved || rejected;
  const currentStep = final ? 3 : 2;
  const status = rejected ? 'Đơn bị từ chối' : approved ? 'Đã duyệt' : 'Đang chờ duyệt';
  const date = request.created_at && Number.isFinite(Date.parse(request.created_at))
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(request.created_at)) : 'Đang cập nhật';
  return <section className={'club-application-progress' + (rejected ? ' is-rejected' : approved ? ' is-approved' : '')} aria-label={'Tiến độ đơn thành lập CLB ' + request.name}>
    <div className="club-application-progress-heading"><div><span className="club-application-progress-label">Theo dõi tiến độ đơn</span><strong>{request.name}</strong></div><span className="club-application-progress-status">{status}</span></div>
    <div className="club-progress-steps" data-current-step={currentStep}>
      <span className="club-progress-line"><span /></span>
      <div className="club-progress-step is-complete"><i aria-hidden="true">✓</i><span>Đã gửi</span></div>
      <div className={'club-progress-step ' + (final ? 'is-complete' : 'is-current')}><i aria-hidden="true">{rejected ? '×' : final ? '✓' : '2'}</i><span>{rejected ? 'Đã từ chối' : approved ? 'Đã duyệt' : 'Chờ duyệt'}</span></div>
      <div className={'club-progress-step ' + (final ? 'is-complete' : '')}><i aria-hidden="true">{final ? '✓' : '3'}</i><span>Kết quả</span></div>
    </div>
    <p className="club-application-progress-footnote">Đã gửi ngày {date}{request.review_note ? ' · ' + request.review_note : ''}</p>
  </section>;
}
