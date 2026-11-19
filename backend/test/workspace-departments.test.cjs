const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { createClient } = require('@supabase/supabase-js');
const { ValidationPipe } = require('@nestjs/common');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { WorkspacePeople } = require('../dist/workspace/workspace-people.service');
const { DepartmentDto } = require('../dist/workspace/workspace.dto');

const input = { name: 'Ban Thiết kế', description: 'Thiết kế ấn phẩm của CLB', is_private: false, status: 'active' };
function fixture({ role = 'chairperson', management = false, conflict = false } = {}) {
  const requests = [];
  const client = createClient('https://project.example', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (raw, options) => {
      const url = new URL(raw); const table = url.pathname.split('/').at(-1);
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ table, method: options.method, filters: url.searchParams, body });
      if (table === 'club_memberships') return Response.json(role ? [{ membership_id: 'membership-a', role }] : []);
      if (table === 'clubs') return Response.json([{ club_id: 'club-a', status: 'published' }]);
      if (body && conflict) return Response.json({ code: '23505', message: 'Constraint violation' }, { status: 409 });
      if (body) return Response.json({ department_id: 'department-a', ...body });
      return Response.json([{ department_id: 'department-a', is_management: management }]);
    } },
  });
  return { service: new WorkspacePeople(new WorkspaceAccess({ client })), requests };
}

test('department payload accepts management booleans, preserves older callers and rejects invalid or client-owned scope fields', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = body => pipe.transform(body, { type: 'body', metatype: DepartmentDto });
  assert.equal((await transform({ ...input, is_management: true })).is_management, true);
  assert.equal((await transform(input)).is_management, undefined);
  for (const value of ['true', 1, null]) await assert.rejects(transform({ ...input, is_management: value }), e => e.getStatus() === 400);
  await assert.rejects(transform({ ...input, club_id: 'another-club' }), e => e.getStatus() === 400);
});

test('creating a department inserts the submitted fields into club_departments under the server-selected club', async () => {
  for (const flag of [undefined, false, true]) {
    const { service, requests } = fixture();
    const result = await service.saveDepartment('user-a', 'club-a', { ...input, ...(flag !== undefined && { is_management: flag }) });
    const write = requests.find(r => r.method === 'POST');
    assert.equal(write.table, 'club_departments');
    assert.deepEqual(write.body, { ...input, club_id: 'club-a', is_management: flag ?? false });
    assert.equal(result.item.department_id, 'department-a');
    assert.equal(result.item.is_management, flag ?? false);
    const membership = requests.find(r => r.table === 'club_memberships');
    assert.equal(membership.filters.get('user_id'), 'eq.user-a');
    assert.equal(membership.filters.get('club_id'), 'eq.club-a');
  }
});

test('members and outsiders cannot create departments, and management departments must remain active', async () => {
  for (const role of ['member', null]) {
    const { service, requests } = fixture({ role });
    await assert.rejects(service.saveDepartment('user-a', 'club-a', input), e => e.getStatus() === 403);
    assert.equal(requests.some(r => r.body), false);
  }
  const invalid = fixture();
  await assert.rejects(invalid.service.saveDepartment('user-a', 'club-a', { ...input, is_management: true, status: 'inactive' }), e => e.getStatus() === 400);
  assert.equal(invalid.requests.some(r => r.body), false);
});

test('updates preserve existing management role and scope and database failure never reports a successful save', async () => {
  const protectedDepartment = fixture({ management: true });
  for (const change of [{ status: 'inactive' }, { is_management: false }]) {
    await assert.rejects(protectedDepartment.service.saveDepartment('user-a', 'club-a', { ...input, ...change }, 'department-a'), e => e.getStatus() === 403);
  }
  await protectedDepartment.service.saveDepartment('user-a', 'club-a', input, 'department-a');
  const write = protectedDepartment.requests.find(r => r.method === 'PATCH');
  assert.equal(write.filters.get('club_id'), 'eq.club-a');
  assert.equal(write.filters.get('department_id'), 'eq.department-a');
  assert.equal(Object.hasOwn(write.body, 'is_management'), false);
  const conflict = fixture({ conflict: true });
  await assert.rejects(conflict.service.saveDepartment('user-a', 'club-a', input), e => e.getStatus() === 409);
});
