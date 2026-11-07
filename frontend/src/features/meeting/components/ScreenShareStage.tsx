import { useState } from 'react';
import { useTracks, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function ScreenShareStage() {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  // Derive a valid selection immediately when a presenter stops or leaves.
  const selected = tracks.find(track => track.participant.identity === selectedIdentity) ?? tracks[0];
  if (!selected) return null;
  const presenterName = selected.participant.name || selected.participant.identity;

  return <section className="screen-share-stage" aria-label="Màn hình đang chia sẻ">
    <div className="screen-share-heading">
      <span role="status">{presenterName} đang chia sẻ màn hình</span>
      {tracks.length > 1 && <label>
        Xem màn hình của
        <select value={selected.participant.identity} onChange={event => setSelectedIdentity(event.target.value)}>
          {tracks.map(track => <option key={track.participant.identity} value={track.participant.identity}>
            {track.participant.name || track.participant.identity}
          </option>)}
        </select>
      </label>}
    </div>
    <VideoTrack key={selected.publication.trackSid} trackRef={selected} className="screen-share-video" />
  </section>;
}
