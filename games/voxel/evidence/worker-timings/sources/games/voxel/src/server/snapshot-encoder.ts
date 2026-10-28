import type { ActorDelta, ServerMessage } from '../shared/protocol.ts';

/** GameRoom owns immutable delta objects for one synchronous snapshot pass.
 * Reuse their JSON across viewers, while encoding each viewer's self independently.
 * Paused observer snapshots share a world tick, so both tick and time delimit a pass.
 */
export class SnapshotEncoder {
  private tick = -1;
  private time = -Infinity;
  private header = '';
  private actors = new WeakMap<ActorDelta, string>();

  encode(event: ServerMessage): string {
    if (event.type !== 'snapshot') return JSON.stringify(event);
    if (event.tick !== this.tick || event.time !== this.time) {
      this.tick = event.tick;
      this.time = event.time;
      this.header = `{"type":"snapshot","time":${JSON.stringify(event.time)},"tick":${JSON.stringify(event.tick)}`;
      this.actors = new WeakMap();
    }
    const actors = event.actors.map((actor) => {
      let text = this.actors.get(actor);
      if (text === undefined) {
        text = JSON.stringify(actor);
        this.actors.set(actor, text);
      }
      return text;
    });
    const self = event.self === undefined ? '' : `,"self":${JSON.stringify(event.self)}`;
    return `${this.header}${self},"actors":[${actors.join(',')}]}`;
  }
}
