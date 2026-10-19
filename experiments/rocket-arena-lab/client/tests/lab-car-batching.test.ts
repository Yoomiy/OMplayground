import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCarVisualRig } from '../src/renderer/car.js';

function vertices(root: THREE.Object3D) {
  const buckets = new Map<string, number[][]>();
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}`;
    const rows = buckets.get(key) ?? [];
    const geometry = object.geometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    for (let i = 0; i < (geometry.index?.count ?? p.count); i++) {
      const index = geometry.index?.getX(i) ?? i;
      const position = new THREE.Vector3().fromBufferAttribute(p, index).applyMatrix4(object.matrixWorld);
      const normal = new THREE.Vector3().fromBufferAttribute(n, index).applyNormalMatrix(normalMatrix);
      rows.push([...position.toArray(), ...normal.toArray()]);
    }
    buckets.set(key, rows);
  });
  for (const rows of buckets.values()) rows.sort((a,b) => {
    for (let i = 0; i < 6; i++) {
      const delta = Math.round(a[i] * 1e4) - Math.round(b[i] * 1e4);
      if (delta) return delta;
    }
    return 0;
  });
  return buckets;
}

test('batched car preserves material, shadow, position, normal and triangle budgets with animated wheels', () => {
  for (const team of ['blue', 'orange']) {
    const original = createCarVisualRig(team), batched = createCarVisualRig(team, { batchStatic:true });
    try {
      // Per-rig effect materials deliberately differ; omit them from the static comparison.
      for (const rig of [original, batched]) {
        for (const effect of [...rig.boostFlames, ...rig.boostTrails]) effect.removeFromParent();
        rig.frontWheelSteers.forEach(wheel => { wheel.rotation.y = .4; });
        rig.wheelSpins.forEach(wheel => { wheel.rotation.x = 1.2; });
      }
      const a = vertices(original.object), b = vertices(batched.object);
      assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort());
      for (const [key, rows] of a) {
        const other = b.get(key)!;
        assert.equal(rows.length, other.length, 'same triangle count per material');
        rows.forEach((row, i) => row.forEach((value, axis) => {
          assert.ok(Math.abs(value - other[i][axis]) < 1e-5, `${key} vertex ${i}, axis ${axis}`);
        }));
      }
      const meshes = (root:THREE.Object3D) => { let count=0; root.traverse(o => { if(o instanceof THREE.Mesh)count++; });return count; };
      assert.ok(meshes(original.object) - meshes(batched.object) >= 18);
      assert.equal(batched.wheelSpins.length,4); assert.equal(batched.frontWheelSteers.length,2);
    } finally { original.dispose(); batched.dispose(); }
  }
});

test('static batches share geometry and stay owned until the final car leaves', () => {
  const a=createCarVisualRig('blue',{batchStatic:true}), b=createCarVisualRig('blue',{batchStatic:true});
  const first=a.object.getObjectByName('static-body-batch') as THREE.Mesh;
  const second=b.object.getObjectByName('static-body-batch') as THREE.Mesh;
  assert.strictEqual(first.geometry,second.geometry);
  let disposals=0;first.geometry.addEventListener('dispose',()=>{disposals++;});
  a.dispose();assert.equal(disposals,0);b.dispose();assert.equal(disposals,1);b.dispose();assert.equal(disposals,1);
});
