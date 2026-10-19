import * as THREE from 'three';
import { RESOLVED_ARENA_GEOMETRY, resolveBoostPadDescriptors } from '@rocket-arena/shared';
import { initScene, setRenderScale } from '../client/src/renderer/scene.js';
import { createLighting } from '../client/src/renderer/lighting.js';
import { createArena } from '../client/src/renderer/arena.js';
import { createBoostPadVisuals } from '../client/src/renderer/boost-pads.js';
import { createCarVisualRig } from '../client/src/renderer/car.js';
import { createBallVisualRig } from '../client/src/renderer/ball.js';

// Fixed scene/camera: all eight production models fit in view. Count submitted
// work only; software Chromium timing cannot forecast the tester's device FPS.
const { renderer, scene, camera, dispose: disposeScene } = initScene(document.body);
const lights = createLighting(scene, RESOLVED_ARENA_GEOMETRY);
const arena = createArena(scene, RESOLVED_ARENA_GEOMETRY);
const pads = createBoostPadVisuals(resolveBoostPadDescriptors()); scene.add(pads.object);
const ball = createBallVisualRig(); ball.object.position.set(0, 1, 0); scene.add(ball.object);
const cars = Array.from({ length: 16 }, (_, i) => {
  const rig = createCarVisualRig(i % 2 ? 'orange' : 'blue', { batchStatic: i < 8 });
  i %= 8;
  rig.object.position.set((i % 4 - 1.5) * 4, .6, Math.floor(i / 4) * 6 - 3);
  rig.object.rotation.y = i % 2 ? Math.PI : 0;
  scene.add(rig.object); return rig;
});
camera.position.set(0, 11, -23); camera.lookAt(0, 0, 0);

export function configure(players: number, quality: 'standard' | 'low', boosting: boolean, batched = true): void {
  setRenderScale(quality === 'low' ? .7 : 1);
  arena.exteriorPresentation.visible = quality === 'standard';
  cars.forEach((rig, index) => {
    rig.object.visible = (batched ? index < 8 : index >= 8) && index % 8 < players;
    for (const effect of [...rig.boostFlames, ...rig.boostTrails]) {
      effect.visible = boosting;
      const materials = Array.isArray(effect.material) ? effect.material : [effect.material];
      for (const material of materials) material.opacity = .7;
    }
  });
}

export function frame() {
  renderer.render(scene, camera);
  return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    canvasWidth: renderer.domElement.width, canvasHeight: renderer.domElement.height,
    visibleCars: cars.filter(rig => rig.object.visible).length };
}

export function dispose(): void {
  for (const rig of cars) rig.dispose(); ball.dispose(); pads.dispose(); arena.dispose();
  lights.traverse(object => { if (object instanceof THREE.Light) object.dispose(); });
  scene.clear(); disposeScene();
}
