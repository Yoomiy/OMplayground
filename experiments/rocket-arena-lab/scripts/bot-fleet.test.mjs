import assert from 'node:assert/strict';
import test from 'node:test';
import { PracticeBotFleet } from './bot-fleet.mjs';
import { driveBot } from './bot-driver.mjs';

function room(id) {
  const listeners = new Map();
  return { sessionId:id, connection:{isOpen:true}, sent:[], leaves:0,
    onMessage(type, fn) { listeners.set(type,fn); }, onLeave(fn) { this.leaveListener=fn; },
    send(type, data) { this.sent.push({type,data}); },
    emit(frame) { listeners.get('prediction-state')?.(frame); },
    async leave() { this.leaves++;this.connection.isOpen=false;this.leaveListener?.(); } };
}
const frame = ids => ({ phase:'playing', cars:ids.map(sessionId => ({ sessionId,
  position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0,w:1},velocity:{x:1,y:0,z:1} })),
  ball:{position:{x:0,y:1,z:10}} });

test('fleet joins tagged rooms once, drives real inputs and leaves when all humans leave', async () => {
  const joined=[];
  const client={ async getAvailableRooms(){return [{roomId:'ordinary',metadata:{}},{roomId:'practice',metadata:{labBotCount:7}}];},
    async joinById(id){assert.equal(id,'practice');const result=room(`bot-${joined.length}`);joined.push(result);return result;} };
  const fleet=new PracticeBotFleet(client,2,()=>{});
  await fleet.discover();await fleet.discover();assert.equal(joined.length,7);
  joined[0].emit(frame(['human',...joined.map(bot=>bot.sessionId)]));
  fleet.tick();fleet.tick();
  assert.ok(joined.every(bot=>bot.sent.length===2 && bot.sent[1].data.sequence===2 && bot.sent[1].data.command.throttle===1));
  joined[0].emit(frame(joined.map(bot=>bot.sessionId)));
  await new Promise(setImmediate);
  assert.equal(fleet.groups.size,0);assert.ok(joined.every(bot=>bot.leaves===1));
  await fleet.stop();
});

test('shutdown fences a join which completes after stop, and discovery is serialized', async () => {
  let finish, joins=0;
  const pending=new Promise(resolve=>{finish=resolve;});
  const fleet=new PracticeBotFleet({ async getAvailableRooms(){return [{roomId:'x',metadata:{labBotCount:1}}];},
    async joinById(){joins++;return pending;} },2,()=>{});
  const discovery=fleet.discover();await new Promise(setImmediate);
  await fleet.discover();assert.equal(joins,1);
  await fleet.stop();const late=room('late');finish(late);await discovery;
  assert.equal(late.leaves,1);assert.equal(fleet.groups.size,0);
});

test('fleet caps rooms and cleans stalled transports; bot jump edges stay monotonic', async () => {
  const joined=[];
  const fleet=new PracticeBotFleet({ async getAvailableRooms(){return ['a','b','c'].map(roomId=>({roomId,metadata:{labBotCount:1}}));},
    async joinById(id){const result=room(id);joined.push(result);return result;} },2,()=>{});
  await fleet.discover();assert.equal(joined.length,2);
  fleet.tick(performance.now()+6_000);await new Promise(setImmediate);
  assert.equal(fleet.groups.size,0);assert.ok(joined.every(bot=>bot.leaves===1));
  const bot={room:room('a'),index:0,jumpSequence:0,jumping:false};
  const state=frame(['a']);
  assert.equal(driveBot(bot,state,10.9).jumpSequence,1);
  assert.equal(driveBot(bot,state,10.95).jumpSequence,1);
  assert.equal(driveBot(bot,state,11.1).jumpHeld,false);
  assert.equal(driveBot(bot,state,21.9).jumpSequence,2);
  assert.equal(driveBot(bot,{...state,phase:'waiting'},22).throttle,0);
  await fleet.stop();
});
