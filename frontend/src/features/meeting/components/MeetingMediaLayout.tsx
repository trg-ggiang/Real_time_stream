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
  const self = cameras.filter(track => track.participant.isLocal);
  const others = cameras.filter(track => !track.participant.isLocal);

  return <div className="meeting-media-layout">
    <ScreenShareStage />
    <aside className="meeting-camera-sidebar" aria-label="Camera trong phòng">
      <section className="meeting-self-camera" aria-label="Camera của bạn">
        <div className="meeting-camera-label">Camera của bạn</div>
        <TrackLoop tracks={self}>{children}</TrackLoop>
      </section>
      {others.length > 0 && <section className="meeting-other-cameras" aria-label="Camera thành viên">
        <TrackLoop tracks={others}>{children}</TrackLoop>
      </section>}
    </aside>
  </div>;
}
