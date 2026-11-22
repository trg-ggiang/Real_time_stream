import { useEffect, useState } from 'react';

const warningMs = 60_000;
const maxTimerMs = 2_147_483_647;

function tokenExpiry(token: string) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' && Number.isFinite(exp * 1000) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function LiveKitExpiryNotice({ token }: { token: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const expiry = tokenExpiry(token);
    let timer: number | undefined;
    function update() {
      const remaining = expiry === null ? 0 : expiry - Date.now();
      setShow(remaining > 0 && remaining <= warningMs);
      if (remaining <= 0) return;
      const delay = remaining > warningMs ? remaining - warningMs : remaining;
      timer = window.setTimeout(update, Math.min(delay, maxTimerMs));
    }
    update();
    return () => window.clearTimeout(timer);
  }, [token]);

  return show ? <p className="meeting-livekit-expiry" role="status">
    Token vào phòng LiveKit ban đầu sắp hết hạn.
  </p> : null;
}
