import { MeetingSharePopup } from '../../meeting/components/MeetingSharePopup';
import { PaginationButton } from "../../../shared/components/PaginationButton";
import { useRef, useState, type RefObject } from 'react';
import { useClub } from '../workspace-context';
import { usePersonalQuery } from '../../personal/use-personal-query';
import { PersonalState } from '../../personal/components/PersonalState';
import { CreateMeetingForm, type CreateValues } from '../../meeting/components/MeetingForms';
import { copyMeetingInvite, meetingRequest, parseMeetingInvite, type MeetingShareResult } from '../../meeting/services/meetings-api';
import { type ClubMeeting, type WorkspaceList } from '../services/workspace-api';
import { useAutoDismiss } from '../../../shared/lib/use-auto-dismiss';
import { MeetingCalendar } from './MeetingCalendar';

export function openClubMeeting(code: string, session: string | undefined, onMeeting?: () => void) {
  if (!onMeeting) return;
  const url = new URL(window.location.href);
  url.searchParams.set('meeting', code);
  if (session) url.searchParams.set('session', session); else url.searchParams.delete('session');
  window.history.replaceState(window.history.state, '', url);
  onMeeting();
}

function JoinMeetingByInvite({ onMeeting, inputRef }: { onMeeting?: () => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const [error, setError] = useState('');
  return <section className="cw-panel" aria-labelledby="join-meeting-title">
    <h2 id="join-meeting-title">Tham gia phòng</h2>
    <form className="workspace-form" onSubmit={event => {
      event.preventDefault();
      if (!onMeeting) return;
      try {
        const value = String(new FormData(event.currentTarget).get('invite') || '');
        const { code, sessionId } = parseMeetingInvite(value);
        setError('');
        openClubMeeting(code, sessionId || undefined, onMeeting);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Kiểm tra lại mã hoặc đường dẫn mời.');
      }
    }}>
      <label>Mã hoặc đường dẫn mời<input ref={inputRef} name="invite" type="text" required maxLength={2048} placeholder="Dán link mời hoặc nhập mã cuộc họp" autoComplete="off" onChange={() => setError('')} aria-invalid={!!error} aria-describedby={error ? 'join-meeting-error' : undefined} /></label>
      {error && <p id="join-meeting-error" role="alert" className="cw-error">{error}</p>}
      <div><button type="submit" disabled={!onMeeting}>Mở cuộc họp</button></div>
    </form>
  </section>;
}

export function WorkspaceMeetings({ recurring = false }: { recurring?: boolean }) {
  const { token, clubId, club, onMeeting, notify } = useClub();
  const [page, setPage] = useState(1);
  const state = usePersonalQuery<WorkspaceList<ClubMeeting>>(token, `workspace/${clubId}/meetings?page=${page}&limit=24`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [shareNotice, setShareNotice] = useState<MeetingShareResult | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const pending = useRef<{ id: string; code: string; values: CreateValues } | null>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  useAutoDismiss(notice, () => setNotice(''));
  async function schedulePending() {
    if (!pending.current) return;
    const saved = pending.current;
    await meetingRequest(token, `/${saved.id}/sessions`, { method: 'POST', body: {
      scheduledStartAt: saved.values.scheduledStartAt, scheduledEndAt: saved.values.scheduledEndAt,
    } });
    pending.current = null;
    const message = `Đã tạo lịch họp ${saved.code} cho ${club.name}.`;
    setNotice(message); notify(message);
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
      else { const message = `Đã mở phòng ${meeting.meeting_code} cho ${club.name}.`; setNotice(message); notify(message); }
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
  const undated = state.data?.items.flatMap(meeting => meeting.meeting_sessions
    .filter(session => !session.scheduled_start_at)
    .map(session => ({ meeting, session }))) ?? [];
  return <div className="cw-meetings">
    <div className="cw-meeting-hero"><div><span className="cw-eyebrow">Không gian {club.name}</span><h1>{recurring ? 'Họp theo lịch' : 'Phòng họp CLB'}</h1></div><button type="button" className="cw-meeting-hero-hint" aria-expanded={inviteOpen} aria-controls="cw-meeting-invite" onClick={() => { setInviteOpen(value => !value); if (!inviteOpen) requestAnimationFrame(() => inviteInputRef.current?.focus()); }}>Mã hoặc đường dẫn mời</button>{inviteOpen && <div id="cw-meeting-invite" className="cw-meeting-invite-popover"><button type="button" className="cw-invite-close" aria-label="Đóng nhập mã mời" onClick={() => setInviteOpen(false)}>×</button><JoinMeetingByInvite onMeeting={onMeeting} inputRef={inviteInputRef} /></div>}</div>
    <div className="cw-meeting-actions-grid">
      <section className="cw-panel cw-meeting-create-panel">
        <CreateMeetingForm busy={busy || !!pending.current} initialKind={recurring ? 'scheduled' : 'quick'} onCreate={create} />
        {error && <p role="alert" className="cw-error">{error}</p>}
        {pending.current && <div role="status"><p>Phòng {pending.current.code} đã tồn tại; lịch chưa được xác nhận.</p><button className="cw-link" disabled={busy} onClick={() => void retrySchedule()}>Kiểm tra và lưu lại lịch</button><button className="cw-link" disabled={!onMeeting} onClick={() => openClubMeeting(pending.current!.code, undefined, onMeeting)}>Mở phòng để kiểm tra</button></div>}
      </section>
    </div>
    <section className="cw-panel cw-meeting-list-panel" aria-label="Lịch và thông tin cuộc họp">
      <MeetingSharePopup result={shareNotice} dismiss={setShareNotice} />
      {!state.data ? <PersonalState {...state} showDiscoveryLink={false} /> : <>
        <MeetingCalendar meetings={state.data.items} onOpen={(meeting, sessionId) => openClubMeeting(meeting.meeting_code, sessionId, onMeeting)} onShare={(meeting, sessionId) => { void copyMeetingInvite(meeting.meeting_code, sessionId).then(setShareNotice); }} />
        {undated.map(({ meeting, session }) => <div className="cw-meeting-unscheduled" key={session.session_id}>
          <span>{meeting.title} · {{ scheduled: 'Đã lên lịch', ongoing: 'Đang diễn ra', ended: 'Đã kết thúc' }[session.status]}</span>
          <button type="button" onClick={() => openClubMeeting(meeting.meeting_code, session.session_id, onMeeting)}>Mở buổi họp</button>
          {session.status !== 'ended' && <button type="button" aria-label="Sao chép link buổi" onClick={() => { void copyMeetingInvite(meeting.meeting_code, session.session_id).then(setShareNotice); }}>Chia sẻ</button>}
        </div>)}
        {state.data.items.filter(meeting => !meeting.meeting_sessions.length).map(meeting => <div className="cw-meeting-unscheduled" key={meeting.meeting_id}><span>{meeting.title} · Chưa có buổi họp</span><button type="button" onClick={() => openClubMeeting(meeting.meeting_code, undefined, onMeeting)}>Mở phòng</button></div>)}
      </>}
      <div className="cw-meeting-list-controls">
        <nav className="cw-meeting-pagination" aria-label="Phân trang cuộc họp">
          <PaginationButton direction="previous" type="button" className="cw-link" disabled={page === 1 || state.loading} onClick={() => setPage(value => value - 1)} />
          <span aria-current="page" aria-live="polite">Trang {page}</span>
          <PaginationButton direction="next" type="button" className="cw-link" disabled={!state.data?.hasMore || state.loading} onClick={() => setPage(value => value + 1)} />
        </nav>
        <button type="button" className="cw-link cw-meeting-refresh" onClick={state.retry}>Tải lại</button>
      </div>
    </section>
  </div>;
}
