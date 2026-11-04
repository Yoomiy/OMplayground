import type { WorldPort } from '../shared/engine-port.ts';

export const MAX_CAMERA_DISTANCE = 6;
export type CameraView = { eye: [number, number, number]; distance: number };

/** Presentation only: sweep a small camera volume along the view line. No player is moved. */
export function cameraView(
  world: Pick<WorldPort, 'sweep_body'>,
  position: readonly number[],
  yaw: number,
  pitch: number,
  requested: number,
): CameraView {
  const start: [number, number, number] = [position[0], position[1] + 1.62, position[2]];
  const distance = Math.max(0, Math.min(MAX_CAMERA_DISTANCE, requested));
  const direction = [
    -Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ];
  let eye = start,
    reached = 0;
  // A stopped sweep stays on the original view line rather than sliding around
  // a corner. The volume also protects the camera's near plane at wide aspects.
  for (let step = 1; step <= Math.ceil(distance / 0.25); step++) {
    const along = Math.min(distance, step * 0.25);
    const next = start.map((value, axis) => value + direction[axis] * along) as [
      number,
      number,
      number,
    ];
    const moved = world.sweep_body(
      eye[0],
      eye[1] - 0.12,
      eye[2],
      next[0] - eye[0],
      next[1] - eye[1],
      next[2] - eye[2],
      0.12,
      0.24,
    );
    if (next.some((value, axis) => Math.abs(value - moved[axis] - (axis === 1 ? 0.12 : 0)) > 1e-5))
      break;
    eye = next;
    reached = along;
  }
  return { eye, distance: reached };
}
