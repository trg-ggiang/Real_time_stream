import type { ClubChannel } from './services/workspace-api';

export function channelLabel(channel: ClubChannel): string {
  const name = channel.name.replace(/^\s*#\s*/, '').trim();
  if (channel.kind === 'general') return name;
  return `Ban ${name.replace(/^ban\s+/i, '')}`;
}
