// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PreJoinAudio } from './PreJoinAudio';

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it('previews camera locally, stops capture before joining and passes the selected devices', async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const confirm = vi.fn(() => expect(stop).toHaveBeenCalled());
  render(<PreJoinAudio title="CLB" onConfirm={confirm} onCancel={vi.fn()} />);
  await waitFor(() => expect((screen.getByLabelText('Xem trước camera của bạn') as HTMLVideoElement).srcObject).toBe(stream));
  expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
  fireEvent.click(screen.getByRole('button', { name: 'Micro trước khi vào phòng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tham gia' }));
  expect(confirm).toHaveBeenCalledWith({ microphone: false, speaker: true, camera: true });
});

it('stops tracks that arrive after the preview was closed', async () => {
  let resolve!: (value: unknown) => void;
  const stop = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } });
  const view = render(<PreJoinAudio title="CLB" onConfirm={vi.fn()} onCancel={vi.fn()} />);
  view.unmount();
  await act(async () => { resolve({ getTracks: () => [{ stop }] }); });
  expect(stop).toHaveBeenCalledOnce();
});

it('allows joining with camera off after permission is denied', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } });
  const confirm = vi.fn();
  render(<PreJoinAudio title="CLB" onConfirm={confirm} onCancel={vi.fn()} />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Camera trước khi vào phòng' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tham gia' }));
  expect(confirm).toHaveBeenCalledWith({ microphone: true, speaker: true, camera: false });
});
