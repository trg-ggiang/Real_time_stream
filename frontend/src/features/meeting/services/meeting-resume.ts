export type MeetingResume = { code: string; meetingId: string; sessionId: string; attendanceId: string; owner: string; savedAt: number };
const key = 'rts.active-meeting.v1';

function ownerOf(token: string): string {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; }
  catch { return ''; }
}

export function rememberMeeting(token: string, value: Omit<MeetingResume, 'owner' | 'savedAt'>) {
  const owner = ownerOf(token);
  if (!owner) return;
  try { sessionStorage.setItem(key, JSON.stringify({ ...value, owner, savedAt: Date.now() })); } catch { /* Optional persistence. */ }
}

export function forgetMeeting() {
  try { sessionStorage.removeItem(key); } catch { /* Storage disabled. */ }
}

export function readMeetingResume(token: string): MeetingResume | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    const url = new URLSearchParams(window.location.search);
    if (value && value.owner === ownerOf(token) && value.owner && Date.now() - value.savedAt < 86400000 &&
        /^[A-Z0-9]{10}$/.test(value.code) && typeof value.meetingId === 'string' &&
        typeof value.sessionId === 'string' && typeof value.attendanceId === 'string' &&
        value.code === url.get('meeting') && value.sessionId === url.get('session')) return value;
  } catch { /* Discard invalid resume data. */ }
  forgetMeeting();
  return null;
}
