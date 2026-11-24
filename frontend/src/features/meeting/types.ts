export interface JoinCredentials {
  role?: 'host' | 'moderator' | 'participant';
  hostUserId?: string;
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
  sessionId?: string;
}
