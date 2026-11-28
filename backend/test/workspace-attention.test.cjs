const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { WorkspaceAttention } = require('../dist/workspace/workspace-attention.service');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { WorkspaceChannels } = require('../dist/workspace/workspace-channels.service');

test('attention counts only readable channel messages and actionable club items', async () => {
  const calls = [];
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
  const client = createClient('https://test.example', 'fake', { auth: { persistSession: false }, global: { fetch: async (input, options) => {
    const url = new URL(input), table = url.pathname.split('/').at(-1), q = url.searchParams;
    calls.push({ table, q });
    if (table === 'club_memberships') return Response.json(q.has('membership_id') ? { joined_at: '2026-11-01T00:00:00Z' } : [{ membership_id: 'member', role: 'chairperson' }]);
    if (table === 'clubs') return Response.json([{ club_id: 'club' }]);
    if (table === 'club_channels') return Response.json([{ channel_id: 'visible' }, { channel_id: 'private' }]);
    if (table === 'clubspace_can_read_channel') return Response.json(JSON.parse(options.body).p_channel === 'visible');
    if (table === 'channel_read_states') return Response.json([{ channel_id: 'visible', last_read_message_id: 'old' }]);
    if (table === 'channel_messages') {
      if (q.has('message_id')) return Response.json([{ message_id: 'old', created_at: '2026-11-10T00:00:00Z' }]);
      return new Response(null, { headers: { 'content-range': '0-1/2' } });
    }
    if (table === 'meetings') return Response.json([{ meeting_id: 'meeting', meeting_sessions: [
      { session_id: 'now', status: 'ongoing', scheduled_start_at: new Date(dayStart.getTime() + 3600000).toISOString() },
      { session_id: 'past', status: 'ended', scheduled_start_at: new Date(dayStart.getTime() + 7200000).toISOString() },
      { session_id: 'future', status: 'scheduled', scheduled_start_at: new Date(Date.now() + 7 * 86400000).toISOString() },
    ] }]);
    if (table === 'club_posts' || table === 'club_activities') {
      const count = q.get('publication_status') === 'eq.pending_review' ? 1 : 1;
      return new Response(null, { headers: { 'content-range': `0-${count - 1}/${count}` } });
    }
    throw new Error(`Unexpected table ${table}`);
  } } });
  const access = new WorkspaceAccess({ client });
  const summary = await new WorkspaceAttention(access, new WorkspaceChannels(access)).summary('actor', 'club', dayStart.toISOString(), dayEnd.toISOString());
  assert.deepEqual(summary.channels, [{ channel_id: 'visible', unread: 2 }]);
  assert.equal(summary.meetings, 2);
  assert.equal(summary.meetingsToday, 2);
  assert.equal(summary.review, 2);
  assert.equal(summary.revisions, 2);
  assert.equal(summary.total, 8);
  const count = calls.find(call => call.table === 'channel_messages' && !call.q.has('message_id'));
  assert.match(count.q.get('or'), /created_at\.gt\.2026-11-10T00:00:00Z/);
  assert.equal(calls.some(call => call.q.get('channel_id') === 'eq.private'), false);
});
