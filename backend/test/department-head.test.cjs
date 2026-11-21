const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { createClient } = require('@supabase/supabase-js');
const { WorkspacePeople } = require('../dist/workspace/workspace-people.service');
const { HeadNotifications } = require('../dist/personal/head-notifications.service');
function fixture(role = 'member', missing = false, error = null) {
 const calls=[];
 const client=createClient('https://test.invalid','fake',{global:{fetch:async(input,options)=>{
  const u=new URL(input); calls.push({path:u.pathname,query:u.searchParams,body:options.body&&JSON.parse(options.body)});
  return error ? Response.json(error,{status:409}) : Response.json(missing?[]:[{membership_id:'target',role}]);
 }}});
 const access={supabase:{client},require:async(a,c,chair)=>{assert.equal(chair,true);},check:e=>{if(e)throw Error('DB error');}};
 return {people:new WorkspacePeople(access),calls,access,client};
}
test('head change scopes the target and calls only the head RPC with precise version',async()=>{
 const f=fixture(); await f.people.setHead('actor','club','target',true,'2026-11-20T00:00:00.123456Z');
 assert.equal(f.calls[0].query.get('club_id'),'eq.club'); assert.equal(f.calls[0].query.get('status'),'eq.active');
 assert.deepEqual(f.calls[1].body,{p_actor:'actor',p_membership:'target',p_is_head:true,p_expected_updated_at:'2026-11-20T00:00:00.123456Z'});
 assert.ok(f.calls[1].path.endsWith('/clubspace_set_department_head'));
});
test('demotion changes head to member without transferring chair',async()=>{
 const f=fixture('head'); await f.people.setHead('actor','club','target',false,'stamp'); assert.equal(f.calls[1].body.p_is_head,false);
 assert.equal(f.calls.some(c=>c.path.includes('transfer_chair')),false);
});
test('chairperson, missing target and unauthorized actors cannot be changed',async()=>{
 for(const [role,missing] of [['chairperson',false],['member',true]]){const f=fixture(role,missing);await assert.rejects(f.people.setHead('actor','club','target',true,'stamp'));assert.equal(f.calls.length,1);}
 const f=fixture(); f.access.require=async()=>{throw Error('denied');};await assert.rejects(f.people.setHead('outsider','club','target',true,'stamp'));assert.equal(f.calls.length,0);
});
test('notification list filters recipient, event type and read snapshot',async()=>{
 const f=fixture(); const service=new HeadNotifications({client:f.client}); const data=await service.list('recipient');
 for(const c of f.calls){assert.equal(c.query.get('recipient_id'),'eq.recipient');assert.equal(c.query.get('type'),'in.(department.head_assigned,recruitment.application,recruitment.accepted,recruitment.rejected,post.published,activity.published,recruitment.published)');assert.equal(c.query.get('created_at'),'lte.'+data.read_through);}
});
test('mark viewed uses only authenticated recipient and snapshot cutoff',async()=>{
 const f=fixture(); await new HeadNotifications({client:f.client}).read('recipient','snapshot');
 assert.deepEqual(f.calls[0].body,{p_actor:'recipient',p_through:'snapshot'});
});
