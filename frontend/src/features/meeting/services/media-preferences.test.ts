// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { readMediaPreferences, saveMediaPreference } from './media-preferences';
afterEach(() => sessionStorage.clear());

it('preserves muted camera and microphone across reload without changing the other device', () => {
  saveMediaPreference('audioinput', false);
  expect(readMediaPreferences()).toEqual({ audio: false, video: true });
  saveMediaPreference('videoinput', false);
  expect(readMediaPreferences()).toEqual({ audio: false, video: false });
});

it('ignores malformed preferences', () => {
  sessionStorage.setItem('rts.meeting-devices.v1', '{bad');
  expect(readMediaPreferences()).toEqual({ audio: true, video: true });
});
