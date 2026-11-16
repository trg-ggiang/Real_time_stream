import { useEffect, useRef, useState } from "react";
export function useAccountMutation() {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => pending.current?.abort(), []);
  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | null> {
    if (pending.current) return null;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await operation(controller.signal);
      return controller.signal.aborted ? null : result;
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thực hiện được thao tác.",
        );
      return null;
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return { busy, error, run };
}
