const key = 'rts.meeting-devices.v1';
export function readMediaPreferences(): { audio: boolean; video: boolean } {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (typeof value?.audio === 'boolean' && typeof value?.video === 'boolean') return value;
  } catch { /* Optional preference. */ }
  return { audio: true, video: true };
}
export function saveMediaPreference(kind: MediaDeviceKind, enabled: boolean) {
  try {
    const value = readMediaPreferences();
    if (kind === 'audioinput') value.audio = enabled;
    if (kind === 'videoinput') value.video = enabled;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* Controls still work without storage. */ }
}
