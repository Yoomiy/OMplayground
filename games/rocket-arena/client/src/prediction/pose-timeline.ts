import * as THREE from 'three';
import type { BodyState } from '@rocket-arena/simulation/protocol';

/** A small bounded pose history; arrival time never becomes the display clock. */
export class PoseTimeline {
  private samples: { at: number; body: BodyState }[] = [];
  private input: BodyState | null = null;
  private inputAt = 0;
  readonly target: BodyState = { position: new THREE.Vector3(), rotation: new THREE.Quaternion(),
    velocity: new THREE.Vector3(), angularVelocity: new THREE.Vector3() };
  private rotation = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  private delta = new THREE.Quaternion();
  reset(): void { this.samples = []; this.input = null; }
  push(body: BodyState, at: number): boolean {
    if (body === this.input && at === this.inputAt) return false;
    this.input = body; this.inputAt = at;
    const last = this.samples.at(-1);
    let discontinuity = false;
    if (last) {
      const dt = Math.max(0, (at-last.at)/1_000);
      const error = Math.hypot(body.position.x-last.body.position.x-last.body.velocity.x*dt,
        body.position.y-last.body.position.y-last.body.velocity.y*dt,
        body.position.z-last.body.position.z-last.body.velocity.z*dt);
      discontinuity = error >= 3;
      if (at < last.at || discontinuity) this.samples = [];
    }
    const copy: BodyState = { position: { ...body.position }, rotation: { x:body.rotation.x,y:body.rotation.y,z:body.rotation.z,w:body.rotation.w },
      velocity: { ...body.velocity }, angularVelocity: { ...body.angularVelocity } };
    if (this.samples.at(-1)?.at === at) this.samples.pop();
    this.samples.push({ at, body: copy });
    if (this.samples.length > 12) this.samples.shift();
    return discontinuity;
  }
  read(at: number): BodyState {
    const first = this.samples[0]!;
    let left = first, right = first;
    for (const sample of this.samples) {
      if (sample.at <= at) left = sample;
      if (sample.at >= at) { right = sample; break; }
      right = sample;
    }
    const alpha = right.at > left.at ? Math.max(0,Math.min(1,(at-left.at)/(right.at-left.at))) : 0;
    const position=this.target.position as THREE.Vector3, velocity=this.target.velocity as THREE.Vector3;
    const angular=this.target.angularVelocity as THREE.Vector3, rotation=this.target.rotation as THREE.Quaternion;
    position.copy(left.body.position).lerp(right.body.position as THREE.Vector3,alpha);
    velocity.copy(left.body.velocity).lerp(right.body.velocity as THREE.Vector3,alpha);
    angular.copy(left.body.angularVelocity).lerp(right.body.angularVelocity as THREE.Vector3,alpha);
    rotation.copy(left.body.rotation).slerp(this.rotation.copy(right.body.rotation),alpha).normalize();
    const age = Math.max(0,(at-right.at)/1_000);
    const extrapolation = Math.min(.05,age);
    position.addScaledVector(velocity,extrapolation);
    const speed=angular.length();
    if (speed > 0 && extrapolation > 0) {
      this.axis.copy(angular).multiplyScalar(1/speed);this.delta.setFromAxisAngle(this.axis,speed*extrapolation);
      rotation.premultiply(this.delta).normalize();
    }
    if (at < first.at || age > .05) { velocity.set(0,0,0);angular.set(0,0,0); }
    return this.target;
  }
  get size(): number { return this.samples.length; }
}
