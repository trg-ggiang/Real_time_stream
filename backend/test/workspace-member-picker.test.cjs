const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createClient}=require('@supabase/supabase-js');
const {WorkspacePeople}=require('../dist/workspace/workspace-people.service');
function fixture({management=false,deny=false}={}) {
 const requests=[];
 const client=createClient('https://project.example','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(raw,options)=>{
 const url=new URL(raw),table=url.pathname.split('/').at(-1);const body=options.body?JSON.parse(options.body):null;requests.push({table,method:options.method,query:url.searchParams,body});
 if(table==='users'&&url.searchParams.get('select')==='user_id')return Response.json([{user_id:'new'}]);
 if(table==='users')return Response.json([{user_id:'existing',display_name:'Existing',email:'existing@example.com',avatar_url:null},{user_id:'new',display_name:'New',email:'new@example.com',avatar_url:null}]);
 if(table==='club_departments')return Response.json([{department_id:'tech',is_management:management}]);
 if(table==='club_memberships'&&options.method==='POST')return Response.json({membership_id:'created'},{status:201});
 if(table==='club_memberships')return Response.json([{user_id:'existing'}]);
 throw Error('Unexpected query');
 }}});
 const calls=[];const access={supabase:{client},require:async(...args)=>{calls.push(args);if(deny)throw Error('Forbidden');},check:error=>{if(error)throw error;}};
 return {service:new WorkspacePeople(access),requests,calls};
}
test('candidate search is chair-only, bounded and omits existing club accounts',async()=>{
 const f=fixture();assert.deepEqual(await f.service.candidates('actor','club','New'),{items:[{user_id:'new',display_name:'New',email:'new@example.com',avatar_url:null}]});
 assert.deepEqual(f.calls,[['actor','club',true]]);const users=f.requests.find(r=>r.table==='users');assert.equal(users.query.get('limit'),'8');assert.equal(users.query.get('display_name'),'ilike.%New%');
 const denied=fixture({deny:true});await assert.rejects(denied.service.candidates('member','club','New'),/Forbidden/);assert.equal(denied.requests.length,0);
});
test('candidate lookup rejects short queries and treats wildcard input literally',async()=>{
 const f=fixture();await assert.rejects(f.service.candidates('actor','club',' '));assert.equal(f.requests.length,0);
 await f.service.candidates('actor','club','new_%@example.com');const users=f.requests.find(r=>r.table==='users');assert.equal(users.query.get('email'),'ilike.%new\\_\\%@example.com%');
});
test('chair adds head directly with selected department and joined date',async()=>{
 const f=fixture();await f.service.add('actor','club',' NEW@example.com ','tech','head');assert.deepEqual(f.calls,[['actor','club',true]]);
 const insert=f.requests.find(r=>r.method==='POST');assert.equal(insert.body.role,'head');assert.equal(insert.body.department_id,'tech');assert.equal(insert.body.user_id,'new');assert.ok(Number.isFinite(Date.parse(insert.body.joined_at)));
});
test('invalid roles and management head assignments never insert memberships',async()=>{
 const invalid=fixture();await assert.rejects(invalid.service.add('actor','club','new@example.com','tech','chairperson'));assert.equal(invalid.requests.length,0);
 const management=fixture({management:true});await assert.rejects(management.service.add('actor','club','new@example.com','tech','head'));assert.equal(management.requests.some(r=>r.method==='POST'),false);
 const denied=fixture({deny:true});await assert.rejects(denied.service.add('member','club','new@example.com','tech','member'));assert.equal(denied.requests.length,0);
});
