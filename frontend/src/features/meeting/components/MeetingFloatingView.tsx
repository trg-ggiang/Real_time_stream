import {
  TrackToggle, VideoTrack, useParticipants, useSpeakingParticipants, useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ArrowsOutSimple } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/dist/csr/MicrophoneSlash';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { VideoCameraSlash } from '@phosphor-icons/react/dist/csr/VideoCameraSlash';
import type { PictureInPictureSelection } from '../hooks/use-meeting-picture-in-picture';

function MeetingFloatingVideo({ selection }: { selection?: PictureInPictureSelection }) {
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera], { onlySubscribed: false });
  const speakers = useSpeakingParticipants();
  const participants = useParticipants();
  const visibleTracks = tracks.filter(({ publication }) => publication.track && !publication.isMuted);
  const selected = selection && visibleTracks.find(track =>
    track.participant.identity === selection.identity && track.source === selection.source);
  const selectedParticipant = selection && participants.find(participant => participant.identity === selection.identity);
  const previews = visibleTracks.filter(track => track.source === Track.Source.Camera);
  const preview = selected ?? (!selection || !selectedParticipant ? (
    visibleTracks.find(track => track.source === Track.Source.ScreenShare) ??
    speakers.filter(speaker => !speaker.isLocal)
      .map(speaker => previews.find(track => track.participant.identity === speaker.identity)).find(Boolean) ??
    previews.find(track => !track.participant.isLocal) ?? previews[0]
  ) : undefined);
  const name = preview?.participant.name || selectedParticipant?.name;
  const unavailable = selection?.source === Track.Source.ScreenShare ? 'Màn hình đã ngừng chia sẻ' : 'Camera đang tắt';
  return <div className="meeting-floating-media">
    {preview ? <VideoTrack trackRef={preview} key={preview.publication.trackSid} muted data-source={preview.source} />
      : <span>{name ? name + ' · ' + unavailable : 'Chưa có video'}</span>}
    {preview && name && <span className="meeting-floating-caption">
      {name}{preview.source === Track.Source.ScreenShare ? ' · Đang chia sẻ' : ''}
    </span>}
  </div>;
}

type FloatingProps = {
  title: string;
  status: string;
  selection?: PictureInPictureSelection;
  canUseDevices: boolean;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  onToggleMedia: (kind: 'audioinput' | 'videoinput', enabled: boolean, userInitiated: boolean) => void;
  onMediaError: (kind: 'audioinput' | 'videoinput', error: Error) => void;
  onExpand: () => void;
  onLeave: () => void;
};

export function MeetingFloatingView({
  title, status, selection, canUseDevices, isMicrophoneEnabled, isCameraEnabled,
  onToggleMedia, onMediaError, onExpand, onLeave,
}: FloatingProps) {
  const microphoneLabel = isMicrophoneEnabled ? 'Tắt microphone' : 'Bật microphone';
  const cameraLabel = isCameraEnabled ? 'Tắt camera' : 'Bật camera';
  return <section className="meeting-floating" aria-label="Cuộc họp trong Picture-in-Picture">
    <header className="meeting-floating-header">
      <div><strong title={title}>{title}</strong><span role="status">{status}</span></div>
      <button type="button" aria-label="Mở lại phòng" title="Mở lại phòng" onClick={onExpand}>
        <ArrowsOutSimple size={19} aria-hidden="true" />
      </button>
    </header>
    <MeetingFloatingVideo selection={selection} />
    <div className="meeting-floating-controls" role="group" aria-label="Điều khiển cuộc họp">
      <TrackToggle source={Track.Source.Microphone} showIcon={false} disabled={!canUseDevices}
        aria-label={microphoneLabel} title={microphoneLabel} aria-pressed={isMicrophoneEnabled}
        onChange={(enabled, userInitiated) => onToggleMedia('audioinput', enabled, userInitiated)}
        onDeviceError={error => onMediaError('audioinput', error)}>
        {isMicrophoneEnabled ? <Microphone size={19} aria-hidden="true" /> : <MicrophoneSlash size={19} aria-hidden="true" />}
      </TrackToggle>
      <TrackToggle source={Track.Source.Camera} showIcon={false} disabled={!canUseDevices}
        aria-label={cameraLabel} title={cameraLabel} aria-pressed={isCameraEnabled}
        onChange={(enabled, userInitiated) => onToggleMedia('videoinput', enabled, userInitiated)}
        onDeviceError={error => onMediaError('videoinput', error)}>
        {isCameraEnabled ? <VideoCamera size={19} aria-hidden="true" /> : <VideoCameraSlash size={19} aria-hidden="true" />}
      </TrackToggle>
      <button type="button" className="meeting-floating-leave" aria-label="Rời cuộc họp" title="Rời cuộc họp" onClick={onLeave}>
        <SignOut size={19} aria-hidden="true" />
      </button>
    </div>
  </section>;
}
