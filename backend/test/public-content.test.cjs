const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { PublicContentService } = require('../dist/public-content/public-content.service');

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
