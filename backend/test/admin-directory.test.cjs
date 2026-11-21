const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AdminService } = require('../dist/admin/admin.service');
const { AdminDirectoryQuery } = require('../dist/admin/admin.dto');

function fixture(responses = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, operations: [] }; calls.push(call);
    const chain = {};
    for (const method of ['select', 'eq', 'in', 'or', 'ilike', 'order', 'range', 'limit', 'gte', 'lt']) chain[method] = (...args) => { call.operations.push([method, ...args]); return chain; };
    const result = () => typeof responses[table] === 'function' ? responses[table](call) : responses[table] ?? { data: [], count: 0, error: null };
    chain.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
    chain.maybeSingle = async () => result();
    return chain;
  } };
  return { calls, admin: new AdminService({ client }) };
}
const query = values => Object.assign(new AdminDirectoryQuery(), values);

test('admin read endpoints reject ordinary users before touching data', async () => {
  const { admin, calls } = fixture();
  for (const operation of [() => admin.users({ role: 'user' }, query({})), () => admin.userDetail({ role: null }, 'id'),
    () => admin.content({ role: 'user' }, query({})), () => admin.contentDetail({ role: null }, 'posts', 'id'), () => admin.summary({ role: 'user' })]) {
    await assert.rejects(operation, error => error.getStatus() === 403);
  }
  assert.equal(calls.length, 0);
});

test('account search is paginated, filters roles and never selects credential fields', async () => {
  const { admin, calls } = fixture({ users: { data: [{ user_id: 'one', email: 'an@example.com' }], count: 30, error: null } });
  const result = await admin.users({ role: 'admin' }, query({ page: 2, role: 'user', q: 'an),role.eq.admin' }));
  assert.equal(result.total, 30); assert.equal(result.hasMore, true);
  assert.deepEqual(calls[0].operations.find(([name]) => name === 'range'), ['range', 8, 15]);
  const fields = calls[0].operations.find(([name]) => name === 'select')[1];
  assert.equal(fields.includes('password'), false); assert.equal(fields.includes('*'), false);
  const filters = calls[0].operations.filter(([name]) => name === 'or');
  assert.equal(filters[0][1], 'role.is.null,role.eq.user');
  assert.equal(filters[1][1].includes(')'), false);
});

test('account details read profile and memberships without returning credential columns', async () => {
  const { admin, calls } = fixture({
    users: { data: { user_id: 'u', display_name: 'An', email: 'an@example.com' }, error: null },
    student_profiles: { data: { student_code: '20260001' }, error: null },
    club_memberships: { data: [{ membership_id: 'm', club_id: 'c', role: 'member', status: 'active' }], error: null },
    clubs: { data: [{ club_id: 'c', name: 'SINNO' }], error: null },
  });
  const result = await admin.userDetail({ role: 'admin' }, 'u');
  assert.equal(result.profile.student_code, '20260001'); assert.equal(result.memberships[0].club_name, 'SINNO');
  assert.ok(calls.every(call => call.operations.every(([name, value]) => name !== 'select' || !/password|\*/.test(value))));
});

test('content queries use only whitelisted sources and include private status for authorized admins', async () => {
  const { admin, calls } = fixture({ club_posts: { data: [{ post_id: 'p', club_id: 'c', publication_status: 'draft' }], count: 1, error: null },
    clubs: { data: [{ club_id: 'c', name: 'SINNO', status: 'published' }], error: null } });
  const result = await admin.content({ role: 'admin' }, query({ status: 'draft', q: 'Story' }));
  assert.equal(result.items[0].id, 'p'); assert.equal(result.items[0].club.name, 'SINNO');
  assert.ok(calls[0].operations.some(args => args[0] === 'eq' && args[1] === 'publication_status' && args[2] === 'draft'));
  await assert.rejects(() => admin.contentDetail({ role: 'admin' }, 'users', 'u'), error => error.getStatus() === 400);
  assert.equal(calls.length, 2);
});

test('overview counts are exact and daily registrations use seven non-overlapping Vietnam days', async () => {
  const { admin, calls } = fixture({ users: { data: null, count: 2, error: null }, clubs: { data: null, count: 3, error: null } });
  const result = await admin.summary({ role: 'admin' });
  assert.equal(result.users, 2); assert.equal(result.registrations.length, 7);
  const days = calls.filter(call => call.operations.some(args => args[0] === 'gte'));
  assert.equal(days.length, 7);
  for (let index = 0; index < days.length; index++) {
    const start = days[index].operations.find(args => args[0] === 'gte')[2];
    const end = days[index].operations.find(args => args[0] === 'lt')[2];
    assert.equal(Date.parse(end) - Date.parse(start), 86400000);
    assert.equal(start.slice(11, 16), '17:00');
    if (index) assert.equal(start, days[index - 1].operations.find(args => args[0] === 'lt')[2]);
  }
});

test('directory DTO rejects oversized pages and invalid content sources', async () => {
  for (const value of [{ page: '1.5' }, { limit: '9' }, { limit: '500' }, { kind: 'users' }, { role: 'owner' }, { status: 'anything' }]) {
    assert.ok((await validate(plainToInstance(AdminDirectoryQuery, value))).length > 0);
  }
  assert.equal((await validate(plainToInstance(AdminDirectoryQuery, { status: 'pending_review' }))).length, 0);
  assert.ok((await validate(plainToInstance(AdminDirectoryQuery, { status: 'pending' }))).length > 0);
});
