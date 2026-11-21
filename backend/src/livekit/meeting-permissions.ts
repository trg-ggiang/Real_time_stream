import { TrackSource } from 'livekit-server-sdk';

// Replace this policy with room membership/role decisions when roles are introduced.
export function getMeetingPublishSources(canShareScreen: boolean): TrackSource[] {
  return [
    TrackSource.CAMERA,
    TrackSource.MICROPHONE,
    ...(canShareScreen ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : []),
  ];
}
