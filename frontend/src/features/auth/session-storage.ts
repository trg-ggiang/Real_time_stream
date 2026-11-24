import type { AuthSession } from './auth-api';

export const AUTH_SESSION_KEY = 'rts.auth-session.v1';

export function sessionExpiresAt(session: AuthSession): number {
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0;
  } catch { return 0; }
}

export function saveSession(session: AuthSession | null): void {
  try {
    // A null marker prevents an older tab's legacy session from restoring after logout.
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch { /* Storage may be disabled; login still works in memory. */ }
}

export function restoreSession(): AuthSession | null {
  try {
    const shared = localStorage.getItem(AUTH_SESSION_KEY);
    const value = JSON.parse(shared ?? sessionStorage.getItem(AUTH_SESSION_KEY) ?? 'null');
    if (typeof value?.access_token === 'string' &&
        typeof value.user?.userId === 'string' && typeof value.user?.email === 'string' &&
        typeof value.user?.displayName === 'string' && sessionExpiresAt(value) > Date.now()) {
      if (shared === null) saveSession(value);
      return value;
    }
  } catch { /* Discard invalid or unavailable storage. */ }
  saveSession(null);
  return null;
}
