const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
require('reflect-metadata');
const { WorkspacePeople } = require('../dist/workspace/workspace-people.service');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');

function fixture() {
  const writes = [];
  const client = createClient('https://test.example', 'fake', { global: { fetch: async (_url, options) => {
    if (options.method === 'GET') return Response.json([{ is_management: false, is_private: true }]);
    const payload = JSON.parse(options.body);
    writes.push(payload);
    if (options.method === 'PATCH' && Object.hasOwn(payload, 'is_private')) {
      return Response.json({ code: '42501', message: 'permission denied' }, { status: 403 });
    }
    return Response.json([{ department_id: 'department', is_private: true, ...payload }]);
  } } });
  const access = new WorkspaceAccess({ client });
  access.require = async (_actor, _club, chair) => assert.equal(chair, true);
  return { service: new WorkspacePeople(access, {}), writes };
}

test('editing a private department saves metadata without writing its privacy column', async () => {
  const { service, writes } = fixture();
  const result = await service.saveDepartment('chair', 'club', { name: ' New name ', is_private: true, status: 'active' }, 'department');
  assert.deepEqual(writes, [{ name: 'New name', description: null, status: 'active' }]);
  assert.equal(result.item.is_private, true);
});

test('editing department metadata rejects privacy changes without writing', async () => {
  const { service, writes } = fixture();
  await assert.rejects(() => service.saveDepartment('chair', 'club', { name: 'New name', is_private: false, status: 'active' }, 'department'), error => error.getStatus() === 403);
  assert.deepEqual(writes, []);
});

test('creating a department still sends the selected privacy setting', async () => {
  const { service, writes } = fixture();
  await service.saveDepartment('chair', 'club', { name: 'New department', is_private: true, status: 'active' });
  assert.equal(writes[0].is_private, true);
});

test('department list defaults to active departments and only chairs can request all states', async () => {
  const requests = [];
  const client = createClient('https://test.example', 'fake', { global: { fetch: async input => {
    const params = new URL(input).searchParams;
    requests.push(params);
    return Response.json([{ status: 'active' }, ...(!params.has('status') ? [{ status: 'inactive' }] : [])]);
  } } });
  const access = new WorkspaceAccess({ client });
  access.require = async (actor, _club, chair) => { if (chair && actor !== 'chair') throw new Error('denied'); };
  const service = new WorkspacePeople(access, {});
  assert.deepEqual((await service.departments('member', 'club')).items.map(d => d.status), ['active']);
  assert.deepEqual((await service.departments('chair', 'club', true)).items.map(d => d.status), ['active', 'inactive']);
  await assert.rejects(() => service.departments('member', 'club', true), /denied/);
  assert.equal(requests[0].get('status'), 'eq.active');
  assert.equal(requests.length, 2);
});
