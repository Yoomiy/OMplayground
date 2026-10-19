import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { PresentationFilter } from '../src/lab/presentation-filter.js';
import type { BodyState } from '@rocket-arena/simulation/protocol';
const body=(x=0,velocity=0):BodyState=>({position:{x,y:0,z:0},velocity:{x:velocity,y:0,z:0},
 rotation:{x:0,y:0,z:0,w:1},angularVelocity:{x:0,y:0,z:0}});

test('constant motion stays uniform despite irregular worker completion times',()=>{
 const filter=new PresentationFilter();
 const samples=[{completed:5,sampled:0},{completed:48,sampled:33},{completed:99,sampled:66},{completed:108,sampled:100}];
 let cursor=0,sample=samples[0];
 const positions:number[]=[];
 for(const now of [33,66,100,133]){
  while(cursor<samples.length && samples[cursor].completed<=now)sample=samples[cursor++];
  filter.sample(body(sample.sampled*.03,30),sample.sampled,now);positions.push(filter.position.x);
 }
 for(let i=0;i<positions.length;i++)assert.ok(Math.abs(positions[i]-[.99,1.98,3,3.99][i])<1e-6,JSON.stringify(positions));
});

test('new correction targets continue from the last displayed pose and decay on the render clock',()=>{
 const run=(frames:number[])=>{
  const filter=new PresentationFilter();filter.sample(body(),0,0);
  filter.sample(body(.5),0,0);
  assert.equal(filter.position.x,0,'a packet alone must not move the displayed pose');
  for(const now of frames)filter.sample(body(.5),0,now);
  assert.ok(filter.position.x>0 && filter.position.x<.5);
  return filter.position.x;
 };
 assert.ok(Math.abs(run([25,50,75,100])-run([10,20,30,40,50,60,70,80,90,100]))<1e-9);
});

test('rotation follows angular velocity on the same clock; extrapolation stays bounded',()=>{
 const filter=new PresentationFilter();const rotating=body();rotating.angularVelocity.y=1;
 filter.sample(rotating,0,33);
 const expected=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.033);
 assert.ok(filter.rotation.angleTo(expected)<1e-6);
 const moving=new PresentationFilter();moving.sample(body(0,30),0,500);
 assert.equal(moving.position.x,1.5,'at most 50 ms of extrapolation');
});

test('large discontinuities and explicit context resets snap instead of trailing across a kickoff',()=>{
 const filter=new PresentationFilter();filter.sample(body(),0,0);filter.sample(body(10),16,16);
 assert.equal(filter.position.x,10);
 filter.reset();filter.sample(body(11),32,32);assert.equal(filter.position.x,11);
});

test('50 ms timeline keeps constant-speed strides uniform with 60–100 ms old worker poses',()=>{
 const f=new PresentationFilter(50);
 const arrivals=[{sample:0,at:10},{sample:33,at:105},{sample:66,at:110},{sample:100,at:180},
  {sample:133,at:185},{sample:166,at:240},{sample:200,at:250},{sample:233,at:305},{sample:266,at:310}];
 let cursor=0,s=arrivals[0],previous=0;
 f.sample(body(0,25),0,50);
 for(let now=83;now<=347;now+=33){
  while(cursor<arrivals.length&&arrivals[cursor].at<=now)s=arrivals[cursor++];
  f.sample(body(s.sample*.025,25),s.sample,now);
  assert.ok(Math.abs(f.position.x-previous-.825)<1e-6,`at ${now}: ${f.position.x-previous}`);
  previous=f.position.x;
 }
});

test('timeline follows irregular render intervals, bounds starvation and snaps teleports',()=>{
 const f=new PresentationFilter(50);f.sample(body(0,20),0,50);
 for(const now of [67,100,166]){
  f.sample(body((now-30)*.02,20),now-30,now);
  assert.ok(Math.abs(f.position.x-(now-50)*.02)<1e-6,`${now}: ${f.position.x}`);
 }
 f.sample(body(100,0),180,180);assert.equal(f.position.x,100);
 const starved=new PresentationFilter(50);starved.sample(body(0,20),0,50);
 starved.sample(body(0,20),0,500);assert.equal(starved.position.x,1);
});

test('completed poses are buffered between render callbacks and storage stays bounded',()=>{
 const f=new PresentationFilter(50);
 for(let at=0;at<=200;at+=10)f.push(body(at*.02,20),at);
 f.sample(body(4,20),200,200);
 assert.ok(Math.abs(f.position.x-3)<1e-6,'render samples the 150 ms pose, not the latest arrival');
 const timeline=(f as any).timeline;assert.ok(timeline.size<=12);
 const snapshot=body(4.2,20);f.push(snapshot,210);snapshot.position.x=999;
 f.sample(body(4.2,20),210,210);assert.ok(f.position.x<4,'buffered poses are detached from later input mutation');
});
