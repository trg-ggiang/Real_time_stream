export interface JoinCredentials {
  role?: 'host' | 'moderator' | 'participant';
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
  sessionId?: string;
}
