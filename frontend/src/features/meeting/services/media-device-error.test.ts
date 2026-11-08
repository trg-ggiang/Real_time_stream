import { MediaDeviceFailure } from 'livekit-client';
import { expect, it } from 'vitest';
import { getMediaDeviceErrorMessage } from './media-device-error';

it('explains that camera permission needs to be granted in the browser', () => {
  expect(
    getMediaDeviceErrorMessage(
      MediaDeviceFailure.PermissionDenied,
      'videoinput',
    ),
  ).toContain('Trình duyệt đang chặn camera');
});

it('identifies when another app or tab is using the camera', () => {
  const message = getMediaDeviceErrorMessage(
    MediaDeviceFailure.DeviceInUse,
    'videoinput',
  );
  expect(message).toContain('đang được ứng dụng hoặc tab khác sử dụng');
  expect(message).toContain('Windows');
});

it('asks the user to connect a camera if no video input is available', () => {
  expect(
    getMediaDeviceErrorMessage(MediaDeviceFailure.NotFound, 'videoinput'),
  ).toContain('Không tìm thấy camera');
});
