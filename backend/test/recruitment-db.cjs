// Always creates its own cluster. Never reads project .env or connects to a user database.
const assert = require('node:assert/strict');
const { execFileSync, execFile, spawnSync } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');

async function main() {
  const bin = process.env.RECRUITMENT_TEST_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
  const exe = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  if (!fs.existsSync(exe('initdb'))) throw new Error('Set RECRUITMENT_TEST_PG_BIN to an installed PostgreSQL bin directory.');
  const tempRoot = process.env.RECRUITMENT_TEST_TEMP_ROOT || os.tmpdir();
  const root = fs.mkdtempSync(path.join(tempRoot, 'rts-recruitment-test-'));
  const data = path.join(root, 'data');
  let started = false;
  const env = { ...process.env, PGHOST: '127.0.0.1', PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: '', PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8' };
  const run = (name, args, options = {}) => execFileSync(exe(name), args, { encoding: 'utf8', windowsHide: true, timeout: 30000, env, maxBuffer: 8 * 1024 * 1024, ...options });
  const sql = text => run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: text }).trim();
  const file = filename => run('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', filename]);
  const singleMode = process.argv.includes('--single');
  const singleFile = filename => {
    const source = fs.readFileSync(filename, 'utf8').replace(/\r/g, '').split('\n').filter(line => line.trim() !== '').join('\n');
    // exit_on_error turns even intentionally caught SQL exceptions into FATAL.
    // Capture stderr instead and fail on every uncaught ERROR/FATAL/PANIC.
    const result = spawnSync(exe('postgres'), ['--single', '-D', data, '-j', '-c', 'log_min_messages=error', '-c', 'log_min_error_statement=panic', 'postgres'],
      { input: source + '\n;\n\n', encoding: 'utf8', windowsHide: true, timeout: 30000, env, maxBuffer: 8 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0 || /(?:ERROR|FATAL|PANIC):/.test(result.stderr)) throw new Error(result.stderr || 'Single-user SQL check failed.');
    return result.stdout;
  };
  try {
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer(); server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); });
    });
    env.PGPORT = String(port);
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-instructions']);
    if (singleMode) {
      for (const filename of [path.join(__dirname, 'fixtures/recruitment-schema.sql'), path.join(__dirname, 'fixtures/recruitment-seed.sql'),
        path.join(__dirname, '../../supabase/migrations/202611190001_recruitment_forms_api.sql'), path.join(__dirname, 'fixtures/recruitment-assertions.sql'),
        path.join(__dirname, '../../supabase/migrations/202611190002_recruitment_notifications.sql'), path.join(__dirname, 'fixtures/recruitment-notifications-assertions.sql')]) {
        singleFile(filename);
        console.log('PASS:', path.basename(filename));
      }
      console.log('SKIP: concurrency tests require TCP connections; single-user mode verifies SQL behavior without networking.');
      return;
    }
    run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', '-t', '20', 'start']);
    started = true;
    file(path.join(__dirname, 'fixtures/recruitment-schema.sql'));
    file(path.join(__dirname, 'fixtures/recruitment-seed.sql'));
    file(path.join(__dirname, '../../supabase/migrations/202611190001_recruitment_forms_api.sql'));
    file(path.join(__dirname, 'fixtures/recruitment-assertions.sql'));
    file(path.join(__dirname, '../../supabase/migrations/202611190002_recruitment_notifications.sql'));
    file(path.join(__dirname, 'fixtures/recruitment-notifications-assertions.sql'));
    console.log('PASS: migration, legacy backfill, authorization, forms, deadlines, files, admission, durable events and privileges');

    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const campaign = sql("SELECT value FROM test_ids WHERE key='campaign'");
    const department = sql("SELECT recruitment_department_id FROM recruitment_departments WHERE campaign_id='" + campaign + "'");
    const version = sql("SELECT current_form_version_id FROM recruitment_departments WHERE recruitment_department_id='" + department + "'");
    const answer = sql("SELECT jsonb_build_array(jsonb_build_object('question_id',question_id,'value','Concurrent answer')) FROM recruitment_questions WHERE form_version_id='" + version + "' AND question_type='paragraph'");
    const concurrent = async statements => Promise.allSettled(statements.map(statement => promisify(execFile)(exe('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], { encoding: 'utf8', windowsHide: true, timeout: 15000, env })));
    const submit = `SELECT (public.recruitment_submit_application('${id(8)}','${campaign}','${department}','${version}','${answer}'::jsonb)).application_id;`;
    const submissions = await concurrent([submit, submit]);
    assert.equal(submissions.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(submissions.find(r => r.status === 'rejected').reason.stderr.includes('APPLICATION_EXISTS'));
    console.log('PASS: simultaneous duplicate submissions commit exactly once');
    const application = sql(`SELECT application_id FROM recruitment_applications WHERE campaign_id='${campaign}' AND applicant_id='${id(8)}'`);
    const timestamp = sql(`SELECT updated_at FROM recruitment_applications WHERE application_id='${application}'`);
    const decisions = await concurrent(['approve', 'reject'].map(decision => `SELECT (public.recruitment_decide_application('${id(1)}','${id(101)}','${campaign}','${application}','${timestamp}','${decision}',NULL,NULL)).status;`));
    assert.equal(decisions.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(decisions.find(r => r.status === 'rejected').reason.stderr.includes('INVALID_STATE'));
    const decisionJobs = sql(`SELECT count(*) FROM notification_jobs WHERE entity_id='${application}' AND event_type IN('application.accepted','application.rejected')`);
    assert.equal(decisionJobs, '1');
    console.log('PASS: concurrent decisions produce one result and one notification job');
  } finally {
    if (started || fs.existsSync(path.join(data, 'postmaster.pid'))) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    const resolved = path.resolve(root), temp = path.resolve(tempRoot) + path.sep;
    if (!resolved.startsWith(temp) || !path.basename(resolved).startsWith('rts-recruitment-test-')) throw new Error('Refusing cleanup outside the generated test directory.');
    try { fs.rmSync(resolved, { recursive: true, force: true }); }
    catch { console.error('Could not clean the disposable test directory:', resolved); }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
