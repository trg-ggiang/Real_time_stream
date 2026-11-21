import { useCallback, useEffect, useRef, useState } from 'react';
import { joinMeeting, meetingRequest, MeetingApiError, type Admission, type JoinedSession } from '../services/meetings-api';
import { UnauthorizedError } from '../services/token-api';
import { forgetMeeting, readMeetingResume, rememberMeeting } from '../services/meeting-resume';

type Waiting = Admission & { meetingId: string; sessionId: string; code: string };

export function useSessionFlow(accessToken: string, onUnauthorized: () => void) {
  const [active, setActive] = useState<JoinedSession | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<JoinedSession | null>(null);
  const departure = useRef<Pick<JoinedSession, 'meetingId' | 'sessionId' | 'attendanceId'> | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const report = useCallback((cause: unknown) => {
    if (cause instanceof UnauthorizedError) { onUnauthorized(); return; }
    if (mounted.current) setError(cause instanceof Error ? cause.message : 'Thao tác không thành công. Hãy thử lại.');
  }, [onUnauthorized]);

  const recordDeparture = useCallback(async () => {
    const session = departure.current;
    if (!session) return;
    await meetingRequest(accessToken, `/${session.meetingId}/sessions/${session.sessionId}/leave`, {
      method: 'POST', body: { attendanceId: session.attendanceId }, keepalive: true,
    });
    if (departure.current === session) departure.current = null;
  }, [accessToken]);

  const leave = useCallback(async (message = '') => {
    forgetMeeting();
    request.current?.abort(); request.current = null;
    if (current.current) departure.current = current.current;
    current.current = null;
    setActive(null); setWaiting(null); setBusy(false); setError(message);
    try { await recordDeparture(); }
    catch (cause) {
      if (cause instanceof UnauthorizedError) { onUnauthorized(); return; }
      if (mounted.current) setError(`${message ? `${message} ` : ''}Đã ngắt cuộc gọi nhưng chưa xác nhận rời phòng. Khi tham gia lại, hệ thống sẽ thử xác nhận trước.`);
    }
  }, [recordDeparture, onUnauthorized]);

  const join = useCallback(async (code: string, meetingId: string, sessionId: string) => {
    if (request.current || current.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices) { setError('Camera và microphone cần HTTPS hoặc localhost.'); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setWaiting(null);
    try {
      await recordDeparture();
      if (controller.signal.aborted) return;
      const result = await joinMeeting(accessToken, code, sessionId, controller.signal);
      if (controller.signal.aborted || !mounted.current) {
        if (result.status === 'admitted') void meetingRequest(accessToken, `/${result.meetingId}/sessions/${result.sessionId}/leave`, {
          method: 'POST', body: { attendanceId: result.attendanceId }, keepalive: true,
        }).catch(() => {});
        return;
      }
      if (result.status === 'admitted') {
        rememberMeeting(accessToken, { code, meetingId: result.meetingId, sessionId: result.sessionId, attendanceId: result.attendanceId });
        current.current = result; setActive(result);
      }
      else setWaiting({ ...result, code });
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof MeetingApiError && cause.retryAt) setWaiting({ code, meetingId, sessionId, status: 'denied', retryAt: cause.retryAt, remainingAttempts: 0 });
        report(cause);
      }
    } finally {
      if (request.current === controller) { request.current = null; if (mounted.current) setBusy(false); }
    }
  }, [accessToken, recordDeparture, report]);

  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    // Defer one tick so StrictMode's setup/cleanup rehearsal cannot issue a join.
    const timer = window.setTimeout(() => {
      if (resumed.current) return;
      resumed.current = true;
      const saved = readMeetingResume(accessToken);
      if (!saved) return;
      departure.current = saved;
      void join(saved.code, saved.meetingId, saved.sessionId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, join]);

  // Poll status only. Never resubmit an entry request until the user retries or approval is confirmed.
  useEffect(() => {
    if (!waiting || waiting.status !== 'pending') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const status = await meetingRequest<Admission>(accessToken, `/${waiting.meetingId}/sessions/${waiting.sessionId}/join-status`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (status.status === 'admitted') { await join(waiting.code, waiting.meetingId, waiting.sessionId); return; }
        setWaiting(previous => previous?.sessionId === waiting.sessionId ? { ...previous, ...status } : previous);
        setError('');
      } catch (cause) { if (!controller.signal.aborted) report(cause); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [waiting?.meetingId, waiting?.sessionId, waiting?.code, waiting?.status, accessToken, join, report]);

  useEffect(() => {
    mounted.current = true;
    const depart = () => {
      if (current.current) departure.current = current.current;
      current.current = null;
      void recordDeparture().catch(() => {});
    };
    window.addEventListener('pagehide', depart);
    return () => { mounted.current = false; request.current?.abort(); window.removeEventListener('pagehide', depart); depart(); };
  }, [recordDeparture]);

  const ended = useCallback((message?: string) => { void leave(message); }, [leave]);
  const sessionEnded = useCallback(() => {
    forgetMeeting();
    current.current = null; departure.current = null;
    setActive(null); setWaiting(null); setError('Buổi họp đã kết thúc.');
  }, []);
  return { active, waiting, busy, error, join, leave, ended, sessionEnded, report };
}
