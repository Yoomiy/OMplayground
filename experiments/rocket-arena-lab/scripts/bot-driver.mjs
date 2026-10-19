/** Simple ball pursuit for load/playtests, not competitive game AI. No physics. */
export const neutral = Object.freeze({ protocolVersion: 2, throttle: 0, steer: 0, pitch: 0, roll: 0, yaw: 0,
  jumpHeld: false, jumpSequence: 0, boostHeld: false, powerslideHeld: false, cameraToggleSequence: 0 });

export function driveBot(bot, frame, seconds) {
  const car = frame?.cars.find(car => car.sessionId === bot.room.sessionId);
  if (!car || !['playing', 'overtime'].includes(frame.phase)) return { ...neutral, jumpSequence: bot.jumpSequence };
  const q = car.rotation, fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const dx = frame.ball.position.x + Math.sin(bot.index * 2.4) * .7 - car.position.x;
  const dz = frame.ball.position.z - car.position.z;
  const angle = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz);
  const jumping = (seconds + bot.index * 1.3) % 11 > 10.85;
  if (jumping && !bot.jumping) bot.jumpSequence++;
  bot.jumping = jumping;
  const speed = Math.hypot(car.velocity.x, car.velocity.z);
  const reverse = speed < 2 && (seconds + bot.index) % 9 > 7.8;
  return { ...neutral, throttle: reverse ? -1 : 1,
    steer: Math.max(-1, Math.min(1, angle * 2)) * (reverse ? -1 : 1),
    jumpHeld: jumping, jumpSequence: bot.jumpSequence,
    boostHeld: !reverse && Math.abs(angle) < .35 && speed < 30,
    powerslideHeld: Math.abs(angle) > 1.1 };
}
