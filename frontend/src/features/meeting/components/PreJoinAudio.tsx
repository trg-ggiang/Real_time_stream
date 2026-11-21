import { useEffect, useId, useRef, useState } from 'react';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/dist/csr/MicrophoneSlash';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { VideoCameraSlash } from '@phosphor-icons/react/dist/csr/VideoCameraSlash';
import { readMediaPreferences, readSpeakerPreference } from '../services/media-preferences';

export type AudioSelection = { microphone: boolean; speaker: boolean; camera?: boolean };

export function PreJoinAudio({ title, onConfirm, onCancel }: {
  title: string; onConfirm: (selection: AudioSelection) => void; onCancel: () => void;
}) {
  const [microphone, setMicrophone] = useState(() => readMediaPreferences().audio);
  const [speaker] = useState(readSpeakerPreference);
  const [camera, setCamera] = useState(() => readMediaPreferences().video);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const preview = useRef<MediaStream | null>(null);
  function stopPreview() {
    preview.current?.getTracks().forEach(track => track.stop());
    preview.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => {
    let disposed = false;
    if (!camera) { setLoading(false); return; }
    setLoading(true); setCameraError('');
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return; }
        preview.current = stream;
        if (video.current) video.current.srcObject = stream;
      } catch {
        if (!disposed) { setCameraError('Không mở được camera. Kiểm tra quyền camera hoặc tiếp tục với camera tắt.'); setCamera(false); }
      } finally { if (!disposed) setLoading(false); }
    }
    void start();
    return () => { disposed = true; stopPreview(); };
  }, [camera]);
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    if (typeof element?.showModal === 'function') element.showModal();
    else if (element) element.open = true;
    element?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (typeof element?.close === 'function') element.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} className="meeting-prejoin" aria-labelledby={label} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={label}>Chuẩn bị vào phòng</h2>
    <p>{title}</p>
    <div className="meeting-prejoin-preview">
      <video ref={video} autoPlay muted playsInline hidden={!camera || loading} aria-label="Xem trước camera của bạn" />
      {(!camera || loading) && <div className="meeting-prejoin-placeholder"><VideoCameraSlash size={44} aria-hidden="true" /><span>{loading ? 'Đang mở camera…' : 'Camera đang tắt'}</span></div>}
      <span className="meeting-prejoin-self">Bạn</span>
    </div>
    <div className="meeting-prejoin-devices">
      <button type="button" aria-label="Micro trước khi vào phòng" title={microphone ? 'Tắt micro' : 'Bật micro'} aria-pressed={microphone} onClick={() => setMicrophone(value => !value)}>{microphone ? <Microphone size={24} aria-hidden="true" /> : <MicrophoneSlash size={24} aria-hidden="true" />}</button>
      <button type="button" aria-label="Camera trước khi vào phòng" title={camera ? 'Tắt camera' : 'Bật camera'} aria-pressed={camera} onClick={() => setCamera(value => !value)}>{camera ? <VideoCamera size={24} aria-hidden="true" /> : <VideoCameraSlash size={24} aria-hidden="true" />}</button>
    </div>
    {cameraError && <p className="notice error" role="alert">{cameraError}</p>}
    <p className="meeting-prejoin-hint">Bạn có thể đổi lại trong phòng. Với phòng có duyệt, bước tiếp theo sẽ gửi yêu cầu tham gia.</p>
    <div className="meeting-prejoin-actions"><button type="button" onClick={onCancel}>Hủy</button><button type="button" disabled={loading} onClick={() => { stopPreview(); onConfirm({ microphone, speaker, camera }); }}>Tiếp tục tham gia</button></div>
  </dialog>;
}
