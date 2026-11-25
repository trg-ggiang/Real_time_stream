// Disposable PostgreSQL single-user regression. Does not read .env or connect to Supabase.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const bin = process.env.SUPPORT_TEST_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-support-test-')), data = path.join(root, 'data');
const exe = name => path.join(bin, name + '.exe');
try {
  execFileSync(exe('initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C', '--no-instructions'], { windowsHide: true, stdio: 'pipe', timeout: 30000 });
  for (const file of ['fixtures/support-schema.sql', '../../supabase/migrations/202611250001_support_reports.sql', 'fixtures/support-assertions.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r/g, '');
    const result = spawnSync(exe('postgres'), ['--single', '-D', data, '-j', '-c', 'log_min_messages=error', 'postgres'], {
      input: sql + '\n;\n\n', encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || /(?:ERROR|FATAL|PANIC):/.test(result.stderr)) throw Error(result.error?.message || result.stderr);
    console.log('PASS: ' + file);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  const resolved = path.resolve(root), temp = path.resolve(os.tmpdir());
  if (!resolved.startsWith(temp + path.sep) || !path.basename(resolved).startsWith('rts-support-test-')) throw Error('Unsafe cleanup target');
  fs.rmSync(resolved, { recursive: true, force: true });
}
