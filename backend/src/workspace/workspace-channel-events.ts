import { Injectable } from '@nestjs/common';

export interface ChannelSavedEvent { clubId: string; channelId: string; message: Record<string, any> }

@Injectable()
export class WorkspaceChannelEvents {
  private readonly listeners = new Set<(event: ChannelSavedEvent) => void>();
  subscribe(listener: (event: ChannelSavedEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  publish(event: ChannelSavedEvent) { for (const listener of this.listeners) listener(event); }
}
