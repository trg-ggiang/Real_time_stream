import { Injectable } from '@nestjs/common';
import { WorkspaceAccess } from './workspace-access.service';
import { WorkspaceChannels } from './workspace-channels.service';

@Injectable()
export class WorkspaceAttention {
  constructor(private readonly access: WorkspaceAccess, private readonly channels: WorkspaceChannels) {}

  async summary(userId: string, clubId: string) {
    const context = await this.access.require(userId, clubId);
    const db = this.access.supabase.client;
    const visible = await this.channels.list(userId, clubId);
    const membershipId = context.membership.membership_id;
    const channelIds = visible.items.map(channel => channel!.channel_id);
    const [states, joined, postsReview, activitiesReview, postsMine, activitiesMine, meetings] = await Promise.all([
      channelIds.length ? db.from('channel_read_states').select('channel_id,last_read_message_id').eq('membership_id', membershipId).in('channel_id', channelIds) : Promise.resolve({ data: [], error: null }),
      db.from('club_memberships').select('joined_at').eq('membership_id', membershipId).single(),
      context.membership.role === 'chairperson' ? db.from('club_posts').select('post_id', { count: 'exact', head: true }).eq('club_id', clubId).eq('publication_status', 'pending_review') : Promise.resolve({ count: 0, error: null }),
      context.membership.role === 'chairperson' ? db.from('club_activities').select('activity_id', { count: 'exact', head: true }).eq('club_id', clubId).eq('publication_status', 'pending_review') : Promise.resolve({ count: 0, error: null }),
      db.from('club_posts').select('post_id', { count: 'exact', head: true }).eq('club_id', clubId).eq('author_id', userId).eq('publication_status', 'changes_requested'),
      db.from('club_activities').select('activity_id', { count: 'exact', head: true }).eq('club_id', clubId).eq('created_by', userId).eq('publication_status', 'changes_requested'),
      db.from('meetings').select('meeting_id,meeting_sessions(session_id,status,scheduled_start_at)').eq('club_id', clubId),
    ]);
    for (const result of [states, joined, postsReview, activitiesReview, postsMine, activitiesMine, meetings]) this.access.check(result.error);
    const readIds = (states.data ?? []).map(state => state.last_read_message_id).filter((id): id is string => !!id);
    const readMessages = readIds.length ? await db.from('channel_messages').select('message_id,created_at').in('message_id', readIds) : { data: [], error: null };
    this.access.check(readMessages.error);
    const readTimes = new Map((readMessages.data ?? []).map(message => [message.message_id, message.created_at]));
    const read = new Map((states.data ?? []).map(state => [state.channel_id, state]));
    const channels = await Promise.all(channelIds.map(async channelId => {
      const state = read.get(channelId);
      const lastTime = state?.last_read_message_id ? readTimes.get(state.last_read_message_id) : undefined;
      let query = db.from('channel_messages').select('message_id', { count: 'exact', head: true })
        .eq('channel_id', channelId).is('deleted_at', null).neq('sender_membership_id', membershipId);
      if (lastTime && state?.last_read_message_id) {
        query = query.or(`created_at.gt.${lastTime},and(created_at.eq.${lastTime},message_id.gt.${state.last_read_message_id})`);
      } else {
        query = query.gt('created_at', joined.data!.joined_at);
      }
      const result = await query;
      this.access.check(result.error);
      return { channel_id: channelId, unread: result.count ?? 0 };
    }));
    const now = Date.now();
    const meetingCount = (meetings.data ?? []).reduce((count, meeting) => count +
      (meeting.meeting_sessions ?? []).filter(session => session.status === 'ongoing' ||
        (session.status === 'scheduled' && !!session.scheduled_start_at && Date.parse(session.scheduled_start_at) >= now)).length, 0);
    const review = (postsReview.count ?? 0) + (activitiesReview.count ?? 0);
    const revisions = (postsMine.count ?? 0) + (activitiesMine.count ?? 0);
    return { channels, meetings: meetingCount, review, revisions, postRevisions: postsMine.count ?? 0, activityRevisions: activitiesMine.count ?? 0,
      total: channels.reduce((sum, channel) => sum + channel.unread, 0) + meetingCount + review + revisions };
  }
}
