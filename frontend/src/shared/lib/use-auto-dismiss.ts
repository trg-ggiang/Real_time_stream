import { useEffect } from 'react';

export function useAutoDismiss(value: string | null | undefined, dismiss: () => void, delay = 4500) {
  useEffect(() => {
    if (!value) return;
    const timer = window.setTimeout(dismiss, delay);
    return () => window.clearTimeout(timer);
  }, [value, dismiss, delay]);
}
