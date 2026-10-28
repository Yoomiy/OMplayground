import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {GameRoom} from '/home/ubuntu/OMplayground/games/voxel/src/sim/game-room.ts';
import {WorldStore} from '/home/ubuntu/OMplayground/games/voxel/src/sim/world-store.ts';
import {around} from '/home/ubuntu/OMplayground/games/voxel/src/shared/protocol.ts';
import {encodeChunk} from '/home/ubuntu/OMplayground/games/voxel/src/shared/chunk-wire.ts';
import {initSync,set_content,VoxelWorld,TerrainGen} from '/home/ubuntu/OMplayground/games/voxel/engine/pkg/voxel_engine.js';
const root='/home/ubuntu/OMplayground/games/voxel/';
const build=JSON.parse(fs.readFileSync(root+'artifacts/build.json')),content=JSON.parse(fs.readFileSync(root+'artifacts/content.json'));
const {memory}=initSync({module:fs.readFileSync(root+'dist-server/engine.wasm')});set_content(JSON.stringify(content));
const results=[];
for(const players of [16,32,64,128]){
 let bytes=0,messages=0,now=0;
 const store=new WorldStore(new VoxelWorld(),new TerrainGen(4242));
 const room=new GameRoom(store,content,build,{send(_id,e){messages++;},close(){}},'capacity-fixture',4242,now,0,'survival');
 try{
   for(let i=0;i<players;i++)room.join({id:'a'+i,role:'participant',capabilities:{build:true,fly:false,observe:false,combat:true,explosives:true}},'a'+i,now);
   while(store.generateOne()){}
   room.advance(now+=1000/30);
   for(const a of room.actors.values()){
     const state=store.world.player_state(a.slot);
     room.receive(a.id,{type:'ready',epoch:a.epoch,columns:around(Math.floor(state[0]/16),Math.floor(state[2]/16),1).map(c=>({...c,revision:store.revision(c.x,c.z)}))},now);
     room.receive(a.id,{type:'focus',epoch:a.epoch,active:true},now);
   }
   const samples=[];let sequence=0;bytes=0;messages=0;
   for(let tick=0;tick<660;tick++){
     now+=1000/30;const start=performance.now();
     for(const a of room.actors.values())room.receive(a.id,{type:'input',frames:[1,2].map(n=>({epoch:a.epoch,sequence:sequence+n,x:0,z:0,yaw:Math.sin(tick/30)*.4,pitch:Math.cos(tick/45)*.15,jump:tick%60===0,sprint:false,sneak:false}))},now);
     sequence+=2;const r=room.advance(now);assert.equal(r.steps,1);assert.equal(r.droppedMs,0);
     if(tick>=60)samples.push(performance.now()-start);
     while(store.generateOne()){}
   }
   assert([...room.actors.values()].every(a=>a.phase==='playing'));
   samples.sort((a,b)=>a-b);
   const row={players,samples:samples.length,p95:samples[Math.ceil(samples.length*.95)-1],p99:samples[Math.ceil(samples.length*.99)-1],max:samples.at(-1),mean:samples.reduce((a,b)=>a+b,0)/samples.length,messages,wireBytes:bytes,columns:store.world.column_count(),wasmHighWaterBytes:memory.buffer.byteLength};
   results.push(row);console.log(JSON.stringify(row));
 }finally{room.dispose();assert.equal(store.world.__wbg_ptr,0);}
}
fs.writeFileSync('/tmp/voxel-survival-probe-no-encoding.json',JSON.stringify({scope:'Lower-bound direct GameRoom survival simulation plus input dispatch without encoding (controlled diagnostic), natural terrain, dense stationary/jumping actors, no sockets/worker scheduling/SQL/browser/voice/mining/crafting/TNT',buildId:build.buildId,results},null,2)+'\n');
