const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { ClubActivitiesService } = require('../dist/public-content/club-activities.service');

function fixture({ role = 'member', pending = true, failSubmission = false } = {}) {
  const requests = [];
  let inserted = false;
  const client = createClient('https://project.example', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input);
      const table = url.pathname.split('/').at(-1);
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ table, method: options.method, filters: url.searchParams, body });
      if (table === 'club_memberships') return Response.json(role ? [{ role }] : []);
      if (table === 'clubs') return Response.json([{ club_id: 'club-a' }]);
      if (options.method === 'POST') { inserted = true; return new Response(null, { status: 201 }); }
      if (body?.publication_status === 'pending_review' && failSubmission) {
        failSubmission = false;
        return Response.json({ message: 'temporary database failure' }, { status: 503 });
      }
      if (options.method === 'PATCH' && (pending || inserted)) {
        return Response.json([{ activity_id: 'activity-1', publication_status: body.publication_status }]);
      }
      return Response.json([]);
    } },
  });
  return { service: new ClubActivitiesService({ client }), requests };
}

const input = {
  activity_id: 'activity-1', title: 'Workshop', summary: 'Workshop summary', description: 'Workshop description',
  starts_at: '2026-12-01T09:00:00+07:00', ends_at: '2026-12-01T11:00:00+07:00',
  format: 'onsite', location_name: 'Room 1',
};

test('creation follows database transitions and only a chairperson publishes immediately', async () => {
  for (const role of ['member', 'chairperson']) {
    const { service, requests } = fixture({ role });
    const result = await service.createActivity('user-a', 'club-a', input);
    assert.equal(result.item.publication_status, role === 'member' ? 'pending_review' : 'published');
    const writes = requests.filter(request => request.body);
    assert.deepEqual(writes.map(request => request.body.publication_status),
      role === 'member' ? ['draft', 'pending_review'] : ['draft', 'pending_review', 'published']);
    assert.equal(writes[0].body.created_by, 'user-a');
    assert.equal(writes[0].body.club_id, 'club-a');
    assert.equal(writes[1].filters.get('publication_status'), 'eq.draft');
    if (role === 'chairperson') assert.equal(writes[2].filters.get('publication_status'), 'eq.pending_review');
  }
});

test('membership and chairperson checks are scoped to the selected club', async () => {
  const outsider = fixture({ role: null });
  await assert.rejects(outsider.service.createActivity('user-a', 'club-a', input), error => error.getStatus() === 403);
  const member = fixture();
  await assert.rejects(member.service.reviewActivity('user-a', 'club-a', 'activity-1'), error => error.getStatus() === 403);
  await assert.rejects(member.service.listActivities('user-a', 'club-b', 'pending_review', 1, 12), error => error.getStatus() === 403);
  assert.deepEqual(member.requests.filter(request => request.table === 'club_memberships').map(request => [
    request.filters.get('user_id'), request.filters.get('club_id'), request.filters.get('status'),
  ]), [['eq.user-a', 'eq.club-a', 'eq.active'], ['eq.user-a', 'eq.club-b', 'eq.active']]);
  assert.equal(member.requests.some(request => request.table === 'club_activities'), false);
});

test('rejection records a reason and only updates a pending activity in the selected club', async () => {
  const { service, requests } = fixture({ role: 'chairperson', pending: false });
  await assert.rejects(service.reviewActivity('user-a', 'club-a', 'activity-1', 'Update time'), error => error.getStatus() === 409);
  const update = requests.find(request => request.method === 'PATCH');
  assert.equal(update.filters.get('club_id'), 'eq.club-a');
  assert.equal(update.filters.get('activity_id'), 'eq.activity-1');
  assert.equal(update.filters.get('publication_status'), 'eq.pending_review');
  assert.equal(update.body.publication_status, 'rejected');
  assert.equal(update.body.review_note, 'Update time');
});

test('a member only receives their own proposals and failed submission can reuse its draft ID', async () => {
  const { service, requests } = fixture({ failSubmission: true });
  await service.listActivities('user-a', 'club-a', 'mine', 1, 12);
  const list = requests.find(request => request.table === 'club_activities');
  assert.equal(list.filters.get('created_by'), 'eq.user-a');
  assert.equal(list.filters.get('publication_status'), 'in.(pending_review,published,rejected)');
  await assert.rejects(service.createActivity('user-a', 'club-a', input), error => error.getStatus() === 503);
  assert.equal((await service.createActivity('user-a', 'club-a', input)).item.publication_status, 'pending_review');
  const inserts = requests.filter(request => request.method === 'POST');
  assert.deepEqual(inserts.map(request => request.body.activity_id), ['activity-1', 'activity-1']);
  assert.equal(inserts[0].filters.get('on_conflict'), 'activity_id');
});
