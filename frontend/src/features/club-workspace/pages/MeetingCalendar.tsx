import { useMemo, useState } from 'react';
import type { ClubMeeting } from '../services/workspace-api';

type Entry = { meeting: ClubMeeting; session: ClubMeeting['meeting_sessions'][number]; date: Date };
const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const dayLabel = (date: Date) => date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

export function MeetingCalendar({ meetings, onOpen, onShare }: {
  meetings: ClubMeeting[];
  onOpen: (meeting: ClubMeeting, sessionId: string) => void;
  onShare: (meeting: ClubMeeting, sessionId: string) => void;
}) {
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [agenda, setAgenda] = useState<'week' | 'month'>('week');
  const entries = useMemo(() => meetings.flatMap(meeting => meeting.meeting_sessions.flatMap(session => {
    if (!session.scheduled_start_at) return [];
    const date = new Date(session.scheduled_start_at);
    return Number.isFinite(date.getTime()) ? [{ meeting, session, date }] : [];
  })).sort((a, b) => a.date.getTime() - b.date.getTime()), [meetings]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedEntries = entries.filter(entry => keyOf(entry.date) === keyOf(selected));
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const days = Array.from({ length: Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  const weekStart = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - (selected.getDay() + 6) % 7);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const weekEntries = entries.filter(entry => entry.date >= weekStart && entry.date < weekEnd);
  const monthEntries = entries.filter(entry => entry.date.getFullYear() === month.getFullYear() && entry.date.getMonth() === month.getMonth());
  const changeMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next); setSelected(next);
  };
  const renderEntry = (entry: Entry) => <li key={entry.session.session_id}>
    <div><strong>{entry.meeting.title}</strong><small>{entry.date.toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} · {{ scheduled: 'Đã lên lịch', ongoing: 'Đang diễn ra', ended: 'Đã kết thúc' }[entry.session.status]}</small></div>
    <button type="button" aria-label={`Mở buổi họp ${entry.meeting.title}`} onClick={() => onOpen(entry.meeting, entry.session.session_id)}>Mở</button>
    {entry.session.status !== 'ended' && <button type="button" aria-label={`Sao chép link buổi ${entry.meeting.title}`} onClick={() => onShare(entry.meeting, entry.session.session_id)}>Chia sẻ</button>}
  </li>;
  return <div className="cw-calendar-layout">
    <div className="cw-calendar-main">
      <div className="cw-calendar-toolbar"><h2>Lịch họp</h2><div><button type="button" aria-label="Tháng trước" onClick={() => changeMonth(-1)}>‹</button><strong>{month.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Tháng sau" onClick={() => changeMonth(1)}>›</button></div></div>
      <div className="cw-calendar-grid" role="grid" aria-label="Lịch họp theo tháng">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span className="cw-calendar-weekday" key={day}>{day}</span>)}
        {days.map(date => { const dayEntries = entries.filter(entry => keyOf(entry.date) === keyOf(date)); const hasUpcoming = date >= today && dayEntries.some(entry => entry.session.status !== 'ended'); return <button type="button" key={keyOf(date)} className={`${date.getMonth() === month.getMonth() ? '' : 'is-outside'} ${keyOf(date) === keyOf(selected) ? 'is-selected' : ''}`} aria-label={`${dayLabel(date)}${dayEntries.length ? `, ${dayEntries.length} buổi họp` : ''}`} aria-pressed={keyOf(date) === keyOf(selected)} onClick={() => { setSelected(date); if (date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}><span>{date.getDate()}</span>{hasUpcoming && <i aria-hidden="true" />}</button>; })}
      </div>
    </div>
    <aside className="cw-calendar-day"><h3>{dayLabel(selected)}</h3>{selectedEntries.length ? <ul>{selectedEntries.map(renderEntry)}</ul> : <p>Không có buổi họp.</p>}</aside>
    <div className="cw-calendar-agenda"><div className="cw-calendar-agenda-tabs" role="group" aria-label="Khoảng lịch họp"><button type="button" aria-pressed={agenda === 'week'} onClick={() => setAgenda('week')}>Tuần này <small>{weekEntries.length}</small></button><button type="button" aria-pressed={agenda === 'month'} onClick={() => setAgenda('month')}>Tháng này <small>{monthEntries.length}</small></button></div><div className="cw-calendar-agenda-scroll">{(agenda === 'week' ? weekEntries : monthEntries).length ? <ul>{(agenda === 'week' ? weekEntries : monthEntries).map(renderEntry)}</ul> : <p>Chưa có lịch họp trong {agenda === 'week' ? 'tuần' : 'tháng'}.</p>}</div></div>
  </div>;
}
