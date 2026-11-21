import { useEffect, useId, useRef } from 'react';
import type { DeviceJoinMode } from '../services/meetings-api';

export function MeetingDeviceChoice({ busy, error, onChoose, onCancel }: {
  busy: boolean;
  error: string;
  onChoose: (mode: DeviceJoinMode) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancelButton.current?.focus();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="workspace-confirm meeting-device-choice" aria-labelledby={titleId}
      aria-describedby={descriptionId} aria-busy={busy} onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}>
      <h2 id={titleId}>Bạn đang họp trên thiết bị khác</h2>
      <p id={descriptionId}>Nếu chuyển, thiết bị này sẽ kết nối trước khi các thiết bị cũ của bạn rời phòng.</p>
      <div className="meeting-device-choice-options">
        <button type="button" className="meeting-device-choice-primary" disabled={busy} onClick={() => onChoose('transfer')}>
          Chuyển sang thiết bị này
        </button>
        <button type="button" disabled={busy} onClick={() => onChoose('add')}>Dùng cả hai thiết bị</button>
      </div>
      {busy ? <p role="status">Đang tham gia…</p> : null}
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <button ref={cancelButton} type="button" className="meeting-device-choice-cancel" disabled={busy} onClick={onCancel}>Hủy</button>
    </dialog>
  );
}
