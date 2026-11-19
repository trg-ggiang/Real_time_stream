const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createClient } = require('@supabase/supabase-js');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { WorkspacePeople } = require('../dist/workspace/workspace-people.service');

test('adding a club member writes the active membership with its joined date and selected department', async () => {
  const requests = [];
  const client = createClient('https://project.example', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (raw, options) => {
      const url = new URL(raw);
      const table = url.pathname.split('/').at(-1);
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ table, method: options.method, filters: url.searchParams, body });
      if (table === 'clubs') return Response.json([{ club_id: 'club-a', status: 'published' }]);
      if (table === 'club_departments') return Response.json([{ department_id: 'department-a' }]);
      if (table === 'users') return Response.json([{ user_id: 'user-b' }]);
      if (table === 'club_memberships' && options.method === 'POST') {
        return Response.json({ membership_id: 'membership-b' }, { status: 201 });
      }
      if (table === 'club_memberships') return Response.json([{ membership_id: 'membership-a', user_id: 'user-a', club_id: 'club-a', role: 'chairperson', department_id: 'department-a' }]);
      throw new Error(`Unexpected table ${table}`);
    } },
  });
  const service = new WorkspacePeople(new WorkspaceAccess({ client }));
  const result = await service.add('user-a', 'club-a', 'member@example.com', 'department-a');
  const insert = requests.find(request => request.table === 'club_memberships' && request.method === 'POST');
  assert.deepEqual({
    club_id: insert.body.club_id,
    user_id: insert.body.user_id,
    department_id: insert.body.department_id,
    role: insert.body.role,
    status: insert.body.status,
  }, {
    club_id: 'club-a', user_id: 'user-b', department_id: 'department-a',
    role: 'member', status: 'active',
  });
  assert.equal(Number.isNaN(Date.parse(insert.body.joined_at)), false);
  assert.deepEqual(result, { item: { membership_id: 'membership-b' } });
});
