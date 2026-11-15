import { lazy, Suspense } from 'react';
import { restoreSession } from './features/auth/session-storage';
import { GuestLanding } from './features/guest/GuestLanding';

const AuthApp = lazy(() => import('./features/auth/AuthApp').then(module => ({ default: module.AuthApp })));

export function App() {
  const mode = new URLSearchParams(window.location.search).get('mode');
  const showAccount = mode === 'login' || mode === 'register' || restoreSession() !== null;
  return showAccount ? <Suspense fallback={<p role="status">Đang mở tài khoản…</p>}><AuthApp /></Suspense> : <GuestLanding />;
}
