// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { AUTH_SESSION_KEY, restoreSession, saveSession } from './session-storage';

const session = {
  access_token: `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`,
  user: { userId: 'member', email: 'member@test.dev', displayName: 'Member', avatarUrl: null },
};
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

it('restores login in a new tab with no tab-specific storage', () => {
  saveSession(session);
  sessionStorage.clear();
  expect(restoreSession()).toEqual(session);
});

it('migrates an existing login so subsequent tabs can use it', () => {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  expect(restoreSession()).toEqual(session);
  expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
  expect(JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)!)).toEqual(session);
});

it('does not resurrect an old tab login after another tab logs out', () => {
  saveSession(null);
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  expect(restoreSession()).toBeNull();
  expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
});

it('prefers the shared account over an old tab account and rejects expiry', () => {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...session, user: { ...session.user, userId: 'old' } }));
  saveSession(session);
  expect(restoreSession()?.user.userId).toBe('member');
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...session,
    access_token: `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`,
  }));
  expect(restoreSession()).toBeNull();
});
