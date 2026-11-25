import { useCallback, useEffect, useRef, useState } from 'react';
import { joinMeeting, meetingRequest, MeetingApiError, type Admission, type DeviceJoinMode, type JoinedSession } from '../services/meetings-api';
import { UnauthorizedError } from '../services/token-api';
import { forgetMeeting, readMeetingResume, rememberMeeting } from '../services/meeting-resume';

type Waiting = Admission & { meetingId: string; sessionId: string; code: string };
type JoinTarget = Pick<Waiting, 'meetingId' | 'sessionId' | 'code'>;

export function useSessionFlow(accessToken: string, onUnauthorized: () => void) {
  const [active, setActive] = useState<JoinedSession | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [deviceChoice, setDeviceChoice] = useState<JoinTarget | null>(null);
  const [transferStatus, setTransferStatus] = useState<'pending' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const current = useRef<JoinedSession | null>(null);
  const departure = useRef<Pick<JoinedSession, 'meetingId' | 'sessionId' | 'attendanceId'> | null>(null);
  const reloadDeparture = useRef<typeof departure.current>(null);
  const reloadCleanupPending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const pendingTransfer = useRef<JoinedSession | null>(null);
  const completedTransfer = useRef<JoinedSession | null>(null);
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
    const interruptedRecovery = request.current && !current.current && !reloadCleanupPending.current
      ? reloadDeparture.current : null;
    request.current?.abort(); request.current = null;
    if (current.current || interruptedRecovery) departure.current = current.current ?? interruptedRecovery;
    if (interruptedRecovery) reloadDeparture.current = null;
    current.current = null;
    setDeviceChoice(null); setTransferStatus(null);
    setActive(null); setWaiting(null); setBusy(false); setRecovering(false); setError(message);
    try { await recordDeparture(); }
    catch (cause) {
      if (cause instanceof UnauthorizedError) { onUnauthorized(); return; }
      if (mounted.current) setError(`${message ? `${message} ` : ''}Đã ngắt cuộc gọi nhưng chưa xác nhận rời phòng. Khi tham gia lại, hệ thống sẽ thử xác nhận trước.`);
    }
  }, [recordDeparture, onUnauthorized]);

  const join = useCallback(async (code: string, meetingId: string, sessionId: string, deviceMode?: DeviceJoinMode) => {
    if (request.current || current.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices) { setError('Camera và microphone cần HTTPS hoặc localhost.'); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setWaiting(null);
    try {
      await recordDeparture();
      if (controller.signal.aborted) return;
      const result = await joinMeeting(accessToken, code, sessionId, controller.signal, deviceMode);
      if (controller.signal.aborted || !mounted.current) {
        if (result.status === 'admitted') void meetingRequest(accessToken, `/${result.meetingId}/sessions/${result.sessionId}/leave`, {
          method: 'POST', body: { attendanceId: result.attendanceId }, keepalive: true,
        }).catch(() => {});
        return;
      }
      if (result.status === 'device_choice_required') {
        forgetMeeting();
        setDeviceChoice({ code, meetingId: result.meetingId, sessionId: result.sessionId });
      } else if (result.status === 'admitted') {
        setDeviceChoice(null);
        if (result.transferAfterConnect) setTransferStatus('pending');
        rememberMeeting(accessToken, { code, meetingId: result.meetingId, sessionId: result.sessionId, attendanceId: result.attendanceId });
        current.current = result; setActive(result);
      } else {
        setDeviceChoice(null);
        setWaiting({ status: 'pending', meetingId: result.meetingId, sessionId: result.sessionId, code });
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof MeetingApiError && cause.retryAt) setWaiting({ code, meetingId, sessionId, status: 'denied', retryAt: cause.retryAt, remainingAttempts: 0 });
        report(cause);
      }
    } finally {
      if (request.current === controller) { request.current = null; if (mounted.current) setBusy(false); }
    }
  }, [accessToken, recordDeparture, report]);

  const transferDevice = useCallback(async () => {
    const session = current.current;
    if (!session?.transferAfterConnect || pendingTransfer.current === session || completedTransfer.current === session) return;
    pendingTransfer.current = session;
    setTransferStatus('pending');
    try {
      await meetingRequest(accessToken, `/${session.meetingId}/sessions/${session.sessionId}/device-transfer`, {
        method: 'POST', body: { attendanceId: session.attendanceId },
      });
      completedTransfer.current = session;
      if (current.current === session) setTransferStatus(null);
    } catch (cause) {
      if (current.current !== session) return;
      if (cause instanceof UnauthorizedError) onUnauthorized();
      else setTransferStatus('failed');
    } finally {
      if (pendingTransfer.current === session) pendingTransfer.current = null;
    }
  }, [accessToken, onUnauthorized]);

  const recoveryUsed = useRef(false);
  const onConnected = useCallback(() => {
    recoveryUsed.current = false;
    const previous = reloadDeparture.current;
    const session = current.current;
    if (session?.transferAfterConnect) void transferDevice();
    if (!previous || !session || reloadCleanupPending.current ||
        previous.sessionId !== session.sessionId || previous.meetingId !== session.meetingId ||
        previous.attendanceId === session.attendanceId) return;
    reloadCleanupPending.current = true;
    // Cleanup is scoped to the replaced attendance and stays off the join path.
    void meetingRequest(accessToken, `/${previous.meetingId}/sessions/${previous.sessionId}/leave`, {
      method: 'POST', body: { attendanceId: previous.attendanceId }, keepalive: true,
    }).then(() => {
      if (reloadDeparture.current === previous) reloadDeparture.current = null;
    }).catch(() => {
      // A slow or failed cleanup must not interrupt the new connection.
    }).finally(() => { reloadCleanupPending.current = false; });
  }, [accessToken, transferDevice]);

  const reconnect = useCallback(async (code: string, attendanceId: string) => {
    const session = current.current;
    if (!session || session.attendanceId !== attendanceId || request.current) return;
    if (recoveryUsed.current) {
      await leave('Không thể khôi phục kết nối. Hãy thử tham gia lại.');
      return;
    }
    recoveryUsed.current = true;
    reloadDeparture.current = session;
    current.current = null;
    forgetMeeting();
    setRecovering(true);
    setActive(null);
    setTransferStatus(null);
    try { await join(code, session.meetingId, session.sessionId, 'add'); }
    finally { if (mounted.current) setRecovering(false); }
  }, [join, leave]);

  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    // Defer one tick so StrictMode's setup/cleanup rehearsal cannot issue a join.
    const timer = window.setTimeout(() => {
      if (resumed.current) return;
      resumed.current = true;
      const saved = readMeetingResume(accessToken);
      if (!saved) return;
      // A duplicated tab can inherit sessionStorage. Only a reload replaces the saved attendance.
      const navigation = window.performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
      const isReload = navigation?.type === 'reload';
      if (isReload) reloadDeparture.current = saved;
      void join(saved.code, saved.meetingId, saved.sessionId, isReload ? 'add' : undefined);
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
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', depart);
      // React can immediately rerun this effect while the same attendance remains active.
      queueMicrotask(() => {
        if (mounted.current) return;
        request.current?.abort();
        depart();
      });
    };
  }, [recordDeparture]);

  const ended = useCallback((message?: string, removedByServer?: boolean) => {
    if (removedByServer) { current.current = null; departure.current = null; }
    void leave(message);
  }, [leave]);
  const sessionEnded = useCallback(() => {
    request.current?.abort(); request.current = null;
    setBusy(false);
    forgetMeeting();
    current.current = null; departure.current = null;
    setActive(null); setWaiting(null); setDeviceChoice(null); setTransferStatus(null); setRecovering(false); setError('Buổi họp đã kết thúc.');
  }, []);
  const cancelDeviceChoice = useCallback(() => { setDeviceChoice(null); setError(''); }, []);
  return { active, recovering, waiting, deviceChoice, transferStatus, busy, error, join, leave, ended, sessionEnded, report, cancelDeviceChoice, transferDevice, onConnected, reconnect };
}
