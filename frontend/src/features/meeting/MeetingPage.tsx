import { UniCircleLogo } from "../../shared/components/UniCircleLogo";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { ScheduleSessionForm } from './components/MeetingForms';
import { MeetingManagement } from './components/MeetingManagement';
import { useSessionFlow } from './hooks/use-session-flow';
import { canManageSessions, copyMeetingInvite, formatMeetingDate, meetingRequest, parseMeetingCode, roleLabels, type Member, type MeetingOverview } from './services/meetings-api';
import './meeting.css';
import './workspace.css';
import { UnauthorizedError } from './services/token-api';
import { useMeetingTheme } from './hooks/use-meeting-theme';
import { AccountSettings } from './components/AccountSettings';
import './meeting-theme.css';
import './join-lobby.css';

const MeetingRoom = lazy(() => import('./components/MeetingRoom').then(module => ({ default: module.MeetingRoom })));
function codeFromUrl() { return new URLSearchParams(window.location.search).get('meeting') || ''; }
function sessionFromUrl() { return new URLSearchParams(window.location.search).get('session') || ''; }
const statusLabels = { scheduled: 'Đã lên lịch', ongoing: 'Đang diễn ra', ended: 'Đã kết thúc' };

export function MeetingPage({ accessToken, displayName, onLogout, onBack }: { accessToken: string; displayName: string; onLogout: () => void; onBack?: () => void }) {
  const flow = useSessionFlow(accessToken, onLogout);
  const { theme, setTheme } = useMeetingTheme();
  const [code, setCode] = useState(codeFromUrl), [selectedId, setSelectedId] = useState(sessionFromUrl);
  const [overview, setOverview] = useState<MeetingOverview | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [sessionPage, setSessionPage] = useState(0);
  const [people, setPeople] = useState<Record<string, Member[]>>({});
  const onMembersChanged = useCallback((meetingId: string, members: Member[]) => setPeople(previous => ({ ...previous, [meetingId]: members })), []);
  const [showSchedule, setShowSchedule] = useState(false), [now, setNow] = useState(Date.now);
  const lock = useRef(false), revision = useRef(0);
  const name = displayName.trim() || 'Bạn';
  const initials = Array.from(name)[0]?.toLocaleUpperCase('vi') || 'B';
  const requestedSessionId = flow.active?.sessionId || selectedId;
  const selected = requestedSessionId
    ? overview?.sessions.find(session => session.session_id === requestedSessionId)
    : overview?.sessions.find(session => session.status === 'ongoing')
      || overview?.sessions.find(session => session.status === 'scheduled') || overview?.sessions[0];
  const requestedSessionIndex = requestedSessionId
    ? overview?.sessions.findIndex(session => session.session_id === requestedSessionId)
    : undefined;

  useEffect(() => {
    if (requestedSessionIndex !== undefined && requestedSessionIndex >= 0) {
      setSessionPage(Math.floor(requestedSessionIndex / 10));
    }
  }, [requestedSessionId, requestedSessionIndex]);

  const report = useCallback((cause: unknown) => {
    flow.report(cause);
  }, [flow.report]);
  const reportAdmin = useCallback((cause: unknown) => {
    if (cause instanceof UnauthorizedError) flow.report(cause);
  }, [flow.report]);

  const refresh = useCallback(async () => {
    if (!code) return;
    const sequence = ++revision.current;
    try {
      const data = await meetingRequest<MeetingOverview>(accessToken, `/${encodeURIComponent(parseMeetingCode(code))}/sessions`);
      if (sequence === revision.current) { setOverview(data); setError(''); }
    } catch (cause) { if (sequence === revision.current) { setError(cause instanceof Error ? cause.message : 'Không tải được cuộc họp.'); report(cause); } }
  }, [code, accessToken, report]);

  useEffect(() => {
    const controller = new AbortController(); const sequence = ++revision.current;
    setOverview(null); setShowSchedule(false); setSessionPage(0); setError('');
    if (!code) return () => controller.abort();
    setLoading(true);
    try {
      const parsed = parseMeetingCode(code);
      void meetingRequest<MeetingOverview>(accessToken, `/${parsed}/sessions`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted && sequence === revision.current) setOverview(data); })
        .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không tải được cuộc họp.'); report(cause); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } catch (cause) { setLoading(false); setError(cause instanceof Error ? cause.message : 'Mã không hợp lệ.'); }
    return () => controller.abort();
  }, [code, accessToken, report]);

  useEffect(() => {
    if (!code || !overview) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => { if (!document.hidden) await refresh(); if (!stopped) timer = setTimeout(poll, 6000); };
    timer = setTimeout(poll, 6000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [code, !!overview, refresh]);

  useEffect(() => {
    const navigateBack = () => { void flow.leave(); setCode(codeFromUrl()); setSelectedId(sessionFromUrl()); setNotice(''); };
    window.addEventListener('popstate', navigateBack);
    return () => { window.removeEventListener('popstate', navigateBack); };
  }, [flow.leave]);
  const hasScheduledSessions = !!overview?.sessions.some(session => session.status === 'scheduled');
  useEffect(() => {
    if (flow.active || (!hasScheduledSessions && !flow.waiting?.retryAt)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [!!flow.active, hasScheduledSessions, flow.waiting?.retryAt]);

  async function schedule(values: { scheduledStartAt: string; scheduledEndAt: string }) {
    if (!overview || lock.current) return;
    lock.current = true; setBusy(true);
    try { await meetingRequest(accessToken, `/${overview.meeting.meetingId}/sessions`, { method: 'POST', body: values }); await refresh(); setShowSchedule(false); setNotice('Đã lưu lịch hẹn.'); }
    catch (cause) { report(cause); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  async function copyLink(sessionId?: string) {
    if (overview) setNotice(await copyMeetingInvite(overview.meeting.meetingCode, sessionId));
  }
  const waiting = flow.waiting;
  const cooldown = waiting?.retryAt && Date.parse(waiting.retryAt) > now;
  const pageError = error || flow.error;
  const onSessionEnded = useCallback(() => { flow.sessionEnded(); void refresh(); }, [flow.sessionEnded, refresh]);
  useEffect(() => {
    if (flow.active && overview?.sessions.find(session => session.session_id === flow.active?.sessionId)?.status === 'ended') flow.sessionEnded();
  }, [flow.active, overview, flow.sessionEnded]);

  return <div className={`meeting-app meeting-room-page${flow.active ? ' meeting-app--incall' : ''}`} data-theme={theme}>
    <a className="meeting-skip" href="#meeting-main">Đến nội dung chính</a>
    <header className="meeting-topbar"><div className="meeting-brand"><UniCircleLogo /></div>
      {onBack && <button className="meeting-home-link" type="button" onClick={() => { void flow.leave(); onBack(); }}><ArrowLeft size={17} aria-hidden="true" />Trang chủ</button>}
      <div className="meeting-account"><span className="meeting-account-name" title={name}>{name}</span><span className="meeting-avatar-small" aria-hidden="true">{initials}</span><AccountSettings theme={theme} onThemeChange={setTheme} onLogout={async () => { await flow.leave(); onLogout(); }} /></div>
    </header>
    <main id="meeting-main" className="meeting-main" tabIndex={-1}>
      {pageError && (code || !error) ? <p role="alert" className="notice error workspace-error">{pageError}</p> : null}
      <p role="status" className="workspace-feedback">{notice}</p>
      {flow.active && overview ? <>
        <div className="meeting-call-intro"><h1>{overview.meeting.title}</h1><button type="button" className="workspace-icon meeting-share-button" onClick={() => void copyLink(flow.active?.sessionId)} title="Chia sẻ đường dẫn" aria-label="Chia sẻ đường dẫn"><ShareNetwork size={22} aria-hidden="true" /></button></div>
        <Suspense fallback={<div className="meeting-loading" role="status">Đang tải phòng họp…</div>}><MeetingRoom credentials={flow.active} accessToken={accessToken} onLeave={() => void flow.leave()} onEnded={flow.ended}
          management={{ accessToken, overview, sessionId: flow.active.sessionId, knownMembers: people[overview.meeting.meetingId] || [], onMembersChanged, onChanged: refresh, onError: reportAdmin, onSessionEnded }} /></Suspense>
      </> : code ? <>
        {loading ? <p role="status" className="meeting-loading">Đang tải cuộc họp…</p> : overview ? <>
          <div className="workspace-detail-heading"><div>{overview.membership ? <span className="workspace-role">{roleLabels[overview.membership.role]}</span> : null}<h1>{overview.meeting.title}</h1></div><button className="workspace-icon meeting-share-button" type="button" title="Chia sẻ đường dẫn" aria-label="Chia sẻ đường dẫn" disabled={!!requestedSessionId && !selected} onClick={() => void copyLink(selected?.session_id)}><ShareNetwork size={22} aria-hidden="true" /></button></div>
          {requestedSessionId && !selected ? <p role="status">Buổi họp trong đường dẫn không còn khả dụng. Hãy kiểm tra link hoặc chọn một buổi bên dưới.</p> : null}
          {waiting ? <section className="workspace-waiting" aria-labelledby="waiting-title">
            <span className="workspace-waiting-symbol" aria-hidden="true">{waiting.status === 'pending' ? '◷' : waiting.status === 'denied' ? '×' : '✓'}</span>
            <h2 id="waiting-title">{waiting.status === 'pending' ? 'Đang chờ duyệt' : waiting.status === 'denied' ? 'Yêu cầu đã bị từ chối' : waiting.status === 'session_ended' ? 'Buổi họp đã kết thúc' : 'Yêu cầu không còn hiệu lực'}</h2>
            {waiting.remainingAttempts !== undefined ? <p>Còn {waiting.remainingAttempts} lượt gửi yêu cầu trong khoảng giới hạn.</p> : null}
            {cooldown ? <p role="status">Có thể thử lại lúc {formatMeetingDate(waiting.retryAt)}.</p> : null}
            {waiting.status === 'denied' || waiting.status === 'not_requested' ? <button type="button" disabled={!!cooldown || flow.busy} onClick={() => void flow.join(waiting.code, waiting.meetingId, waiting.sessionId)}>Gửi lại yêu cầu</button> : null}
            <button type="button" className="workspace-text-button" onClick={() => void flow.leave()}>Quay lại danh sách</button>
          </section> : null}
          <div className="workspace-detail-grid"><section className="workspace-sessions" aria-labelledby="sessions-title"><div className="workspace-section-title"><h2 id="sessions-title">Các buổi họp</h2><button type="button" disabled={busy} onClick={() => void refresh()}>Tải lại</button></div>
            {canManageSessions(overview.membership) && (overview.meeting.recurrenceRule === undefined || !overview.sessions.length || overview.meeting.recurrenceRule) ? <button type="button" className="workspace-schedule-toggle" disabled={busy} aria-expanded={showSchedule} onClick={() => setShowSchedule(value => !value)}>{showSchedule ? 'Đóng lịch hẹn' : 'Lên lịch buổi họp'}</button> : null}
            {showSchedule ? <ScheduleSessionForm busy={busy} onSchedule={schedule} /> : null}
            {overview.sessions.length === 0 ? <p className="workspace-empty">Chưa có buổi họp nào được lên lịch.</p> : null}
            {overview.sessions.slice(sessionPage * 10, sessionPage * 10 + 10).map((session, index) => {
              const future = session.status === 'scheduled' && !!session.scheduled_start_at && Date.parse(session.scheduled_start_at) > now;
              return <article className="workspace-session" data-selected={selected?.session_id === session.session_id} key={session.session_id}>
                <div><span className={`workspace-session-status workspace-session-status--${session.status}`}>{statusLabels[session.status]}</span><h3>Buổi {sessionPage * 10 + index + 1}</h3><time dateTime={session.scheduled_start_at || undefined}>{formatMeetingDate(session.scheduled_start_at || session.started_at)}</time>{session.scheduled_end_at ? <p>Kết thúc: {formatMeetingDate(session.scheduled_end_at)}</p> : null}</div>
                <div className="workspace-session-actions"><button type="button" disabled={flow.busy || !!waiting || future || session.status === 'ended'} onClick={() => { setSelectedId(session.session_id); const url = new URL(window.location.href); url.searchParams.set('session', session.session_id); history.replaceState(null, '', url); void flow.join(code, overview.meeting.meetingId, session.session_id); }}>{flow.busy && selectedId === session.session_id ? 'Đang tham gia…' : future ? 'Chưa đến giờ' : session.status === 'ended' ? 'Đã kết thúc' : 'Tham gia'}</button>
                {session.status !== 'ended' ? <button type="button" className="workspace-text-button" onClick={() => void copyLink(session.session_id)}>Sao chép link buổi</button> : null}
                {canManageSessions(overview.membership) && selected?.session_id !== session.session_id ? <button type="button" className="workspace-text-button" onClick={() => setSelectedId(session.session_id)}>Chọn quản lý</button> : null}</div>
              </article>;
            })}
            {overview.sessions.length > 10 ? <div className="workspace-pagination"><button type="button" disabled={sessionPage === 0} onClick={() => setSessionPage(page => page - 1)}>Trang trước</button><span>Trang {sessionPage + 1}</span><button type="button" disabled={(sessionPage + 1) * 10 >= overview.sessions.length} onClick={() => setSessionPage(page => page + 1)}>Trang sau</button></div> : null}
          </section>
          {canManageSessions(overview.membership) ? <details className="lobby-management"><summary>Quản lý cuộc họp</summary><MeetingManagement key={`${code}:${selected?.session_id || ''}`} accessToken={accessToken} overview={overview} sessionId={selected?.session_id} knownMembers={people[overview.meeting.meetingId] || []} onMembersChanged={onMembersChanged} onChanged={refresh} onError={reportAdmin} onSessionEnded={onSessionEnded} /></details> : null}
          </div>
        </> : <button type="button" onClick={() => void refresh()}>Thử tải lại</button>}
      </> : null}
    </main>
  </div>;
}
