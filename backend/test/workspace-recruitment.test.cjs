const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { createClient } = require('@supabase/supabase-js');
const { ValidationPipe } = require('@nestjs/common');
const { WorkspaceAccess } = require('../dist/workspace/workspace-access.service');
const { WorkspaceRecruitment } = require('../dist/workspace/workspace-recruitment.service');
const { PublishRecruitmentDto } = require('../dist/workspace/recruitment.dto');

const campaignId = '11111111-1111-4111-8111-111111111111';
const recruitmentId = '22222222-2222-4222-8222-222222222222';
const departmentId = '33333333-3333-4333-8333-333333333333';
const questionId = '44444444-4444-4444-8444-444444444444';
const input = () => ({ campaign_id: campaignId, title: 'Tuyển thành viên mới', description: 'Cùng xây dựng cộng đồng CLB.',
  application_opens_at: '2026-12-01T00:00:00+07:00', application_closes_at: '2026-12-20T23:59:59.999+07:00',
  departments: [{ recruitment_department_id: recruitmentId, department_id: departmentId, description: 'Xây dựng website', requirements: 'Có tinh thần học hỏi', target_quantity: 12,
    questions: [{ question_id: questionId, question_text: 'Bạn muốn học điều gì?', help_text: '', is_required: true, max_length: 240 }] }] });

function fixture({ role = 'chairperson', activeDepartment = true, management = false, failQuestions = false } = {}) {
  const tables = { recruitment_campaigns: [], recruitment_departments: [], recruitment_questions: [] };
  const requests = [];
  let version = 0;
  let rejectQuestions = failQuestions;
  const client = createClient('https://project.example', 'test-key', { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (raw, options) => {
      const url = new URL(raw); const table = url.pathname.split('/').at(-1); const filters = url.searchParams;
      const body = options.body ? JSON.parse(options.body) : undefined;
      requests.push({ table, method: options.method, filters, body });
      if (table === 'club_memberships') return Response.json(role ? [{ user_id: 'chair', role }] : []);
      if (table === 'clubs') return Response.json([{ club_id: 'club', status: 'published' }]);
      if (table === 'club_departments') return Response.json(activeDepartment ? [{ department_id: departmentId, is_management: management }] : []);
      if (table === 'recruitment_questions' && body && rejectQuestions) return Response.json({ code: 'XX000' }, { status: 500 });
      const primary = { recruitment_campaigns: 'campaign_id', recruitment_departments: 'recruitment_department_id', recruitment_questions: 'question_id' }[table];
      const matches = row => [...filters].filter(([key]) => !['select','order','offset','limit','on_conflict'].includes(key)).every(([key,value]) => {
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.')) return value.slice(4,-1).split(',').includes(row[key]);
        return true;
      });
      if (options.method === 'POST') {
        for (const row of Array.isArray(body) ? body : [body]) if (!tables[table].some(existing => existing[primary] === row[primary])) {
          tables[table].push({ ...row, ...(table === 'recruitment_campaigns' && { updated_at: `2026-11-19T08:00:0${version++}Z` }) });
        }
        return new Response(null, { status: 201 });
      }
      let rows = tables[table].filter(matches);
      if (options.method === 'PATCH') {
        rows.forEach(row => Object.assign(row, body, { updated_at: `2026-11-19T08:00:0${version++}Z` }));
      }
      rows = rows.map(row => table === 'recruitment_departments' && filters.get('select').includes('recruitment_questions') ? {
        ...row, club_departments: { name: 'Ban Kỹ thuật' }, recruitment_questions: tables.recruitment_questions.filter(q => q.recruitment_department_id === row.recruitment_department_id),
      } : row);
      return Response.json(rows, { headers: { 'content-range': `0-${rows.length - 1}/${rows.length}` } });
    } } });
  return { service: new WorkspaceRecruitment(new WorkspaceAccess({ client })), requests, tables, resume: () => { rejectQuestions = false; } };
}

test('recruitment DTO validates nested fields, scope ownership and quota', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const transform = body => pipe.transform(body, { type: 'body', metatype: PublishRecruitmentDto });
  assert.equal((await transform(input())).departments[0].questions[0].max_length, 240);
  for (const change of [body => body.created_by = 'attacker', body => body.departments[0].target_quantity = 0,
    body => body.departments[0].questions[0].max_length = 10001, body => body.departments[0].questions[0].is_required = 'true']) {
    const body = input(); change(body);
    await assert.rejects(transform(body), e => e.getStatus() === 400);
  }
});

test('publication persists campaign, department and question before opening; identical retry creates no duplicate', async () => {
  const { service, tables, requests } = fixture();
  const result = await service.publish('chair', 'club', input());
  assert.equal(result.item.status, 'open');
  assert.equal(result.item.departments[0].recruitment_questions[0].max_length, 240);
  assert.equal(tables.recruitment_campaigns[0].application_opens_at, '2026-11-30T17:00:00.000Z');
  for (const table of Object.keys(tables)) assert.equal(tables[table][0].created_by, 'chair');
  const writes = requests.filter(r => r.body);
  assert.deepEqual(writes.map(r => r.table), ['recruitment_campaigns', 'recruitment_departments', 'recruitment_questions', 'recruitment_campaigns']);
  assert.equal(writes.at(-1).body.status, 'open');
  const before = writes.length;
  await service.publish('chair', 'club', input());
  assert.equal(requests.filter(r => r.body).length, before);
  for (const rows of Object.values(tables)) assert.equal(rows.length, 1);
});

test('members, outsiders, foreign departments and blank questions cannot publish or write', async () => {
  for (const role of ['member', 'head', null]) {
    const { service, requests } = fixture({ role });
    await assert.rejects(service.publish('chair', 'club', input()), e => e.getStatus() === 403);
    assert.equal(requests.some(r => r.body), false);
  }
  const missing = fixture({ activeDepartment: false });
  await assert.rejects(missing.service.publish('chair', 'club', input()), e => e.getStatus() === 400);
  assert.equal(missing.requests.some(r => r.body), false);
  const blank = fixture(); const body = input(); body.departments[0].questions[0].question_text = '   ';
  await assert.rejects(blank.service.publish('chair', 'club', body), e => e.getStatus() === 400);
  assert.equal(blank.requests.some(r => r.body), false);
});

test('question save failure leaves private draft; published list does not expose partial forms', async () => {
  const { service, tables, requests, resume } = fixture({ failQuestions: true });
  await assert.rejects(service.publish('chair', 'club', input()), e => e.getStatus() === 503);
  assert.equal(tables.recruitment_campaigns[0].status, 'draft');
  assert.equal(requests.some(r => r.method === 'PATCH'), false);
  assert.equal((await service.list('chair', 'club', 'published', 1, 12)).items.length, 0);
  assert.equal((await service.list('chair', 'club', 'mine', 1, 12)).items.length, 1);
  resume();
  assert.equal((await service.publish('chair', 'club', input())).item.status, 'open');
  for (const rows of Object.values(tables)) assert.equal(rows.length, 1);
});

test('retry with changed content cannot overwrite a published form, and reads are scoped to the club', async () => {
  const { service, tables, requests } = fixture();
  await service.publish('chair', 'club', input());
  const changed = input(); changed.departments[0].questions[0].question_text = 'Khác nội dung';
  await assert.rejects(service.publish('chair', 'club', changed), e => e.getStatus() === 409);
  assert.equal(tables.recruitment_questions[0].question_text, input().departments[0].questions[0].question_text);
  await assert.rejects(service.detail('chair', 'other-club', campaignId), e => e.getStatus() === 404);
  const list = await service.list('chair', 'club', 'published', 1, 12);
  assert.equal(list.items.length, 1);
  assert.equal(requests.at(-1).filters.get('club_id'), 'eq.club');
  assert.equal(requests.at(-1).filters.get('limit'), '12');
});

test('a colliding department ID never receives questions belonging to another campaign', async () => {
  const { service, tables, requests } = fixture();
  tables.recruitment_departments.push({ recruitment_department_id: recruitmentId, campaign_id: 'other-campaign', department_id: departmentId });
  await assert.rejects(service.publish('chair', 'club', input()), e => e.getStatus() === 409);
  assert.equal(requests.some(r => r.table === 'recruitment_questions' && r.body), false);
  assert.equal(tables.recruitment_campaigns[0].status, 'draft');
});

test('management departments are rejected before any campaign or department write', async () => {
  const { service, requests } = fixture({ management: true });
  await assert.rejects(service.publish('chair', 'club', input()), e => e.getStatus() === 400 && e.message.includes('Ban quản lý'));
  assert.equal(requests.some(r => r.body), false);
});

test('cover upload checks ownership and image signature and only stores a public URL', async () => {
  const actions = [];
  let bucketExists = false;
  const storage = {
    getBucket: async () => bucketExists ? { data: { public: true }, error: null } : { error: { statusCode: '404' } },
    createBucket: async (name, options) => { actions.push({ name, options }); bucketExists = true; return { error: null }; },
    from: name => ({ upload: async (path, bytes, options) => { actions.push({ name, path, bytes, options }); return { error: null }; },
      getPublicUrl: path => ({ data: { publicUrl: `https://storage.example/${name}/${path}` } }) }),
  };
  const scope = [];
  const service = new WorkspaceRecruitment({ require: async (...args) => scope.push(args), supabase: { client: { storage } } });
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const result = await service.cover('chair', 'club', { buffer, size: buffer.length, mimetype: 'image/png' });
  assert.deepEqual(scope[0], ['chair', 'club', true]);
  assert.equal(actions[0].name, 'recruitment-covers');
  assert.equal(actions[0].options.public, true);
  assert.match(result.cover_url, /^https:\/\/storage.example\/recruitment-covers\/club\/chair\/[a-f0-9]{64}\.png$/);
  assert.equal(actions[1].options.upsert, false);
  for (const file of [undefined, { buffer: Buffer.from('<svg>'), size: 5, mimetype: 'image/png' }, { buffer, size: 11 * 1024 * 1024, mimetype: 'image/png' }])
    await assert.rejects(service.cover('chair', 'club', file), e => e.getStatus() === 400);
  assert.equal(actions.length, 2);
});
