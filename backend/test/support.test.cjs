const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { SupportService } = require('../dist/support/support.service');
const { CreateSupportReport, SupportReportQuery, UpdateSupportReport } = require('../dist/support/support.dto');
const user = { userId: 'student', role: 'student' }, admin = { userId: 'admin', role: 'admin' };
const input = () => Object.assign(new CreateSupportReport(), { report_id: 'b0f46f64-eafb-40d7-8eba-a441d8e44cc4', category: 'meetings',
  title: 'Không bật được microphone', description: 'Microphone không hoạt động sau khi vào phòng họp.', page_path: '/workspace' });
function fixture(resolve) {
  const calls = [];
  const client = { from(table) {
    const call = { table, mode: 'select', operations: [] }; calls.push(call);
    const chain = {};
    for (const op of ['select', 'eq', 'ilike', 'order', 'range']) chain[op] = (...args) => { call.operations.push([op, ...args]); return chain; };
    for (const op of ['insert', 'update']) chain[op] = values => { call.mode = op; call.values = values; return chain; };
    const result = () => resolve ? resolve(call, calls) : { data: { ...input(), status: 'new', updated_at: '2026-11-25T00:00:00.123456Z' }, error: null, count: 0 };
    chain.single = chain.maybeSingle = async () => result();
    chain.then = (yes, no) => Promise.resolve(result()).then(yes, no);
    return chain;
  } };
  return { service: new SupportService({ client }), calls };
}

test('reports bind the sender to the authenticated account and never accept admin fields', async () => {
  const { service, calls } = fixture();
  await service.create(user, input());
  assert.equal(calls[0].values.reporter_id, user.userId);
  for (const key of ['status', 'admin_response', 'processed_by', 'resolved_at']) assert.equal(key in calls[0].values, false);
  const forged = plainToInstance(CreateSupportReport, { ...input(), reporter_id: 'other-user', status: 'resolved' });
  const errors = await validate(forged, { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.some(error => error.property === 'reporter_id'));
  assert.ok(errors.some(error => error.property === 'status'));
});

test('list and detail always scope student access to their own reports', async () => {
  const { service, calls } = fixture();
  await service.list(user, Object.assign(new SupportReportQuery(), { page: 2, limit: 10, status: 'in_progress', category: 'meetings' }));
  await service.detail(user, 'another-report');
  for (const call of calls) assert.ok(call.operations.some(op => op[0] === 'eq' && op[1] === 'reporter_id' && op[2] === 'student'));
  assert.deepEqual(calls[0].operations.find(op => op[0] === 'range'), ['range', 10, 19]);
  assert.ok(calls[0].operations.some(op => op[0] === 'eq' && op[1] === 'status' && op[2] === 'in_progress'));
  assert.equal(calls[1].operations.find(op => op[0] === 'select')[1].includes('email'), false);
  const absent = fixture(() => ({ data: null, error: null }));
  await assert.rejects(absent.service.detail(user, 'foreign-id'), error => error.getStatus() === 404);
});

test('non-admins cannot read or process the admin queue before any database query', async () => {
  const { service, calls } = fixture();
  for (const role of ['student', 'chairperson', 'head', null]) {
    const actor = { ...user, role };
    await assert.rejects(service.list(actor, new SupportReportQuery(), true), error => error.getStatus() === 403);
    await assert.rejects(service.detail(actor, 'id', true), error => error.getStatus() === 403);
    await assert.rejects(service.update(actor, 'id', {}), error => error.getStatus() === 403);
  }
  assert.equal(calls.length, 0);
});

test('retries return the existing own report without overwriting it or exposing another sender', async () => {
  const draft = input();
  const f = fixture(call => call.mode === 'insert' ? { data: null, error: { code: '23505' } } : { data: { ...draft, status: 'in_progress' }, error: null });
  assert.equal((await f.service.create(user, draft)).item.status, 'in_progress');
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[1].operations.some(op => op[1] === 'reporter_id' && op[2] === user.userId));
  assert.equal(f.calls.some(call => call.mode === 'update'), false);
  const collision = fixture(call => ({ data: null, error: call.mode === 'insert' ? { code: '23505' } : null }));
  await assert.rejects(collision.service.create(user, draft), error => error.getStatus() === 409);
});

test('closing requires a response, updates atomically against the exact version and supports reopening', async () => {
  const { service, calls } = fixture();
  const decision = { status: 'resolved', priority: 'high', admin_response: '', expected_updated_at: '2026-11-25T00:00:00.123456Z' };
  await assert.rejects(service.update(admin, 'id', decision), error => error.getStatus() === 400);
  assert.equal(calls.length, 0);
  decision.admin_response = 'Đã kiểm tra và khắc phục sự cố.';
  await service.update(admin, 'id', decision);
  assert.equal(calls[0].values.processed_by, admin.userId);
  assert.ok(calls[0].values.resolved_at);
  assert.deepEqual(calls[0].operations.find(op => op[1] === 'updated_at'), ['eq', 'updated_at', decision.expected_updated_at]);
  await service.update(admin, 'id', { ...decision, status: 'in_progress' });
  assert.equal(calls[1].values.resolved_at, null);
  const stale = fixture(() => ({ data: null, error: null }));
  await assert.rejects(stale.service.update(admin, 'id', decision), error => error.getStatus() === 409);
});

test('DTO validation bounds requests and excludes query fragments or external links', async () => {
  assert.deepEqual(await validate(plainToInstance(CreateSupportReport, input())), []);
  for (const page_path of ['https://outside.example/', '//outside.example', '/?token=private', '/help#private', '/back\\slash']) {
    assert.ok((await validate(plainToInstance(CreateSupportReport, { ...input(), page_path }))).some(error => error.property === 'page_path'));
  }
  const invalid = plainToInstance(CreateSupportReport, { ...input(), title: '   ', description: 'x', category: 'invalid' });
  assert.ok((await validate(invalid)).length >= 3);
  assert.ok((await validate(plainToInstance(SupportReportQuery, { limit: 1000, page: 0, status: 'invalid' }))).length >= 3);
  assert.ok((await validate(plainToInstance(UpdateSupportReport, { status: 'resolved', priority: 'normal', admin_response: '', expected_updated_at: 'bad' }))).length);
});

test('database failures never leak SQL details or claim successful delivery', async () => {
  const { service } = fixture(() => ({ data: null, error: { code: '42P01', message: 'SQL secret' } }));
  await assert.rejects(service.create(user, input()), error => error.getStatus() === 503 && !error.message.includes('SQL secret'));
});
