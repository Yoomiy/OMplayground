/*! Blockyard, copyright 2026 Patrick Blais. MIT; see public/blockyard-LICENSE.txt.
 * Source: https://github.com/Potrock/blockyard/tree/a79346108fc5ed3b68e3827608fdb448e5a7e5db
 * Imported by tools/import-blockyard-art.mjs; only module paths adapted. */
import * as THREE from 'three';
type Atlas = { pixels: Uint8Array; width: number; height: number };
export function extrudeSprite(a: Atlas, sx: number, sy: number): THREE.BufferGeometry {
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && a.pixels[((sy + y) * a.width + sx + x) * 4 + 3] > 127;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const t = 1 / 32; // half thickness (1 texel)
  const quad = (p: number[][], n: number[], uvq: number[][]) => {
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      pos.push(...p[k]);
      nrm.push(...n);
      uvs.push(...uvq[k]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const U = (x: number) => (sx + x) / a.width;
  const V = (y: number) => (sy + y) / a.height;
  // Sprite space: x right, y up; texel (tx, ty) row 0 at the top.
  const X = (tx: number) => tx / 16 - 0.5;
  const Y = (ty: number) => 0.5 - ty / 16;
  quad(
    [[X(0), Y(16), t], [X(16), Y(16), t], [X(16), Y(0), t], [X(0), Y(0), t]],
    [0, 0, 1],
    [[U(0), V(16)], [U(16), V(16)], [U(16), V(0)], [U(0), V(0)]],
  );
  quad(
    [[X(16), Y(16), -t], [X(0), Y(16), -t], [X(0), Y(0), -t], [X(16), Y(0), -t]],
    [0, 0, -1],
    [[U(16), V(16)], [U(0), V(16)], [U(0), V(0)], [U(16), V(0)]],
  );
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      if (!opaque(tx, ty)) continue;
      const cu = U(tx + 0.5);
      const cv = V(ty + 0.5);
      const c = [[cu, cv], [cu, cv], [cu, cv], [cu, cv]];
      const x0 = X(tx), x1 = X(tx + 1), y0 = Y(ty + 1), y1 = Y(ty);
      if (!opaque(tx - 1, ty)) quad([[x0, y0, -t], [x0, y0, t], [x0, y1, t], [x0, y1, -t]], [-1, 0, 0], c);
      if (!opaque(tx + 1, ty)) quad([[x1, y0, t], [x1, y0, -t], [x1, y1, -t], [x1, y1, t]], [1, 0, 0], c);
      if (!opaque(tx, ty - 1)) quad([[x0, y1, t], [x1, y1, t], [x1, y1, -t], [x0, y1, -t]], [0, 1, 0], c);
      if (!opaque(tx, ty + 1)) quad([[x0, y0, -t], [x1, y0, -t], [x1, y0, t], [x0, y0, t]], [0, -1, 0], c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

