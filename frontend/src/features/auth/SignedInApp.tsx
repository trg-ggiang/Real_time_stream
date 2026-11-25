import { useCallback, useEffect, useRef, useState } from 'react';
import { GuestLanding } from '../guest/GuestLanding';
import { MeetingPage } from '../meeting/MeetingPage';
import type { AuthSession } from './auth-api';

function meetingHref() {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  return params.get('view') === 'meeting' && params.get('meeting') ? pathname + search : null;
}

function appHref(url = new URL(window.location.href)) {
  for (const key of ['view', 'meeting', 'session']) url.searchParams.delete(key);
  return url.pathname + url.search + url.hash;
}

function navigate(href: string) {
  const state = window.history.state;
  window.history.pushState({ ...state, idx: (state?.idx ?? 0) + 1 }, '', href);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

export function SignedInApp({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [entry, setEntry] = useState(meetingHref);
  const [expanded, setExpanded] = useState(entry !== null);
  const [hasCall, setHasCall] = useState(false);
  const callHref = useRef(entry);
  const outsideHref = useRef(entry && location.pathname === '/' ? '/workspace' : appHref());

  useEffect(() => {
    function syncNavigation() {
      const href = meetingHref();
      if (hasCall) {
        // A different meeting link must not replace the current call.
        if (href && callHref.current && href !== callHref.current) {
          history.replaceState(history.state, '', callHref.current);
        }
        if (!href) outsideHref.current = appHref();
        setExpanded(Boolean(href));
        return;
      }
      callHref.current = href;
      setEntry(href);
      setExpanded(Boolean(href));
    }
    window.addEventListener('popstate', syncNavigation);
    return () => window.removeEventListener('popstate', syncNavigation);
  }, [hasCall]);

  function openMeeting() {
    if (hasCall) {
      restoreMeeting();
      return;
    }
    const url = new URL(window.location.href);
    if (!url.searchParams.get('meeting')) {
      navigate('/workspace');
      return;
    }
    outsideHref.current = appHref(new URL(url));
    history.replaceState(history.state, '', outsideHref.current);
    url.searchParams.set('view', 'meeting');
    navigate(url.pathname + url.search);
  }

  function restoreMeeting() {
    if (expanded || !callHref.current) return;
    outsideHref.current = appHref();
    // A workspace invite may have written its parameters into this history entry.
    history.replaceState(history.state, '', outsideHref.current);
    navigate(callHref.current);
  }

  function showApp() {
    if (hasCall) {
      callHref.current = meetingHref() ?? callHref.current;
      const outside = outsideHref.current;
      navigate(/^\/workspace(?:[/?#]|$)/.test(outside) ? outside : '/workspace');
      return;
    }
    navigate(outsideHref.current);
  }

  const onCallChange = useCallback((active: boolean) => {
    // The user may have picked a different occurrence in the lobby.
    if (active) callHref.current = meetingHref() ?? callHref.current;
    setHasCall(active);
  }, []);

  return <div className="signed-in-app">
    {entry && <MeetingPage key={entry} entrySearch={new URL(entry, window.location.origin).search}
      accessToken={session.access_token} displayName={session.user.displayName} onLogout={onLogout}
      expanded={expanded} onBack={showApp} onExpand={restoreMeeting} onCallChange={onCallChange} />}
    <div hidden={expanded}>
      <GuestLanding viewer={session.user} role={session.user.role} accessToken={session.access_token}
        onMeeting={openMeeting} onLogout={onLogout} />
    </div>
  </div>;
}
