import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { PlayerLabelProjector, resolvePlayerLabelOverlaps, type PlayerLabelPose } from '../src/hud/player-label-layout.js';

const pose=(id:string,local=false,x=400,y=300,depth=5):PlayerLabelPose=>({id,local,x,y,depth,visible:true});
test('player labels follow CSS-pixel projection and hide behind the camera, edges and invalid positions',()=>{
  const camera=new PerspectiveCamera(90,800/600,.1,100),projector=new PlayerLabelProjector();
  projector.begin(camera);const out=pose('name');
  const point=Object.freeze({x:0,y:-1.25,z:-5});
  projector.project(out,point,800,600);assert.equal(out.visible,true);assert.equal(out.x,400);assert.equal(out.y,300);
  for(const position of [{x:0,y:0,z:5},{x:100,y:0,z:-5},{x:NaN,y:0,z:-5},{x:0,y:0,z:-500}]){
    projector.project(out,position,800,600);assert.equal(out.visible,false);
  }
  projector.project(out,point,0,600);assert.equal(out.visible,false);
  assert.deepEqual(point,{x:0,y:-1.25,z:-5});
});
test('own label wins collisions; nearer other labels win without hiding separate names',()=>{
  const own=pose('own',true,400,300,10),near=pose('near',false,400,300,2),far=pose('far',false,600,300,10),next=pose('next',false,600,300,5);
  const labels=[far,near,next,own];resolvePlayerLabelOverlaps(labels);
  assert.equal(own.visible,true);assert.equal(near.visible,false);assert.equal(far.visible,false);assert.equal(next.visible,true);
});

test('own on-screen label remains readable at the edge while pointing back to its car',()=>{
  const camera=new PerspectiveCamera(90,800/600,.1,100),projector=new PlayerLabelProjector();projector.begin(camera);
  const local=pose('own',true),remote=pose('friend');
  const edge={x:-6.3,y:-1.25,z:-5};
  projector.project(local,edge,800,600);projector.project(remote,edge,800,600);
  assert.equal(local.visible,true);assert.equal(local.x,68);assert.ok(local.anchorX!<68);
  assert.equal(remote.visible,false);
});
