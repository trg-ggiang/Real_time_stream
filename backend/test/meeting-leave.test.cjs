const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { ServerError } = require('livekit-server-sdk');
const { MeetingsService } = require('../dist/meetings/meetings.service');

function fixture({sdkError,closed=false,dbError=null}={}) {
  const writes=[], filters=[], removals=[];
  const attendance={attendance_id:'attendance',livekit_identity:'user:connection',joined_at:new Date().toISOString(),left_at:closed?new Date().toISOString():null};
  const query={select(){return query;},eq(...args){filters.push(args);return query;},is(){return query;},
    update(values){writes.push(values);return query;},async maybeSingle(){return {data:attendance,error:null};},
    then(resolve,reject){return Promise.resolve({error:dbError}).then(resolve,reject);}};
  const service=new MeetingsService({}, {client:{from:()=>query}});
  service.requireMember=async()=>({meeting_member_id:'member'});
  service.getSession=async()=>({livekit_room_name:'room'});
  service.livekitRoomService={
    listParticipants:async()=>{throw Error('Cleanup must not list before removal');},
    removeParticipant:async(...args)=>{removals.push(args);if(sdkError)throw sdkError;},
  };
  return {service,writes,filters,removals};
}

test('leave records departure when LiveKit room/participant is already absent',async()=>{
  const {service,writes,filters,removals}=fixture({sdkError:new ServerError('Not Found','requested room does not exist',404,'not_found')});
  const result=await service.leave({userId:'user'},'meeting','session','attendance');
  assert.equal(result.status,'left');
  assert.deepEqual(removals,[['room','user:connection']]);
  assert.equal(writes[0].leave_reason,'client_left');
  assert.ok(Number.isFinite(Date.parse(writes[0].left_at)));
  assert.ok(filters.some(([key,value])=>key==='meeting_member_id'&&value==='member'));
  assert.ok(filters.some(([key,value])=>key==='session_id'&&value==='session'));
});

test('normal leave disconnects then records attendance, and repeated leave is harmless',async()=>{
  const normal=fixture();await normal.service.leave({userId:'user'},'meeting','session','attendance');
  assert.equal(normal.removals.length,1);assert.equal(normal.writes.length,1);
  const closed=fixture({closed:true});
  assert.equal((await closed.service.leave({userId:'user'},'meeting','session','attendance')).status,'left');
  assert.equal(closed.removals.length,0);assert.equal(closed.writes.length,0);
});

test('permission, network and unrecognized 404 errors are not swallowed or recorded as successful departures',async()=>{
  for(const sdkError of [new ServerError('Forbidden','permission denied',403,'permission_denied'),new Error('network timeout'),Object.assign(new Error('not found'),{status:404,code:'not_found'})]){
    const {service,writes}=fixture({sdkError});
    await assert.rejects(()=>service.leave({userId:'user'},'meeting','session','attendance'),error=>error===sdkError);
    assert.equal(writes.length,0);
  }
});

test('database failure after absent room still reports an unconfirmed departure',async()=>{
  const {service}=fixture({sdkError:new ServerError('Not Found','absent',404,'not_found'),dbError:{code:'database-error'}});
  await assert.rejects(()=>service.leave({userId:'user'},'meeting','session','attendance'),/Could not record meeting departure/);
});

test('cleanup used by member removal and session end tolerates only SDK not_found',async()=>{
  const {service,removals}=fixture({sdkError:new ServerError('Not Found','participant absent',404,'not_found')});
  await service.disconnectIfPresent('room','identity');
  assert.deepEqual(removals,[['room','identity']]);
});
