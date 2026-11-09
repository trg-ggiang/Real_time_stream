import { lazy, Suspense, useEffect, useState } from 'react';
import { useMeetingSession } from './hooks/use-meeting-session';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { LinkSimple } from '@phosphor-icons/react/dist/csr/LinkSimple';
import { CreateMeetingForm, ScheduleSessionForm, type CreateValues } from './components/MeetingForms';
import { MeetingManagement } from './components/MeetingManagement';
import { useSessionFlow } from './hooks/use-session-flow';
import { canManageSessions, formatMeetingDate, meetingRequest, parseMeetingCode, roleLabels, type Member, type Membership, type MeetingOverview, type MeetingSession } from './services/meetings-api';
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

export function MeetingPage({ accessToken, displayName, onLogout }: { accessToken: string; displayName: string; onLogout: () => void }) {
  const session = useMeetingSession(accessToken, onLogout);
  const [options, setOptions] = useState<{ sessionId: string; title: string; roomName: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
    void fetch(`${base}/api/meeting-sessions`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { onLogout(); throw new Error('Phiên đăng nhập hết hạn.'); }
        if (!response.ok) throw new Error('Không tải được danh sách phiên họp. Bạn vẫn có thể dùng phòng PoC không có chat.');
        const data = await response.json();
        if (!Array.isArray(data) || !data.every(row => typeof row?.sessionId === 'string' && typeof row?.title === 'string')) throw new Error('Danh sách phiên họp không hợp lệ.');
        if (!controller.signal.aborted) { setOptions(data); setSelectedSession(data[0]?.sessionId ?? ''); }
      }).catch(cause => { if (!controller.signal.aborted) setSessionsError(cause instanceof Error ? cause.message : 'Không tải được phiên họp.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSessions(false); });
    return () => controller.abort();
  }, [accessToken, onLogout]);
  return (
    <main>
      <header>
        <div className="room-heading"><span>{displayName}</span><button className="secondary" onClick={() => { session.leave(); onLogout(); }}>Đăng xuất</button></div>
        <p className="eyebrow">MEETING / MODULE 01</p>
        <h1>Cùng gặp nhau, từ bất cứ đâu.</h1>
        <p className="subtitle">
          Phòng thử nghiệm âm thanh và hình ảnh trực tiếp.
        </p>
      </header>
      {session.credentials ? (
        <Suspense fallback={<p role="status">Đang tải phòng họp…</p>}>
          <MeetingRoom
            credentials={session.credentials}
            accessToken={accessToken}
            onLeave={session.leave}
            onEnded={session.endSession}
          />
        </Suspense>
      ) : (
        <section className="join-card" aria-label="Tham gia phòng thử nghiệm">
          <span className="badge">{selectedSession ? 'Phiên họp có chat' : 'Phòng thử nghiệm chung'}</span>
          <h2>Sẵn sàng kết nối?</h2>
          <p>
            Cho phép truy cập camera và microphone khi trình duyệt hỏi. Mở cùng
            trang này trên thiết bị thứ hai để gặp nhau.
          </p>
          <p className="hint">
            Dùng tai nghe để tránh tiếng vọng. Chọn cùng phiên họp với những
            người bạn muốn gặp và trò chuyện.
          </p>
          <div className="meeting-session-picker"><label htmlFor="meeting-session-select">Phiên họp</label>
            <select id="meeting-session-select" value={selectedSession} onChange={event => setSelectedSession(event.target.value)} disabled={loadingSessions || session.isJoining}>
              <option value="">Phòng PoC — media, không có lịch sử chat</option>
              {options.map(option => <option key={option.sessionId} value={option.sessionId}>{option.title} · {option.roomName}</option>)}
            </select>
          </div>
          <p className="hint">Chat dùng cho phiên đang diễn ra mà bạn đã được chấp nhận vào. Mọi người cần chọn cùng phiên.</p>
          {sessionsError && <p role="status">{sessionsError}</p>}
          {session.error && (
            <p className="notice error" role="alert">
              {session.error}
            </p>
          )}
          <div className="join-actions">
            <button
              disabled={session.isJoining || loadingSessions}
              onClick={() => void session.join(selectedSession || undefined)}
            >
              {session.isJoining ? 'Đang chuẩn bị…' : 'Tham gia phòng'}
            </button>
            {session.isJoining && (
              <button className="secondary" onClick={session.leave}>
                Hủy
              </button>
            )}
  const flow = useSessionFlow(accessToken, onLogout);
  const { theme, setTheme } = useMeetingTheme();
  const [code, setCode] = useState(codeFromUrl), [selectedId, setSelectedId] = useState(sessionFromUrl);
  const [overview, setOverview] = useState<MeetingOverview | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [sessionPage, setSessionPage] = useState(0);
  const [people, setPeople] = useState<Record<string, Member[]>>({});
  const contexts = useRef(new Map<string, { membership: Membership; recurrenceRule: string | null }>());
  const enrich = useCallback((data: MeetingOverview): MeetingOverview => {
    const context = contexts.current.get(data.meeting.meetingCode);
    return context ? { ...data, membership: context.membership, meeting: { ...data.meeting, recurrenceRule: context.recurrenceRule } } : data;
  }, []);
  const onMembersChanged = useCallback((meetingId: string, members: Member[]) => setPeople(previous => ({ ...previous, [meetingId]: members })), []);
  const [showSchedule, setShowSchedule] = useState(false), [now, setNow] = useState(Date.now);
  const lock = useRef(false), revision = useRef(0), actionController = useRef<AbortController | null>(null);
  const name = displayName.trim() || 'Bạn';
  const initials = Array.from(name)[0]?.toLocaleUpperCase('vi') || 'B';
  const selected = overview?.sessions.find(s => s.session_id === (flow.active?.sessionId || selectedId))
    || overview?.sessions.find(s => s.status === 'ongoing') || overview?.sessions.find(s => s.status === 'scheduled') || overview?.sessions[0];

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
      if (sequence === revision.current) { setOverview(enrich(data)); setError(''); }
    } catch (cause) { if (sequence === revision.current) { setError(cause instanceof Error ? cause.message : 'Không tải được cuộc họp.'); report(cause); } }
  }, [code, accessToken, report, enrich]);

  useEffect(() => {
    const controller = new AbortController(); const sequence = ++revision.current;
    setOverview(null); setShowSchedule(false); setSessionPage(0); setError('');
    if (!code) return () => controller.abort();
    setLoading(true);
    try {
      const parsed = parseMeetingCode(code);
      void meetingRequest<MeetingOverview>(accessToken, `/${parsed}/sessions`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted && sequence === revision.current) setOverview(enrich(data)); })
        .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không tải được cuộc họp.'); report(cause); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } catch (cause) { setLoading(false); setError(cause instanceof Error ? cause.message : 'Mã không hợp lệ.'); }
    return () => controller.abort();
  }, [code, accessToken, report, enrich]);

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
    return () => { actionController.current?.abort(); window.removeEventListener('popstate', navigateBack); };
  }, [flow.leave]);
  const hasScheduledSessions = !!overview?.sessions.some(session => session.status === 'scheduled');
  useEffect(() => {
    if (flow.active || (!hasScheduledSessions && !flow.waiting?.retryAt)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [!!flow.active, hasScheduledSessions, flow.waiting?.retryAt]);

  function openMeeting(nextCode: string, sessionId = '') {
    const url = new URL(window.location.href);
    if (nextCode) url.searchParams.set('meeting', nextCode); else url.searchParams.delete('meeting');
    if (sessionId) url.searchParams.set('session', sessionId); else url.searchParams.delete('session');
    window.history.pushState(null, '', url); setCode(nextCode); setSelectedId(sessionId); setNotice('');
  }
  async function create(values: CreateValues, quick: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const controller = new AbortController(); actionController.current = controller;
    try {
      const result = await meetingRequest<{ meeting_id: string; meeting_code: string; created_by: string; session?: MeetingSession }>(accessToken, quick ? '/quick' : '', {
        method: 'POST', body: { title: values.title, waitingRoomEnabled: values.waitingRoomEnabled, ...(!quick ? { recurrenceRule: values.recurrenceRule } : {}) }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      contexts.current.set(result.meeting_code, { membership: { userId: result.created_by, role: 'host', invitedAt: null }, recurrenceRule: values.recurrenceRule });
      openMeeting(result.meeting_code, result.session?.session_id);
      if (!quick && values.scheduledStartAt && values.scheduledEndAt) {
        try {
          await meetingRequest(accessToken, `/${result.meeting_id}/sessions`, { method: 'POST', body: { scheduledStartAt: values.scheduledStartAt, scheduledEndAt: values.scheduledEndAt }, signal: controller.signal });
        } catch (cause) {
          setShowSchedule(true); setNotice('Cuộc họp đã được tạo. Lịch hẹn chưa lưu thành công; hãy dùng Lên lịch để thử lại.'); throw cause;
        }
      }
      const data = await meetingRequest<MeetingOverview>(accessToken, `/${result.meeting_code}/sessions`, { signal: controller.signal });
      if (!controller.signal.aborted) setOverview(enrich(data));
      if (quick && result.session) await flow.join(result.meeting_code, result.meeting_id, result.session.session_id);
    } catch (cause) { if (!controller.signal.aborted) report(cause); }
    finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  async function schedule(values: { scheduledStartAt: string; scheduledEndAt: string }) {
    if (!overview || lock.current) return;
    lock.current = true; setBusy(true);
    try { await meetingRequest(accessToken, `/${overview.meeting.meetingId}/sessions`, { method: 'POST', body: values }); await refresh(); setShowSchedule(false); setNotice('Đã lưu lịch hẹn.'); }
    catch (cause) { report(cause); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Đã sao chép đường dẫn cuộc họp.'); }
    catch { setNotice(`Không sao chép được. Mã cuộc họp: ${code}`); }
  }
  const waiting = flow.waiting;
  const cooldown = waiting?.retryAt && Date.parse(waiting.retryAt) > now;
  const pageError = error || flow.error;
  const onSessionEnded = useCallback(() => { flow.sessionEnded(); void refresh(); }, [flow.sessionEnded, refresh]);
  useEffect(() => {
    if (flow.active && overview?.sessions.find(session => session.session_id === flow.active?.sessionId)?.status === 'ended') flow.sessionEnded();
  }, [flow.active, overview, flow.sessionEnded]);

  return <div className={`meeting-app${flow.active ? ' meeting-app--incall' : ''}`} data-theme={theme}>
    <a className="meeting-skip" href="#meeting-main">Đến nội dung chính</a>
    <header className="meeting-topbar"><div className="meeting-brand"><span className="meeting-brand-symbol"><VideoCamera size={23} weight="fill" aria-hidden="true" /></span><span translate="no">Real-time Stream</span></div>
      <div className="meeting-account"><span className="meeting-account-name" title={name}>{name}</span><span className="meeting-avatar-small" aria-hidden="true">{initials}</span><AccountSettings theme={theme} onThemeChange={setTheme} onLogout={async () => { await flow.leave(); onLogout(); }} /></div>
    </header>
    <main id="meeting-main" className="meeting-main" tabIndex={-1}>
      {pageError && (code || !error) ? <p role="alert" className="notice error workspace-error">{pageError}</p> : null}
      <p role="status" className="workspace-feedback">{notice}</p>
      {flow.active && overview ? <>
        <div className="meeting-call-intro"><h1>{overview.meeting.title}</h1><span className="workspace-code" translate="no">{code}</span><button type="button" className="workspace-icon" onClick={() => void copyLink()} title="Sao chép đường dẫn" aria-label="Sao chép đường dẫn"><Copy size={20} aria-hidden="true" /></button></div>
        <Suspense fallback={<div className="meeting-loading" role="status">Đang tải phòng họp…</div>}><MeetingRoom credentials={flow.active} onLeave={() => void flow.leave()} onEnded={flow.ended}
          management={{ accessToken, overview, sessionId: flow.active.sessionId, knownMembers: people[overview.meeting.meetingId] || [], onMembersChanged, onChanged: refresh, onError: reportAdmin, onSessionEnded }} /></Suspense>
      </> : code ? <>
        <button className="workspace-back" type="button" disabled={busy || flow.busy} onClick={async () => { await flow.leave(); openMeeting(''); }}><ArrowLeft size={18} aria-hidden="true" />Tổng quan</button>
        {loading ? <p role="status" className="meeting-loading">Đang tải cuộc họp…</p> : overview ? <>
          <div className="workspace-detail-heading"><div>{overview.membership ? <span className="workspace-role">{roleLabels[overview.membership.role]}</span> : null}<h1>{overview.meeting.title}</h1></div><div className="workspace-code-actions"><code translate="no">{overview.meeting.meetingCode}</code><button className="workspace-icon" type="button" title="Sao chép đường dẫn" aria-label="Sao chép đường dẫn" onClick={() => void copyLink()}><Copy size={21} aria-hidden="true" /></button></div></div>
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
                {canManageSessions(overview.membership) && selected?.session_id !== session.session_id ? <button type="button" className="workspace-text-button" onClick={() => setSelectedId(session.session_id)}>Chọn quản lý</button> : null}</div>
              </article>;
            })}
            {overview.sessions.length > 10 ? <div className="workspace-pagination"><button type="button" disabled={sessionPage === 0} onClick={() => setSessionPage(page => page - 1)}>Trang trước</button><span>Trang {sessionPage + 1}</span><button type="button" disabled={(sessionPage + 1) * 10 >= overview.sessions.length} onClick={() => setSessionPage(page => page + 1)}>Trang sau</button></div> : null}
            {flow.busy ? <button type="button" onClick={() => void flow.leave()}>Hủy tham gia</button> : null}
          </section>
          {canManageSessions(overview.membership) ? <details className="lobby-management"><summary>Quản lý cuộc họp</summary><MeetingManagement key={`${code}:${selected?.session_id || ''}`} accessToken={accessToken} overview={overview} sessionId={selected?.session_id} knownMembers={people[overview.meeting.meetingId] || []} onMembersChanged={onMembersChanged} onChanged={refresh} onError={reportAdmin} onSessionEnded={onSessionEnded} /></details> : null}
          </div>
        </> : <button type="button" onClick={() => void refresh()}>Thử tải lại</button>}
      </> : <>
        <div className="workspace-welcome"><span>Xin chào, {name}</span><h1>Bạn muốn gặp ai hôm nay?</h1></div>
        <div className="workspace-dashboard lobby-dashboard">
          <section className="workspace-join lobby-join" aria-labelledby="join-title">
            <span className="lobby-join-symbol" aria-hidden="true"><LinkSimple size={30} /></span>
            <div className="workspace-section-title"><h2 id="join-title">Tham gia cuộc họp</h2></div>
            <form className="workspace-form" onSubmit={event => { event.preventDefault(); try { setError(''); openMeeting(parseMeetingCode(String(new FormData(event.currentTarget).get('code')))); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mã không hợp lệ.'); } }}>
              <label htmlFor="meeting-code">Mã hoặc đường dẫn mời</label>
              <div className="lobby-code-field"><LinkSimple size={21} aria-hidden="true" /><input id="meeting-code" name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Nhập mã hoặc dán đường dẫn" aria-invalid={!!error} aria-describedby={error ? 'join-code-error' : undefined} /></div>
              {error ? <p id="join-code-error" className="notice error" role="alert">{error}</p> : null}
              <button type="submit" disabled={busy}>Mở cuộc họp</button>
            </form>
          </section>
          <CreateMeetingForm busy={busy} onCreate={create} />
        </div>
      </>}
    </main>
  </div>;
}
