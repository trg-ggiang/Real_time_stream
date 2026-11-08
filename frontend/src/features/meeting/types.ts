export interface JoinCredentials {
  serverUrl: string;
  participantIdentity: string;
  roomName: string;
  token: string;
  isHost: boolean;
  settings: {
    allowMic: boolean;
    allowVideo: boolean;
    waitingRoom: boolean;
  };
}

export interface WaitingRoomStatus {
  waiting: true;
}
