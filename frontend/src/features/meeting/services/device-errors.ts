import { MediaDeviceFailure } from 'livekit-client';

export function deviceErrorMessage(failure: MediaDeviceFailure | undefined, kind: MediaDeviceKind): string {
  const device = kind === 'videoinput' ? 'Camera' : 'Microphone';
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied: return `${device} đang bị chặn. Cho phép truy cập trong cài đặt trình duyệt rồi bật lại.`;
    case MediaDeviceFailure.NotFound: return `Không tìm thấy ${device.toLowerCase()}. Kết nối thiết bị hoặc chọn thiết bị khác trong cài đặt.`;
    case MediaDeviceFailure.DeviceInUse: return `${device} đang được ứng dụng khác sử dụng hoặc chưa sẵn sàng. Đóng ứng dụng đang dùng thiết bị rồi bật lại.`;
    default: return `Chưa bật được ${device.toLowerCase()}. Kiểm tra thiết bị đã chọn rồi thử bật lại. Bạn vẫn có thể tiếp tục cuộc họp.`;
  }
}

export function isCaptureError(error: Error): boolean {
  return ['NotAllowedError', 'PermissionDeniedError', 'NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'OverconstrainedError', 'AbortError'].includes(error.name);
}
