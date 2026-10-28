import type { ActorState, ActorDelta } from '../shared/protocol.ts';
import type { AvatarPose } from '../render/avatars.ts';
type Sample = { time: number; state: number[]; yaw: number; pitch: number };
export class RemoteActors {
  private actors = new Map<string, { latest: ActorState; samples: Sample[] }>();
  private offset: number | null = null;
  join(actor: ActorState, time: number): void {
    this.actors.set(actor.id, {
      latest: actor,
      samples: [
        { time: time + (this.offset ?? 0), state: actor.state, yaw: actor.yaw, pitch: actor.pitch },
      ],
    });
  }
  remove(id: string): void {
    this.actors.delete(id);
  }
  snapshot(deltas: ActorDelta[], serverTime: number, clientTime: number): void {
    if (this.offset === null)
      for (const actor of this.actors.values())
        for (const sample of actor.samples) sample.time = serverTime;
    const offset = serverTime - clientTime;
    // Network/renderer delay lowers (server - receipt) time. Prefer the least delayed
    // observation; a delayed frame must not shift every actor seconds into the past.
    this.offset = this.offset === null ? offset : Math.max(offset, this.offset - 0.25);
    for (const delta of deltas) {
      const actor = this.actors.get(delta.id);
      if (!actor) continue;
      actor.latest = { ...actor.latest, ...delta };
      actor.samples.push({
        time: serverTime,
        state: actor.latest.state,
        yaw: actor.latest.yaw,
        pitch: actor.latest.pitch,
      });
      while (actor.samples.length > 32) actor.samples.shift();
    }
  }
  frame(now: number): AvatarPose[] {
    const time = now + (this.offset ?? 0) - 125,
      out: AvatarPose[] = [];
    for (const [id, actor] of this.actors) {
      const samples = actor.samples;
      while (samples.length > 2 && samples[1].time < time) samples.shift();
      const a = samples[0],
        b = samples[1] ?? a,
        span = b.time - a.time,
        t = span > 0 ? Math.max(0, Math.min(1, (time - a.time) / span)) : 0;
      const position = a.state.slice(0, 3).map((v, i) => v + (b.state[i] - v) * t);
      if (time > b.time && b.state[12] !== 1) {
        const dt = Math.min(0.1, Math.max(0, (time - b.time) / 1000));
        for (let i = 0; i < 3; i++) position[i] = b.state[i] + b.state[i + 3] * dt;
      }
      const angle = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
      out.push({
        id,
        position,
        yaw: a.yaw + angle * t,
        pitch: a.pitch + (b.pitch - a.pitch) * t,
        speed: b.state[12] === 1 ? 0 : Math.hypot(b.state[3], b.state[5]),
        flying: b.state[10] === 1,
        appearance: actor.latest.appearance,
      });
    }
    return out;
  }
  clear(): void {
    this.actors.clear();
    this.offset = null;
  }
  get size(): number {
    return this.actors.size;
  }
}
