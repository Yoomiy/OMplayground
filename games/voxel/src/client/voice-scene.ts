/** Semantic media values only: no renderer, WebAudio, SDK or native handles. */
export type VoicePoint = readonly [number, number, number];
export type VoiceScene = Readonly<{
  listener: Readonly<{ position: VoicePoint; forward: VoicePoint; up: VoicePoint }>;
  sources: readonly Readonly<{
    id: string;
    position: VoicePoint;
    gain: number;
    occluded: boolean;
  }>[];
}>;
export const VOICE_RADIUS = 32;
const point = (v: readonly number[]): v is VoicePoint => v.length === 3 && v.every(Number.isFinite);
/** Absolute double-precision positions preserve the same world axes through origin shifts. */
export function voiceScene(
  position: readonly number[],
  yaw: number,
  pitch: number,
  actors: readonly Readonly<{ id: string; position: readonly number[] }>[],
  clear: (from: VoicePoint, to: VoicePoint) => boolean,
): VoiceScene | null {
  if (!point(position) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  const eye: VoicePoint = [position[0], position[1] + 1.62, position[2]],
    cos = Math.cos(pitch);
  const sources: VoiceScene['sources'][number][] = [];
  for (const actor of actors) {
    if (!actor.id || !point(actor.position)) continue;
    const to: VoicePoint = [actor.position[0], actor.position[1] + 1.62, actor.position[2]],
      distance = Math.hypot(to[0] - eye[0], to[1] - eye[1], to[2] - eye[2]);
    let gain = 0,
      occluded = false;
    if (distance < VOICE_RADIUS) {
      const t = Math.max(0, Math.min(1, (distance - 2) / (VOICE_RADIUS - 2)));
      gain = 1 - t * t * (3 - 2 * t);
      try {
        occluded = !clear(eye, to);
      } catch {
        return null;
      }
      if (occluded) gain *= 0.16;
    }
    sources.push({ id: actor.id, position: to, gain, occluded });
  }
  return {
    listener: {
      position: eye,
      forward: [Math.sin(yaw) * cos, Math.sin(pitch), -Math.cos(yaw) * cos],
      up: [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)],
    },
    sources,
  };
}
