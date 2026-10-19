import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJoinCredentials } from '../services/token-api';
import type { JoinCredentials } from '../types';

export function useMeetingSession() {
  const [credentials, setCredentials] = useState<JoinCredentials | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const joined = useRef(false);

  const leave = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    joined.current = false;
    setCredentials(null);
    setIsJoining(false);
    setError(null);
  }, []);

  const endSession = useCallback(
    (message?: string) => {
      leave();
      setError(message ?? null);
    },
    [leave],
  );

  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );

  const join = useCallback(async () => {
    if (pending.current || joined.current) return;
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices) {
      setError(
        'Camera và microphone cần HTTPS hoặc localhost. Hãy mở trang bằng địa chỉ phù hợp.',
      );
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setIsJoining(true);
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await requestJoinCredentials(controller.signal);
      if (!controller.signal.aborted) {
        joined.current = true;
        setCredentials(result);
      }
    } catch (cause) {
      if (pending.current === controller) {
        setError(
          controller.signal.aborted
            ? 'Yêu cầu đã quá thời gian. Hãy kiểm tra backend rồi thử lại.'
            : cause instanceof TypeError
              ? 'Không kết nối được backend. Hãy kiểm tra API và địa chỉ frontend được phép.'
              : cause instanceof Error
                ? cause.message
                : 'Không thể tham gia phòng.',
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setIsJoining(false);
      }
    }
  }, []);

  return { credentials, isJoining, error, join, leave, endSession };
}
