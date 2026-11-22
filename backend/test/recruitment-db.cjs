// Disposable PostgreSQL single-user regression; never reads .env or a live DB.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync,execFileSync}=require('node:child_process');
const bin=process.env.RECRUITMENT_TEST_PG_BIN||'C:\\Program Files\\PostgreSQL\\17\\bin';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'rts-recruit-test-')),data=path.join(root,'data');
const exe=name=>path.join(bin,name+'.exe');
try {
 execFileSync(exe('initdb'),['-D',data,'-U','postgres','-A','trust','-E','UTF8','--locale=C','--no-instructions'],{windowsHide:true,stdio:'pipe',timeout:30000});
 for(const file of ['fixtures/recruitment-schema.sql','fixtures/recruitment-seed.sql','../../supabase/migrations/202611200002_recruitment_workflow.sql','../../supabase/migrations/202611200002_recruitment_workflow.sql','../../supabase/migrations/202611220001_recruitment_chair_review.sql','fixtures/recruitment-assertions.sql']){
  const sql=fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r/g,'').split('\n').filter(line=>line.trim()).join('\n');
  const r=spawnSync(exe('postgres'),['--single','-D',data,'-j','-c','log_min_messages=error','postgres'],{input:sql+'\n;\n\n',encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0||/(?:ERROR|FATAL|PANIC):/.test(r.stderr))throw Error(r.error?.message||r.stderr);
  console.log('PASS: '+file);
 }
}catch(e){console.error(e.message);process.exitCode=1;}
finally{const resolved=path.resolve(root);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('rts-recruit-test-'))throw Error('Unsafe cleanup target');fs.rmSync(resolved,{recursive:true,force:true});}
