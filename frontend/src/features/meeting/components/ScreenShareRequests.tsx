import { useState } from 'react';
import { useParticipantAttribute, useParticipants } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { meetingRequest } from '../services/meetings-api';

function Request({ participant, accessToken, path }: { participant: Participant; accessToken: string; path: string }) {
  const status = useParticipantAttribute('screenShareRequest', { participant });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (status !== 'pending') return null;
  async function decide(approved: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try { await meetingRequest(accessToken, path, { method: 'POST', body: { identity: participant.identity, approved } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không duyệt được yêu cầu.'); }
    finally { setBusy(false); }
  }
  return <div className="screen-share-request"><span>{participant.name || 'Thành viên'} muốn chia sẻ màn hình</span>
    <div><button disabled={busy} onClick={() => void decide(true)}>Cho chia sẻ</button><button disabled={busy} onClick={() => void decide(false)}>Từ chối</button></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function ScreenShareRequests({ accessToken, meetingId, sessionId }: { accessToken: string; meetingId: string; sessionId: string }) {
  const participants = useParticipants();
  return <div className="screen-share-requests" aria-live="polite">{participants.filter(p => !p.isLocal).map(participant =>
    <Request key={participant.identity} participant={participant} accessToken={accessToken} path={`/${meetingId}/sessions/${sessionId}/screen-share/decision`} />)}</div>;
}
