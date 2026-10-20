import * as THREE from 'three';
import { PoseTimeline } from './pose-timeline.js';
import type { BodyState } from '@rocket-arena/simulation/protocol';

const MAX_EXTRAPOLATION_SECONDS = .05;
const CORRECTION_RATE = 18;
const HARD_SNAP_METERS = 3;

/** One render clock and last displayed pose; packet arrival never restarts a lerp. */
export class PresentationFilter {
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Quaternion();
  private velocity = new THREE.Vector3();
  private angularVelocity = new THREE.Vector3();
  private targetVelocity = new THREE.Vector3();
  private targetAngularVelocity = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private targetRotation = new THREE.Quaternion();
  private deltaRotation = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  private lastAtMs: number | null = null;
  private timeline = new PoseTimeline();
  private buffered = false;
  constructor(private readonly bufferMs = 0) {}

  reset(): void { this.lastAtMs = null; this.timeline.reset(); }

  push(body: BodyState, sampledAtMs: number): void {
    if (!this.buffered) { this.timeline.reset();this.buffered=true; }
    if (this.timeline.push(body,sampledAtMs)) this.lastAtMs=null;
  }

  private advanceRotation(rotation: THREE.Quaternion, velocity: THREE.Vector3, seconds: number): void {
    const speed = velocity.length();
    if (speed > 0 && seconds > 0) {
      this.axis.copy(velocity).multiplyScalar(1/speed);
      this.deltaRotation.setFromAxisAngle(this.axis,speed*seconds);
      rotation.premultiply(this.deltaRotation).normalize();
    }
  }

  sample(body: BodyState, sampledAtMs: number, nowMs: number, buffered = this.bufferMs > 0): void {
    if (buffered !== this.buffered) { this.timeline.reset(); this.buffered = buffered; }
    if (buffered) {
      this.push(body,sampledAtMs);
      body = this.timeline.read(nowMs-this.bufferMs);
      sampledAtMs = nowMs; // The timeline already applied bounded extrapolation.
    }
    // The pose belongs to the input/snapshot sample, not worker completion time.
    const age = Math.min(MAX_EXTRAPOLATION_SECONDS, Math.max(0,(nowMs-sampledAtMs)/1_000));
    this.targetPosition.set(body.position.x,body.position.y,body.position.z)
      .addScaledVector(this.targetVelocity.set(body.velocity.x,body.velocity.y,body.velocity.z),age);
    this.targetRotation.set(body.rotation.x,body.rotation.y,body.rotation.z,body.rotation.w).normalize();
    this.targetAngularVelocity.set(body.angularVelocity.x,body.angularVelocity.y,body.angularVelocity.z);
    this.advanceRotation(this.targetRotation,this.targetAngularVelocity,age);
    if (this.lastAtMs === null || nowMs < this.lastAtMs || nowMs-this.lastAtMs > 150) {
      this.position.copy(this.targetPosition);this.rotation.copy(this.targetRotation);
    } else {
      const dt = Math.min(this.bufferMs > 0 ? .15 : MAX_EXTRAPOLATION_SECONDS,
        Math.max(0,(nowMs-this.lastAtMs)/1_000));
      this.position.addScaledVector(this.velocity,dt);
      this.advanceRotation(this.rotation,this.angularVelocity,dt);
      if (this.position.distanceTo(this.targetPosition) >= HARD_SNAP_METERS) {
        this.position.copy(this.targetPosition);this.rotation.copy(this.targetRotation);
      } else {
        const alpha = 1-Math.exp(-CORRECTION_RATE*dt);
        this.position.lerp(this.targetPosition,alpha);
        this.rotation.slerp(this.targetRotation,alpha).normalize();
      }
    }
    this.velocity.set(body.velocity.x,body.velocity.y,body.velocity.z);
    this.angularVelocity.copy(this.targetAngularVelocity);
    this.lastAtMs=nowMs;
  }
}
