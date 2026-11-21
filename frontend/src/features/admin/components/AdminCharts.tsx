import type { AdminSummary } from '../admin-model';

export function AdminCharts({ data }: { data: AdminSummary }) {
  const registrations = data.registrations ?? [];
  const max = Math.max(3, ...registrations.map(day => day.count));
  const points = registrations.map((day, index) => `${40 + index * 80},${160 - day.count / max * 120}`).join(' ');
  const statuses = [
    { label: 'Đã công khai', value: data.published, color: 'var(--ad-chart-blue, #245dc1)' },
    { label: 'Đang chờ xét duyệt', value: data.pending, color: 'var(--ad-chart-amber, #b77913)' },
    { label: 'Đã từ chối', value: data.rejected, color: 'var(--ad-chart-red, #bc3e50)' },
    { label: 'Tạm ngừng', value: data.suspended ?? 0, color: 'var(--ad-chart-gray, #73829b)' },
    { label: 'Đã lưu trữ', value: data.archived ?? 0, color: 'var(--ad-chart-light, #b0bdd0)' },
  ];
  const total = statuses.reduce((sum, status) => sum + status.value, 0);
  let offset = 0;
  return <div className="ad-chart-grid">
    <section className="ad-panel ad-registration-chart"><div className="ad-section-heading"><h2>Tài khoản mới</h2><span>7 ngày gần nhất</span></div>
      <div className="ad-chart-total"><strong>{registrations.reduce((sum, day) => sum + day.count, 0)}</strong><span>tài khoản mới / {data.users ?? 0} tài khoản</span></div>
      {registrations.length ? <svg viewBox="0 0 560 205" role="img" aria-label={`Tài khoản mới theo ngày: ${registrations.map(day => `${day.date}: ${day.count}`).join(', ')}`}>
        {[0, 1, 2, 3].map(index => <g key={index}><line x1="40" x2="520" y1={40 + index * 40} y2={40 + index * 40} stroke="var(--ad-line)" /><text x="26" y={44 + index * 40} textAnchor="end">{Math.round(max * (3 - index) / 3)}</text></g>)}
        <polygon points={`40,160 ${points} 520,160`} fill="var(--ad-accent-soft)" />
        <polyline points={points} fill="none" stroke="var(--ad-accent)" strokeWidth="3" strokeLinejoin="round" />
        {registrations.map((day, index) => <g key={day.date}><circle cx={40 + index * 80} cy={160 - day.count / max * 120} r="4" fill="var(--ad-accent)"><title>{day.date}: {day.count} tài khoản</title></circle><text x={40 + index * 80} y="190" textAnchor="middle">{day.date.slice(8)}/{day.date.slice(5, 7)}</text></g>)}
      </svg> : <p>Chưa có dữ liệu theo ngày.</p>}
    </section>
    <section className="ad-panel"><div className="ad-section-heading"><h2>Trạng thái CLB</h2><span>{data.clubs ?? total} CLB</span></div><div className="ad-donut-layout">
      <svg viewBox="0 0 160 160" role="img" aria-label={`Trạng thái CLB: ${statuses.map(status => `${status.label}: ${status.value}`).join(', ')}`}>
        <circle cx="80" cy="80" r="58" fill="none" stroke="var(--ad-line)" strokeWidth="18" />
        {statuses.filter(status => status.value > 0).map(status => { const start = offset; const fraction = status.value / Math.max(1, total); offset += fraction * 100;
          return <circle key={status.label} cx="80" cy="80" r="58" pathLength="100" fill="none" stroke={status.color} strokeWidth="18" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"><title>{status.label}: {status.value}</title></circle>;
        })}<text x="80" y="80" textAnchor="middle" className="ad-donut-total">{total}</text><text x="80" y="101" textAnchor="middle">câu lạc bộ</text>
      </svg><ul className="ad-chart-legend">{statuses.map(status => <li key={status.label}><span className="ad-legend-color" style={{ background: status.color }} /><span>{status.label}</span><strong>{status.value}</strong></li>)}</ul>
    </div></section>
    <section className="ad-panel ad-content-chart"><div className="ad-section-heading"><h2>Nội dung cộng đồng</h2><span>Toàn hệ thống</span></div><div className="ad-bar-chart">{[{ label: 'Bài viết', value: data.posts ?? 0 }, { label: 'Hoạt động', value: data.activities ?? 0 }].map(item => <div key={item.label}><span>{item.label}</span><div className="ad-bar-track"><span style={{ width: `${item.value / Math.max(1, data.posts ?? 0, data.activities ?? 0) * 100}%` }} /></div><strong>{item.value}</strong></div>)}</div></section>
  </div>;
}
