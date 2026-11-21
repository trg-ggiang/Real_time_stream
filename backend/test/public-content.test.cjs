const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { PublicContentService } = require('../dist/public-content/public-content.service');
const { CreateClubDto } = require('../dist/public-content/create-club.dto');
const { validateSync } = require('class-validator');
const { PersonalService } = require('../dist/personal/personal.service');
const { AdminService } = require('../dist/admin/admin.service');

function fixture(result) {
  const calls = [];
  const client = { from(view) {
    calls.push(['from', view]);
    const query = {};
    for (const operation of ['select', 'order', 'range']) query[operation] = (...args) => { calls.push([operation, ...args]); return query; };
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
  } };
  return { service: new PublicContentService({ client }), calls };
}

test('reads only public views, bounds pagination and strips unexpected/private fields', async () => {
  for (const collection of ['clubs', 'activities', 'posts']) {
    const { service, calls } = fixture({ data: [{ club_id: 'club', name: 'Published', author_id: 'private-author', review_note: 'private-note', join_url: 'private-url', password_hash: 'private-hash' }], count: 30, error: null });
    const response = await service.list(collection, 2, 12);
    assert.equal(calls[0][1], { clubs: 'public_clubs', activities: 'public_activity_feed', posts: 'public_club_posts' }[collection]);
    assert.deepEqual(calls.find(call => call[0] === 'range'), ['range', 12, 23]);
    assert.equal(response.hasMore, true);
    for (const key of ['author_id', 'review_note', 'join_url', 'password_hash']) assert.equal(Object.hasOwn(response.items[0], key), false);
    assert.equal(calls.find(call => call[0] === 'select')[1].includes('*'), false);
  }
});
test('empty public views return empty collections without fabricated records', async () => {
  const { service } = fixture({ data: [], count: 0, error: null });
  assert.deepEqual(await service.list('clubs', 1, 12), { items: [], page: 1, limit: 12, total: 0, hasMore: false });
});
test('database failures return a generic unavailable error without fallback or secrets', async () => {
  const { service, calls } = fixture({ data: null, error: { message: 'internal credentials and schema detail' } });
  await assert.rejects(service.list('posts', 1, 12), error => error.getStatus() === 503 && !error.message.includes('credentials'));
  assert.equal(calls.filter(call => call[0] === 'from').length, 1);
});

test('lists interest categories with an allowlist and filters published clubs before pagination', async () => {
  const calls = [];
  const client = { from(view) {
    calls.push(['from', view]);
    const query = {};
    for (const operation of ['select', 'eq', 'order', 'range', 'in', 'ilike'])
      query[operation] = (...args) => { calls.push([operation, ...args]); return query; };
    query.then = (resolve, reject) => Promise.resolve(view === 'club_categories'
      ? { data: [{ category_id: 'art', name: 'Nghệ thuật', description: 'private' }], error: null }
      : view === 'club_category_links'
        ? { data: [{ club_id: 'one' }, { club_id: 'hidden' }], error: null }
        : { data: [{ club_id: 'one', name: 'Art club', review_note: 'private' }], count: 1, error: null }
    ).then(resolve, reject);
    return query;
  } };
  const service = new PublicContentService({ client });
  assert.deepEqual(await service.clubCategories(), { items: [{ category_id: 'art', name: 'Nghệ thuật' }] });
  const response = await service.list('clubs', 1, 12, { category: 'art', q: 'Art' });
  assert.equal(response.total, 1);
  assert.equal(response.hasMore, false);
  assert.equal(response.items[0].review_note, undefined);
  assert.deepEqual(calls.find(call => call[0] === 'in'), ['in', 'club_id', ['one', 'hidden']]);
  assert.deepEqual(calls.find(call => call[0] === 'ilike'), ['ilike', 'name', '%Art%']);
  assert.deepEqual(calls.filter(call => call[0] === 'from').map(call => call[1]),
    ['club_categories', 'club_category_links', 'public_clubs']);
});

test('empty interest has no clubs and never reads the private clubs table', async () => {
  const calls = [];
  const client = { from(view) {
    calls.push(view);
    const query = {};
    for (const operation of ['select', 'eq', 'order', 'range']) query[operation] = () => query;
    query.then = (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return query;
  } };
  const service = new PublicContentService({ client });
  assert.deepEqual(await service.list('clubs', 1, 12, { category: 'empty' }),
    { items: [], page: 1, limit: 12, total: 0, hasMore: false });
  assert.deepEqual(calls, ['club_category_links']);
});

test('large interest sets keep exact counts and page order across query batches', async () => {
  const ids = Array.from({ length: 201 }, (_, index) => `club-${String(index).padStart(3, '0')}`);
  const queried = [];
  const client = { from(view) {
    const query = { selectedIds: [] };
    for (const operation of ['select', 'eq', 'order', 'range', 'ilike']) query[operation] = () => query;
    query.in = (_column, values) => { query.selectedIds = values; queried.push(values); return query; };
    query.then = (resolve, reject) => Promise.resolve(view === 'club_category_links'
      ? { data: ids.map(club_id => ({ club_id })), error: null }
      : { data: query.selectedIds.map(club_id => ({ club_id, name: club_id, published_at: '2026-11-20T00:00:00Z', review_note: 'private' })), error: null }
    ).then(resolve, reject);
    return query;
  } };
  const service = new PublicContentService({ client });
  const response = await service.list('clubs', 2, 12, { category: 'art' });
  assert.equal(queried.length, 2);
  assert.equal(response.total, 201);
  assert.equal(response.items.length, 12);
  assert.equal(response.items[0].club_id, 'club-012');
  assert.equal(response.items[0].review_note, undefined);
  assert.equal(response.hasMore, true);
});

const newClub = { name: 'Câu lạc bộ mới', summary: 'Một cộng đồng sinh viên mới', description: 'Nơi thành viên cùng học và tổ chức hoạt động.', category_ids: [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
] };

test('club creation validates multiple type IDs and saves both links', async () => {
  assert.equal(validateSync(Object.assign(new CreateClubDto(), newClub)).length, 0);
  assert.ok(validateSync(Object.assign(new CreateClubDto(), { ...newClub, category_ids: [newClub.category_ids[0], newClub.category_ids[0]] })).length);
  const calls = [];
  const client = { from(table) {
    calls.push(['from', table]);
    const query = {
      select() { return query; },
      in(_field, ids) { calls.push(['in', ids]); return Promise.resolve({ data: ids.map(category_id => ({ category_id })), error: null }); },
      insert(rows) { calls.push(['insert', table, rows]); return table === 'club_category_links' ? Promise.resolve({ error: null }) : query; },
      single() { return Promise.resolve({ data: { club_id: 'new-id', name: newClub.name, status: 'pending' }, error: null }); },
    };
    return query;
  } };
  const result = await new PublicContentService({ client }).createClub('user-id', newClub);
  assert.equal(result.club.club_id, 'new-id');
  assert.deepEqual(calls.find(call => call[0] === 'insert' && call[1] === 'club_category_links')[2],
    newClub.category_ids.map(category_id => ({ club_id: 'new-id', category_id })));
});

test('invalid club type is rejected before creating a club', async () => {
  const calls = [];
  const client = { from(table) {
    calls.push(table);
    return { select() { return this; }, in() { return Promise.resolve({ data: [], error: null }); } };
  } };
  await assert.rejects(new PublicContentService({ client }).createClub('user-id', newClub), error => error.getStatus() === 400);
  assert.deepEqual(calls, ['club_categories']);
});

test('failed club type link removes only the newly inserted pending request', async () => {
  const calls = [];
  const client = { from(table) {
    const query = {
      select() { return query; },
      in(_field, ids) { return Promise.resolve({ data: ids.map(category_id => ({ category_id })), error: null }); },
      insert() { return table === 'club_category_links' ? Promise.resolve({ error: { code: 'failure' } }) : query; },
      single() { return Promise.resolve({ data: { club_id: 'new-id' }, error: null }); },
      delete() { calls.push(['delete', table]); return query; },
      eq(field, value) { calls.push(['eq', field, value]); return query; },
      then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
    };
    return query;
  } };
  await assert.rejects(new PublicContentService({ client }).createClub('user-id', newClub), error => error.getStatus() === 503);
  assert.deepEqual(calls, [
    ['delete', 'clubs'], ['eq', 'club_id', 'new-id'], ['eq', 'created_by', 'user-id'], ['eq', 'status', 'pending'],
  ]);
});

test('owner and admin request details include all selected club types', async () => {
  const client = { from(table) {
    const query = {
      select() { return query; }, eq() { return query; },
      in() { return query; }, order() { return query; },
      maybeSingle() { return Promise.resolve({ data: {
        club_id: 'club-id', created_by: 'user-id', reviewed_by: null, status: 'pending', name: 'CLB Mới',
      }, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: table === 'club_category_links'
        ? [{ category_id: 'one' }, { category_id: 'two' }]
        : table === 'club_categories'
          ? [{ category_id: 'one', name: 'Học thuật & công nghệ' }, { category_id: 'two', name: 'Kỹ năng' }]
          : [{ user_id: 'user-id', display_name: 'An', email: 'an@example.com' }], error: null }).then(resolve, reject); },
    };
    return query;
  } };
  const personal = await new PersonalService({ client }).request('user-id', 'club-id');
  const admin = await new AdminService({ client }).detail({ role: 'admin' }, 'club-id');
  const expected = ['Học thuật & công nghệ', 'Kỹ năng'];
  assert.deepEqual(personal.item.category_names, expected);
  assert.deepEqual(admin.item.category_names, expected);
});
