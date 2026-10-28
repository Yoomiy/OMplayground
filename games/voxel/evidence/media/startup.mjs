import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startVoxelService} from '/home/ubuntu/OMplayground/apps/voxel-server/src/service.ts';
const allowed=new Set(['voxel_persistence_status','voxel_session_projection_status','voxel_controls_status','voxel_roster_status','voxel_staff_status','voxel_moderation_status','voxel_chat_status','voxel_media_status']),seen=[],events=[];
let service;const timer=setTimeout(()=>{process.exitCode=1;void service?.close();},20000);
try{
  service=await startVoxelService({env:{...process.env,NODE_ENV:'test',PORT:'0',VOXEL_HOST:'127.0.0.1',VOXEL_ALLOWED_ORIGINS:'https://school.example'},
    logger:{info:v=>events.push(v.context?.event),error:v=>events.push(v.context?.event)},
    request:async(input,init)=>{const request=new Request(input,init),path=new URL(request.url).pathname,name=path.split('/').at(-1);
      assert.equal(request.method,'POST');assert.equal(path,'/rest/v1/rpc/'+name);assert(allowed.has(name));seen.push(name);return fetch(request);}});
  const address=service.gateway.address;assert(address&&typeof address==='object');const origin='http://127.0.0.1:'+address.port;
  const health=(await fetch(origin+'/health')).status,ready=(await fetch(origin+'/ready')).status;assert.equal(health,200);assert.equal(ready,200);assert.equal(service.gateway.rooms.size,0);
  assert.deepEqual([...seen].sort(),[...allowed].sort());await service.close();
  const result={result:'READ_ONLY_EIGHT_SCHEMA_PACKAGED_STARTUP_PASS',checkedAt:new Date().toISOString(),buildId:service.build.buildId,statusRpcs:seen,health,ready,rooms:0,closed:true,remoteApplicationWrites:false,events};
  writeFileSync('/tmp/voxel-media-startup.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{clearTimeout(timer);await service?.close();}
