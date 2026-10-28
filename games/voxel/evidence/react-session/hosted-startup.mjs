import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startVoxelService} from '/home/ubuntu/OMplayground/apps/voxel-server/src/service.ts';
const logs=[];
const service=await startVoxelService({env:{...process.env,NODE_ENV:'test',PORT:'0',VOXEL_HOST:'127.0.0.1',VOXEL_ALLOWED_ORIGINS:'https://school.example'},logger:{info:value=>logs.push(value),error:value=>logs.push(value)}});
let record;
try{
 const address=service.gateway.address;assert.ok(address&&typeof address==='object');
 const origin=`http://127.0.0.1:${address.port}`;
 const health=(await fetch(origin+'/health')).status,ready=(await fetch(origin+'/ready')).status;
 assert.equal(health,200);assert.equal(ready,200);assert.equal(service.gateway.rooms.size,0);
 record={result:'PASS',buildId:service.build.buildId,scope:'Read-only hosted schema checks and local loopback production composition; no admission, worker, hosted recovery or deployment claim',health,ready,roomsAllocated:0,remoteApplicationWrites:false};
}finally{await service.close();}
writeFileSync('/tmp/voxel-react-hosted-startup.json',JSON.stringify({...record,closed:true,checkedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({result:record.result,roomsAllocated:0,closed:true}));
