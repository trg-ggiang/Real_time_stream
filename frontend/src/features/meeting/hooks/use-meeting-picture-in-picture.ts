import { useEffect, useRef, useState } from 'react';
import type { TrackReference } from '@livekit/components-react';

type PictureInPictureApi = { requestWindow(options: { width: number; height: number }): Promise<Window> };

function documentPictureInPicture() {
  return (window as Window & { documentPictureInPicture?: PictureInPictureApi }).documentPictureInPicture;
}

export function canOpenTrackPictureInPicture() {
  return Boolean(documentPictureInPicture() || document.pictureInPictureEnabled);
}

export type PictureInPictureSelection = {
  identity: string;
  source: TrackReference['source'];
};

export type OpenTrackPictureInPicture = (track: TrackReference, video?: HTMLVideoElement | null) => void;

export function useMeetingPictureInPicture(title: string) {
  const [pictureWindow, setPictureWindow] = useState<Window | null>(null);
  const [selection, setSelection] = useState<PictureInPictureSelection>();
  const [error, setError] = useState('');
  const openWindow = useRef<Window | null>(null);
  const nativeVideo = useRef<HTMLVideoElement | null>(null);
  const opening = useRef(false);
  const lifetime = useRef(0);

  useEffect(() => () => {
    lifetime.current++;
    openWindow.current?.close();
    if (nativeVideo.current && document.pictureInPictureElement === nativeVideo.current) {
      void document.exitPictureInPicture().catch(() => {});
    }
  }, []);

  async function open(track?: TrackReference, video?: HTMLVideoElement | null) {
    if (opening.current) return;
    const generation = lifetime.current;
    const documentApi = documentPictureInPicture();
    opening.current = true;
    setError('');
    try {
      if (documentApi) {
        setSelection(track ? { identity: track.participant.identity, source: track.source } : undefined);
        if (openWindow.current && !openWindow.current.closed) {
          openWindow.current.focus();
          return;
        }
        const target = await documentApi.requestWindow({ width: 366, height: 304 });
        if (generation !== lifetime.current) {
          target.close();
          return;
        }
        target.document.title = title;
        target.document.body.className = 'meeting-pip-body';
        openWindow.current = target;
        target.addEventListener('pagehide', () => {
          if (openWindow.current !== target) return;
          openWindow.current = null;
          if (generation === lifetime.current) setPictureWindow(null);
        }, { once: true });
        setPictureWindow(target);
      } else if (video?.requestPictureInPicture && document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        if (generation !== lifetime.current) {
          if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
          return;
        }
        nativeVideo.current = video;
      }
    } catch {
      if (generation === lifetime.current) {
        setError('Không mở được cửa sổ nổi. Hãy kiểm tra camera hoặc thử lại.');
      }
    } finally {
      opening.current = false;
    }
  }

  return {
    pictureWindow, selection, error,
    supportsWindow: Boolean(documentPictureInPicture()),
    open,
    dismissError: () => setError(''),
    closeWindow() {
      const target = openWindow.current;
      openWindow.current = null;
      setPictureWindow(null);
      target?.close();
    },
  };
}
