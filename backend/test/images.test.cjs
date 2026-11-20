const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ImagesService, imageLimit } = require('../dist/media/images.controller');

function fixture({ missing = false, failing = false } = {}) {
  const uploads = [], creates = [];
  const bucket = {
    async upload(path, buffer, options) { uploads.push({ path, options }); return { error: missing && uploads.length === 1 ? { message: 'Bucket not found' } : failing ? { message: 'Storage unavailable' } : null }; },
    getPublicUrl(path) { return { data: { publicUrl: 'https://storage.example/app-images/' + path } }; },
  };
  return { uploads, creates, service: new ImagesService({ client: { storage: {
    from(name) { assert.equal(name, 'app-images'); return bucket; },
    async createBucket(name, options) { creates.push({ name, options }); return { error: null }; },
  } } }) };
}
const png = () => { const buffer = Buffer.alloc(32); Buffer.from([137,80,78,71,13,10,26,10]).copy(buffer); return { buffer, size: buffer.length, mimetype: 'image/png' }; };

test('image upload binds the path to the actor and returns the generated URL', async () => {
  const f = fixture();
  const result = await f.service.upload('actor', png());
  assert.match(f.uploads[0].path, /^actor\/[0-9a-f-]+\.png$/);
  assert.equal(f.uploads[0].options.upsert, false);
  assert.equal(f.uploads[0].options.contentType, 'image/png');
  assert.equal(result.url, 'https://storage.example/app-images/' + f.uploads[0].path);
  assert.equal(f.creates.length, 0);
});
test('first explicit upload provisions only the new image bucket when missing', async () => {
  const f = fixture({ missing: true }); await f.service.upload('actor', png());
  assert.equal(f.uploads.length, 2);
  assert.equal(f.uploads[0].path, f.uploads[1].path);
  assert.equal(f.creates[0].name, 'app-images');
  assert.equal(f.creates[0].options.fileSizeLimit, imageLimit);
});
test('image upload rejects oversized, missing and spoofed images before storage', async () => {
  const f = fixture();
  for (const file of [undefined, { ...png(), mimetype: 'image/jpeg' }, { buffer: Buffer.alloc(32), size: 32, mimetype: 'image/png' }, { buffer: Buffer.alloc(imageLimit + 1), size: imageLimit + 1, mimetype: 'image/png' }]) {
    await assert.rejects(f.service.upload('actor', file), e => e.getStatus() === 400);
  }
  assert.equal(f.uploads.length, 0);
});
test('failed storage never returns an image URL', async () => {
  await assert.rejects(fixture({ failing: true }).service.upload('actor', png()), e => e.getStatus() === 503);
});
