import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startVoxelService} from '/home/ubuntu/OMplayground/apps/voxel-server/src/service.ts';
const allowed=new Set(['voxel_persistence_status','voxel_session_projection_status','voxel_roster_status','voxel_controls_status','voxel_staff_status','voxel_moderation_status']);
const calls=[],events=[];
const nativeFetch=globalThis.fetch;
const guarded=async(input,init)=>{
  const path=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url).pathname;
  const method=init?.method??(input instanceof Request?input.method:'GET');
  const name=path.replace('/rest/v1/rpc/','');
  assert(method==='POST'&&path==='/rest/v1/rpc/'+name&&allowed.has(name),'Remote mutation or non-status request denied');
  calls.push(name);return nativeFetch(input,init);
};
let service;
try{
  service=await startVoxelService({env:{...process.env,NODE_ENV:'test',PORT:'0',VOXEL_HOST:'127.0.0.1',VOXEL_ALLOWED_ORIGINS:'https://school.invalid'},request:guarded,logger:{info:value=>events.push(value),error:value=>events.push(value)}});
  const origin=`http://127.0.0.1:${service.gateway.address.port}`;
  const health=await nativeFetch(origin+'/health'),ready=await nativeFetch(origin+'/ready');
  assert.equal(health.status,200);assert.equal(ready.status,200);
  assert.equal(service.gateway.rooms.size,0);
  assert.deepEqual([...calls].sort(),[...allowed].sort());
  await service.close();
  const result={result:'PASS',buildId:service.build.buildId,health:health.status,ready:ready.status,rooms:0,remoteStatusCalls:calls.sort(),remoteApplicationWrites:0,closed:true,checkedAt:new Date().toISOString()};
  writeFileSync('/tmp/voxel-moderation-voxel-startup.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{await service?.close();}
