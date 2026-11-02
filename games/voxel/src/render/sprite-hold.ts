import * as THREE from 'three';

/** Adapted from Blockyard firstperson/poses.ts: armChain + attachedRest, right hand at rest.
 * Copyright 2026 Patrick Blais, MIT. See public/blockyard-LICENSE.txt and UPSTREAM.md. */
export function spriteHoldPose(tool: boolean) {
  const degree = Math.PI / 180;
  const arm = new THREE.Matrix4(),
    m = new THREE.Matrix4();
  const translate = (x: number, y: number, z: number) => arm.multiply(m.makeTranslation(x, y, z));
  const rotate = (axis: 'X' | 'Y' | 'Z', degrees: number) =>
    arm.multiply(
      axis === 'X'
        ? m.makeRotationX(degrees * degree)
        : axis === 'Y'
          ? m.makeRotationY(degrees * degree)
          : m.makeRotationZ(degrees * degree),
    );
  // Original armChain(side=1, swing=0, drop=0), post-multiplied in the same order.
  translate(0.64, -0.6, -0.72);
  rotate('Y', 45);
  translate(-1, 3.6, 3.5);
  rotate('Z', 120);
  rotate('X', 200);
  rotate('Y', -135);
  translate(5.6, 0, 0);
  translate(-5 / 16, 2 / 16, 0);
  rotate('Z', 0.1 / degree);
  const fist = new THREE.Vector3(-1 / 16, 8.5 / 16, 0).applyMatrix4(arm);
  const armMatrix = arm
    .clone()
    .multiply(m.makeTranslation(-1 / 16, 4 / 16, 0))
    .multiply(m.makeRotationX(Math.PI));
  const armCenter = new THREE.Vector3(),
    armRotation = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  armMatrix.decompose(armCenter, armRotation, scale);
  const itemRotation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4()
      .makeRotationY((tool ? -90 : -60) * degree)
      .multiply(m.makeRotationZ((tool ? 25 : 20) * degree)),
  );
  const pixel = tool ? [3, 12.5] : [8, 13];
  const gripLocal = new THREE.Vector3(pixel[0] / 16 - 0.5, 0.5 - pixel[1] / 16, 0);
  const itemScale = tool ? 0.68 : 0.55;
  const itemPosition = gripLocal.clone().multiplyScalar(-itemScale).applyQuaternion(itemRotation);
  return {
    fist,
    armOffset: armCenter.sub(fist),
    armRotation,
    itemRotation,
    itemScale,
    gripLocal,
    itemPosition,
  };
}
export const SPRITE_HOLD = { tool: spriteHoldPose(true), item: spriteHoldPose(false) };
