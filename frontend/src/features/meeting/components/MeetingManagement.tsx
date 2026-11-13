import { useCallback, useEffect, useRef, useState } from 'react';
import { meetingRequest, MeetingApiError, roleLabels, type JoinRequest, type Member, type MeetingOverview } from '../services/meetings-api';
import { ConfirmAction } from './ConfirmAction';

export function MeetingManagement({ accessToken, overview, sessionId, onlineUsers, knownMembers, onMembersChanged, onChanged, onError, onSessionEnded }: {
  accessToken: string; overview: MeetingOverview; sessionId?: string; onlineUsers?: ReadonlySet<string>;
  knownMembers: Member[]; onMembersChanged: (meetingId: string, members: Member[]) => void;
  onChanged: () => Promise<void>; onError: (cause: unknown) => void; onSessionEnded: () => void;
}) {
  const member = overview.membership;
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [canModerate, setCanModerate] = useState(member?.role === 'host' || member?.role === 'moderator');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [waitingEnabled, setWaitingEnabled] = useState<boolean | undefined>(overview.meeting.waitingRoomEnabled);
  const [confirmation, setConfirmation] = useState<{ title: string; path: string; end?: boolean; memberId?: string; request?: JoinRequest } | null>(null);
  const locked = useRef(false), mutation = useRef<AbortController | null>(null);
  const meetingId = overview.meeting.meetingId;
  const session = overview.sessions.find(s => s.session_id === sessionId);
  const durable = member ? member.role !== 'participant' || member.invitedAt !== null : true;

  const load = useCallback(async (signal: AbortSignal) => {
    if (!sessionId || session?.status === 'ended') { setLoading(false); return; }
    try {
      const pending = await meetingRequest<JoinRequest[]>(accessToken, `/${meetingId}/sessions/${sessionId}/join-requests`, { signal });
      if (!signal.aborted) { setRequests(pending); setCanModerate(true); setLoading(false); }
    } catch (cause) {
      if (signal.aborted) return;
      setLoading(false);
      if (cause instanceof MeetingApiError && cause.status === 403) { setCanModerate(false); setRequests([]); return false; }
      throw cause;
    }
  }, [accessToken, meetingId, sessionId, session?.status]);

  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    const poll = async () => {
      try { if (await load(controller.signal) === false) return; }
      catch (cause) { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không tải được yêu cầu vào phòng.'); onError(cause); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 6000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load, onError]);
  useEffect(() => () => mutation.current?.abort(), []);

  async function act(path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST', end = false, onSuccess?: (data: Record<string, unknown>) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(path); setNotice(''); setError('');
    const controller = new AbortController(); mutation.current = controller;
    try {
      const data = await meetingRequest<Record<string, unknown>>(accessToken, path, { method, body, signal: controller.signal });
      if (controller.signal.aborted) return;
      onSuccess?.(data); setConfirmation(null); setNotice('Đã cập nhật.');
      if (end) { onSessionEnded(); return; }
      await onChanged(); await load(controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được.'); onError(cause); }
    } finally { locked.current = false; if (!controller.signal.aborted) setBusy(''); }
  }
  function observe(target: Member) {
    onMembersChanged(meetingId, [...knownMembers.filter(item => item.meeting_member_id !== target.meeting_member_id), target]);
  }
  function approve(request: JoinRequest) {
    void act(`/${meetingId}/sessions/${sessionId}/join-requests/${request.meeting_member_id}/approve`, undefined, 'POST', false, () => observe({
      meeting_member_id: request.meeting_member_id, user_id: request.meeting_members.user_id,
      role: 'participant', invited_at: null,
      users: { display_name: request.meeting_members.users?.display_name || 'Thành viên', email: '' },
    }));
  }

  return <section className="workspace-management" aria-label="Quản lý cuộc họp">
    <div className="workspace-section-title"><h2>Quản lý cuộc họp</h2>{member ? <span className="workspace-role">{roleLabels[member.role]}</span> : null}</div>
    {error ? <p className="notice error" role="alert">{error}</p> : null}
    <p className="workspace-feedback" role="status">{notice}</p>
    {canModerate || !sessionId ? <><div className="workspace-form workspace-setting" aria-label="Cài đặt phòng chờ">
      <label className="workspace-check"><input type="checkbox" name="waitingEnabled"
        checked={waitingEnabled === true}
        ref={input => { if (input) input.indeterminate = waitingEnabled === undefined; }}
        disabled={!!busy} aria-busy={busy === `/${meetingId}/settings`}
        title={waitingEnabled === undefined ? 'Chưa có thông tin cài đặt hiện tại' : undefined}
        onChange={event => {
          const enabled = event.currentTarget.checked;
          void act(`/${meetingId}/settings`, { waitingRoomEnabled: enabled }, 'PATCH', false, () => setWaitingEnabled(enabled));
        }} /><span>Phòng chờ</span></label>
    </div>
    <form className="workspace-invite workspace-form" aria-label="Mời thành viên" onSubmit={event => {
      event.preventDefault(); if (locked.current) return;
      const email = String(new FormData(event.currentTarget).get('inviteEmail')).trim().toLowerCase();
      void act(`/${meetingId}/members`, { email }, 'POST', false, data => observe({ ...(data as unknown as Member), users: { display_name: email, email } }));
    }}><label>Mời thành viên lâu dài<input type="email" name="inviteEmail" autoComplete="off" spellCheck={false} required maxLength={254} placeholder="email@gmail.com" disabled={!!busy} /></label><button type="submit" disabled={!!busy}>{busy === `/${meetingId}/members` ? 'Đang mời…' : 'Mời thành viên'}</button></form></> : null}
    {loading ? <p role="status">Đang kiểm tra yêu cầu vào phòng…</p> : null}
    {canModerate && sessionId && session?.status !== 'ended' ? <section className="workspace-requests" aria-labelledby="requests-title"><h3 id="requests-title">Đang chờ duyệt ({requests.length})</h3>
      {!loading && requests.length === 0 ? <p className="workspace-empty">Chưa có yêu cầu tham gia buổi này.</p> : null}
      {requests.map(request => <div className="workspace-person" key={request.requestId}><span>{request.meeting_members?.users?.display_name || 'Thành viên'}</span><div className="workspace-person-actions"><button type="button" disabled={!!busy} onClick={() => approve(request)}>Cho vào</button><button type="button" className="workspace-text-button" disabled={!!busy} onClick={() => setConfirmation({ title: 'Từ chối yêu cầu tham gia này?', path: `/${meetingId}/sessions/${sessionId}/join-requests/${request.meeting_member_id}/deny` })}>Từ chối</button></div></div>)}
    </section> : null}
    {knownMembers.length ? <section aria-labelledby="members-title"><h3 id="members-title">Thành viên đã xử lý trong phiên này</h3>
      {knownMembers.map(target => {
        const self = target.user_id === member?.userId;
        const canAct = !self && target.role !== 'host';
        const online = onlineUsers?.has(target.user_id);
        return <div className="workspace-person" key={target.meeting_member_id}><div className="workspace-person-info"><strong>{target.users?.display_name || target.users?.email || 'Thành viên'}</strong><span>{roleLabels[target.role]}{onlineUsers ? online ? ' · Đang kết nối' : ' · Ngoại tuyến' : ''}</span></div><div className="workspace-person-actions">
          {canAct && online && session?.status === 'ongoing' ? <button type="button" disabled={!!busy} onClick={() => void act(`/${meetingId}/sessions/${sessionId}/members/${target.meeting_member_id}/mute`)}>Tắt mic</button> : null}
          {!self && target.role !== 'host' && target.invited_at ? <button type="button" disabled={!!busy} onClick={() => void act(`/${meetingId}/members/${target.meeting_member_id}/moderator`, { enabled: target.role !== 'moderator' }, 'PATCH', false, data => observe({ ...target, role: data.role as Member['role'] }))}>{target.role === 'moderator' ? 'Gỡ điều hành' : 'Cấp điều hành'}</button> : null}
          {canAct ? <button type="button" className="workspace-text-button" disabled={!!busy} onClick={() => setConfirmation({ title: `Loại ${target.users?.display_name || 'thành viên này'} khỏi cuộc họp?`, path: `/${meetingId}/members/${target.meeting_member_id}/remove`, memberId: target.meeting_member_id })}>Loại</button> : null}
        </div></div>;
      })}
    </section> : null}
    {durable && sessionId && session?.status !== 'ended' ? <button type="button" className="workspace-danger" disabled={!!busy} onClick={() => setConfirmation({ title: 'Kết thúc buổi họp cho tất cả mọi người?', path: `/${meetingId}/sessions/${sessionId}/end`, end: true })}>Kết thúc buổi họp</button> : null}
    {confirmation ? <ConfirmAction title={confirmation.title} busy={!!busy} onConfirm={() => void act(confirmation.path, undefined, 'POST', confirmation.end, () => {
      if (confirmation.memberId) onMembersChanged(meetingId, knownMembers.filter(target => target.meeting_member_id !== confirmation.memberId));
    })} onCancel={() => setConfirmation(null)} /> : null}
  </section>;
}
