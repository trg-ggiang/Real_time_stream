const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { ServerError } = require('livekit-server-sdk');
const { MeetingsService } = require('../dist/meetings/meetings.service');

const sessionId = 'session-a';
const user = { userId:'guest-user',displayName:'Guest' };
const member = (status='pending', requestedSession=sessionId) => ({
  meeting_member_id:'guest-member',meeting_id:'meeting',user_id:user.userId,
  role:'participant',admission_status:status,invited_at:null,removed_at:null,
});

function fixture(options={}) {
  const calls=[];
  const client={from(table){
    const call={table,mode:'select',filters:[]}; calls.push(call);
    const query={};
    for(const operation of ['select','eq','neq','is','not','gte','order','limit']) query[operation]=(...args)=>{call.filters.push([operation,...args]);return query;};
    query.insert=values=>{call.mode='insert';call.values=values;return query;};
    query.update=values=>{call.mode='update';call.values=values;return query;};
    const execute=()=>{
      if(options.resolve)return options.resolve(call);
      if(table==='club_memberships')return {data:options.clubMembership?{membership_id:'membership'}:null,error:null};
      if(table==='clubs')return {data:{club_id:'club'},error:null};
      if(table==='meeting_members' && call.mode==='insert')return {data:{...member(call.values.admission_status),...call.values},error:null};
      if(table==='attendances' && call.mode==='insert')return {data:{attendance_id:'actual-attendance'},error:null};
      if(table==='attendances' && call.mode==='select')return {data:options.attendances??[],error:null};
      return {data:call.mode==='update'?{meeting_member_id:'guest-member'}:[],error:null};
    };
    query.single=async()=>execute();query.maybeSingle=async()=>execute();
    query.then=(resolve,reject)=>Promise.resolve(execute()).then(resolve,reject);
    return query;
  }};
  const values={LIVEKIT_URL:'wss://unit.invalid',LIVEKIT_API_KEY:'synthetic-key',LIVEKIT_API_SECRET:'synthetic-secret-long-enough-for-unit-test',LIVEKIT_TOKEN_TTL_SECONDS:300};
  const service=new MeetingsService({get:key=>values[key],getOrThrow:key=>values[key]}, {client});
  service.getMeetingByCode=async()=>({meeting_id:'meeting',waiting_room_enabled:options.waiting!==false});
  service.getMeetingById=service.getMeetingByCode;
  service.getSession=async(meetingId,id)=>({meeting_id:meetingId,session_id:id,status:'ongoing',livekit_room_name:'room-'+id});
  service.getMember=async()=>options.member||null;
  service.getMemberById=async()=>options.member||member();
  service.requireModerator=async()=>({role:'host'});
  service.requireMeetingMember=async()=>({role:'host'});
  service.checkAdmissionRetryLimit=async()=>{};
  return {service,calls};
}

test('waiting requests use existing membership status and never create attendance, including repeat joins', async()=>{
  const {service,calls}=fixture();
  assert.equal((await service.join(user,'CODE',sessionId)).status,'pending');
  const write=calls.find(call=>call.mode==='insert');
  assert.equal(write.table,'meeting_members');
  assert.equal(Object.keys(write.values).includes('requested_session_id'),false);
  assert.equal(calls.filter(call=>call.table==='attendances').length,0);
  service.getMember=async()=>member();
  service.getMeetingByCode=async()=>({meeting_id:'meeting',waiting_room_enabled:false});
  assert.equal((await service.join(user,'CODE',sessionId)).status,'pending');
  assert.equal(calls.filter(call=>call.mode==='insert').length,1);
});

test('approved guests create a real non-null attendance only when joining', async()=>{
  const {service,calls}=fixture({member:member('admitted')});
  const joined=await service.join(user,'CODE',sessionId);
  assert.equal(joined.attendanceId,'actual-attendance');
  assert.ok(joined.token);
  const attendance=calls.find(call=>call.table==='attendances'&&call.mode==='insert').values;
  assert.ok(attendance.livekit_identity.startsWith(user.userId+':'));
  assert.ok(Number.isFinite(Date.parse(attendance.joined_at)));
  assert.equal(attendance.session_id,sessionId);
});

test('turning the waiting room off admits new guests without inserting a placeholder attendance', async()=>{
  const {service,calls}=fixture({waiting:false});
  assert.equal((await service.join(user,'CODE',sessionId)).status,'admitted');
  const membership=calls.find(call=>call.table==='meeting_members'&&call.mode==='insert').values;
  assert.equal(membership.admission_status,'admitted');
  assert.equal(Object.keys(membership).includes('requested_session_id'),false);
  const attendances=calls.filter(call=>call.table==='attendances'&&call.mode==='insert');
  assert.equal(attendances.length,1);
  assert.ok(attendances[0].values.livekit_identity);
  assert.ok(attendances[0].values.joined_at);
});

test('approval updates only the matching pending request and does not create attendance', async()=>{
  const {service,calls}=fixture();
  await service.approve({userId:'host'},'meeting',sessionId,'guest-member');
  const update=calls.find(call=>call.mode==='update');
  assert.equal(update.table,'meeting_members');
  assert.equal(update.values.admission_status,'admitted');
  assert.ok(update.filters.some(([op,key,value])=>op==='eq'&&key==='meeting_id'&&value==='meeting'));
  assert.ok(update.filters.some(([op,key,value])=>op==='eq'&&key==='admission_status'&&value==='pending'));
  assert.equal(calls.filter(call=>call.table==='attendances').length,0);
});

test('approval and denial cannot operate on an already processed request', async()=>{
  for(const action of ['approve','deny']){
    const raced=fixture({resolve:()=>({data:null,error:null})});
    await assert.rejects(()=>raced.service[action]({userId:'host'},'meeting',sessionId,'guest-member'), /no longer pending/);
  }
});

test('pending list reads membership requests and exposes request IDs, never fake attendance IDs', async()=>{
  const {service,calls}=fixture({resolve:()=>({data:[{...member(),users:{display_name:'Guest'}}],error:null})});
  const pending=await service.pending({userId:'host'},'meeting',sessionId);
  assert.equal(pending[0].requestId,'guest-member');
  assert.equal(pending[0].attendance_id,undefined);
  assert.equal(pending[0].meeting_members.users.display_name,'Guest');
  assert.equal(calls[0].table,'meeting_members');
  assert.ok(calls[0].filters.some(([op,key,value])=>op==='eq'&&key==='meeting_id'&&value==='meeting'));
});

test('join status reflects approval before attendance without attendance', async()=>{
  for(const status of ['pending','admitted']){
    const {service,calls}=fixture({member:member(status)});
    assert.equal((await service.joinStatus(user,'meeting',sessionId)).status,status);
    assert.equal(calls.length,0);
  }

});

test('ending a session uses existing columns only', async()=>{
  const {service,calls}=fixture();
  await service.endSession({userId:'host'},'meeting',sessionId);
  assert.ok(calls.some(call=>call.table==='meeting_sessions'&&call.mode==='update'&&call.values.status==='ended'));
  assert.equal(JSON.stringify(calls).includes('requested_session_id'),false);
});

test('join tokens permit hand raising for every role and screen sources only for the actual host', async()=>{
  for (const role of ['host', 'moderator', 'participant']) {
    const {service}=fixture({member:{...member('admitted'),role}});
    service.getMeetingByCode=async()=>({meeting_id:'meeting',created_by:user.userId});
    const joined=await service.join(user,'CODE',sessionId);
    const claims=JSON.parse(Buffer.from(joined.token.split('.')[1],'base64url').toString());
    assert.equal(claims.video.canUpdateOwnMetadata,true);
    assert.equal(claims.video.canPublishSources.includes('screen_share'),role==='host');
    assert.equal(claims.video.canPublishSources.includes('screen_share_audio'),role==='host');
    assert.equal(joined.role,role);
  }
});

test('parallel club sessions issue tokens scoped to distinct LiveKit rooms', async () => {
  const { service, calls } = fixture({ member: member('admitted'), clubMembership: true });
  service.getMeetingByCode = async () => ({ meeting_id: 'meeting', club_id: 'club', waiting_room_enabled: true });
  const sessions = ['session-a', 'session-b'];
  const credentials = await Promise.all(sessions.map(id => service.join(user, 'CODE', id)));
  for (const [index, joined] of credentials.entries()) {
    const claims = JSON.parse(Buffer.from(joined.token.split('.')[1], 'base64url').toString());
    assert.equal(claims.video.room, 'room-' + sessions[index]);
    assert.equal(joined.sessionId, sessions[index]);
  }
  assert.deepEqual(calls.filter(call => call.table === 'attendances' && call.mode === 'insert').map(call => call.values.session_id).sort(), sessions);
});

test('club meeting outsiders cannot list sessions, join or read admission status', async () => {
  const { service, calls } = fixture();
  service.getMeetingById = service.getMeetingByCode = async () => ({ meeting_id: 'meeting', club_id: 'club' });
  service.getSession = async () => assert.fail('Access must be checked before touching the session');
  const forbidden = error => error.getStatus() === 403;
  await assert.rejects(service.listSessions(user, 'CODE'), forbidden);
  await assert.rejects(service.join(user, 'CODE', sessionId), forbidden);
  await assert.rejects(service.joinStatus(user, 'meeting', sessionId), forbidden);
  assert.ok(calls.every(call => call.mode === 'select' && ['club_memberships', 'clubs'].includes(call.table)));
});

function deviceFixture() {
  const attendances = ['old', 'current', 'newer'].map((id, index) => ({
    attendance_id: id,
    livekit_identity: `guest-user:${id}`,
    joined_at: new Date(Date.UTC(2026, 10, 21, 8, index)).toISOString(),
  }));
  const { service, calls } = fixture({ member: member('admitted'), attendances });
  const connected = new Set([attendances[0].livekit_identity, 'another-user:connection']);
  const removals = [];
  service.livekitRoomService = {
    async listParticipants(roomName) {
      assert.equal(roomName, 'room-' + sessionId);
      return Array.from(connected, identity => ({ identity }));
    },
    async removeParticipant(roomName, identity) {
      assert.equal(roomName, 'room-' + sessionId);
      removals.push(identity);
      if (!connected.delete(identity)) throw new ServerError('Not Found', 'Missing participant', 404, 'not_found');
    },
  };
  return { service, calls, connected, removals };
}

test('another connected device prompts before issuing a token; add keeps both connections', async () => {
  const { service, calls, removals } = deviceFixture();
  assert.deepEqual(await service.join(user, 'CODE', sessionId), {
    status: 'device_choice_required', meetingId: 'meeting', sessionId,
  });
  assert.ok(calls[0].filters.some(([op, key, value]) => op === 'eq' && key === 'meeting_member_id' && value === 'guest-member'));
  assert.ok(calls[0].filters.some(([op, key, value]) => op === 'eq' && key === 'session_id' && value === sessionId));
  assert.equal(calls.some(call => call.mode === 'insert'), false);

  const joined = await service.join(user, 'CODE', sessionId, 'add');
  assert.equal(joined.status, 'admitted');
  assert.equal(joined.transferAfterConnect, undefined);
  assert.notEqual(joined.participantIdentity, 'guest-user:old');
  assert.deepEqual(removals, []);
});

test('stale open attendance and a room that no longer exists do not prompt', async () => {
  const { service, connected } = deviceFixture();
  connected.delete('guest-user:old');
  assert.equal((await service.join(user, 'CODE', sessionId)).status, 'admitted');
  service.livekitRoomService.listParticipants = async () => { throw new ServerError('Not Found', 'Missing room', 404, 'not_found'); };
  assert.equal((await service.join(user, 'CODE', sessionId)).status, 'admitted');
});

test('transfer waits for the new owned connection and closes only older attendances in the session', async () => {
  const { service, calls, connected, removals } = deviceFixture();
  const joined = await service.join(user, 'CODE', sessionId, 'transfer');
  assert.equal(joined.transferAfterConnect, true);
  assert.equal(joined.role, 'participant');
  assert.deepEqual(removals, []);

  const conflict = error => error.getStatus() === 409;
  await assert.rejects(service.transferDevice(user, 'meeting', sessionId, 'other-user'), conflict);
  await assert.rejects(service.transferDevice(user, 'meeting', sessionId, 'current'), conflict);
  assert.deepEqual(removals, []);

  connected.add('guest-user:current');
  connected.add('guest-user:newer');
  assert.deepEqual(await service.transferDevice(user, 'meeting', sessionId, 'current'), { transferred: true });
  assert.deepEqual(removals, ['guest-user:old']);
  assert.deepEqual([...connected], ['another-user:connection', 'guest-user:current', 'guest-user:newer']);
  const writes = calls.filter(call => call.mode === 'update');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].values.leave_reason, 'device_transferred');
  assert.ok(writes[0].filters.some(([op, key, value]) => op === 'eq' && key === 'attendance_id' && value === 'old'));
});
