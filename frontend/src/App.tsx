import { lazy, Suspense } from 'react';
import { restoreSession } from './features/auth/session-storage';
import { GuestLanding } from './features/guest/GuestLanding';

const AuthApp = lazy(() => import('./features/auth/AuthApp').then(module => ({ default: module.AuthApp })));

export function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const meetingInvite = params.get('view') === 'meeting' && Boolean(params.get('meeting'));
  const showAccount = mode === 'login' || mode === 'register' || meetingInvite || restoreSession() !== null;
  return showAccount ? <Suspense fallback={<p role="status">Đang mở tài khoản…</p>}><AuthApp /></Suspense> : <GuestLanding />;
}
