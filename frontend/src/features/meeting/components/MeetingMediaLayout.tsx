import type { ReactElement } from 'react';
import { GridLayout, TrackLoop, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ScreenShareStage } from './ScreenShareStage';

export function MeetingMediaLayout({ children }: { children: ReactElement }) {
  const cameras = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screens = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  if (screens.length === 0) {
    return <div className="video-grid"><GridLayout tracks={cameras}>{children}</GridLayout></div>;
  }
  const others = cameras.filter(track => !track.participant.isLocal);

  return <div className={`meeting-media-layout${others.length === 0 ? ' meeting-media-layout--presentation-only' : ''}`}>
    <ScreenShareStage />
    {others.length > 0 && <aside className="meeting-camera-sidebar" aria-label="Camera trong phòng">
      <section className="meeting-other-cameras" aria-label="Camera thành viên">
        <TrackLoop tracks={others}>{children}</TrackLoop>
      </section>
    </aside>}
  </div>;
}
