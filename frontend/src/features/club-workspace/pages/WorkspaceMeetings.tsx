import { useRef, useState } from 'react';
import { useClub } from '../workspace-context';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { PersonalState } from '../../personal/components/PersonalState';
import { CreateMeetingForm, type CreateValues } from '../../meeting/components/MeetingForms';
import { meetingRequest } from '../../meeting/services/meetings-api';
import { type ClubMeeting, type WorkspaceList } from '../services/workspace-api';

export function openClubMeeting(code: string, session: string | undefined, onMeeting?: () => void) {
  if (!onMeeting) return;
  const url = new URL(window.location.href);
  url.searchParams.set('meeting', code);
  if (session) url.searchParams.set('session', session); else url.searchParams.delete('session');
  window.history.replaceState(null, '', url);
  onMeeting();
}

export function WorkspaceMeetings({ recurring = false }: { recurring?: boolean }) {
  const { token, clubId, club, onMeeting } = useClub();
  const [page, setPage] = useState(1);
  const state = usePersonalQuery<WorkspaceList<ClubMeeting>>(token, `workspace/${clubId}/meetings?page=${page}&limit=12`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const pending = useRef<{ id: string; code: string; values: CreateValues } | null>(null);
  async function schedulePending() {
    if (!pending.current) return;
    const saved = pending.current;
    await meetingRequest(token, `/${saved.id}/sessions`, { method: 'POST', body: {
      scheduledStartAt: saved.values.scheduledStartAt, scheduledEndAt: saved.values.scheduledEndAt,
    } });
    pending.current = null;
    setNotice(`Đã tạo lịch họp ${saved.code} cho ${club.name}.`);
  }
  async function create(values: CreateValues, quick: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (pending.current) throw new Error('Phòng trước đã được tạo. Hãy xử lý lịch chưa lưu trước khi tạo phòng khác.');
      const meeting = await meetingRequest<ClubMeeting>(token, quick ? '/quick' : '', { method: 'POST', body: {
        title: values.title, waitingRoomEnabled: values.waitingRoomEnabled, clubId,
        ...(!quick ? { recurrenceRule: values.recurrenceRule } : {}),
      } });
      if (!quick) { pending.current = { id: meeting.meeting_id, code: meeting.meeting_code, values }; await schedulePending(); }
      else setNotice(`Đã mở phòng ${meeting.meeting_code} cho ${club.name}.`);
      state.retry();
      window.dispatchEvent(new CustomEvent('uc:workspace-meetings-changed', { detail: clubId }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tạo được cuộc họp.'); state.retry(); }
    finally { lock.current = false; setBusy(false); }
  }
  async function retrySchedule() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await schedulePending(); state.retry(); window.dispatchEvent(new CustomEvent('uc:workspace-meetings-changed', { detail: clubId })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa lưu được lịch.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="cw-meetings">
    <div className="cw-heading"><div><h1>{recurring ? 'Họp theo lịch' : 'Phòng họp CLB'}</h1><p>Tạo và tham gia cuộc họp của {club.name}. Quyền host và duyệt người vào phòng vẫn áp dụng trong từng cuộc họp.</p></div></div>
    <section className="cw-panel">
      <CreateMeetingForm busy={busy || !!pending.current} initialKind={recurring ? 'scheduled' : 'quick'} onCreate={create} />
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="cw-error">{error}</p>}
      {pending.current && <div role="status"><p>Phòng {pending.current.code} đã tồn tại; lịch buổi họp chưa được xác nhận. Không tạo lại phòng.</p><button className="cw-link" disabled={busy} onClick={() => void retrySchedule()}>Kiểm tra và lưu lại lịch</button><button className="cw-link" disabled={!onMeeting} onClick={() => openClubMeeting(pending.current!.code, undefined, onMeeting)}>Mở phòng để kiểm tra</button></div>}
    </section>
    <section className="cw-panel"><h2>Các cuộc họp của CLB</h2>
      {!state.data || !state.data.items.length ? <PersonalState {...state} empty="Chưa có cuộc họp gắn với CLB này." showDiscoveryLink={false} /> : <div className="cw-meeting-list">{state.data.items.map(meeting => <article key={meeting.meeting_id}>
        <h3>{meeting.title}</h3><p>{meeting.recurrence_rule ? 'Họp định kỳ' : 'Cuộc họp'} · Mã {meeting.meeting_code}</p>
        {meeting.meeting_sessions.length ? meeting.meeting_sessions.slice().sort((a, b) => (a.scheduled_start_at || '').localeCompare(b.scheduled_start_at || '')).map(session => <div className="cw-meeting-session" key={session.session_id}>
          <span>{session.scheduled_start_at ? new Date(session.scheduled_start_at).toLocaleString('vi-VN') : 'Chưa có giờ bắt đầu'} · {{ scheduled: 'Đã lên lịch', ongoing: 'Đang diễn ra', ended: 'Đã kết thúc' }[session.status]}</span>
          <button className="cw-link" disabled={!onMeeting} onClick={() => openClubMeeting(meeting.meeting_code, session.session_id, onMeeting)}>Mở buổi họp</button>
        </div>) : <p>Chưa có buổi họp.</p>}
        <button className="cw-link" disabled={!onMeeting} onClick={() => openClubMeeting(meeting.meeting_code, undefined, onMeeting)}>Quản lý trong công cụ họp</button>
      </article>)}</div>}
      <div className="cw-actions"><button className="cw-link" disabled={page === 1 || state.loading} onClick={() => setPage(value => value - 1)}>Trang trước</button><span>Trang {page}</span><button className="cw-link" disabled={!state.data?.hasMore || state.loading} onClick={() => setPage(value => value + 1)}>Trang sau</button><button className="cw-link" onClick={state.retry}>Tải lại</button></div>
    </section>
  </div>;
}
