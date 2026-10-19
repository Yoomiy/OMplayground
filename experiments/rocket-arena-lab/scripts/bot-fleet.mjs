import { driveBot } from './bot-driver.mjs';

/** Real loopback clients. Never creates rooms, starts matches or changes rules. */
export class PracticeBotFleet {
  groups = new Map();
  stopped = false;
  polling = false;
  constructor(client, maxRooms = 2, log = console.info) {
    this.client = client; this.maxRooms = maxRooms; this.log = log;
  }
  async discover() {
    if (this.stopped || this.polling) return;
    this.polling = true;
    try {
      const rooms = await this.client.getAvailableRooms('custom');
      for (const listing of rooms) {
        const count = listing.metadata?.labBotCount;
        if (this.stopped || this.groups.size >= this.maxRooms) break;
        if (![1, 7].includes(count) || this.groups.has(listing.roomId)) continue;
        const group = { id: listing.roomId, bots: [], ready: false, closed: false,
          frame: null, frameAt: performance.now(), began: performance.now() };
        this.groups.set(group.id, group);
        try {
          for (let i = 0; i < count && !group.closed && !this.stopped; i++) {
            const room = await this.client.joinById(group.id, { name: `Lab Bot ${i + 1}` });
            if (group.closed || this.stopped) { await room.leave(); break; }
            group.bots.push({ room, index: i + 1, sequence: 0, jumpSequence: 0, jumping: false });
            room.onMessage('*', () => {});
            if (i === 0) room.onMessage('prediction-state', frame => {
              group.frame = frame; group.frameAt = performance.now();
              if (!group.ready) return;
              const botIds = new Set(group.bots.map(bot => bot.room.sessionId));
              if (!frame.cars.some(car => !botIds.has(car.sessionId))) void this.close(group);
            });
            room.onLeave(() => { void this.close(group); });
          }
          group.ready = !group.closed && group.bots.length === count;
          if (group.ready) this.log(`[LabBots] room=${group.id} ready=${count}`);
        } catch (error) {
          this.log(`[LabBots] room=${group.id} join failed: ${error.message}`);
          await this.close(group);
        }
      }
    } finally { this.polling = false; }
  }
  tick(now = performance.now()) {
    for (const group of this.groups.values()) {
      if (now - group.frameAt > 5_000) { void this.close(group); continue; }
      if (!group.ready || !group.frame) continue;
      for (const bot of group.bots) {
        if (!bot.room.connection.isOpen) { void this.close(group); break; }
        try { bot.room.send('lab-input', { sequence: ++bot.sequence,
          command: driveBot(bot, group.frame, (now - group.began) / 1_000) }); }
        catch { void this.close(group); break; }
      }
    }
  }
  async close(group) {
    if (group.closed) return;
    group.closed = true; this.groups.delete(group.id);
    await Promise.allSettled(group.bots.map(bot => bot.room.leave()));
    this.log(`[LabBots] room=${group.id} stopped`);
  }
  async stop() {
    this.stopped = true;
    await Promise.allSettled([...this.groups.values()].map(group => this.close(group)));
  }
}
