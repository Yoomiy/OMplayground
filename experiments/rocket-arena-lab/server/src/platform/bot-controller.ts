import type { InputCommandV2 } from '@rocket-arena/shared';
import { createNeutralInputCommandV2, type AuthoritativeRoomProjection } from '../rooms/authoritative-room-core.js';

/** Typed port of scripts/bot-driver.mjs; one command per authoritative tick. */
export function createBotController(actorId: string, index: number, initial: Readonly<InputCommandV2>) {
  let jumpSequence = initial.jumpSequence;
  let jumping = false;
  const neutral = { ...createNeutralInputCommandV2(), cameraToggleSequence: initial.cameraToggleSequence };
  return (frame: Readonly<AuthoritativeRoomProjection>): InputCommandV2 => {
    const car = frame.cars.find(car => car.sessionId === actorId);
    if (!car || !['playing', 'overtime'].includes(frame.phase)) {
      return { ...neutral, jumpSequence };
    }
    const seconds = frame.fixedStepsCompleted / 60;
    const [qx, qy, qz, qw] = car.rotation;
    const fx = 2 * (qx * qz + qw * qy), fz = 1 - 2 * (qx * qx + qy * qy);
    const dx = frame.ball.position[0] + Math.sin(index * 2.4) * .7 - car.position[0];
    const dz = frame.ball.position[2] - car.position[2];
    const angle = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz);
    const nextJumping = (seconds + index * 1.3) % 11 > 10.85;
    if (nextJumping && !jumping) jumpSequence++;
    jumping = nextJumping;
    const speed = Math.hypot(car.linearVelocity[0], car.linearVelocity[2]);
    const reverse = speed < 2 && (seconds + index) % 9 > 7.8;
    return { ...neutral, throttle: reverse ? -1 : 1,
      steer: Math.max(-1, Math.min(1, angle * 2)) * (reverse ? -1 : 1),
      jumpHeld: jumping, jumpSequence,
      boostHeld: !reverse && Math.abs(angle) < .35 && speed < 30,
      powerslideHeld: Math.abs(angle) > 1.1 };
  };
}
