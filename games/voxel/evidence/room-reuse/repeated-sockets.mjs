import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const archive='games/voxel/evidence/worker-timings', before='/tmp/voxel-room-reuse-before-release';
assert(!fs.existsSync(before));
fs.mkdirSync(before+'/artifacts',{recursive:true});
fs.cpSync(archive+'/release/dist-server',before+'/dist-server',{recursive:true});
fs.copyFileSync(archive+'/build.json',before+'/artifacts/build.json');
fs.copyFileSync(archive+'/release.json',before+'/artifacts/release.json');
fs.copyFileSync(before+'/dist-server/content.json',before+'/artifacts/content.json');
fs.writeFileSync(before+'/package.json','{"type":"module"}\n');
fs.symlinkSync(process.cwd()+'/games/voxel/node_modules',before+'/node_modules','dir');
fs.copyFileSync('games/voxel/test-results/survival-sockets.json','/tmp/voxel-room-reuse-full-sockets.json');
const results=[];
for (let pair=0;pair<3;pair++) for(const old of pair%2?[false,true]:[true,false]) {
  const log=`/tmp/voxel-room-reuse-repeat-${pair}-${old?'before':'after'}`;
  const env={...process.env,VOXEL_BENCH_LAYOUTS:'1x128'};
  if(old)env.VOXEL_BENCH_RELEASE_ROOT=before;else delete env.VOXEL_BENCH_RELEASE_ROOT;
  const child=spawnSync(process.execPath,['games/voxel/tools/benchmark-sockets.mjs'],{env,encoding:'utf8',maxBuffer:8*1024*1024});
  fs.writeFileSync(log+'.log',child.stdout+child.stderr);assert.equal(child.status,0,log);
  const r=JSON.parse(fs.readFileSync('games/voxel/test-results/survival-sockets.json'));
  assert.equal(r.profiles.length,1);fs.writeFileSync(log+'.json',JSON.stringify(r,null,2)+'\n');
  results.push({pair,old,report:r});
  console.log(JSON.stringify({pair,old,buildId:r.buildId,worldP95:r.profiles[0].roomMetrics[0].worldStep_p95UpperMs,ackP99:r.profiles[0].ackMs.p99}));
}
fs.writeFileSync('/tmp/voxel-room-reuse-repeated-sockets.json',JSON.stringify({result:'ALTERNATING_PACKAGED_128_PLAYER_SAMPLES_PASS',scope:'Three alternating before/after pairs, independent process per run; 3s endpoint warmup and 10s sample, startup/warmup included in worker metrics. Co-located loopback fixtures; no rich activity, real school network or physical capacity signoff.',results},null,2)+'\n');
fs.copyFileSync('/tmp/voxel-room-reuse-full-sockets.json','games/voxel/test-results/survival-sockets.json');
