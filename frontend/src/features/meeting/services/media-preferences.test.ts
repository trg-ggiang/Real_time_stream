// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { readMediaPreferences, saveMediaPreference, readSpeakerPreference, saveSpeakerPreference } from './media-preferences';
afterEach(() => sessionStorage.clear());

it('stores speaker preference independently of microphone and camera', () => {
  expect(readSpeakerPreference()).toBe(true);
  saveSpeakerPreference(false);
  expect(readSpeakerPreference()).toBe(false);
  expect(readMediaPreferences()).toEqual({ audio: true, video: true });
  saveMediaPreference('audioinput', false);
  expect(readSpeakerPreference()).toBe(false);
  saveSpeakerPreference(true);
  expect(readSpeakerPreference()).toBe(true);
});

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
