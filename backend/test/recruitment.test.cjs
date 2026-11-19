const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { createClient } = require('@supabase/supabase-js');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { answerErrors, validateForm, detectedMime } = require('../dist/recruitment/recruitment-validation');
const { RecruitmentRepository } = require('../dist/recruitment/recruitment.repository');
const { RecruitmentService } = require('../dist/recruitment/recruitment.service');
const { RecruitmentFiles } = require('../dist/recruitment/recruitment-files.service');
const { SaveFormDto, SubmitApplicationDto } = require('../dist/recruitment/recruitment.dto');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const question = (type, validation = {}, options = []) => ({ question_id: id(1), question_type: type, validation, options, is_required: true });

test('form answers validate required, typed, bounded values rather than truthiness', () => {
  for (const value of ['', '   ', null, undefined, []]) assert.ok(answerErrors([question('paragraph')], [{ question_id: id(1), value }])[id(1)]);
  assert.deepEqual(answerErrors([question('number', { min: 0 })], [{ question_id: id(1), value: 0 }]), {});
  for (const value of ['12', NaN, Infinity, -1]) assert.ok(answerErrors([question('number', { min: 0 })], [{ question_id: id(1), value }])[id(1)]);
  for (const value of [0, 6, 2.5]) assert.ok(answerErrors([question('rating')], [{ question_id: id(1), value }])[id(1)]);
  assert.deepEqual(answerErrors([question('rating')], [{ question_id: id(1), value: 5 }]), {});
});
test('dates, email and phone errors point to the individual question', () => {
  for (const [type, bad, good] of [['date', '2026-02-30', '2026-02-28'], ['email', 'bad@', 'student@example.edu'], ['phone', 'not-a-phone', '0912345678']]) {
    assert.ok(answerErrors([question(type)], [{ question_id: id(1), value: bad }])[id(1)]);
    assert.deepEqual(answerErrors([question(type)], [{ question_id: id(1), value: good }]), {});
  }
});
test('choice/file fields reject forged options, duplicate IDs and excess files', () => {
  const options = [{ option_id: id(2), label: 'A' }, { option_id: id(3), label: 'B' }];
  assert.ok(answerErrors([question('single_choice', {}, options)], [{ question_id: id(1), value: 'A' }])[id(1)]);
  assert.ok(answerErrors([question('checkboxes', {}, options)], [{ question_id: id(1), value: [id(2), id(2)] }])[id(1)]);
  assert.deepEqual(answerErrors([question('checkboxes', {}, options)], [{ question_id: id(1), value: [id(2), id(3)] }]), {});
  for (const value of ['https://example.com/cv.pdf', [id(2), id(3)], ['../file']]) assert.ok(answerErrors([question('file')], [{ question_id: id(1), value }])[id(1)]);
});
test('unknown questions and repeated answers are rejected even when valid questions are present', () => {
  const answers = [{ question_id: id(1), value: 'ok' }, { question_id: id(1), value: 'duplicate' }, { question_id: id(2), value: 'injected' }];
  const errors = answerErrors([question('short_text')], answers);
  assert.ok(errors[id(1)]); assert.ok(errors[id(2)]);
});
test('builder validates option identity, nonblank titles and range consistency', () => {
  assert.throws(() => validateForm([{ question_text: '  ', question_type: 'short_text' }]), /không được để trống/);
  assert.throws(() => validateForm([{ question_text: 'Pick', question_type: 'dropdown', options: [{ option_id: id(1), label: 'A' }] }]), /hai phương án/);
  assert.throws(() => validateForm([{ question_text: 'Number', question_type: 'number', validation: { min: 10, max: 1 } }]), /tối thiểu/);
});
test('DTO nesting forbids unknown validation rules and caller-controlled application identity', async () => {
  const form = plainToInstance(SaveFormDto, { expected_updated_at: new Date().toISOString(), questions: [{ question_text: 'Name', question_type: 'short_text', is_required: true, validation: { secret: true } }] });
  assert.ok((await validate(form, { whitelist: true, forbidNonWhitelisted: true })).length);
  const application = plainToInstance(SubmitApplicationDto, { recruitment_department_id: id(1), form_version_id: id(2), answers: [], applicant_id: id(3) });
  assert.ok((await validate(application, { whitelist: true, forbidNonWhitelisted: true })).some(e => e.property === 'applicant_id'));
});
test('file detection checks bytes instead of trusting file extensions', () => {
  assert.equal(detectedMime(Buffer.from('%PDF-1.7\n')), 'application/pdf');
  assert.equal(detectedMime(Buffer.from('<html>renamed-to-pdf</html>')), null);
  assert.equal(detectedMime(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
  assert.equal(detectedMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
});
test('database exceptions become safe Vietnamese responses without internal SQL details', () => {
  const repo = new RecruitmentRepository({});
  for (const [code, message, status] of [['42501', 'secret query', 403], ['P0001', 'APPLICATION_EXISTS', 409], ['40001', 'FORM_CHANGED', 409], ['22023', 'INVALID_FILE', 400], ['XX000', 'password=secret', 503]]) {
    assert.throws(() => repo.check({ code, message }), e => e.getStatus() === status && !JSON.stringify(e.getResponse()).includes('secret'));
  }
});

test('RPC responses normalize composite rows without unwrapping list JSON objects', async () => {
  let payload;
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async () => Response.json(payload) } });
  const repo = new RecruitmentRepository({ client });
  payload = [{ form_version_id: id(1) }];
  assert.deepEqual(await repo.rpc('recruitment_save_form', {}), { form_version_id: id(1) });
  payload = { items: [], stats: { total: 0 } };
  assert.deepEqual(await repo.rpc('recruitment_list_applications', {}), payload);
  payload = [];
  await assert.rejects(repo.rpc('recruitment_save_form', {}), e => e.getStatus() === 503);
});
test('chair checks are scoped to actor, club, active role and published club', async () => {
  let url;
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async input => { url = new URL(input); return Response.json([]); } } });
  const repo = new RecruitmentRepository({ client });
  await assert.rejects(repo.chair(id(1), id(2)), e => e.getStatus() === 403);
  for (const [key, value] of [['user_id', `eq.${id(1)}`], ['club_id', `eq.${id(2)}`], ['role', 'eq.chairperson'], ['status', 'eq.active'], ['clubs.status', 'eq.published']]) assert.equal(url.searchParams.get(key), value);
});
test('student detail scopes the first query to the current applicant', async () => {
  let url;
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async input => { url = new URL(input); return Response.json([]); } } });
  const service = new RecruitmentService(new RecruitmentRepository({ client }), {});
  await assert.rejects(service.applicationDetail(id(1), id(2)), e => e.getStatus() === 404);
  assert.equal(url.searchParams.get('applicant_id'), `eq.${id(1)}`);
  assert.equal(url.searchParams.get('application_id'), `eq.${id(2)}`);
});
test('CSV export escapes formula injection, commas, quotes and line breaks', async () => {
  const service = new RecruitmentService({}, {});
  service.applications = async () => ({ items: [{ application_id: id(1), profile_snapshot: { full_name: '=1+1', student_code: 'A,"B\nC' }, display_status: 'pending' }], hasMore: false });
  const result = await service.exportCsv(id(1), id(2), id(3), {});
  assert.ok(result.startsWith('\uFEFF'));
  assert.ok(result.includes('"\'=1+1"'));
  assert.ok(result.includes('"A,""B\nC"'));
});

test('attachment downloads reject another student before asking Storage for a URL', async () => {
  const paths = [];
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async input => {
    const url = new URL(input); paths.push(url.pathname);
    if (url.pathname.endsWith('/recruitment_files')) return Response.json([{ file_id: id(1), campaign_id: id(2), uploaded_by: id(3), state: 'attached', application_id: id(4), purpose: 'answer' }]);
    if (url.pathname.endsWith('/recruitment_campaigns')) return Response.json([{ campaign_id: id(2), club_id: id(5) }]);
    return Response.json([]);
  } } });
  await assert.rejects(new RecruitmentFiles(new RecruitmentRepository({ client })).download(id(6), id(1)), e => e.getStatus() === 403);
  assert.equal(paths.some(p => p.includes('/storage/')), false);
});

test('uploads reject a forged content type before touching database or Storage', async () => {
  const service = new RecruitmentFiles({});
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(service.upload(id(1), id(2), { purpose: 'answer', question_id: id(3) }, { buffer, size: buffer.length, mimetype: 'application/pdf', originalname: 'cv.pdf' }), e => e.getStatus() === 400);
});

test('file cleanup does not delete an object if submission won the row claim', async () => {
  const methods = [];
  const client = createClient('https://test.invalid', 'synthetic', { global: { fetch: async (input, options) => {
    methods.push(options.method);
    if (options.method === 'GET') return Response.json([{ file_id: id(1), bucket: 'recruitment-attachments', object_path: 'example', state: 'staged' }]);
    return Response.json([]);
  } } });
  await new RecruitmentFiles(new RecruitmentRepository({ client })).cleanup();
  assert.deepEqual(methods, ['GET', 'PATCH']);
});
