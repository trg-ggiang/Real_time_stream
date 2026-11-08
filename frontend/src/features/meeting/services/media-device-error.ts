import { MediaDeviceFailure } from 'livekit-client';

function getDeviceLabel(kind?: MediaDeviceKind): string {
  if (kind === 'videoinput') return 'camera';
  if (kind === 'audioinput') return 'microphone';
  return 'thiết bị media';
}

export function getMediaDeviceErrorMessage(
  failure: MediaDeviceFailure | undefined,
  kind?: MediaDeviceKind,
): string {
  const device = getDeviceLabel(kind);

  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return `Trình duyệt đang chặn ${device}. Hãy mở quyền Camera/Microphone cạnh thanh địa chỉ, chọn Cho phép, rồi bật lại ${device} trong thanh điều khiển.`;
    case MediaDeviceFailure.NotFound:
      return `Không tìm thấy ${device}. Hãy kết nối thiết bị rồi thử bật lại.`;
    case MediaDeviceFailure.DeviceInUse:
      return `${device} đang được ứng dụng hoặc tab khác sử dụng. Hãy tắt ${device} ở nơi đó rồi thử lại. Trên Windows, camera thường chỉ mở được ở một tab cùng lúc.`;
    case MediaDeviceFailure.Other:
    case undefined:
      return `Không thể mở ${device}. Hãy kiểm tra quyền trình duyệt và thiết bị, sau đó thử bật lại.`;
  }
}

export function getMediaDeviceErrorFromException(
  error: Error,
  kind?: MediaDeviceKind,
): string {
  const failure = MediaDeviceFailure.getFailure(error);
  if (failure) return getMediaDeviceErrorMessage(failure, kind);
  return `${getDeviceLabel(kind)} gặp lỗi: ${error.message}`;
}
