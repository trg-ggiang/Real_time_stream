import { useEffect, useState, type ReactElement } from 'react';
import { GridLayout, TrackLoop, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { ScreenShareStage } from './ScreenShareStage';

const CAMERA_TILES_PER_PAGE = 3;

export function MeetingMediaLayout({ children }: { children: ReactElement }) {
  const cameras = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screens = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const selfCamera = cameras.filter(track => track.participant.isLocal);
  const others = cameras.filter(track => !track.participant.isLocal);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(others.length / CAMERA_TILES_PER_PAGE));
  const visibleTracks = others.slice(page * CAMERA_TILES_PER_PAGE, (page + 1) * CAMERA_TILES_PER_PAGE);
  useEffect(() => setPage(current => Math.min(current, pageCount - 1)), [pageCount]);

  if (screens.length === 0) {
    return <div className="video-grid"><GridLayout tracks={cameras}>{children}</GridLayout></div>;
  }

  return <div className={`meeting-media-layout${others.length === 0 && selfCamera.length === 0 ? ' meeting-media-layout--presentation-only' : ''}`}>
    <ScreenShareStage />
    {((page === 0 && selfCamera.length > 0) || others.length > 0) && <aside className="meeting-camera-sidebar" aria-label="Camera trong phòng">
      {page === 0 && selfCamera.length > 0 ? <section className="meeting-self-camera" aria-label="Camera của bạn">
        <TrackLoop tracks={selfCamera}>{children}</TrackLoop>
      </section> : null}
      {others.length > 0 ? <>
        <section className="meeting-other-cameras" aria-label="Camera thành viên">
          <TrackLoop tracks={visibleTracks}>{children}</TrackLoop>
        </section>
        {pageCount > 1 ? <nav className="meeting-camera-pagination" aria-label="Phân trang camera thành viên">
        <button type="button" aria-label="Camera trang trước" title="Trang trước" disabled={page === 0}
          onClick={() => setPage(current => Math.max(0, current - 1))}><CaretLeft size={17} aria-hidden="true" /></button>
        <span aria-live="polite">{page + 1}/{pageCount}</span>
        <button type="button" aria-label="Camera trang sau" title="Trang sau" disabled={page >= pageCount - 1}
          onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}><CaretRight size={17} aria-hidden="true" /></button>
        </nav> : null}
      </> : null}
    </aside>}
  </div>;
}
