import { useEffect, useState } from "react";
import { accountRequest } from "../../shared/api/account-http";
export function usePersonalQuery<T>(token: string, path: string, refresh = 0) {
  const identity = `${token}:${path}`;
  const [state, setState] = useState<{
    identity: string;
    data?: T;
    error?: string;
  }>({ identity });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ identity });
    void accountRequest<T>(token, path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ identity, data });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setState({ identity, error: cause.message });
      });
    return () => controller.abort();
  }, [identity, attempt, refresh]);
  const current = state.identity === identity ? state : { identity };
  return {
    data: current.data,
    error: current.error,
    loading: !current.data && !current.error,
    retry: () => setAttempt((n) => n + 1),
  };
}
