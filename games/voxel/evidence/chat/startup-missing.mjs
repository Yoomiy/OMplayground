import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Server} from 'node:net';
import {startVoxelService} from '/home/ubuntu/OMplayground/apps/voxel-server/src/service.ts';
import {PersistenceError} from '/home/ubuntu/OMplayground/apps/voxel-server/src/supabase-persistence.ts';
const names=new Set(['voxel_persistence_status','voxel_session_projection_status','voxel_roster_status','voxel_controls_status','voxel_staff_status','voxel_moderation_status','voxel_chat_status']);
const calls=[];let listenerAttempts=0;const original=Server.prototype.listen;
Server.prototype.listen=function(){listenerAttempts++;throw new Error('Unexpected listener before chat schema readiness');};
const guarded=async(input,init)=>{
 const req=new Request(input,init),path=new URL(req.url).pathname,name=path.replace('/rest/v1/rpc/','');
 assert(req.method==='POST'&&path==='/rest/v1/rpc/'+name&&names.has(name),'Non-status hosted operation rejected');
 calls.push(name);return fetch(req);
};
try {
 await assert.rejects(startVoxelService({env:{...process.env,NODE_ENV:'test',PORT:'0',VOXEL_HOST:'127.0.0.1',VOXEL_ALLOWED_ORIGINS:'https://school.invalid'},request:guarded,logger:{info:()=>{},error:()=>{}}}),
  error=>error instanceof PersistenceError&&error.providerCode==='PGRST202'&&error.operation==='voxel_chat_status');
 assert.equal(listenerAttempts,0);assert.deepEqual(calls.sort(),[...names].sort());
 const result={result:'EXPECTED_NOT_READY',missing:'voxel_chat_status',remoteStatusCalls:calls,listenerAttempts,serviceCreated:false,remoteApplicationWrites:0,checkedAt:new Date().toISOString()};
 writeFileSync('/tmp/voxel-chat-startup-missing.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {Server.prototype.listen=original;}
