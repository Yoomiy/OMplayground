// src/sim/action-ledger.ts
var ActionLedger = class {
  currentEpoch;
  highWater = 0;
  results = /* @__PURE__ */ new Map();
  capacity;
  constructor(epoch, capacity = 128) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("invalid cache capacity");
    this.currentEpoch = epoch;
    this.capacity = capacity;
  }
  get boundary() {
    return this.highWater;
  }
  run(epoch, sequence, apply) {
    if (epoch !== this.currentEpoch) return { status: "stale_epoch" };
    if (!Number.isSafeInteger(sequence) || sequence <= 0) return { status: "invalid" };
    if (this.results.has(sequence)) return { status: "cached", value: this.results.get(sequence) };
    if (sequence <= this.highWater) return { status: "retired" };
    this.highWater = sequence;
    const value = apply();
    this.results.set(sequence, value);
    if (this.results.size > this.capacity) this.results.delete(this.results.keys().next().value);
    return { status: "applied", value };
  }
  reset(epoch) {
    if (!Number.isSafeInteger(epoch) || epoch <= this.currentEpoch)
      throw new Error("epoch must advance");
    this.currentEpoch = epoch;
    this.highWater = 0;
    this.results.clear();
  }
};

// src/shared/staff.ts
function readStaffCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value;
  if (Object.keys(v).length !== 2) return null;
  if (v.kind === "mode" && ["creative", "survival"].includes(v.mode))
    return Object.freeze({ kind: "mode", mode: v.mode });
  if (v.kind === "teleport" && typeof v.target === "string" && v.target.length > 0 && v.target.length <= 128)
    return Object.freeze({ kind: "teleport", target: v.target });
  return null;
}

// src/server/room-worker.ts
import { parentPort, workerData } from "node:worker_threads";

// engine/pkg/voxel_engine.js
var ChunkMesher = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ChunkMesherFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_chunkmesher_free(ptr, 0);
  }
  /**
   * @param {Uint8Array} region
   * @returns {Uint32Array}
   */
  mesh(region) {
    const ptr0 = passArray8ToWasm0(region, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.chunkmesher_mesh(this.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
  }
  constructor() {
    const ret = wasm.chunkmesher_new();
    this.__wbg_ptr = ret;
    ChunkMesherFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
};
if (Symbol.dispose) ChunkMesher.prototype[Symbol.dispose] = ChunkMesher.prototype.free;
var Culler = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    CullerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_culler_free(ptr, 0);
  }
  /**
   * Slot capacity; output arrays hold 6 (main) / 4 (shadow) words per slot.
   * @returns {number}
   */
  capacity() {
    const ret = wasm.culler_capacity(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {Float64Array} vp
   * @param {number} cx
   * @param {number} cy
   * @param {number} cz
   * @param {number} radius
   * @param {boolean} occlusion
   */
  cull(vp, cx, cy, cz, radius, occlusion) {
    const ptr0 = passArrayF64ToWasm0(vp, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.culler_cull(this.__wbg_ptr, ptr0, len0, cx, cy, cz, radius, occlusion);
  }
  /**
   * @param {Float64Array} vp
   * @param {number} cx
   * @param {number} cy
   * @param {number} cz
   * @param {number} radius
   */
  cull_shadow(vp, cx, cy, cz, radius) {
    const ptr0 = passArrayF64ToWasm0(vp, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.culler_cull_shadow(this.__wbg_ptr, ptr0, len0, cx, cy, cz, radius);
  }
  constructor() {
    const ret = wasm.culler_new();
    this.__wbg_ptr = ret;
    CullerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @returns {number}
   */
  out_ptr() {
    const ret = wasm.culler_out_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  out_shadow_ptr() {
    const ret = wasm.culler_out_shadow_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {number} cx
   * @param {number} cz
   */
  remove_column(cx, cz) {
    wasm.culler_remove_column(this.__wbg_ptr, cx, cz);
  }
  /**
   * @param {number} cx
   * @param {number} cz
   * @param {Uint32Array} header
   * @returns {number}
   */
  set_column(cx, cz, header) {
    const ptr0 = passArray32ToWasm0(header, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.culler_set_column(this.__wbg_ptr, cx, cz, ptr0, len0);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  visible_sections() {
    const ret = wasm.culler_visible_sections(this.__wbg_ptr);
    return ret >>> 0;
  }
};
if (Symbol.dispose) Culler.prototype[Symbol.dispose] = Culler.prototype.free;
var TerrainGen = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TerrainGenFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_terraingen_free(ptr, 0);
  }
  /**
   * Stamp a game structure during generation. `data` is (y * sz + z) * sx + x; 65535 = keep.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} sx
   * @param {number} sy
   * @param {number} sz
   * @param {Uint16Array} data
   */
  add_blueprint(ox, oy, oz, sx, sy, sz, data2) {
    const ptr0 = passArray16ToWasm0(data2, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.terraingen_add_blueprint(this.__wbg_ptr, ox, oy, oz, sx, sy, sz, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Flatten terrain to `height` inside `radius`, blending over `blend` blocks.
   * @param {number} cx
   * @param {number} cz
   * @param {number} radius
   * @param {number} blend
   * @param {number} height
   */
  add_terraform(cx, cz, radius, blend, height) {
    wasm.terraingen_add_terraform(this.__wbg_ptr, cx, cz, radius, blend, height);
  }
  /**
   * [x, y, z] of a pleasant spawn column.
   * @returns {Int32Array}
   */
  find_spawn() {
    const ret = wasm.terraingen_find_spawn(this.__wbg_ptr);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @param {number} cx
   * @param {number} cz
   * @returns {Uint8Array}
   */
  generate(cx, cz) {
    const ret = wasm.terraingen_generate(this.__wbg_ptr, cx, cz);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @param {number} seed
   */
  constructor(seed) {
    const ret = wasm.terraingen_new(seed);
    this.__wbg_ptr = ret;
    TerrainGenFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @param {number} height
   */
  set_flat(height) {
    wasm.terraingen_set_flat(this.__wbg_ptr, height);
  }
  set_void() {
    wasm.terraingen_set_void(this.__wbg_ptr);
  }
  /**
   * @param {number} y
   * @param {number} top
   * @param {number} fill
   * @param {number} depth
   */
  set_void_ground(y, top, fill, depth) {
    wasm.terraingen_set_void_ground(this.__wbg_ptr, y, top, fill, depth);
  }
};
if (Symbol.dispose) TerrainGen.prototype[Symbol.dispose] = TerrainGen.prototype.free;
var VoxelWorld = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    VoxelWorldFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_voxelworld_free(ptr, 0);
  }
  /**
   * Damage from the simulation's copy of the world (`carve`'s changes, `export_damage`), here
   * too. Returns the loaded columns whose meshes change: [cx, cz, relight] triples, relight 1
   * where a block went altogether (remesh around it: its light changed).
   * @param {Uint8Array} data
   * @returns {Int32Array}
   */
  apply_damage(data2) {
    const ptr0 = passArray8ToWasm0(data2, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.voxelworld_apply_damage(this.__wbg_ptr, ptr0, len0);
    var v2 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
  }
  /**
   * A blast's crater (`World::blast`): a ragged sphere of little voxels `radius` round (x, y, z),
   * its edge wandering by `roughness` of that (the same for the same `seed`), out of the
   * carvable blocks among `cells` (x, y, z triples). Returns what `carve` returns.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   * @param {number} roughness
   * @param {number} seed
   * @param {Int32Array} cells
   * @returns {Uint8Array}
   */
  blast(x, y, z, radius, roughness, seed, cells) {
    const ptr0 = passArray32ToWasm0(cells, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.voxelworld_blast(this.__wbg_ptr, x, y, z, radius, roughness, seed, ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
  }
  /**
   * @returns {number}
   */
  bodies_ptr() {
    const ret = wasm.voxelworld_bodies_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  body_capacity() {
    const ret = wasm.voxelworld_body_capacity(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * [ride, x, y, z] for an entity body: the mover it rides (0 for none) and where it is on it.
   * @param {number} i
   * @returns {Float64Array}
   */
  body_ride(i) {
    const ret = wasm.voxelworld_body_ride(this.__wbg_ptr, i);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @returns {number}
   */
  body_stride() {
    const ret = wasm.voxelworld_body_stride(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Whether `carve` and `blast` can take bits out of the block at (x, y, z).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  carvable(x, y, z) {
    const ret = wasm.voxelworld_carvable(this.__wbg_ptr, x, y, z);
    return ret !== 0;
  }
  /**
   * Take a capsule of little voxels out of the destructible blocks it reaches: from (x, y, z)
   * along (dx, dy, dz) for `depth` blocks, `radius` round. Returns [removed u32, n u32, then n
   * blocks left with nothing (air now, an edit) as x, y, z, the block it was (i32 each), then
   * the changes to the rest for other copies of the world (`apply_damage`)], little-endian.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} radius
   * @param {number} depth
   * @returns {Uint8Array}
   */
  carve(x, y, z, dx, dy, dz, radius, depth) {
    const ret = wasm.voxelworld_carve(this.__wbg_ptr, x, y, z, dx, dy, dz, radius, depth);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  clear_edits() {
    wasm.voxelworld_clear_edits(this.__wbg_ptr);
  }
  /**
   * How high the collision of the block at (x, y, z) reaches above the bottom of its cell, in
   * blocks: 0 if nothing there is solid, 1 for a full block, 0.5 for a bottom slab, 1.5 for a
   * fence; a fence as it's joined there, a carved block as what's left of it. Unloaded columns
   * count as solid.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  collision_top(x, y, z) {
    const ret = wasm.voxelworld_collision_top(this.__wbg_ptr, x, y, z);
    return ret;
  }
  /**
   * @returns {number}
   */
  column_count() {
    const ret = wasm.voxelworld_column_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * How many blocks are damaged.
   * @returns {number}
   */
  damage_count() {
    const ret = wasm.voxelworld_damage_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * How many of a block's 4096 little voxels are left: fewer once it's been carved, 4096 for
   * a block that hasn't (whatever it is).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  damage_left(x, y, z) {
    const ret = wasm.voxelworld_damage_left(this.__wbg_ptr, x, y, z);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  edit_count() {
    const ret = wasm.voxelworld_edit_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * All the damage, for `apply_damage` in a copy of the world that has none (a late joiner).
   * @returns {Uint8Array}
   */
  export_damage() {
    const ret = wasm.voxelworld_export_damage(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {Uint8Array}
   */
  export_edits() {
    const ret = wasm.voxelworld_export_edits(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @param {number} cx
   * @param {number} cz
   * @returns {Uint8Array}
   */
  extract_region(cx, cz) {
    const ret = wasm.voxelworld_extract_region(this.__wbg_ptr, cx, cz);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * `extract_region` for a world drawn repeated along x (`period` columns from column `x0`): a
   * neighbour past either end is the column at the other end.
   * @param {number} cx
   * @param {number} cz
   * @param {number} x0
   * @param {number} period
   * @returns {Uint8Array}
   */
  extract_region_wrapped(cx, cz, x0, period) {
    const ret = wasm.voxelworld_extract_region_wrapped(this.__wbg_ptr, cx, cz, x0, period);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @param {number} cx
   * @param {number} cz
   */
  forget_column(cx, cz) {
    wasm.voxelworld_forget_column(this.__wbg_ptr, cx, cz);
  }
  /**
   * Block id; 65535 when the column is not loaded.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  get_block(x, y, z) {
    const ret = wasm.voxelworld_get_block(this.__wbg_ptr, x, y, z);
    return ret;
  }
  /**
   * @param {number} cx
   * @param {number} cz
   * @returns {boolean}
   */
  has_column(cx, cz) {
    const ret = wasm.voxelworld_has_column(this.__wbg_ptr, cx, cz);
    return ret !== 0;
  }
  /**
   * @param {Uint8Array} data
   */
  import_edits(data2) {
    const ptr0 = passArray8ToWasm0(data2, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.voxelworld_import_edits(this.__wbg_ptr, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * @param {number} cx
   * @param {number} cz
   * @param {Uint8Array} data
   */
  insert_column(cx, cz, data2) {
    const ptr0 = passArray8ToWasm0(data2, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.voxelworld_insert_column(this.__wbg_ptr, cx, cz, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * [sky, block] light estimate (0..1) at a block position.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Float32Array}
   */
  light_probe(x, y, z) {
    const ret = wasm.voxelworld_light_probe(this.__wbg_ptr, x, y, z);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * Whether the segment between two points is free of solid blocks.
   * @param {number} ax
   * @param {number} ay
   * @param {number} az
   * @param {number} bx
   * @param {number} by
   * @param {number} bz
   * @returns {boolean}
   */
  line_clear(ax, ay, az, bx, by, bz) {
    const ret = wasm.voxelworld_line_clear(this.__wbg_ptr, ax, ay, az, bx, by, bz);
    return ret !== 0;
  }
  /**
   * An edit from the simulation's copy of the world: applied now if loaded, else when the
   * column loads. True if the block changed now.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} b
   * @returns {boolean}
   */
  mirror_block(x, y, z, b) {
    const ret = wasm.voxelworld_mirror_block(this.__wbg_ptr, x, y, z, b);
    return ret !== 0;
  }
  /**
   * Add (or replace) a mover: `cells` holds 1 for each solid cell of an `sx` x `sy` x `sz` grid
   * (index `(y * sz + z) * sx + x`); the model's origin is at grid point (`px`, `py`, `pz`) and
   * a cell is `unit` model units across.
   * @param {number} id
   * @param {number} sx
   * @param {number} sy
   * @param {number} sz
   * @param {Uint16Array} cells
   * @param {number} px
   * @param {number} py
   * @param {number} pz
   * @param {number} unit
   */
  mover_add(id, sx, sy, sz, cells, px, py, pz, unit) {
    const ptr0 = passArray16ToWasm0(cells, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.voxelworld_mover_add(this.__wbg_ptr, id, sx, sy, sz, ptr0, len0, px, py, pz, unit);
  }
  /**
   * The mover whose cells hold this point, or 0.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  mover_at(x, y, z) {
    const ret = wasm.voxelworld_mover_at(this.__wbg_ptr, x, y, z);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  mover_count() {
    const ret = wasm.voxelworld_mover_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * How many of a mover's blocks would be in the world's solid blocks with it at this pose
   * (position, rotation, scale): 0 when it's clear.
   * @param {number} id
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} qx
   * @param {number} qy
   * @param {number} qz
   * @param {number} qw
   * @param {number} scale
   * @returns {number}
   */
  mover_overlap(id, x, y, z, qx, qy, qz, qw, scale) {
    const ret = wasm.voxelworld_mover_overlap(this.__wbg_ptr, id, x, y, z, qx, qy, qz, qw, scale);
    return ret >>> 0;
  }
  /**
   * Where a mover is now: position, rotation (unit quaternion) and scale. `snap` places it
   * without motion (new, teleported): nothing riding it is carried and nobody is pushed.
   * @param {number} id
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} qx
   * @param {number} qy
   * @param {number} qz
   * @param {number} qw
   * @param {number} scale
   * @param {boolean} snap
   */
  mover_pose(id, x, y, z, qx, qy, qz, qw, scale, snap) {
    wasm.voxelworld_mover_pose(this.__wbg_ptr, id, x, y, z, qx, qy, qz, qw, scale, snap);
  }
  /**
   * [mover id or 0, distance] for the first mover along a ray within `max_dist`.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} max_dist
   * @returns {Float64Array}
   */
  mover_raycast(ox, oy, oz, dx, dy, dz, max_dist) {
    const ret = wasm.voxelworld_mover_raycast(this.__wbg_ptr, ox, oy, oz, dx, dy, dz, max_dist);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * @param {number} id
   */
  mover_remove(id) {
    wasm.voxelworld_mover_remove(this.__wbg_ptr, id);
  }
  /**
   * The movers have moved (`mover_pose`) over `dt` seconds: carry what rides them, push what
   * they ran into, and start measuring their motion afresh.
   * @param {number} dt
   */
  movers_carry(dt) {
    wasm.voxelworld_movers_carry(this.__wbg_ptr, dt);
  }
  /**
   * `movers_carry` without the carrying (a client's copy of the world, which only predicts).
   * @param {number} dt
   */
  movers_settle(dt) {
    wasm.voxelworld_movers_settle(this.__wbg_ptr, dt);
  }
  constructor() {
    const ret = wasm.voxelworld_new();
    this.__wbg_ptr = ret;
    VoxelWorldFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * [body index or -1, distance] for the first body hit by a ray before any solid block.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} max_dist
   * @param {number} pad
   * @returns {Float64Array}
   */
  pick_body(ox, oy, oz, dx, dy, dz, max_dist, pad) {
    const ret = wasm.voxelworld_pick_body(this.__wbg_ptr, ox, oy, oz, dx, dy, dz, max_dist, pad);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * A new player body at (x, y, z); returns its slot (slots of removed players are reused).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   */
  player_add(x, y, z) {
    const ret = wasm.voxelworld_player_add(this.__wbg_ptr, x, y, z);
    return ret >>> 0;
  }
  /**
   * Whether a player's body (0.6 x 1.8 x 0.6) fits with its feet at (x, y, z): no solid block,
   * block model or mover in the way (unloaded columns count as solid).
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  player_fits(x, y, z) {
    const ret = wasm.voxelworld_player_fits(this.__wbg_ptr, x, y, z);
    return ret !== 0;
  }
  /**
   * Add a velocity change to a player (knockback, launch pads).
   * @param {number} i
   * @param {number} vx
   * @param {number} vy
   * @param {number} vz
   */
  player_impulse(i, vx, vy, vz) {
    wasm.voxelworld_player_impulse(this.__wbg_ptr, i, vx, vy, vz);
  }
  /**
   * Whether block `id` at (x, y, z) would overlap any player's body (only its solid boxes:
   * a bottom slab leaves room above it). By id, not what's there: the block would be new, and
   * whole.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} id
   * @returns {boolean}
   */
  player_overlaps(x, y, z, id) {
    const ret = wasm.voxelworld_player_overlaps(this.__wbg_ptr, x, y, z, id);
    return ret !== 0;
  }
  /**
   * @param {number} i
   */
  player_remove(i) {
    wasm.voxelworld_player_remove(this.__wbg_ptr, i);
  }
  /**
   * @param {number} i
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  player_reset(i, x, y, z) {
    wasm.voxelworld_player_reset(this.__wbg_ptr, i, x, y, z);
  }
  /**
   * Put a player's body back exactly as `player_state` described it (client-side prediction
   * starts again from the server's word).
   * @param {number} i
   * @param {Float64Array} s
   */
  player_restore(i, s) {
    const ptr0 = passArrayF64ToWasm0(s, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.voxelworld_player_restore(this.__wbg_ptr, i, ptr0, len0);
  }
  /**
   * [x, y, z, vx, vy, vz, on_ground, in_water, eyes_in_water, in_lava, flying, bob, frozen,
   * ride, ride_x, ride_y, ride_z] (the mover they ride, 0 for none, and where they are on it)
   * @param {number} i
   * @returns {Float64Array}
   */
  player_state(i) {
    const ret = wasm.voxelworld_player_state(this.__wbg_ptr, i);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * One step of a player's movement. Gravity, control and ground-jump power are per-step
   * multipliers. Returns whether native ground takeoff occurred. Jump power never applies
   * to water/lava swimming, flight or an airborne press.
   * @param {number} i
   * @param {number} wish_x
   * @param {number} wish_z
   * @param {boolean} jump
   * @param {boolean} sneak
   * @param {boolean} sprint
   * @param {boolean} slide
   * @param {number} speed
   * @param {number} gravity
   * @param {number} control
   * @param {number} jump_power
   * @param {number} dt
   * @returns {boolean}
   */
  player_step(i, wish_x, wish_z, jump, sneak, sprint, slide, speed, gravity, control, jump_power, dt) {
    const ret = wasm.voxelworld_player_step(this.__wbg_ptr, i, wish_x, wish_z, jump, sneak, sprint, slide, speed, gravity, control, jump_power, dt);
    return ret !== 0;
  }
  /**
   * How a player moves: [walk, sprint, sneak, jump, gravity, ground_accel, air_accel,
   * edge_guard (0/1), mantle, slide_friction] (see `world::Tuning`). Kept across `player_reset`.
   * @param {number} i
   * @param {Float64Array} t
   */
  player_tune(i, t) {
    const ptr0 = passArrayF64ToWasm0(t, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.voxelworld_player_tune(this.__wbg_ptr, i, ptr0, len0);
  }
  /**
   * Whether a point is inside solid material: a solid block's collision boxes, less what's been
   * shot out of it. Unloaded columns count as air.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  point_solid(x, y, z) {
    const ret = wasm.voxelworld_point_solid(this.__wbg_ptr, x, y, z);
    return ret !== 0;
  }
  /**
   * @returns {number}
   */
  projectile_capacity() {
    const ret = wasm.voxelworld_projectile_capacity(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  projectile_stride() {
    const ret = wasm.voxelworld_projectile_stride(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @returns {number}
   */
  projectiles_ptr() {
    const ret = wasm.voxelworld_projectiles_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * A ray that went into material at (ox, oy, oz): [found, distance, nx, ny, nz], how far along
   * it comes out into the open and the face it comes out of (see `World::ray_exit`); found 0
   * when it's still in material after `max`.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} max
   * @returns {Float64Array}
   */
  ray_exit(ox, oy, oz, dx, dy, dz, max) {
    const ret = wasm.voxelworld_ray_exit(this.__wbg_ptr, ox, oy, oz, dx, dy, dz, max);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * [hit, bx, by, bz, nx, ny, nz, block, distance]
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} max_dist
   * @returns {Float64Array}
   */
  raycast(ox, oy, oz, dx, dy, dz, max_dist) {
    const ret = wasm.voxelworld_raycast(this.__wbg_ptr, ox, oy, oz, dx, dy, dz, max_dist);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * [hit, bx, by, bz, nx, ny, nz, block, distance], including liquid surfaces.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} max_dist
   * @returns {Float64Array}
   */
  raycast_liquids(ox, oy, oz, dx, dy, dz, max_dist) {
    const ret = wasm.voxelworld_raycast_liquids(this.__wbg_ptr, ox, oy, oz, dx, dy, dz, max_dist);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * Force a navigation-field rebuild toward the players now.
   */
  rebuild_flow() {
    wasm.voxelworld_rebuild_flow(this.__wbg_ptr);
  }
  /**
   * @param {number} cx
   * @param {number} cz
   */
  remove_column(cx, cz) {
    wasm.voxelworld_remove_column(this.__wbg_ptr, cx, cz);
  }
  /**
   * Undo this session's edits; returns the loaded columns that changed as [cx, cz, ...].
   * @returns {Int32Array}
   */
  revert_edits() {
    const ret = wasm.voxelworld_revert_edits(this.__wbg_ptr);
    var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} b
   * @returns {boolean}
   */
  set_block(x, y, z, b) {
    const ret = wasm.voxelworld_set_block(this.__wbg_ptr, x, y, z, b);
    return ret !== 0;
  }
  /**
   * Which blocks `carve` can take bits out of: `ids` has 1 for each destructible block id (by
   * id; all 0 or empty turns carving off), and only blocks higher than `above`. Solid opaque
   * cubes only, whatever it says.
   * @param {number} above
   * @param {Uint8Array} ids
   */
  set_destructible(above, ids) {
    const ptr0 = passArray8ToWasm0(ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.voxelworld_set_destructible(this.__wbg_ptr, above, ptr0, len0);
  }
  /**
   * @param {number} i
   * @param {boolean} on
   */
  set_flying(i, on) {
    wasm.voxelworld_set_flying(this.__wbg_ptr, i, on);
  }
  /**
   * @param {number} i
   * @param {boolean} on
   */
  set_frozen(i, on) {
    wasm.voxelworld_set_frozen(this.__wbg_ptr, i, on);
  }
  /**
   * A spectator (on) or a player again: see `world::Player::ghost`. Flying either way; off, they fall.
   * @param {number} i
   * @param {boolean} on
   */
  set_ghost(i, on) {
    wasm.voxelworld_set_ghost(this.__wbg_ptr, i, on);
  }
  /**
   * Advance bodies (navigation, physics, separation) and projectiles.
   * @param {number} dt
   */
  step_entities(dt) {
    wasm.voxelworld_step_entities(this.__wbg_ptr, dt);
  }
  /**
   * Shape-aware motion for small server-owned bodies. Positions use feet coordinates.
   * No entity or simulation clock is allocated by this compute operation.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {number} half_width
   * @param {number} height
   * @returns {Float64Array}
   */
  sweep_body(x, y, z, dx, dy, dz, half_width, height) {
    const ret = wasm.voxelworld_sweep_body(this.__wbg_ptr, x, y, z, dx, dy, dz, half_width, height);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
  }
  /**
   * The boxes you aim at in the block at (x, y, z), 6 numbers each (1/16 of a block within its
   * cell): a fence or pane as it's joined there. Empty for air.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Uint8Array}
   */
  target_boxes(x, y, z) {
    const ret = wasm.voxelworld_target_boxes(this.__wbg_ptr, x, y, z);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
};
if (Symbol.dispose) VoxelWorld.prototype[Symbol.dispose] = VoxelWorld.prototype.free;
function set_content(json) {
  const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.set_content(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return ret[0] >>> 0;
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_generic_0000000000000001: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, void 0);
      table.set(offset + 0, void 0);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    }
  };
  return {
    __proto__: null,
    "./voxel_engine_bg.js": import0
  };
}
var ChunkMesherFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_chunkmesher_free(ptr, 1));
var CullerFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_culler_free(ptr, 1));
var TerrainGenFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_terraingen_free(ptr, 1));
var VoxelWorldFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_voxelworld_free(ptr, 1));
function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
function getArrayF64FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}
function getArrayI32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
function getArrayU32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
var cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}
var cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}
var cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
  if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
    cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32ArrayMemory0;
}
function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}
var cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}
var cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function passArray16ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 2, 2) >>> 0;
  getUint16ArrayMemory0().set(arg, ptr / 2);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passArray32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getUint32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedFloat32ArrayMemory0 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedInt32ArrayMemory0 = null;
  cachedUint16ArrayMemory0 = null;
  cachedUint32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
function initSync(module) {
  if (wasm !== void 0) return wasm;
  if (module !== void 0) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

// src/shared/input.ts
var MOVEMENT_HZ = 60;
var WORLD_HZ = 30;
var MOVEMENT_DT = 1 / MOVEMENT_HZ;
var INPUT_QUEUE_LIMIT = 12;
var INPUT_MAX_AGE_MS = 200;
var HELD_INPUT_MS = 100;
var NEUTRAL = Object.freeze({
  x: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sneak: false,
  sprint: false
});
var keys = ["epoch", "sequence", "x", "z", "yaw", "pitch", "jump", "sneak", "sprint"];
function isInputFrame(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value;
  if (Object.keys(v).length !== keys.length || keys.some((k) => !Object.hasOwn(v, k))) return false;
  return Number.isSafeInteger(v.epoch) && v.epoch > 0 && Number.isSafeInteger(v.sequence) && v.sequence > 0 && ["x", "z", "yaw", "pitch"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k])) && Math.abs(v.x) <= 1 && Math.abs(v.z) <= 1 && Math.abs(v.yaw) <= Math.PI && Math.abs(v.pitch) <= Math.PI / 2 && ["jump", "sneak", "sprint"].every((k) => typeof v[k] === "boolean");
}
function movementWish(input) {
  const scale = Math.max(1, Math.hypot(input.x, input.z));
  const x = input.x / scale, z = input.z / scale;
  const c = Math.cos(input.yaw), s = Math.sin(input.yaw);
  return [x * c - z * s, x * s + z * c];
}

// src/sim/input-queue.ts
var InputQueue = class {
  pending = [];
  latestSequence = 0;
  held;
  acknowledged = 0;
  currentEpoch;
  latestArrival = -Infinity;
  look;
  constructor(epoch, look = NEUTRAL) {
    this.currentEpoch = epoch;
    this.look = { yaw: look.yaw, pitch: look.pitch };
  }
  get received() {
    return this.latestSequence;
  }
  get epoch() {
    return this.currentEpoch;
  }
  get ack() {
    return this.acknowledged;
  }
  get size() {
    return this.pending.length;
  }
  active(now) {
    return now - this.latestArrival <= HELD_INPUT_MS;
  }
  receive(value, now) {
    if (!isInputFrame(value)) return "invalid";
    if (value.epoch !== this.currentEpoch) return "stale_epoch";
    if (value.sequence <= this.latestSequence) return "duplicate";
    this.latestSequence = value.sequence;
    this.latestArrival = now;
    this.pending.push({ frame: { ...value }, arrivedAt: now });
    if (this.pending.length > INPUT_QUEUE_LIMIT) {
      const discarded = this.pending.splice(0, this.pending.length - INPUT_QUEUE_LIMIT);
      this.acknowledged = Math.max(this.acknowledged, discarded.at(-1).frame.sequence);
      return "resync";
    }
    return "accepted";
  }
  take(now) {
    let resync = false;
    while (this.pending[0] && now - this.pending[0].arrivedAt > INPUT_MAX_AGE_MS) {
      this.acknowledged = Math.max(this.acknowledged, this.pending.shift().frame.sequence);
      resync = true;
    }
    const next = this.pending.shift();
    if (next) {
      this.held = next;
      this.look = { yaw: next.frame.yaw, pitch: next.frame.pitch };
      this.acknowledged = next.frame.sequence;
      return { controls: next.frame, resync };
    }
    const held = this.held;
    if (held && now - held.arrivedAt <= HELD_INPUT_MS) {
      return { controls: { ...held.frame, jump: false }, resync };
    }
    return {
      controls: { ...NEUTRAL, ...this.look },
      resync
    };
  }
  reset(epoch) {
    if (!Number.isSafeInteger(epoch) || epoch <= this.currentEpoch)
      throw new Error("epoch must advance");
    this.currentEpoch = epoch;
    this.pending = [];
    this.held = void 0;
    this.latestSequence = 0;
    this.acknowledged = 0;
    this.latestArrival = -Infinity;
  }
};

// src/sim/scheduler.ts
var TICK_MS = 1e3 / WORLD_HZ;
var MAX_CATCHUP_STEPS = 4;
var FixedScheduler = class {
  previous;
  remainder = 0;
  constructor(now) {
    this.previous = now;
  }
  advance(now, tick) {
    if (!Number.isFinite(now) || now < this.previous) throw new Error("clock must be monotonic");
    this.remainder += now - this.previous;
    this.previous = now;
    const due = Math.floor((this.remainder + 1e-7) / TICK_MS);
    const steps = Math.min(due, MAX_CATCHUP_STEPS);
    const droppedMs = Math.max(0, due - steps) * TICK_MS;
    this.remainder = Math.max(0, this.remainder - due * TICK_MS);
    for (let i = 0; i < steps; i++) tick();
    return { steps, droppedMs };
  }
  reset(now) {
    this.previous = now;
    this.remainder = 0;
  }
};

// src/shared/environment.ts
var ENVIRONMENT_VERSION = 1;
var DAY_TICKS = WORLD_HZ * 20 * 60;
var WEATHER_TICKS = WORLD_HZ * 3 * 60;
var TRANSITION_TICKS = WORLD_HZ * 15;
var smooth = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
function hash(seed, period) {
  let v = (seed ^ Math.imul(period, 2654435761)) >>> 0;
  v = Math.imul(v ^ v >>> 16, 2246822507);
  v = Math.imul(v ^ v >>> 13, 3266489909);
  return ((v ^ v >>> 16) >>> 0) / 4294967296;
}
var rainAt = (seed, period) => period <= 0 ? 0 : hash(seed, period) < 0.28 ? 1 : 0;
function sampleEnvironment(tick, seed) {
  if (!Number.isFinite(tick) || tick < 0 || tick > Number.MAX_SAFE_INTEGER || !Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("invalid environment clock/seed");
  const dayFraction = (tick / DAY_TICKS + 0.22) % 1;
  const angle = dayFraction * Math.PI * 2;
  const sunLength = Math.hypot(1, 0.3);
  const sun = [Math.cos(angle) / sunLength, Math.sin(angle) / sunLength, 0.3 / sunLength];
  const daylight = 0.06 + 0.94 * smooth(-0.12, 0.22, sun[1]);
  const period = Math.floor(tick / WEATHER_TICKS);
  const blend = smooth(0, TRANSITION_TICKS, tick % WEATHER_TICKS);
  const rain = rainAt(seed, period - 1) * (1 - blend) + rainAt(seed, period) * blend;
  const dusk = (1 - smooth(0.02, 0.3, Math.abs(sun[1]))) * daylight;
  const sky = [
    0.025 + daylight * 0.565 + dusk * 0.13,
    0.04 + daylight * 0.72 - dusk * 0.08,
    0.09 + daylight * 0.79 - dusk * 0.18
  ].map((v, i) => v * (1 - rain * 0.55) + [0.26, 0.3, 0.36][i] * daylight * rain * 0.55);
  const windAngle = hash(seed, 0) * Math.PI * 2;
  const windSpeed = 0.3 + rain * 0.8;
  return {
    tick,
    seconds: tick / WORLD_HZ,
    dayFraction,
    daylight,
    sun,
    sky,
    rain,
    wind: [Math.cos(windAngle) * windSpeed, Math.sin(windAngle) * windSpeed]
  };
}

// src/shared/recipes.ts
function ingredientMatches(ingredient, actual, items) {
  if (ingredient === null || actual === null) return ingredient === actual;
  return ingredient.startsWith("#") ? items?.get(actual)?.tags?.includes(ingredient.slice(1)) ?? false : ingredient === actual;
}

// src/shared/inventory.ts
var INVENTORY_VERSION = 2;
var BAG_SLOTS = 36;
var CHEST_SLOTS = 27;
var EQUIPMENT = ["head", "body", "legs", "feet", "offhand"];
function copyStack(stack) {
  return stack ? { ...stack, ...stack.instance ? { instance: { ...stack.instance } } : {} } : null;
}
function sameStack(a, b) {
  return a.itemType === b.itemType && a.instance?.durability === b.instance?.durability;
}
function validStack(value, items) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value;
  if (!Object.hasOwn(v, "itemType") || !Object.hasOwn(v, "count") || v.instance !== void 0 && !Object.hasOwn(v, "instance") || !Object.keys(v).every((key2) => ["itemType", "count", "instance"].includes(key2)) || typeof v.itemType !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(v.itemType) || !Number.isSafeInteger(v.count) || v.count < 1 || v.count > 999)
    return false;
  const item = items?.get(v.itemType);
  if (items && (!item || v.count > item.maxStack)) return false;
  if (v.instance !== void 0) {
    const instance = v.instance;
    if (!instance || typeof instance !== "object" || Array.isArray(instance) || Object.keys(instance).length !== 1 || !Object.hasOwn(instance, "durability") || !Number.isSafeInteger(instance.durability) || instance.durability < 1 || v.count !== 1 || item && (!item.durability || instance.durability > item.durability))
      return false;
  } else if (item?.durability !== void 0) return false;
  return true;
}
function makeStack(item, count) {
  const stack = {
    itemType: item.itemType,
    count,
    ...item.durability ? { instance: { durability: item.durability } } : {}
  };
  if (!validStack(stack, /* @__PURE__ */ new Map([[item.itemType, item]]))) throw new Error("invalid new stack");
  return stack;
}
var areaSizes = {
  bag: BAG_SLOTS,
  craft2: 4,
  craft3: 9,
  equipment: EQUIPMENT.length,
  container: CHEST_SLOTS
};
function matchRecipe(grid, size, recipes, items) {
  if (grid.length !== size * size || !grid.some(Boolean)) return null;
  function bounds(cells, width) {
    let minX = width, minY = width, maxX = -1, maxY = -1;
    cells.forEach((cell, i) => {
      if (cell) {
        minX = Math.min(minX, i % width);
        maxX = Math.max(maxX, i % width);
        minY = Math.min(minY, Math.floor(i / width));
        maxY = Math.max(maxY, Math.floor(i / width));
      }
    });
    return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }
  const actual = grid.map((stack) => stack?.itemType ?? null), a = bounds(actual, size);
  for (const recipe of recipes) {
    if (recipe.size > size) continue;
    const b = bounds(recipe.ingredients, recipe.size);
    if (a.width !== b.width || a.height !== b.height) continue;
    for (const mirror of [false, true]) {
      let matches = true;
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++) {
          const ingredient = recipe.ingredients[(b.minY + y) * recipe.size + b.minX + (mirror ? b.width - 1 - x : x)];
          const stack = grid[(a.minY + y) * size + a.minX + x];
          if (!ingredientMatches(ingredient, stack?.itemType ?? null, items) || stack?.instance)
            matches = false;
        }
      if (matches) return recipe;
    }
  }
  return null;
}

// src/shared/movement.ts
var DEFAULT_MOVEMENT = Object.freeze({
  speed: 1,
  gravity: 1,
  control: 1,
  jump: 1,
  sprint: true
});
function stepMovement(world, slot, controls, modifiers = DEFAULT_MOVEMENT) {
  const [x, z] = movementWish(controls);
  return world.player_step(
    slot,
    x,
    z,
    controls.jump,
    controls.sneak,
    controls.sprint && modifiers.sprint,
    false,
    modifiers.speed,
    modifiers.gravity,
    modifiers.control,
    modifiers.jump,
    MOVEMENT_DT
  );
}
function stepBoundedMovement(world, slot, controls, modifiers = DEFAULT_MOVEMENT) {
  const jumped = stepMovement(world, slot, controls, modifiers);
  const state = world.player_state(slot);
  let changed = false;
  const limits = [
    [-255.7, 255.7],
    [0, 254],
    [-255.7, 255.7]
  ];
  for (let axis = 0; axis < 3; axis++) {
    const bounded = Math.max(limits[axis][0], Math.min(limits[axis][1], state[axis]));
    if (bounded !== state[axis]) {
      state[axis] = bounded;
      state[axis + 3] = 0;
      changed = true;
    }
  }
  if (changed) world.player_restore(slot, state);
  return jumped;
}

// src/shared/vitals.ts
var VITALS_VERSION = 2;
var MAX_HEALTH = 20;
var MAX_FOOD = 20;
var MAX_AIR = 300;
var RESPAWN_TICKS = 60;
function equipmentEffects(items) {
  let speed = 1, gravity = 1, control = 1, fall = 0, armor = 0, jump = 1, fallImmune = false, sunRegen = false, vision = false;
  for (const item of items) {
    speed *= item.modifiers?.speed ?? 1;
    gravity *= item.modifiers?.gravity ?? 1;
    control *= item.modifiers?.control ?? 1;
    jump *= item.modifiers?.jump ?? 1;
    fall += item.modifiers?.fall ?? 0;
    armor += item.modifiers?.armor ?? 0;
    fallImmune ||= item.perks?.fallImmune === true;
    sunRegen ||= item.perks?.sunRegen === true;
    vision ||= item.perks?.vision === true;
  }
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  return {
    movement: {
      ...DEFAULT_MOVEMENT,
      speed: clamp(speed, 0.25, 2),
      gravity: clamp(gravity, 0.25, 2),
      control: clamp(control, 0.25, 2),
      jump: clamp(jump, 0.25, 2)
    },
    fall: clamp(fall, 0, 0.9),
    armor: clamp(armor, 0, 0.8),
    fallImmune,
    sunRegen,
    vision
  };
}

// src/shared/appearance.ts
function sameAppearance(a, b) {
  return a.held === b.held && EQUIPMENT.every((slot) => a.equipment[slot] === b.equipment[slot]);
}

// src/shared/protocol.ts
var GENERATOR_VERSION = 2;
var STREAM_RADIUS = 3;
var BOUNDS = Object.freeze({ minX: -256, minZ: -256, maxX: 256, maxZ: 256, height: 256 });
var integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
var coordinate = (n) => integer(n, -16, 15);
function columnKey(x, z) {
  return `${x},${z}`;
}
function inBounds(x, y, z) {
  return x >= BOUNDS.minX && x < BOUNDS.maxX && z >= BOUNDS.minZ && z < BOUNDS.maxZ && y >= 0 && y < 256;
}
function around(x, z, radius) {
  const out = [];
  for (let dz = -radius; dz <= radius; dz++)
    for (let dx = -radius; dx <= radius; dx++)
      if (coordinate(x + dx) && coordinate(z + dz)) out.push({ x: x + dx, z: z + dz });
  return out;
}

// src/shared/chunk-wire.ts
var HEADER = 24;
var MAX_COLUMN_REVISION = 4294967295;
function encodeChunk(frame) {
  const bytes = new Uint8Array(HEADER + frame.edits.length * 6), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(frame.kind === "baseline" ? "VXB2" : "VXP2"));
  view.setInt32(4, frame.x, true);
  view.setInt32(8, frame.z, true);
  view.setUint32(12, frame.subscription, true);
  view.setUint32(16, frame.revision, true);
  view.setUint32(20, frame.edits.length, true);
  frame.edits.forEach(([local, state], i) => {
    view.setUint32(HEADER + i * 6, local, true);
    view.setUint16(HEADER + i * 6 + 4, state, true);
  });
  return bytes;
}
function localIndex(x, y, z) {
  return y << 8 | (z & 15) << 4 | x & 15;
}
function worldCell(cx, cz, local) {
  return [cx * 16 + (local & 15), local >>> 8, cz * 16 + (local >>> 4 & 15)];
}

// src/sim/checkpoint-values.ts
function checkpointObject(value, fields) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}
function checkpointInteger(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
function checkpointIdentity(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}
function checkpointCell(value) {
  return Array.isArray(value) && value.length === 3 && Array.from(value).every(Number.isSafeInteger) && inBounds(value[0], value[1], value[2]);
}
function checkpointSlots(value, length, items) {
  return Array.isArray(value) && value.length === length && Array.from(value).every((slot) => slot === null || validStack(slot, items));
}
function freezeStack(value) {
  const copied = copyStack(value);
  if (!copied) return null;
  if (copied.instance) Object.freeze(copied.instance);
  return Object.freeze(copied);
}
function freezeSlots(slots) {
  return Object.freeze(slots.map(freezeStack));
}
function checkpointVector(value) {
  return Array.isArray(value) && value.length === 3 && Array.from(value).every((n) => typeof n === "number" && Number.isFinite(n));
}
function checkpointPosition(value) {
  return checkpointVector(value) && value[0] >= BOUNDS.minX && value[0] < BOUNDS.maxX && value[1] >= 0 && value[1] < BOUNDS.height && value[2] >= BOUNDS.minZ && value[2] < BOUNDS.maxZ;
}
function checkpointVelocity(value) {
  return checkpointVector(value) && value.every((n) => Math.abs(n) <= 12);
}
function checkpointCounterId(value, prefix, counter) {
  if (typeof value !== "string" || !value.startsWith(`${prefix}-`)) return false;
  const suffix = value.slice(prefix.length + 1);
  return /^[1-9][0-9]*$/.test(suffix) && checkpointInteger(Number(suffix), 1, counter);
}

// src/sim/world-store.ts
var WorldStore = class _WorldStore {
  world;
  generator;
  changed = /* @__PURE__ */ new Map();
  heights = /* @__PURE__ */ new Map();
  needed = /* @__PURE__ */ new Map();
  constructor(world, generator) {
    this.world = world;
    this.generator = generator;
  }
  checkpoint(content) {
    return Object.freeze({
      schema: 1,
      contentHash: content.hash,
      columns: Object.freeze(
        [...this.changed].map(([key2, entry]) => {
          const [x, z] = key2.split(",").map(Number);
          return Object.freeze({
            x,
            z,
            revision: entry.revision,
            edits: Object.freeze(
              [...entry.edits].sort(([a], [b]) => a - b).map(
                ([local, state]) => Object.freeze([local, state, entry.versions.get(local)])
              )
            )
          });
        }).sort((a, b) => a.x - b.x || a.z - b.z)
      )
    });
  }
  /** Install validated metadata into a fresh compute world; terrain still loads through normal jobs. */
  static fromCheckpoint(world, generator, content, value) {
    const invalid = () => {
      throw new Error("invalid world checkpoint");
    };
    if (!checkpointObject(value, ["schema", "contentHash", "columns"]) || value.schema !== 1 || value.contentHash !== content.hash || !Array.isArray(value.columns))
      return invalid();
    const columns = /* @__PURE__ */ new Map();
    for (const c of value.columns) {
      if (!checkpointObject(c, ["x", "z", "revision", "edits"]) || !checkpointInteger(c.x, BOUNDS.minX >> 4, (BOUNDS.maxX >> 4) - 1) || !checkpointInteger(c.z, BOUNDS.minZ >> 4, (BOUNDS.maxZ >> 4) - 1) || !checkpointInteger(c.revision, 1, MAX_COLUMN_REVISION) || !Array.isArray(c.edits) || !c.edits.length || columns.has(columnKey(c.x, c.z)))
        return invalid();
      const edits = /* @__PURE__ */ new Map(), versions = /* @__PURE__ */ new Map();
      let latest = 0;
      for (const row of c.edits) {
        if (!Array.isArray(row) || row.length !== 3 || !checkpointInteger(row[0], 0, 65535) || !checkpointInteger(row[1], 0, content.blocks.length - 1) || !checkpointInteger(row[2], 1, c.revision) || edits.has(row[0]))
          return invalid();
        edits.set(row[0], row[1]);
        versions.set(row[0], row[2]);
        latest = Math.max(latest, row[2]);
      }
      if (latest !== c.revision) return invalid();
      columns.set(columnKey(c.x, c.z), { revision: c.revision, edits, versions });
    }
    if (world.column_count() !== 0)
      throw new Error("world checkpoint requires a fresh compute world");
    const restored = new _WorldStore(world, generator);
    for (const [key2, column] of columns) restored.changed.set(key2, column);
    return restored;
  }
  revision(x, z) {
    return this.changed.get(columnKey(x, z))?.revision ?? 0;
  }
  edits(x, z) {
    return [...this.changed.get(columnKey(x, z))?.edits.entries() ?? []];
  }
  cellRevision(x, y, z) {
    return this.changed.get(columnKey(x >> 4, z >> 4))?.versions.get(localIndex(x, y, z)) ?? 0;
  }
  require(positions) {
    const desired = /* @__PURE__ */ new Map();
    for (const pos of positions)
      for (const p of around(Math.floor(pos[0] / 16), Math.floor(pos[2] / 16), 1)) {
        const key2 = columnKey(p.x, p.z), priority = (p.x * 16 + 8 - pos[0]) ** 2 + (p.z * 16 + 8 - pos[2]) ** 2;
        if (!desired.has(key2) || desired.get(key2).priority > priority)
          desired.set(key2, { ...p, priority });
      }
    for (const [key2, p] of this.needed)
      if (!desired.has(key2) && this.world.has_column(p.x, p.z)) {
        this.world.forget_column(p.x, p.z);
        this.heights.delete(key2);
      }
    this.needed = desired;
  }
  /** A room worker schedules bounded jobs between simulation turns. No hot query generates. */
  generateOne() {
    const next = [...this.needed.values()].filter((p) => !this.world.has_column(p.x, p.z)).sort((a, b) => a.priority - b.priority)[0];
    if (!next) return false;
    const data2 = this.generator.generate(next.x, next.z), heights = data2.slice(776, 1032);
    this.world.insert_column(next.x, next.z, data2);
    this.heights.set(columnKey(next.x, next.z), heights);
    try {
      for (const [local, state] of this.edits(next.x, next.z)) {
        const cell = worldCell(next.x, next.z, local);
        if (this.world.get_block(...cell) !== state && !this.world.set_block(...cell, state))
          throw new Error("column edit replay failed");
        if (state) heights[local & 255] = Math.max(heights[local & 255], local >>> 8);
      }
    } catch (error) {
      this.world.forget_column(next.x, next.z);
      this.heights.delete(columnKey(next.x, next.z));
      throw error;
    }
    return true;
  }
  heightAt(x, z) {
    return this.heights.get(columnKey(x >> 4, z >> 4))?.[(z & 15) << 4 | x & 15] ?? 252;
  }
  ready(x, z) {
    return around(x, z, 1).every((p) => this.world.has_column(p.x, p.z));
  }
  set(x, y, z, state) {
    if (!inBounds(x, y, z) || this.revision(x >> 4, z >> 4) >= MAX_COLUMN_REVISION || !this.world.has_column(x >> 4, z >> 4) || this.world.get_block(x, y, z) === state)
      return null;
    if (!this.world.set_block(x, y, z, state)) return null;
    const cx = x >> 4, cz = z >> 4, key2 = columnKey(cx, cz), entry = this.changed.get(key2) ?? {
      revision: 0,
      edits: /* @__PURE__ */ new Map(),
      versions: /* @__PURE__ */ new Map()
    };
    const heights = this.heights.get(key2);
    if (state && heights) {
      const index = (z & 15) << 4 | x & 15;
      heights[index] = Math.max(heights[index], y);
    }
    const local = localIndex(x, y, z);
    entry.edits.set(local, state);
    entry.revision++;
    entry.versions.set(local, entry.revision);
    this.changed.set(key2, entry);
    return { x: cx, z: cz, revision: entry.revision, edits: [[local, state]] };
  }
  /** Validate a complete blast before writing; one revision per affected column. */
  clearMany(cells) {
    if (cells.some(
      (cell) => !Array.isArray(cell) || cell.length !== 3 || !cell.every(Number.isInteger) || !inBounds(cell[0], cell[1], cell[2])
    ))
      return null;
    const before = cells.map((cell) => ({ cell, state: this.world.get_block(...cell) }));
    if (new Set(cells.map((cell) => cell.join(","))).size !== cells.length || before.some(
      ({ cell, state }) => !cell.every(Number.isInteger) || !inBounds(...cell) || !this.world.has_column(cell[0] >> 4, cell[2] >> 4) || this.revision(cell[0] >> 4, cell[2] >> 4) >= MAX_COLUMN_REVISION || state === 0 || state === 65535
    ))
      return null;
    const written = [];
    for (const entry of before) {
      if (!this.world.set_block(...entry.cell, 0)) {
        for (const prior of written)
          if (!this.world.set_block(...prior.cell, prior.state))
            throw new Error("world transaction rollback failed");
        return null;
      }
      written.push(entry);
    }
    const columns = /* @__PURE__ */ new Map();
    for (const {
      cell: [x, y, z]
    } of before) {
      const key2 = columnKey(x >> 4, z >> 4), local = localIndex(x, y, z);
      let patch = columns.get(key2);
      const entry = this.changed.get(key2) ?? {
        revision: 0,
        edits: /* @__PURE__ */ new Map(),
        versions: /* @__PURE__ */ new Map()
      };
      if (!patch) {
        entry.revision++;
        patch = { x: x >> 4, z: z >> 4, revision: entry.revision, edits: [] };
        columns.set(key2, patch);
      }
      entry.edits.set(local, 0);
      entry.versions.set(local, entry.revision);
      this.changed.set(key2, entry);
      patch.edits.push([local, 0]);
    }
    return [...columns.values()];
  }
  dispose() {
    this.world.free();
    this.generator.free();
    this.needed.clear();
    this.changed.clear();
    this.heights.clear();
  }
};

// src/sim/vitals.ts
var checkpointBounds = {
  health: MAX_HEALTH,
  food: MAX_FOOD,
  air: MAX_AIR,
  deadTicks: RESPAWN_TICKS,
  elapsed: 3599,
  regeneration: 149,
  solar: 149,
  vision: 899,
  starvation: 119,
  lava: 14,
  drowning: 29,
  eatDelay: 15,
  attackDelay: 60,
  hurtDelay: 10,
  protection: 60
};
var checkpointFields = Object.keys(checkpointBounds);
function validCheckpoint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value;
  return v.schema === 1 && Object.keys(v).length === checkpointFields.length + 3 && Object.keys(v).every(
    (key2) => key2 === "schema" || key2 === "exhaustion" || key2 === "peak" || Object.hasOwn(checkpointBounds, key2)
  ) && checkpointFields.every(
    (key2) => Number.isSafeInteger(v[key2]) && v[key2] >= 0 && v[key2] <= checkpointBounds[key2]
  ) && typeof v.exhaustion === "number" && Number.isFinite(v.exhaustion) && v.exhaustion >= 0 && v.exhaustion < 4 && (v.peak === null || typeof v.peak === "number" && Number.isFinite(v.peak) && v.peak >= 0 && v.peak <= 256) && (v.health === 0 ? v.protection === 0 : v.deadTicks === 0);
}
var Vitals = class _Vitals {
  health = MAX_HEALTH;
  food = MAX_FOOD;
  air = MAX_AIR;
  deadTicks = 0;
  elapsed = 0;
  regeneration = 0;
  solar = 0;
  vision = 0;
  starvation = 0;
  lava = 0;
  drowning = 0;
  exhaustion = 0;
  eatDelay = 0;
  peak = null;
  attackDelay = 0;
  hurtDelay = 0;
  protection = 0;
  checkpoint() {
    return Object.freeze({
      schema: 1,
      health: this.health,
      food: this.food,
      air: this.air,
      deadTicks: this.deadTicks,
      elapsed: this.elapsed,
      regeneration: this.regeneration,
      solar: this.solar,
      vision: this.vision,
      starvation: this.starvation,
      lava: this.lava,
      drowning: this.drowning,
      exhaustion: this.exhaustion,
      eatDelay: this.eatDelay,
      peak: this.peak,
      attackDelay: this.attackDelay,
      hurtDelay: this.hurtDelay,
      protection: this.protection
    });
  }
  /** Validate the whole object before constructing any replacement live state. */
  static fromCheckpoint(value) {
    if (!validCheckpoint(value)) throw new Error("invalid vitals checkpoint");
    const restored = new _Vitals();
    for (const field of checkpointFields) restored[field] = value[field];
    restored.exhaustion = value.exhaustion;
    restored.peak = value.peak;
    return restored;
  }
  get dead() {
    return this.health === 0;
  }
  view() {
    return {
      version: VITALS_VERSION,
      health: this.health,
      food: this.food,
      air: this.air,
      dead: this.dead,
      respawnIn: this.deadTicks,
      attackCooldown: this.attackDelay,
      protection: this.protection
    };
  }
  effort(amount) {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return;
    this.exhaustion += amount;
    const spent = Math.floor(this.exhaustion / 4);
    this.exhaustion %= 4;
    this.food = Math.max(0, this.food - spent);
  }
  damage(amount) {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.max(0, this.health - Math.ceil(amount));
    this.regeneration = 0;
    this.solar = 0;
    if (this.dead) {
      this.deadTicks = RESPAWN_TICKS;
      this.protection = 0;
    }
    return this.dead;
  }
  get canBeHit() {
    return !this.dead && this.protection === 0 && this.hurtDelay === 0;
  }
  beginAttack(cooldown) {
    if (this.dead || this.attackDelay) return false;
    this.attackDelay = cooldown;
    this.protection = 0;
    return true;
  }
  strikeDamage(amount) {
    if (!this.canBeHit) return false;
    this.hurtDelay = 10;
    this.damage(amount);
    return true;
  }
  eat(nutrition) {
    if (!Number.isInteger(nutrition) || nutrition < 1 || nutrition > MAX_FOOD)
      throw new Error("invalid food nutrition");
    if (this.dead) return "dead";
    if (this.food >= MAX_FOOD) return "full";
    if (this.eatDelay) return "cooldown";
    this.food = Math.min(MAX_FOOD, this.food + nutrition);
    this.eatDelay = 15;
    return "eaten";
  }
  movement(before, after, climbing, fallReduction, sprint) {
    if (this.dead) return { damage: 0, impact: 0 };
    const distance = Math.min(1, Math.hypot(after[0] - before[0], after[2] - before[2]));
    this.effort(distance * (sprint ? 0.1 : 0.01));
    if (after[7] || after[9] || after[10] || climbing) {
      this.peak = null;
      return { damage: 0, impact: 0 };
    }
    this.peak = Math.max(this.peak ?? before[1], before[1], after[1]);
    if (!after[6]) return { damage: 0, impact: 0 };
    const fallDistance = Math.max(0, this.peak - after[1] - 3), impact = Math.floor(fallDistance + 1e-6);
    const damage = Math.floor(fallDistance * (1 - fallReduction) + 1e-6);
    this.peak = null;
    this.damage(damage);
    return { damage, impact };
  }
  /** One owned medallion heal after five continuous eligible room seconds. */
  sunlight(eligible) {
    if (!eligible || this.dead || this.health >= MAX_HEALTH) {
      this.solar = 0;
      return false;
    }
    if (++this.solar < 150) return false;
    this.solar = 0;
    this.health++;
    return true;
  }
  visibility(active) {
    if (!active || this.dead) {
      this.vision = 0;
      return false;
    }
    if (++this.vision < 900) return false;
    this.vision = 0;
    return true;
  }
  step(state) {
    if (this.dead) {
      this.deadTicks = Math.max(0, this.deadTicks - 1);
      return;
    }
    this.elapsed = (this.elapsed + 1) % 3600;
    this.attackDelay = Math.max(0, this.attackDelay - 1);
    this.hurtDelay = Math.max(0, this.hurtDelay - 1);
    this.protection = Math.max(0, this.protection - 1);
    this.eatDelay = Math.max(0, this.eatDelay - 1);
    if (this.elapsed === 0) this.food = Math.max(0, this.food - 1);
    if (this.food === 0) {
      if (++this.starvation >= 120) {
        this.starvation = 0;
        this.damage(1);
      }
    } else this.starvation = 0;
    if (this.food >= 18 && this.health < MAX_HEALTH) {
      if (++this.regeneration >= 150) {
        this.regeneration = 0;
        this.health++;
        this.effort(1);
      }
    } else this.regeneration = 0;
    if (state[8]) {
      this.air = Math.max(0, this.air - 1);
      if (!this.air && ++this.drowning >= 30) {
        this.drowning = 0;
        this.damage(2);
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + 10);
      this.drowning = 0;
    }
    if (state[9]) {
      if (++this.lava >= 15) {
        this.lava = 0;
        this.damage(4);
      }
    } else this.lava = 0;
  }
  resetMotion() {
    this.peak = null;
  }
  respawn() {
    if (!this.dead || this.deadTicks) return false;
    this.health = MAX_HEALTH;
    this.food = MAX_FOOD;
    this.air = MAX_AIR;
    this.attackDelay = this.hurtDelay = 0;
    this.protection = 60;
    this.peak = null;
    this.exhaustion = this.elapsed = this.regeneration = this.solar = this.vision = this.starvation = this.lava = this.drowning = this.eatDelay = 0;
    return true;
  }
};

// src/sim/room-checkpoint.ts
var RECONNECT_RESERVATION_MS = 3e4;
function validCheckpointBody(value) {
  return Array.isArray(value) && value.length === 17 && Array.from(value).every((n) => typeof n === "number" && Number.isFinite(n)) && checkpointPosition(value.slice(0, 3)) && [3, 4, 5].every((i) => Math.abs(value[i]) <= 128) && [6, 7, 8, 9, 10, 12].every((i) => value[i] === 0 || value[i] === 1) && value[11] >= 0 && [13, 14, 15, 16].every((i) => value[i] === 0);
}
function readRoomCheckpoint(value, content, build) {
  const invalid = () => {
    throw new Error("invalid room checkpoint");
  };
  if (!checkpointObject(value, [
    "schema",
    "worldId",
    "seed",
    "preset",
    "generatorVersion",
    "contentHash",
    "engineHash",
    "sourceBuildId",
    "bounds",
    "mode",
    "tick",
    "epoch",
    "paused",
    "hitSequence",
    "explosionSequence",
    "spawn",
    "players",
    "world",
    "inventories",
    "drops",
    "explosives"
  ]) || value.schema !== 1 || !checkpointIdentity(value.worldId) || !checkpointInteger(value.seed, 0, 4294967295) || value.preset !== "blockyard-natural-v2" || value.generatorVersion !== GENERATOR_VERSION || value.contentHash !== content.hash || value.engineHash !== build.engineHash || typeof value.sourceBuildId !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceBuildId) || !checkpointObject(value.bounds, Object.keys(BOUNDS)) || !Object.entries(BOUNDS).every(
    ([key2, n]) => value.bounds[key2] === n
  ) || !["creative", "survival"].includes(value.mode) || !checkpointInteger(value.tick, 0, Number.MAX_SAFE_INTEGER - 9e3) || !checkpointInteger(value.epoch, 0, Number.MAX_SAFE_INTEGER - 2) || typeof value.paused !== "boolean" || !checkpointInteger(value.hitSequence) || !checkpointInteger(value.explosionSequence) || !checkpointPosition(value.spawn) || !Array.isArray(value.players))
    return invalid();
  const ids = /* @__PURE__ */ new Set(), players = [];
  for (const p of value.players) {
    if (!checkpointObject(p, ["id", "state", "yaw", "pitch", "reservationMs", "vitals"]) || !checkpointIdentity(p.id) || ids.has(p.id) || !validCheckpointBody(p.state) || typeof p.yaw !== "number" || !Number.isFinite(p.yaw) || Math.abs(p.yaw) > Math.PI || typeof p.pitch !== "number" || !Number.isFinite(p.pitch) || Math.abs(p.pitch) > Math.PI / 2 || p.reservationMs !== null && (typeof p.reservationMs !== "number" || !Number.isFinite(p.reservationMs) || p.reservationMs < 0 || p.reservationMs > RECONNECT_RESERVATION_MS))
      return invalid();
    let vitals;
    try {
      vitals = Vitals.fromCheckpoint(p.vitals).checkpoint();
    } catch {
      return invalid();
    }
    ids.add(p.id);
    players.push(
      Object.freeze({
        id: p.id,
        state: Object.freeze([...p.state]),
        yaw: p.yaw,
        pitch: p.pitch,
        reservationMs: p.reservationMs,
        vitals
      })
    );
  }
  return Object.freeze({
    ...value,
    spawn: Object.freeze([...value.spawn]),
    bounds: BOUNDS,
    players: Object.freeze(players)
  });
}

// src/sim/inventory.ts
var key = (cell) => cell.join(",");
var empty = (count) => Array(count).fill(null);
var clone = (slots) => slots.map(copyStack);
var Inventories = class _Inventories {
  players = /* @__PURE__ */ new Map();
  chests = /* @__PURE__ */ new Map();
  nextChest = 0;
  items;
  recipes;
  access;
  contentHash;
  constructor(content, access) {
    this.items = new Map(content.items.map((item) => [item.itemType, item]));
    this.recipes = content.recipes;
    this.access = access;
    this.contentHash = content.hash;
  }
  /** Capture private ownership without retaining live arrays, instances or open viewers. */
  checkpoint() {
    return Object.freeze({
      schema: 1,
      contentHash: this.contentHash,
      nextChest: this.nextChest,
      players: Object.freeze(
        [...this.players].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(
          ([id, p]) => Object.freeze({
            id,
            revision: p.revision,
            selected: p.selected,
            bag: freezeSlots(p.bag),
            craft2: freezeSlots(p.craft2),
            craft3: freezeSlots(p.craft3),
            equipment: freezeSlots(p.equipment)
          })
        )
      ),
      chests: Object.freeze(
        [...this.chests.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(
          (chest) => Object.freeze({
            id: chest.id,
            cell: Object.freeze([...chest.cell]),
            revision: chest.revision,
            slots: freezeSlots(chest.slots)
          })
        )
      )
    });
  }
  static fromCheckpoint(content, access, value) {
    const invalid = () => {
      throw new Error("invalid inventory checkpoint");
    };
    if (!checkpointObject(value, ["schema", "contentHash", "nextChest", "players", "chests"]) || value.schema !== 1 || value.contentHash !== content.hash || !checkpointInteger(value.nextChest) || !Array.isArray(value.players) || !Array.isArray(value.chests))
      return invalid();
    const restored = new _Inventories(content, access), players = /* @__PURE__ */ new Map(), chests = /* @__PURE__ */ new Map(), chestIds = /* @__PURE__ */ new Set();
    for (const p of value.players) {
      if (!checkpointObject(p, [
        "id",
        "revision",
        "selected",
        "bag",
        "craft2",
        "craft3",
        "equipment"
      ]) || !checkpointIdentity(p.id) || players.has(p.id) || !checkpointInteger(p.revision) || !checkpointInteger(p.selected, 0, 8) || !checkpointSlots(p.bag, BAG_SLOTS, restored.items) || !checkpointSlots(p.craft2, 4, restored.items) || !checkpointSlots(p.craft3, 9, restored.items) || !checkpointSlots(p.equipment, EQUIPMENT.length, restored.items) || p.equipment.some(
        (stack, index) => stack && restored.items.get(stack.itemType)?.equipment !== EQUIPMENT[index]
      ))
        return invalid();
      players.set(p.id, {
        revision: p.revision,
        selected: p.selected,
        bag: clone(p.bag),
        craft2: clone(p.craft2),
        craft3: clone(p.craft3),
        equipment: clone(p.equipment),
        station: null
      });
    }
    for (const chest of value.chests) {
      if (!checkpointObject(chest, ["id", "cell", "revision", "slots"]) || typeof chest.id !== "string" || !/^chest-[1-9][0-9]*$/.test(chest.id) || !checkpointInteger(Number(chest.id.slice(6)), 1, value.nextChest) || chestIds.has(chest.id) || !checkpointCell(chest.cell) || chests.has(key(chest.cell)) || !checkpointInteger(chest.revision) || !checkpointSlots(chest.slots, CHEST_SLOTS, restored.items))
        return invalid();
      chestIds.add(chest.id);
      chests.set(key(chest.cell), {
        id: chest.id,
        cell: [...chest.cell],
        revision: chest.revision,
        slots: clone(chest.slots)
      });
    }
    restored.players = players;
    restored.chests = chests;
    restored.nextChest = value.nextChest;
    return restored;
  }
  join(id) {
    if (!this.players.has(id))
      this.players.set(id, {
        revision: 0,
        selected: 0,
        bag: empty(BAG_SLOTS),
        craft2: empty(4),
        craft3: empty(9),
        equipment: empty(EQUIPMENT.length),
        station: null
      });
    this.close(id);
  }
  close(id) {
    const player = this.players.get(id);
    if (player) player.station = null;
  }
  view(id, catalog = false) {
    const p = this.player(id), chest = this.chest(p);
    return {
      version: INVENTORY_VERSION,
      catalog,
      revision: p.revision,
      selected: p.selected,
      bag: clone(p.bag),
      craft2: clone(p.craft2),
      craft3: clone(p.craft3),
      equipment: clone(p.equipment),
      station: p.station?.kind ?? "personal",
      container: chest ? {
        id: chest.id,
        cell: [...chest.cell],
        revision: chest.revision,
        slots: clone(chest.slots)
      } : null
    };
  }
  viewers(containerId) {
    return [...this.players].filter(([, p]) => p.station?.containerId === containerId).map(([id]) => id);
  }
  refresh(id) {
    const p = this.player(id), station = p.station;
    if (station && (this.access.station(station.cell) !== station.kind || !this.access.canUse(id, station.cell, false) || station.kind === "container" && !this.chest(p))) {
      p.station = null;
      return true;
    }
    return false;
  }
  canBreak(cell) {
    return !this.chests.get(key(cell))?.slots.some(Boolean);
  }
  removed(cell) {
    this.chests.delete(key(cell));
    const closed = [];
    for (const [id, p] of this.players)
      if (p.station && key(p.station.cell) === key(cell)) {
        p.station = null;
        closed.push(id);
      }
    return closed;
  }
  transact(id, command, allowGive) {
    const p = this.player(id);
    if (command.kind === "close") {
      p.station = null;
      return { ok: true, reason: "closed" };
    }
    if (command.kind === "open") {
      if (!command.target) {
        p.station = null;
        return { ok: true, reason: "opened" };
      }
      const kind = this.access.station(command.target);
      if (!kind || !this.access.canUse(id, command.target, true))
        return { ok: false, reason: "out_of_reach" };
      let chest;
      if (kind === "container") {
        chest = this.chests.get(key(command.target));
        if (!chest) {
          if (this.nextChest === Number.MAX_SAFE_INTEGER)
            return { ok: false, reason: "identity_exhausted" };
          chest = {
            id: `chest-${++this.nextChest}`,
            cell: [...command.target],
            revision: 0,
            slots: empty(CHEST_SLOTS)
          };
          this.chests.set(key(command.target), chest);
        }
      }
      p.station = { kind, cell: [...command.target], ...chest ? { containerId: chest.id } : {} };
      return { ok: true, reason: "opened" };
    }
    this.refresh(id);
    if (command.revision !== p.revision) return { ok: false, reason: "conflict" };
    if (command.kind === "select") {
      if (!Number.isInteger(command.slot) || command.slot < 0 || command.slot > 8)
        return { ok: false, reason: "invalid_slot" };
      if (p.selected !== command.slot) {
        p.selected = command.slot;
        p.revision++;
      }
      return { ok: true, reason: "selected" };
    }
    if (command.kind === "drop" || command.kind === "consume")
      return { ok: false, reason: "world_action_required" };
    const draft = {
      revision: p.revision,
      bag: clone(p.bag),
      craft2: clone(p.craft2),
      craft3: clone(p.craft3),
      equipment: clone(p.equipment)
    };
    let changedChest;
    if (command.kind === "give") {
      if (!allowGive) return { ok: false, reason: "forbidden" };
      const item = this.items.get(command.itemType);
      if (!item || !Number.isSafeInteger(command.count) || command.count < 1 || command.count > 999)
        return { ok: false, reason: "invalid_item" };
      if (!this.insert(draft.bag, item, command.count)) return { ok: false, reason: "full" };
    } else if (command.kind === "craft") {
      if (command.grid === 3 && p.station?.kind !== "workbench")
        return { ok: false, reason: "station_required" };
      if (!Number.isSafeInteger(command.count) || command.count < 1 || command.count > 64)
        return { ok: false, reason: "invalid_count" };
      const grid = command.grid === 2 ? draft.craft2 : draft.craft3;
      const recipe = matchRecipe(grid, command.grid, this.recipes, this.items);
      if (!recipe) return { ok: false, reason: "no_recipe" };
      for (const stack of grid)
        if (stack && stack.count < command.count) return { ok: false, reason: "insufficient" };
      for (let i = 0; i < grid.length; i++)
        if (grid[i])
          grid[i] = grid[i].count === command.count ? null : { ...grid[i], count: grid[i].count - command.count };
      const item = this.items.get(recipe.result.itemType);
      if (!this.insert(draft.bag, item, recipe.result.count * command.count, recipe.result))
        return { ok: false, reason: "full" };
    } else {
      const usesChest = command.from.area === "container" || command.to.area === "container";
      const chest = this.chest(p);
      if (usesChest && (!chest || command.containerId !== chest.id || command.containerRevision !== chest.revision))
        return { ok: false, reason: "conflict" };
      const chestSlots = chest ? clone(chest.slots) : null;
      const slots = (ref, writing = false) => {
        if (ref.area === "container") return chestSlots;
        if (writing && ref.area === "craft3" && p.station?.kind !== "workbench") return null;
        return draft[ref.area];
      };
      const from = slots(command.from), to = slots(command.to, true);
      if (!from || !to || !Number.isInteger(command.from.slot) || !Number.isInteger(command.to.slot) || command.from.slot < 0 || command.to.slot < 0 || command.from.slot >= from.length || command.to.slot >= to.length || from === to && command.from.slot === command.to.slot)
        return { ok: false, reason: "invalid_slot" };
      const source = from[command.from.slot], target = to[command.to.slot];
      if (!source || !Number.isSafeInteger(command.count) || command.count < 1 || command.count > source.count)
        return { ok: false, reason: "insufficient" };
      const item = this.items.get(source.itemType);
      const fits = (ref, stack) => !stack || (ref.area !== "craft3" || p.station?.kind === "workbench") && (ref.area !== "equipment" || stack.count === 1 && this.items.get(stack.itemType)?.equipment === EQUIPMENT[ref.slot]);
      const moved = { ...source, count: command.count };
      if (!fits(command.to, moved)) return { ok: false, reason: "wrong_equipment" };
      if (target && !sameStack(source, target)) {
        if (command.count !== source.count || !fits(command.from, target))
          return { ok: false, reason: "occupied" };
        from[command.from.slot] = target;
        to[command.to.slot] = source;
      } else {
        if ((target?.count ?? 0) + command.count > item.maxStack)
          return { ok: false, reason: "full" };
        from[command.from.slot] = source.count === command.count ? null : { ...source, count: source.count - command.count };
        to[command.to.slot] = { ...source, count: (target?.count ?? 0) + command.count };
      }
      if (usesChest && chest && chestSlots)
        changedChest = { ...chest, slots: chestSlots, revision: chest.revision + 1 };
    }
    p.bag = draft.bag;
    p.craft2 = draft.craft2;
    p.craft3 = draft.craft3;
    p.equipment = draft.equipment;
    p.revision++;
    if (changedChest) this.chests.set(key(changedChest.cell), changedChest);
    return {
      ok: true,
      reason: command.kind,
      ...changedChest ? { containerChanged: changedChest.id } : {}
    };
  }
  held(id) {
    const p = this.player(id);
    return { slot: p.selected, stack: copyStack(p.bag[p.selected]), revision: p.revision };
  }
  appearance(id) {
    const p = this.player(id);
    return {
      held: p.bag[p.selected]?.itemType ?? null,
      equipment: {
        head: p.equipment[0]?.itemType ?? null,
        body: p.equipment[1]?.itemType ?? null,
        legs: p.equipment[2]?.itemType ?? null,
        feet: p.equipment[3]?.itemType ?? null,
        offhand: p.equipment[4]?.itemType ?? null
      }
    };
  }
  equipped(id) {
    return this.player(id).equipment.flatMap(
      (stack) => stack ? [this.items.get(stack.itemType)] : []
    );
  }
  active(id) {
    const p = this.player(id), held = p.bag[p.selected], item = held && this.items.get(held.itemType);
    return [...this.equipped(id), ...item?.activation === "held" ? [item] : []];
  }
  consume(id, slot, revision, apply) {
    const p = this.player(id), stack = p.bag[slot];
    if (p.revision !== revision) return { ok: false, reason: "conflict" };
    if (!Number.isInteger(slot) || slot < 0 || slot >= BAG_SLOTS || !stack)
      return { ok: false, reason: "insufficient" };
    const nutrition = this.items.get(stack.itemType)?.food;
    if (!nutrition) return { ok: false, reason: "not_food" };
    const reason = apply(nutrition);
    if (reason !== "eaten") return { ok: false, reason };
    p.bag[slot] = stack.count === 1 ? null : { ...stack, count: stack.count - 1 };
    p.revision++;
    return { ok: true, reason };
  }
  wearEquipment(id, effect) {
    const p = this.player(id);
    let changed = false;
    p.equipment = p.equipment.map((stack) => {
      if (!stack?.instance?.durability) return stack;
      const item = this.items.get(stack.itemType);
      const contributes = effect === "vision" ? item.perks?.vision : effect === "sun" ? item.perks?.sunRegen : effect === "fall" ? item.modifiers?.fall || item.perks?.fallImmune : effect === "jump" ? item.modifiers?.jump !== void 0 && item.modifiers.jump !== 1 : item.modifiers?.armor;
      if (!contributes) return stack;
      changed = true;
      return stack.instance.durability === 1 ? null : { ...stack, instance: { durability: stack.instance.durability - 1 } };
    });
    if (changed) p.revision++;
    return changed;
  }
  drain(id, spawn) {
    const p = this.player(id);
    for (const stack of [...p.bag, ...p.craft2, ...p.craft3, ...p.equipment])
      if (stack) spawn(copyStack(stack));
    p.bag = empty(BAG_SLOTS);
    p.craft2 = empty(4);
    p.craft3 = empty(9);
    p.equipment = empty(EQUIPMENT.length);
    p.station = null;
    p.selected = 0;
    p.revision++;
  }
  place(id, revision, family, apply) {
    const p = this.player(id), stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: "conflict" };
    if (!stack || this.items.get(stack.itemType)?.places !== family)
      return { ok: false, reason: "not_owned" };
    const remainder = this.items.get(stack.itemType)?.remainder;
    const next = remainder ? makeStack(this.items.get(remainder), 1) : stack.count === 1 ? null : { ...stack, count: stack.count - 1 };
    if (!apply()) return { ok: false, reason: "unchanged" };
    p.bag[p.selected] = next;
    p.revision++;
    return { ok: true, reason: "placed" };
  }
  collect(id, revision, family, apply) {
    const p = this.player(id), stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: "conflict" };
    const rule = stack && this.items.get(stack.itemType)?.collects;
    if (!rule || rule.family !== family) return { ok: false, reason: "container_required" };
    const filled = makeStack(this.items.get(rule.result), 1);
    if (!apply()) return { ok: false, reason: "unchanged" };
    p.bag[p.selected] = filled;
    p.revision++;
    return { ok: true, reason: "collected" };
  }
  ignite(id, revision, creative, apply) {
    const p = this.player(id), stack = p.bag[p.selected];
    if (p.revision !== revision) return { ok: false, reason: "conflict" };
    if (!creative && (!stack?.instance?.durability || !this.items.get(stack.itemType)?.igniter))
      return { ok: false, reason: "igniter_required" };
    if (!apply()) return { ok: false, reason: "unchanged" };
    if (!creative && stack?.instance?.durability) {
      p.bag[p.selected] = stack.instance.durability === 1 ? null : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: "ignited" };
  }
  explode(cell, spawn) {
    const chest = this.chests.get(key(cell));
    if (chest) {
      for (const stack of chest.slots) if (stack) spawn(copyStack(stack));
    }
    return this.removed(cell);
  }
  strike(id, revision, apply) {
    const p = this.player(id), stack = p.bag[p.selected];
    if (revision !== p.revision) return { ok: false, reason: "conflict" };
    if (!apply()) return { ok: false, reason: "protected" };
    if (stack?.instance?.durability && this.items.get(stack.itemType)?.combat) {
      p.bag[p.selected] = stack.instance.durability === 1 ? null : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: "hit" };
  }
  mine(id, slot, expected, apply) {
    const p = this.player(id), stack = p.bag[p.selected];
    if (p.selected !== slot || !!stack !== !!expected || stack && expected && !sameStack(stack, expected))
      return { ok: false, reason: "tool_changed" };
    if (!apply()) return { ok: false, reason: "unchanged" };
    if (stack?.instance?.durability && this.items.get(stack.itemType)?.tool) {
      p.bag[p.selected] = stack.instance.durability === 1 ? null : { ...stack, instance: { durability: stack.instance.durability - 1 } };
      p.revision++;
    }
    return { ok: true, reason: "mined" };
  }
  drop(id, slot, count, revision, spawn) {
    const p = this.player(id), stack = p.bag[slot];
    if (revision !== p.revision) return { ok: false, reason: "conflict" };
    if (!Number.isInteger(slot) || slot < 0 || slot >= BAG_SLOTS || !stack || !Number.isInteger(count) || count < 1 || count > stack.count)
      return { ok: false, reason: "insufficient" };
    spawn({ ...copyStack(stack), count });
    p.bag[slot] = count === stack.count ? null : { ...stack, count: stack.count - count };
    p.revision++;
    return { ok: true, reason: "dropped" };
  }
  receive(id, stack) {
    if (!validStack(stack, this.items)) throw new Error("invalid pickup stack");
    const p = this.player(id), bag = clone(p.bag), remaining = this.fill(bag, this.items.get(stack.itemType), stack.count, stack);
    const accepted = stack.count - remaining;
    if (accepted) {
      p.bag = bag;
      p.revision++;
    }
    return accepted;
  }
  dispose() {
    this.players.clear();
    this.chests.clear();
  }
  player(id) {
    const p = this.players.get(id);
    if (!p) throw new Error("unknown inventory owner");
    return p;
  }
  chest(p) {
    if (p.station?.kind !== "container") return void 0;
    const chest = this.chests.get(key(p.station.cell));
    return chest?.id === p.station.containerId ? chest : void 0;
  }
  insert(slots, item, count, template) {
    return this.fill(slots, item, count, template) === 0;
  }
  fill(slots, item, count, template) {
    const prototype = template ?? makeStack(item, Math.min(count, item.maxStack));
    for (let i = 0; i < slots.length && count > 0; i++) {
      const stack = slots[i];
      if (stack && sameStack(stack, prototype)) {
        const moved = Math.min(count, item.maxStack - stack.count);
        slots[i] = { ...stack, count: stack.count + moved };
        count -= moved;
      }
    }
    for (let i = 0; i < slots.length && count > 0; i++)
      if (!slots[i]) {
        const moved = Math.min(count, item.maxStack);
        slots[i] = { ...copyStack(prototype), count: moved };
        count -= moved;
      }
    return count;
  }
};

// src/shared/gameplay.ts
var DROP_RADIUS = 32;
var PICKUP_RADIUS = 1.75;
var DROP_LIFETIME_TICKS = 30 * 300;

// src/sim/drops.ts
var Drops = class _Drops {
  values = /* @__PURE__ */ new Map();
  nextId = 0;
  items;
  contentHash;
  constructor(content) {
    this.items = new Map(content.items.map((item) => [item.itemType, item]));
    this.contentHash = content.hash;
  }
  checkpoint(tick) {
    if (!checkpointInteger(tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS))
      throw new Error("invalid drops checkpoint tick");
    if ([...this.values.values()].some((drop) => tick < drop.expires - DROP_LIFETIME_TICKS))
      throw new Error("drops checkpoint predates a live body");
    return Object.freeze({
      schema: 1,
      contentHash: this.contentHash,
      tick,
      nextId: this.nextId,
      entries: Object.freeze(
        [...this.values.values()].map(
          (drop) => Object.freeze({
            id: drop.id,
            revision: drop.revision,
            stack: freezeStack(drop.stack),
            position: Object.freeze([...drop.position]),
            velocity: Object.freeze([...drop.velocity]),
            expiresIn: Math.max(0, drop.expires - tick),
            pickupIn: Math.max(0, drop.pickupAt - tick),
            owner: drop.owner,
            ownerPickupIn: Math.max(0, drop.ownerPickupAt - tick)
          })
        )
      )
    });
  }
  static fromCheckpoint(content, value) {
    const invalid = () => {
      throw new Error("invalid drops checkpoint");
    };
    if (!checkpointObject(value, ["schema", "contentHash", "tick", "nextId", "entries"]) || value.schema !== 1 || value.contentHash !== content.hash || !checkpointInteger(value.tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS) || !checkpointInteger(value.nextId) || !Array.isArray(value.entries))
      return invalid();
    const restored = new _Drops(content), entries = /* @__PURE__ */ new Map();
    for (const d of value.entries) {
      if (!checkpointObject(d, [
        "id",
        "revision",
        "stack",
        "position",
        "velocity",
        "expiresIn",
        "pickupIn",
        "owner",
        "ownerPickupIn"
      ]) || !checkpointCounterId(d.id, "drop", value.nextId) || entries.has(d.id) || !checkpointInteger(d.revision) || !validStack(d.stack, restored.items) || !checkpointPosition(d.position) || !checkpointVelocity(d.velocity) || !checkpointInteger(d.expiresIn, 0, DROP_LIFETIME_TICKS) || !checkpointInteger(d.pickupIn, 0, 6) || !checkpointInteger(d.ownerPickupIn, 0, 30) || d.ownerPickupIn < d.pickupIn || d.ownerPickupIn > d.expiresIn || d.owner !== null && !checkpointIdentity(d.owner))
        return invalid();
      entries.set(d.id, {
        id: d.id,
        revision: d.revision,
        stack: copyStack(d.stack),
        position: [...d.position],
        velocity: [...d.velocity],
        expires: value.tick + d.expiresIn,
        pickupAt: value.tick + d.pickupIn,
        owner: d.owner,
        ownerPickupAt: value.tick + d.ownerPickupIn
      });
    }
    restored.values = entries;
    restored.nextId = value.nextId;
    return restored;
  }
  get size() {
    return this.values.size;
  }
  add(stack, position, tick, owner = null, velocity = [0, 2, 0]) {
    if (!validStack(stack, this.items) || !checkpointPosition(position) || !checkpointVelocity(velocity) || !checkpointInteger(tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS) || owner !== null && !checkpointIdentity(owner) || this.nextId === Number.MAX_SAFE_INTEGER)
      throw new Error("invalid dropped body");
    const id = `drop-${++this.nextId}`;
    this.values.set(id, {
      id,
      revision: 0,
      stack: copyStack(stack),
      position: [...position],
      velocity: [...velocity],
      expires: tick + DROP_LIFETIME_TICKS,
      pickupAt: tick + 6,
      owner,
      ownerPickupAt: tick + 30
    });
    return id;
  }
  step(world, tick) {
    for (const [id, drop] of this.values) {
      if (tick >= drop.expires) {
        this.values.delete(id);
        continue;
      }
      const [x, y, z] = drop.position;
      if (!world.has_column(Math.floor(x / 16), Math.floor(z / 16))) continue;
      drop.velocity[1] = Math.max(-12, drop.velocity[1] - 18 / 30);
      const state = world.sweep_body(
        x,
        y,
        z,
        drop.velocity[0] / 30,
        drop.velocity[1] / 30,
        drop.velocity[2] / 30,
        0.125,
        0.25
      );
      const position = [
        Math.max(-255.875, Math.min(255.875, state[0])),
        Math.max(0, Math.min(255.75, state[1])),
        Math.max(-255.875, Math.min(255.875, state[2]))
      ];
      for (let i = 0; i < 3; i++)
        if (state[i + 3] || state[i] !== position[i]) drop.velocity[i] = 0;
      drop.velocity[0] *= 0.9;
      drop.velocity[2] *= 0.9;
      if (position.some((n, i) => Math.abs(n - drop.position[i]) > 1e-5)) {
        drop.position = position;
        drop.revision++;
      }
    }
  }
  nearby(position, radius) {
    return [...this.values.values()].filter(
      (drop) => Math.hypot(
        drop.position[0] - position[0],
        drop.position[1] - position[1],
        drop.position[2] - position[2]
      ) <= radius
    ).map((drop) => ({
      id: drop.id,
      revision: drop.revision,
      stack: copyStack(drop.stack),
      position: [...drop.position]
    }));
  }
  eligible(id, actor, tick) {
    const drop = this.values.get(id);
    return !!drop && tick >= drop.pickupAt && (drop.owner !== actor || tick >= drop.ownerPickupAt);
  }
  take(id, count) {
    const drop = this.values.get(id);
    if (!drop || !Number.isInteger(count) || count < 1 || count > drop.stack.count)
      throw new Error("invalid pickup commit");
    if (count === drop.stack.count) this.values.delete(id);
    else {
      drop.stack = { ...drop.stack, count: drop.stack.count - count };
      drop.revision++;
    }
  }
  dispose() {
    this.values.clear();
  }
};

// src/sim/mining.ts
function miningPlan(block, item) {
  const tool = item?.tool, correct = !!tool && tool.kind === block.mining.tool && tool.tier >= (block.mining.tier ?? 0);
  return {
    allowed: !block.mining.requiresTool || correct,
    ticks: Math.max(1, Math.ceil(block.mining.seconds * WORLD_HZ / (correct ? tool.speed : 1)))
  };
}

// src/sim/sunlight.ts
function exposedToSun(world, content, position, ceiling) {
  const x = position[0], z = position[2], head = position[1] + 1.81;
  if (head >= 256 || !world.has_column(Math.floor(x / 16), Math.floor(z / 16))) return false;
  for (let y = Math.floor(head); y <= Math.min(255, ceiling); y++) {
    const block = content.blocks[world.get_block(Math.floor(x), y, Math.floor(z))];
    if (!block) return false;
    if (block.shape === "air" || (block.opacity ?? (block.opaque === false ? 0 : 15)) === 0)
      continue;
    if (block.shape === "liquid" || !world.line_clear(x, Math.max(head, y + 1e-6), z, x, y + 1 - 1e-6, z))
      return false;
  }
  return true;
}

// src/sim/explosives.ts
var Explosives = class _Explosives {
  values = /* @__PURE__ */ new Map();
  next = 0;
  owners() {
    return [...new Set([...this.values.values()].map((body) => body.owner))].sort();
  }
  checkpoint(content) {
    return Object.freeze({
      schema: 1,
      contentHash: content.hash,
      next: this.next,
      entries: Object.freeze(
        [...this.values.values()].map((body) => {
          const family = content.blocks[body.state]?.name, rule = content.behavior.find((block) => block.family === family)?.explosive;
          if (!rule || rule.fuse !== body.rule.fuse || rule.radius !== body.rule.radius || rule.damage !== body.rule.damage)
            throw new Error("explosive checkpoint content mismatch");
          return Object.freeze({
            id: body.id,
            revision: body.revision,
            state: body.state,
            position: Object.freeze([...body.position]),
            velocity: Object.freeze([...body.velocity]),
            remaining: body.remaining,
            total: body.total,
            owner: body.owner
          });
        })
      )
    });
  }
  static fromCheckpoint(content, value) {
    const invalid = () => {
      throw new Error("invalid explosives checkpoint");
    };
    if (!checkpointObject(value, ["schema", "contentHash", "next", "entries"]) || value.schema !== 1 || value.contentHash !== content.hash || !checkpointInteger(value.next) || !Array.isArray(value.entries))
      return invalid();
    const restored = new _Explosives(), entries = /* @__PURE__ */ new Map();
    for (const b of value.entries) {
      if (!checkpointObject(b, [
        "id",
        "revision",
        "state",
        "position",
        "velocity",
        "remaining",
        "total",
        "owner"
      ]) || !checkpointCounterId(b.id, "tnt", value.next) || entries.has(b.id) || !checkpointInteger(b.revision) || !checkpointInteger(b.state, 1, content.blocks.length - 1) || !checkpointPosition(b.position) || !checkpointVelocity(b.velocity) || !checkpointInteger(b.total, 30, 900) || !checkpointInteger(b.remaining, 0, b.total) || b.remaining !== Math.max(0, b.total - b.revision) || !checkpointIdentity(b.owner))
        return invalid();
      const rule = content.behavior.find(
        (block) => block.family === content.blocks[b.state].name
      )?.explosive;
      if (!rule) return invalid();
      entries.set(b.id, {
        id: b.id,
        revision: b.revision,
        state: b.state,
        position: [...b.position],
        velocity: [...b.velocity],
        remaining: b.remaining,
        total: b.total,
        owner: b.owner,
        rule: { ...rule }
      });
    }
    restored.values = entries;
    restored.next = value.next;
    return restored;
  }
  get size() {
    return this.values.size;
  }
  get positions() {
    return [...this.values.values()].map((body) => body.position);
  }
  add(owner, state, position, rule, fuse = rule.fuse) {
    if (!checkpointIdentity(owner) || this.next === Number.MAX_SAFE_INTEGER || !Number.isInteger(state) || state < 1 || state >= 65535 || !checkpointPosition(position) || !Number.isInteger(fuse) || fuse < 30 || fuse > 900 || !Number.isInteger(rule.fuse) || rule.fuse < 30 || rule.fuse > 900 || !Number.isInteger(rule.radius) || rule.radius < 1 || rule.radius > 4 || !Number.isInteger(rule.damage) || rule.damage < 1 || rule.damage > 20)
      throw new Error("invalid primed explosive");
    const id = `tnt-${++this.next}`;
    this.values.set(id, {
      id,
      revision: 0,
      state,
      position: [...position],
      remaining: fuse,
      total: fuse,
      owner,
      rule: { ...rule },
      velocity: [0, 2, 0]
    });
    return id;
  }
  step(world) {
    for (const body of this.values.values()) {
      body.remaining = Math.max(0, body.remaining - 1);
      body.revision++;
      const [x, y, z] = body.position;
      if (!around(Math.floor(x / 16), Math.floor(z / 16), 1).every((p) => world.has_column(p.x, p.z)))
        continue;
      body.velocity[1] = Math.max(-12, body.velocity[1] - 18 / 30);
      const moved = world.sweep_body(
        x,
        y,
        z,
        body.velocity[0] / 30,
        body.velocity[1] / 30,
        body.velocity[2] / 30,
        0.45,
        0.9
      );
      body.position = [
        Math.max(-255.55, Math.min(255.55, moved[0])),
        Math.max(0, Math.min(255.1, moved[1])),
        Math.max(-255.55, Math.min(255.55, moved[2]))
      ];
      for (let axis = 0; axis < 3; axis++)
        if (moved[axis + 3] || body.position[axis] !== moved[axis]) body.velocity[axis] = 0;
    }
  }
  due() {
    return [...this.values.values()].filter((body) => body.remaining === 0).map(({ velocity, ...body }) => ({ ...body, position: [...body.position] }));
  }
  remove(id) {
    this.values.delete(id);
  }
  nearby(position, radius) {
    return [...this.values.values()].filter(
      (body) => Math.hypot(...body.position.map((value, axis) => value - position[axis])) <= radius
    ).map(({ owner, rule, velocity, ...body }) => ({ ...body, position: [...body.position] }));
  }
  dispose() {
    this.values.clear();
  }
};

// src/sim/blast.ts
function resistance(world, content, origin, target, excluded, rules) {
  const delta = target.map((value, axis) => value - origin[axis]), length = Math.hypot(...delta);
  if (length < 1e-8) return 0;
  const direction = delta.map((value) => value / length), cell = origin.map((value, axis) => Math.floor(value + direction[axis] * 1e-6));
  const step = direction.map(Math.sign), increment = direction.map((value) => value === 0 ? Infinity : Math.abs(1 / value));
  const next = cell.map(
    (value, axis) => direction[axis] === 0 ? Infinity : (value + (step[axis] > 0 ? 1 : 0) - origin[axis]) / direction[axis]
  );
  let at = 0, total = 0;
  while (at < length - 1e-7) {
    const end = Math.min(length, ...next);
    if (!cell.every((value, axis) => value === excluded[axis])) {
      const state = world.get_block(cell[0], cell[1], cell[2]), block = content.blocks[state];
      if (!block) return Infinity;
      if (block.shape !== "air") {
        if (block.breakable === false || block.shape === "liquid") return Infinity;
        if (block.solid !== false) {
          const a = origin.map((value, axis) => value + direction[axis] * (at + 1e-6)), b = origin.map(
            (value, axis) => value + direction[axis] * Math.max(at + 1e-6, end - 1e-6)
          );
          if (!world.line_clear(a[0], a[1], a[2], b[0], b[1], b[2]))
            total += rules.get(block.name)?.blastResistance ?? 1;
        }
      }
    }
    at = end;
    for (let axis = 0; axis < 3; axis++)
      if (Math.abs(next[axis] - end) < 1e-7) {
        cell[axis] += step[axis];
        next[axis] += increment[axis];
      }
  }
  return total;
}
function blastPlan(world, content, position, radius) {
  const result = [];
  const rules = new Map(content.behavior.map((rule) => [rule.family, rule]));
  for (let y = Math.floor(position[1] - radius); y <= Math.floor(position[1] + radius); y++)
    for (let z = Math.floor(position[2] - radius); z <= Math.floor(position[2] + radius); z++)
      for (let x = Math.floor(position[0] - radius); x <= Math.floor(position[0] + radius); x++) {
        if (y === 0 || !inBounds(x, y, z)) continue;
        const target = [x + 0.5, y + 0.5, z + 0.5], distance = Math.hypot(...target.map((value, axis) => value - position[axis]));
        if (distance > radius) continue;
        const state = world.get_block(x, y, z), block = content.blocks[state], rule = rules.get(block?.name);
        if (!block || !rule || block.shape === "air" || block.shape === "liquid" || block.breakable === false)
          continue;
        const cell = [x, y, z];
        if ((rule.blastResistance ?? 1) + resistance(world, content, position, target, cell, rules) <= radius + 0.5 - distance)
          result.push({ cell, state, rule });
      }
  return result;
}

// src/shared/explosives.ts
var EXPLOSIVE_RADIUS = 48;
var EXPLOSIONS_PER_TICK = 2;
var CHAIN_FUSE = 30;

// src/shared/combat.ts
var UNARMED = Object.freeze({ damage: 2, cooldown: 15, reach: 3 });
function combatProfile(item) {
  return item?.combat ?? UNARMED;
}
function rayBody(origin, direction, feet, reach) {
  let near = 0, far = reach;
  for (let axis = 0; axis < 3; axis++) {
    const min = feet[axis] - (axis === 1 ? 0 : 0.3), max = feet[axis] + (axis === 1 ? 1.8 : 0.3);
    if (Math.abs(direction[axis]) < 1e-12) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / direction[axis], b = (max - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}

// src/shared/loot.ts
function mix(value) {
  let n = value >>> 0;
  n = Math.imul(n ^ n >>> 16, 2146121005);
  n = Math.imul(n ^ n >>> 15, 2221713035);
  return (n ^ n >>> 16) >>> 0;
}
function blockDrops(rule, seed, cell, revision) {
  const drops = rule.drops.map((drop) => ({ ...drop }));
  if (!rule.forage) return drops;
  const { none, entries } = rule.forage, total = entries.reduce((sum, entry) => sum + entry.weight, none);
  const hash2 = mix(
    seed ^ Math.imul(cell[0], 521288629) ^ Math.imul(cell[1], 1597334677) ^ Math.imul(cell[2], 1821285621) ^ mix(revision >>> 0) ^ mix(Math.floor(revision / 4294967296))
  );
  let roll = hash2 % total - none;
  if (roll < 0) return drops;
  for (const entry of entries) {
    if (roll < entry.weight) {
      drops.push({ itemType: entry.itemType, count: entry.count });
      break;
    }
    roll -= entry.weight;
  }
  return drops;
}

// src/sim/game-room.ts
var GameRoom = class _GameRoom {
  store;
  inventories;
  drops;
  explosives;
  currentMode;
  get mode() {
    return this.currentMode;
  }
  paused = false;
  pausedAt = 0;
  ended = false;
  pauseReason = "manual";
  actors = /* @__PURE__ */ new Map();
  vitals = /* @__PURE__ */ new Map();
  resting = /* @__PURE__ */ new Map();
  policies = /* @__PURE__ */ new Map();
  ownerAuthorizations = null;
  clock;
  observerClock;
  observerTick = 0;
  tick = 0;
  epoch = 0;
  hitSequence = 0;
  explosionSequence = 0;
  spawn;
  content;
  build;
  ports;
  worldId;
  seed;
  constructor(store, content, build, ports, worldId, seed, now, initialTick = 0, mode = "creative", recovery) {
    if (!Number.isFinite(now) || now < 0) throw new Error("invalid room checkpoint time");
    if (!Number.isSafeInteger(initialTick) || initialTick < 0)
      throw new Error("invalid world tick");
    this.tick = initialTick;
    this.store = store;
    this.content = content;
    this.build = build;
    this.ports = ports;
    this.worldId = worldId;
    this.seed = seed;
    this.currentMode = mode;
    this.drops = recovery ? Drops.fromCheckpoint(content, recovery.data.drops) : new Drops(content);
    this.explosives = recovery ? Explosives.fromCheckpoint(content, recovery.data.explosives) : new Explosives();
    const access = {
      station: (cell) => content.behavior.find(
        (b) => b.family === content.blocks[store.world.get_block(...cell)]?.name
      )?.interaction ?? null,
      canUse: (id, cell, opening) => this.canUseStation(id, cell, opening)
    };
    this.inventories = recovery ? Inventories.fromCheckpoint(content, access, recovery.data.inventories) : new Inventories(content, access);
    this.clock = new FixedScheduler(now);
    this.observerClock = new FixedScheduler(now);
    const p = store.generator.find_spawn();
    this.spawn = [
      Math.max(-224, Math.min(224, p[0])) + 0.5,
      Math.min(250, p[1] + 2),
      Math.max(-224, Math.min(224, p[2])) + 0.5
    ];
    if (recovery) {
      const d = recovery.data, own = this.inventories.checkpoint(), playerIds = new Set(d.players.map((p2) => p2.id));
      if (own.players.length !== d.players.length || own.players.some((p2) => !playerIds.has(p2.id)))
        throw new Error("incoherent room ownership checkpoint");
      if (d.drops.tick !== d.tick)
        throw new Error("incoherent room checkpoint drop clock");
      this.paused = d.paused;
      this.pausedAt = now;
      this.epoch = d.epoch + 1;
      this.hitSequence = d.hitSequence;
      this.explosionSequence = d.explosionSequence;
      this.spawn = [...d.spawn];
      const inventoryById = new Map(own.players.map((p2) => [p2.id, p2]));
      for (const p2 of d.players) {
        const inventory = inventoryById.get(p2.id);
        if (p2.vitals.health === 0 && [...inventory.bag, ...inventory.craft2, ...inventory.craft3, ...inventory.equipment].some(
          Boolean
        ))
          throw new Error("incoherent dead ownership checkpoint");
        this.vitals.set(p2.id, Vitals.fromCheckpoint(p2.vitals));
        this.resting.set(p2.id, {
          state: new Float64Array(p2.state),
          yaw: p2.yaw,
          pitch: p2.pitch,
          until: p2.reservationMs === 0 ? now - 1 : now + (p2.reservationMs ?? RECONNECT_RESERVATION_MS)
        });
      }
      const owners = new Set(this.explosives.checkpoint(content).entries.map((body) => body.owner));
      for (const id of owners) {
        if (!playerIds.has(id)) throw new Error("incoherent explosive owner checkpoint");
        if (!recovery.owners.has(id)) throw new Error("restored explosive owner policy missing");
        const owner = recovery.owners.get(id);
        if (owner !== null && (!checkpointObject(owner, ["id", "role", "capabilities"]) || owner.id !== id || !["participant", "observer"].includes(owner.role) || !checkpointObject(owner.capabilities, [
          "build",
          "fly",
          "observe",
          "combat",
          "explosives"
        ]) || !["build", "fly", "observe", "combat", "explosives"].every(
          (key2) => typeof owner.capabilities[key2] === "boolean"
        )))
          throw new Error("invalid restored owner policy");
        this.policies.set(
          id,
          owner ? { role: owner.role, capabilities: { ...owner.capabilities } } : {
            role: "participant",
            capabilities: {
              build: false,
              fly: false,
              observe: false,
              combat: false,
              explosives: false
            }
          }
        );
      }
      if (this.drops.checkpoint(d.tick).entries.some((drop) => drop.owner !== null && !playerIds.has(drop.owner)))
        throw new Error("incoherent drop owner checkpoint");
      for (const chest of own.chests) {
        const state = this.store.edits(chest.cell[0] >> 4, chest.cell[2] >> 4).find(([local]) => local === localIndex(...chest.cell))?.[1];
        if (state === void 0 || content.behavior.find((rule) => rule.family === content.blocks[state]?.name)?.interaction !== "container")
          throw new Error("incoherent checkpoint chest terrain");
      }
    }
  }
  static fromCheckpoint(world, generator, content, build, ports, value, now, owners = /* @__PURE__ */ new Map()) {
    const data2 = readRoomCheckpoint(value, content, build);
    const store = WorldStore.fromCheckpoint(world, generator, content, data2.world);
    return new _GameRoom(
      store,
      content,
      build,
      ports,
      data2.worldId,
      data2.seed,
      now,
      data2.tick,
      data2.mode,
      { data: data2, owners }
    );
  }
  checkpoint(now) {
    if (!Number.isFinite(now) || now < 0) throw new Error("invalid room checkpoint time");
    const reservationNow = this.paused ? this.pausedAt : now;
    const players = [...this.vitals].map(([id, vitals]) => {
      const actor = this.actors.get(id), pose = this.resting.get(id), state = actor?.connection ? this.store.world.player_state(actor.slot) : actor?.saved ?? pose?.state;
      if (!state || !validCheckpointBody(Array.from(state)) || actor?.connection && actor.role === "participant" && actor.vitals.dead && !actor.deathHandled)
        throw new Error("room checkpoint is not at a coherent actor boundary");
      return Object.freeze({
        id,
        state: Object.freeze(Array.from(state)),
        yaw: actor?.controls.yaw ?? pose.yaw,
        pitch: actor?.controls.pitch ?? pose.pitch,
        reservationMs: actor?.connection ? null : Math.max(
          0,
          Math.min(
            RECONNECT_RESERVATION_MS,
            (actor ? actor.disconnectedAt + RECONNECT_RESERVATION_MS : pose.until) - reservationNow
          )
        ),
        vitals: vitals.checkpoint()
      });
    });
    return Object.freeze({
      schema: 1,
      worldId: this.worldId,
      seed: this.seed,
      preset: "blockyard-natural-v2",
      generatorVersion: GENERATOR_VERSION,
      contentHash: this.content.hash,
      engineHash: this.build.engineHash,
      sourceBuildId: this.build.buildId,
      bounds: BOUNDS,
      mode: this.mode,
      tick: this.tick,
      epoch: this.epoch,
      paused: this.paused,
      hitSequence: this.hitSequence,
      explosionSequence: this.explosionSequence,
      spawn: Object.freeze([...this.spawn]),
      players: Object.freeze(players),
      world: this.store.checkpoint(this.content),
      inventories: this.inventories.checkpoint(),
      drops: this.drops.checkpoint(this.tick),
      explosives: this.explosives.checkpoint(this.content)
    });
  }
  join(admitted, connection, now) {
    if (this.ended) {
      this.ports.close(connection, "SESSION_ENDED");
      return;
    }
    const old = this.actors.get(admitted.id);
    const reservationNow = this.paused ? this.pausedAt : now;
    const pose = this.resting.get(admitted.id), continuing = old ? !!old.connection || reservationNow - old.disconnectedAt <= RECONNECT_RESERVATION_MS : !!pose && pose.until >= reservationNow;
    if (old?.connection) {
      this.ports.close(old.connection, "REPLACED");
      this.store.world.player_remove(old.slot);
    }
    const initial = old?.saved.slice() ?? pose?.state.slice() ?? new Float64Array([...this.spawn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const slot = this.store.world.player_add(initial[0], initial[1], initial[2]);
    this.store.world.player_restore(slot, initial);
    this.store.world.set_frozen(slot, true);
    this.store.world.set_ghost(slot, admitted.role === "observer");
    if (!admitted.capabilities.fly || admitted.role === "participant" && this.mode === "survival")
      this.store.world.set_flying(slot, false);
    const epoch = ++this.epoch;
    const controls = {
      ...NEUTRAL,
      yaw: old?.controls.yaw ?? pose?.yaw ?? 0,
      pitch: old?.controls.pitch ?? pose?.pitch ?? 0
    };
    const vitals = this.vitals.get(admitted.id) ?? new Vitals();
    if (!continuing) vitals.resetMotion();
    this.vitals.set(admitted.id, vitals);
    const dead = admitted.role === "participant" && vitals.dead;
    const actor = {
      ...admitted,
      connection,
      slot,
      epoch,
      queue: new InputQueue(epoch, controls),
      ledger: new ActionLedger(epoch),
      controls,
      phase: dead ? "dead" : "preparing",
      vitals,
      movement: DEFAULT_MOVEMENT,
      deathHandled: dead,
      lastVitals: "",
      resolved: false,
      spawnNew: !continuing,
      focused: false,
      disconnectedAt: now,
      saved: initial,
      subscriptions: /* @__PURE__ */ new Map(),
      nextSubscription: 0,
      visible: /* @__PURE__ */ new Map(),
      catalogItem: old?.catalogItem ?? null,
      catalogSequence: 0,
      pending: /* @__PURE__ */ new Map(),
      mining: null,
      visibleDrops: /* @__PURE__ */ new Map(),
      dropsReset: true,
      visibleExplosives: /* @__PURE__ */ new Map(),
      explosivesReset: true
    };
    this.actors.set(actor.id, actor);
    this.resting.set(actor.id, {
      state: initial.slice(),
      yaw: controls.yaw,
      pitch: controls.pitch,
      until: Infinity
    });
    this.policies.set(actor.id, { role: actor.role, capabilities: actor.capabilities });
    this.inventories.join(actor.id);
    actor.movement = this.movementProfile(actor);
    this.send(actor, {
      type: "welcome",
      actorId: actor.id,
      epoch,
      worldId: this.worldId,
      seed: this.seed,
      tick: this.tick,
      environmentVersion: ENVIRONMENT_VERSION,
      spawn: [initial[0], initial[1], initial[2]],
      buildId: this.build.buildId,
      contentHash: this.content.hash,
      generatorVersion: GENERATOR_VERSION,
      role: actor.role,
      mode: this.mode,
      combat: this.survival(actor) && actor.capabilities.combat,
      explosives: actor.role === "participant" && actor.capabilities.build && actor.capabilities.explosives
    });
    this.send(actor, this.lifecycle());
    this.inventoryView(actor);
    this.subscriptions(actor);
    this.store.require(this.positions());
    this.vitalsView(actor);
    if (dead) this.baseline(actor, "join");
  }
  disconnect(connection, now) {
    const actor = this.find(connection);
    if (!actor) return;
    const reservationNow = this.paused ? this.pausedAt : now;
    actor.saved = this.store.world.player_state(actor.slot);
    this.resting.set(actor.id, {
      state: actor.saved.slice(),
      yaw: actor.controls.yaw,
      pitch: actor.controls.pitch,
      until: reservationNow + RECONNECT_RESERVATION_MS
    });
    this.store.world.player_remove(actor.slot);
    actor.connection = null;
    actor.disconnectedAt = reservationNow;
    actor.epoch = ++this.epoch;
    actor.queue.reset(actor.epoch);
    actor.ledger = new ActionLedger(actor.epoch);
    actor.subscriptions.clear();
    actor.mining = null;
    this.inventories.close(actor.id);
    this.store.require(this.positions());
  }
  receive(connection, message, now) {
    const a = this.find(connection);
    if (!a || this.ended) return;
    if (message.type === "input") {
      if (a.phase !== "playing" || !a.focused || this.paused && a.role === "participant") return;
      let resync = false;
      for (const frame of message.frames)
        if (a.queue.receive(frame, now) === "resync") resync = true;
      if (resync) this.baseline(a, "resync");
      return;
    }
    if (message.type === "resync") {
      const sub = a.subscriptions.get(columnKey(message.x, message.z));
      if (sub?.id === message.subscription) this.chunkBaseline(a, sub);
      return;
    }
    if (message.type === "palette") {
      if (this.mode !== "creative" || a.role !== "participant" || this.paused || a.phase !== "playing" || message.epoch !== a.epoch || message.sequence <= a.catalogSequence)
        return;
      const block = this.content.blocks[message.state];
      const item = block && block.placeable !== false && block.shape !== "air" && this.content.items.find((item2) => item2.places === block.name);
      if (!item) return;
      a.catalogItem = item.itemType;
      a.catalogSequence = message.sequence;
      return;
    }
    if (message.type === "ready") {
      if (message.epoch !== a.epoch || a.phase !== "preparing" || !a.resolved) return;
      const s = this.store.world.player_state(a.slot), required = around(Math.floor(s[0] / 16), Math.floor(s[2] / 16), 1);
      if (!this.store.ready(Math.floor(s[0] / 16), Math.floor(s[2] / 16)) || message.columns.length !== required.length || !required.every(
        (p) => message.columns.some(
          (c) => c.x === p.x && c.z === p.z && c.revision === this.store.revision(p.x, p.z)
        )
      ))
        return;
      a.phase = "playing";
      this.store.world.set_frozen(a.slot, !a.focused || this.paused && a.role === "participant");
      this.baseline(a, "ready");
      return;
    }
    if (message.type === "focus") {
      if (message.epoch !== a.epoch) return;
      if (a.phase === "dead") return;
      if (this.paused && a.role === "participant" && message.active) return;
      a.focused = message.active;
      this.invalidate(a);
      this.store.world.set_frozen(a.slot, !a.focused || a.phase !== "playing");
      this.baseline(a, "focus");
      return;
    }
    if (message.type === "respawn") {
      const result = a.ledger.run(message.epoch, message.sequence, () => ({
        ok: a.role === "participant" && a.phase === "dead" && !this.paused && a.vitals.dead && a.vitals.view().respawnIn === 0,
        reason: "respawn"
      }));
      this.send(a, {
        type: "result",
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ..."value" in result ? { outcome: result.value } : {}
      });
      if (result.status === "applied" && result.value.ok && a.vitals.respawn()) {
        const state = new Float64Array([...this.spawn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
        this.store.world.player_restore(a.slot, state);
        a.saved = state;
        a.focused = false;
        a.phase = "preparing";
        a.resolved = false;
        a.spawnNew = true;
        a.deathHandled = false;
        this.invalidate(a);
        a.movement = this.movementProfile(a);
        this.store.require(this.positions());
        this.baseline(a, "respawn");
      }
      return;
    }
    if (message.type === "inventory") {
      const result = a.ledger.run(message.epoch, message.sequence, () => {
        if (a.phase !== "playing" || this.paused) return { ok: false, reason: "not_ready" };
        if (a.role !== "participant" || !a.capabilities.build)
          return { ok: false, reason: "forbidden" };
        const operation = message.operation;
        const outcome = operation.kind === "consume" ? this.survival(a) ? this.inventories.consume(
          a.id,
          operation.slot,
          operation.revision,
          (nutrition) => a.vitals.eat(nutrition)
        ) : { ok: false, reason: "forbidden" } : operation.kind === "drop" ? this.inventories.drop(
          a.id,
          operation.slot,
          operation.count,
          operation.revision,
          (stack) => {
            const p = this.store.world.player_state(a.slot), yaw = a.controls.yaw;
            this.drops.add(stack, [p[0], p[1] + 0.8, p[2]], this.tick, a.id, [
              Math.sin(yaw) * 2,
              2,
              -Math.cos(yaw) * 2
            ]);
          }
        ) : this.inventories.transact(a.id, operation, this.mode === "creative");
        if (outcome.containerChanged)
          for (const id of this.inventories.viewers(outcome.containerChanged)) {
            const viewer = this.actors.get(id);
            if (viewer && viewer.id !== a.id) this.inventoryView(viewer);
          }
        return { ok: outcome.ok, reason: outcome.reason };
      });
      this.send(a, {
        type: "result",
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ..."value" in result ? { outcome: result.value } : {}
      });
      this.inventoryView(a);
      this.vitalsView(a);
      return;
    }
    if (message.type === "action" || message.type === "flight" || message.type === "mining" || message.type === "attack" || message.type === "ignite") {
      if ((message.type === "action" || message.type === "attack" || message.type === "ignite" || message.type === "mining" && message.target !== null) && message.epoch === a.epoch && message.sequence > a.ledger.boundary && a.phase === "playing" && a.focused && message.inputSequence > a.queue.ack) {
        if (a.pending.has(message.sequence)) return;
        if (message.inputSequence > a.queue.received || a.pending.size >= 32) {
          const denied = a.ledger.run(message.epoch, message.sequence, () => ({
            ok: false,
            reason: "input_dependency"
          }));
          this.send(a, {
            type: "result",
            epoch: message.epoch,
            sequence: message.sequence,
            status: denied.status,
            ..."value" in denied ? { outcome: denied.value } : {}
          });
          return;
        }
        if (!a.pending.has(message.sequence))
          a.pending.set(message.sequence, { message, expires: now + 500 });
        return;
      }
      const result = a.ledger.run(message.epoch, message.sequence, () => {
        if (message.type === "mining" && message.target === null) {
          this.cancelMining(a);
          return { ok: true, reason: "cancelled" };
        }
        if (a.phase !== "playing" || !a.focused || this.paused && a.role === "participant")
          return { ok: false, reason: "not_ready" };
        if (message.type === "mining") return this.startMining(a, message, now);
        if (message.type === "attack") return this.attack(a, message, now);
        if (message.type === "ignite") return this.ignite(a, message, now);
        if (message.type === "flight") {
          if (!a.capabilities.fly || a.role === "participant" && this.mode === "survival")
            return { ok: false, reason: "forbidden" };
          this.store.world.set_flying(a.slot, message.on);
          this.invalidate(a);
          this.baseline(a, "flight");
          return { ok: true, reason: "flight" };
        }
        return this.edit(a, message);
      });
      this.send(a, {
        type: "result",
        epoch: message.epoch,
        sequence: message.sequence,
        status: result.status,
        ..."value" in result ? { outcome: result.value } : {}
      });
    }
  }
  advance(now) {
    let result;
    if (this.paused) {
      this.clock.reset(now);
      this.advanceObservers(now);
      result = { steps: 0, droppedMs: 0 };
    } else {
      this.observerClock.reset(now);
      result = this.clock.advance(now, () => {
        this.tick++;
        for (const a of this.actors.values())
          if (a.connection && a.phase === "playing") this.refreshMovement(a);
        for (let sub = 0; sub < 2; sub++)
          for (const a of this.actors.values())
            if (a.connection && a.phase === "playing" && a.focused) {
              const input = a.queue.take(now);
              a.controls = input.controls;
              const before = this.store.world.player_state(a.slot);
              const jumped = stepBoundedMovement(
                this.store.world,
                a.slot,
                input.controls,
                a.movement
              );
              if (this.survival(a)) {
                const after = this.store.world.player_state(a.slot);
                const climbing = [0.1, 0.9, 1.6].some(
                  (height) => this.content.blocks[this.store.world.get_block(
                    Math.floor(after[0]),
                    Math.floor(after[1] + height),
                    Math.floor(after[2])
                  )]?.climbable
                );
                const effects = equipmentEffects(this.inventories.equipped(a.id));
                const landing = a.vitals.movement(
                  before,
                  after,
                  climbing,
                  effects.fallImmune ? 1 : effects.fall,
                  input.controls.sprint && a.movement.sprint
                );
                let worn = landing.impact > 0 && this.inventories.wearEquipment(a.id, "fall");
                if (jumped) worn = this.inventories.wearEquipment(a.id, "jump") || worn;
                if (worn) {
                  this.inventoryView(a);
                  this.refreshMovement(a);
                }
                this.handleDeath(a);
              }
              if (input.resync) this.baseline(a, "resync");
            }
        for (const a of this.actors.values())
          if (a.connection) {
            if ((this.survival(a) || a.role === "participant" && a.vitals.dead) && (a.phase === "playing" || a.phase === "dead")) {
              const body = this.store.world.player_state(a.slot);
              const familyAt = (height) => this.content.blocks[this.store.world.get_block(
                Math.floor(body[0]),
                Math.floor(body[1] + height),
                Math.floor(body[2])
              )]?.name;
              body[8] = Number(familyAt(1.62) === "water");
              body[9] = Number([0.1, 0.9, 1.6].some((height) => familyAt(height) === "lava"));
              a.vitals.step(body);
              const effects = equipmentEffects(this.inventories.equipped(a.id));
              if (a.vitals.sunlight(
                a.phase === "playing" && effects.sunRegen && a.vitals.view().health < 20 && !body[8] && !body[9] && sampleEnvironment(this.tick, this.seed).sun[1] > 0.2 && exposedToSun(
                  this.store.world,
                  this.content,
                  body,
                  this.store.heightAt(Math.floor(body[0]), Math.floor(body[2]))
                )
              )) {
                this.inventories.wearEquipment(a.id, "sun");
                this.inventoryView(a);
              }
              if (a.vitals.visibility(a.phase === "playing" && effects.vision)) {
                this.inventories.wearEquipment(a.id, "vision");
                this.inventoryView(a);
              }
              this.handleDeath(a);
              if (this.tick % 3 === 0) this.vitalsView(a);
            }
            for (const [sequence, pending] of [...a.pending].sort(([a2], [b]) => a2 - b)) {
              if (pending.expires < now) {
                a.pending.delete(sequence);
                const result2 = a.ledger.run(pending.message.epoch, sequence, () => ({
                  ok: false,
                  reason: "input_timeout"
                }));
                this.send(a, {
                  type: "result",
                  epoch: pending.message.epoch,
                  sequence,
                  status: result2.status,
                  ..."value" in result2 ? { outcome: result2.value } : {}
                });
              } else if (pending.message.inputSequence <= a.queue.ack) {
                a.pending.delete(sequence);
                this.receive(a.connection, pending.message, now);
              } else break;
            }
            a.saved = this.store.world.player_state(a.slot);
            this.subscriptions(a);
            this.advanceMining(a, now);
            if (this.tick % 6 === 0 && this.inventories.refresh(a.id)) this.inventoryView(a);
          }
        this.store.require(this.positions());
        this.explosives.step(this.store.world);
        this.advanceExplosions(now);
        this.store.require(this.positions());
        this.drops.step(this.store.world, this.tick);
        if (this.tick % 3 === 0) {
          this.pickups();
          this.dropSnapshots();
          this.explosiveSnapshots();
        }
        if (this.tick % 2 === 0) this.snapshots(now);
      });
    }
    for (const a of this.actors.values())
      if (a.connection && a.phase === "preparing" && !a.resolved) {
        const state = this.store.world.player_state(a.slot), cx = Math.floor(state[0] / 16), cz = Math.floor(state[2] / 16);
        if (!this.store.ready(cx, cz)) continue;
        if (!this.store.world.player_fits(state[0], state[1], state[2]) || a.spawnNew) {
          const candidates = [];
          for (let dz = -10; dz <= 10; dz++)
            for (let dx = -10; dx <= 10; dx++)
              candidates.push({ x: state[0] + dx, z: state[2] + dz, distance: dx * dx + dz * dz });
          candidates.sort((a2, b) => a2.distance - b.distance);
          let found = false;
          for (const candidate of candidates) {
            if (!inBounds(candidate.x, 1, candidate.z)) continue;
            const x = Math.floor(candidate.x), z = Math.floor(candidate.z);
            for (let y = Math.min(252, this.store.heightAt(x, z)); y >= 0; y--) {
              const height = this.store.world.collision_top(x, y, z);
              if (height <= 0) continue;
              const block = this.content.blocks[this.store.world.get_block(x, y, z)];
              if (!block || !["grass_block", "dirt", "stone", "sand", "bedrock"].includes(block.name))
                continue;
              const foot = y + height + 5e-3;
              if ([
                [0, 0],
                [0.7, 0],
                [-0.7, 0],
                [0, 0.7],
                [0, -0.7]
              ].every(
                ([ox, oz]) => this.store.world.player_fits(candidate.x + ox, foot, candidate.z + oz) && this.store.world.player_fits(candidate.x + ox, foot + 1.3, candidate.z + oz) && [0.1, 0.9, 1.62].every(
                  (height2) => !["water", "lava"].includes(
                    this.content.blocks[this.store.world.get_block(
                      Math.floor(candidate.x + ox),
                      Math.floor(foot + height2),
                      Math.floor(candidate.z + oz)
                    )]?.name
                  )
                )
              )) {
                state[0] = candidate.x;
                state[1] = foot;
                state[2] = candidate.z;
                state[3] = state[4] = state[5] = 0;
                found = true;
              }
              break;
            }
            if (found) break;
          }
          if (!found) continue;
        }
        this.store.world.player_restore(a.slot, state);
        a.resolved = true;
        this.baseline(a, "join");
      }
    const reservationNow = this.paused ? this.pausedAt : now;
    for (const [id, a] of this.actors)
      if (!a.connection && reservationNow - a.disconnectedAt > RECONNECT_RESERVATION_MS)
        this.actors.delete(id);
    return result;
  }
  advanceObservers(now) {
    this.observerClock.advance(now, () => {
      if (this.ended) return;
      this.observerTick++;
      for (let sub = 0; sub < 2; sub++)
        for (const a of this.actors.values())
          if (a.connection && a.role === "observer" && a.phase === "playing" && a.focused) {
            const input = a.queue.take(now);
            a.controls = input.controls;
            stepBoundedMovement(this.store.world, a.slot, input.controls, a.movement);
            if (input.resync) this.baseline(a, "resync");
          }
      for (const a of this.actors.values())
        if (a.connection && a.role === "observer") {
          a.saved = this.store.world.player_state(a.slot);
          this.subscriptions(a);
        }
      this.store.require(this.positions());
      if (this.observerTick % 3 === 0) {
        this.dropSnapshots();
        this.explosiveSnapshots();
      }
      if (this.observerTick % 2 === 0) this.snapshots(now);
    });
  }
  /** Called only by the trusted supervisor, at a worker message boundary. */
  staff(actorId, input, now) {
    const command = readStaffCommand(input);
    if (!command || !Number.isFinite(now)) return { ok: false, reason: "invalid" };
    if (this.ended) return { ok: false, reason: "ended" };
    if (command.kind === "mode") {
      if (this.mode === command.mode) return { ok: true, reason: "unchanged" };
      const connected = [...this.actors.values()].filter((a2) => a2.connection);
      if (connected.some((a2) => a2.role === "participant" && a2.vitals.dead && !a2.deathHandled))
        return { ok: false, reason: "not_ready" };
      if (!Number.isSafeInteger(this.epoch + connected.length))
        return { ok: false, reason: "invalid" };
      this.currentMode = command.mode;
      for (const a2 of connected) {
        this.inventories.close(a2.id);
        a2.focused = false;
        this.invalidate(a2);
        this.store.world.set_frozen(a2.slot, true);
        if (a2.role === "participant" && this.mode === "survival")
          this.store.world.set_flying(a2.slot, false);
        a2.vitals.resetMotion();
        if (a2.role === "participant" && a2.vitals.dead) a2.phase = "dead";
        else if (a2.phase === "dead") {
          a2.phase = "preparing";
          a2.resolved = false;
          a2.spawnNew = false;
        }
        a2.movement = this.movementProfile(a2);
        a2.saved = this.store.world.player_state(a2.slot);
        a2.catalogItem = null;
      }
      for (const a2 of connected) {
        this.send(a2, {
          type: "rules",
          epoch: a2.epoch,
          mode: this.mode,
          combat: this.survival(a2) && a2.capabilities.combat,
          explosives: a2.role === "participant" && a2.capabilities.build && a2.capabilities.explosives
        });
        this.baseline(a2, "mode");
      }
      return { ok: true, reason: "mode" };
    }
    const a = this.actors.get(actorId), target = command.target === "spawn" ? null : this.actors.get(command.target);
    if (!a?.connection || command.target !== "spawn" && !target?.connection)
      return { ok: false, reason: "not_present" };
    if (a.phase === "dead" || target && target.phase !== "playing")
      return { ok: false, reason: "not_ready" };
    if (!Number.isSafeInteger(this.epoch + 1)) return { ok: false, reason: "invalid" };
    const destination = target ? this.store.world.player_state(target.slot) : this.spawn;
    if (!inBounds(destination[0], destination[1], destination[2]))
      return { ok: false, reason: "invalid" };
    const state = this.store.world.player_state(a.slot);
    state[0] = destination[0];
    state[1] = Math.min(253, destination[1] + (a.role === "observer" && target ? 2 : 0));
    state[2] = destination[2];
    state[3] = state[4] = state[5] = 0;
    this.inventories.close(a.id);
    this.invalidate(a);
    a.focused = false;
    a.vitals.resetMotion();
    a.phase = "preparing";
    a.resolved = false;
    a.spawnNew = false;
    this.store.world.player_restore(a.slot, state);
    this.store.world.set_frozen(a.slot, true);
    a.saved = this.store.world.player_state(a.slot);
    for (const viewer of this.actors.values())
      if (viewer.visible.delete(a.id)) this.send(viewer, { type: "actor_removed", id: a.id });
    for (const id of a.visible.keys()) this.send(a, { type: "actor_removed", id });
    a.visible.clear();
    for (const sub of a.subscriptions.values())
      this.send(a, { type: "unload", x: sub.x, z: sub.z, subscription: sub.id });
    a.subscriptions.clear();
    a.visibleDrops.clear();
    a.dropsReset = true;
    a.visibleExplosives.clear();
    a.explosivesReset = true;
    this.send(a, { type: "drops", reset: true, upsert: [], removed: [] });
    this.send(a, { type: "explosives", reset: true, upsert: [], removed: [] });
    this.subscriptions(a);
    this.store.require(this.positions());
    this.baseline(a, "teleport");
    return { ok: true, reason: "teleport" };
  }
  lifecycle() {
    return {
      type: "lifecycle",
      state: this.ended ? "ended" : this.paused ? "paused" : "playing",
      reason: this.ended ? "ended" : this.paused ? this.pauseReason : "allowed",
      tick: this.tick
    };
  }
  end(now) {
    if (this.ended) return;
    this.ended = true;
    this.setPaused(true, now, "ended");
    for (const a of this.actors.values())
      if (a.connection) this.ports.close(a.connection, "SESSION_ENDED");
  }
  setPaused(paused, now, reason = paused ? "manual" : "allowed") {
    if (this.ended && !paused) return;
    const changed = this.paused !== paused;
    if (!changed && this.pauseReason === reason) return;
    if (changed && paused) this.pausedAt = now;
    else if (changed) {
      const duration = Math.max(0, now - this.pausedAt);
      for (const actor of this.actors.values())
        if (!actor.connection) actor.disconnectedAt += duration;
      for (const pose of this.resting.values())
        if (Number.isFinite(pose.until)) pose.until += duration;
    }
    this.paused = paused;
    this.pauseReason = reason;
    this.clock.reset(now);
    this.observerClock.reset(now);
    for (const actor of this.actors.values())
      if (actor.connection) {
        if (changed && actor.role === "participant" || this.ended) {
          actor.focused = false;
          this.invalidate(actor);
          this.store.world.set_frozen(actor.slot, true);
          this.baseline(actor, "pause");
        }
        this.send(actor, this.lifecycle());
      }
  }
  survival(a) {
    return this.mode === "survival" && a.role === "participant";
  }
  movementProfile(a) {
    if (!this.survival(a)) return DEFAULT_MOVEMENT;
    return {
      ...equipmentEffects(this.inventories.active(a.id)).movement,
      sprint: a.vitals.view().food >= 6
    };
  }
  refreshMovement(a) {
    const next = this.movementProfile(a);
    if (JSON.stringify(next) === JSON.stringify(a.movement)) return;
    a.movement = next;
    this.invalidate(a);
    this.baseline(a, "movement");
  }
  vitalsView(a) {
    const view = a.vitals.view(), key2 = `${a.epoch}:${JSON.stringify(view)}`;
    if (key2 === a.lastVitals) return;
    a.lastVitals = key2;
    this.send(a, { type: "vitals", epoch: a.epoch, view });
  }
  handleDeath(a) {
    if (!a.vitals.dead || a.deathHandled || !this.survival(a)) return;
    a.deathHandled = true;
    a.phase = "dead";
    a.focused = false;
    this.invalidate(a);
    this.store.world.set_frozen(a.slot, true);
    const p = this.store.world.player_state(a.slot);
    this.inventories.drain(
      a.id,
      (stack) => this.drops.add(stack, [p[0], p[1] + 0.2, p[2]], this.tick, a.id)
    );
    this.baseline(a, "death");
  }
  ignite(a, message, now) {
    if (a.role !== "participant" || !a.capabilities.build || !a.capabilities.explosives)
      return { ok: false, reason: "forbidden" };
    if (!a.queue.active(now)) return { ok: false, reason: "input_stale" };
    if (!this.aimed(a, message.target)) return { ok: false, reason: "out_of_reach" };
    const [x, y, z] = message.target;
    if (y === 0) return { ok: false, reason: "unbreakable" };
    if (this.store.revision(x >> 4, z >> 4) !== message.revision)
      return { ok: false, reason: "conflict" };
    const state = this.store.world.get_block(x, y, z), rule = this.content.behavior.find((rule2) => rule2.family === this.content.blocks[state]?.name);
    if (!rule?.explosive) return { ok: false, reason: "not_ignitable" };
    let patches = null;
    const outcome = this.inventories.ignite(
      a.id,
      message.inventoryRevision,
      this.mode === "creative",
      () => {
        patches = this.store.clearMany([message.target]);
        if (!patches) return false;
        this.explosives.add(a.id, state, [x + 0.5, y + 0.05, z + 0.5], rule.explosive);
        return true;
      }
    );
    if (outcome.ok) {
      this.cancelMining(a);
      for (const patch of patches ?? []) this.publishEdit(patch);
      this.inventoryView(a);
      this.store.require(this.positions());
      this.explosiveSnapshots();
    }
    return outcome;
  }
  finishDamage(target, direction, strength, up) {
    if (target.vitals.dead) {
      this.handleDeath(target);
      return;
    }
    const body = this.store.world.player_state(target.slot);
    if (!body[12]) {
      body[3] = Math.max(-6, Math.min(6, body[3] + direction[0] * strength));
      body[5] = Math.max(-6, Math.min(6, body[5] + direction[2] * strength));
      body[4] = Math.max(body[4], up);
      body[6] = 0;
      this.store.world.player_restore(target.slot, body);
    }
    this.invalidate(target);
    target.movement = this.movementProfile(target);
    this.baseline(target, "damage");
  }
  requireOwnerAuthorizations() {
    this.ownerAuthorizations = /* @__PURE__ */ new Map();
  }
  authorizeOwners(owners, until) {
    if (!this.ownerAuthorizations || !Number.isFinite(until))
      throw new Error("owner authorization is not configured");
    const ids = /* @__PURE__ */ new Set();
    for (const [id, actor] of owners) {
      if (!id.length || id.length > 128 || ids.has(id) || actor !== null && actor.id !== id)
        throw new Error("owner authorization identity mismatch");
      ids.add(id);
    }
    for (const [id, actor] of owners) {
      this.ownerAuthorizations.set(id, {
        actor: actor === null ? null : { id, role: actor.role, capabilities: { ...actor.capabilities } },
        until
      });
    }
    const active = new Set(this.explosives.owners());
    for (const id of this.ownerAuthorizations.keys())
      if (!active.has(id)) this.ownerAuthorizations.delete(id);
  }
  advanceExplosions(now) {
    let processed = 0;
    for (const bomb of this.explosives.due()) {
      if (processed >= EXPLOSIONS_PER_TICK) break;
      if (!this.store.ready(Math.floor(bomb.position[0] / 16), Math.floor(bomb.position[2] / 16)))
        continue;
      const authorization = this.ownerAuthorizations?.get(bomb.owner);
      if (this.ownerAuthorizations && (!authorization || now >= authorization.until)) continue;
      const policy = this.ownerAuthorizations ? authorization.actor : this.actors.get(bomb.owner) ?? this.policies.get(bomb.owner);
      const current = this.actors.get(bomb.owner), connected = current?.connection ? current : null;
      const permitted = policy?.role === "participant" && policy.capabilities.build && policy.capabilities.explosives && (!connected || connected.role === "participant" && connected.capabilities.build && connected.capabilities.explosives);
      const position = [
        bomb.position[0],
        bomb.position[1] + 0.45,
        bomb.position[2]
      ];
      const blocks = permitted ? blastPlan(this.store.world, this.content, position, bomb.rule.radius) : [];
      const hits = [];
      if (permitted && this.mode === "survival" && policy.capabilities.combat && (!connected || connected.capabilities.combat))
        for (const target of this.actors.values()) {
          if (!target.connection || target.phase !== "playing" || !this.survival(target) || !target.capabilities.combat || !target.vitals.canBeHit)
            continue;
          const body = this.store.world.player_state(target.slot), point = [body[0], body[1] + 0.9, body[2]], delta = point.map((value, axis) => value - position[axis]), distance = Math.hypot(...delta), range = bomb.rule.radius * 2;
          if (distance >= range) continue;
          const exposure = [0.2, 0.9, 1.6].filter(
            (height) => this.store.world.line_clear(...position, body[0], body[1] + height, body[2])
          ).length / 3;
          if (!exposure) continue;
          const strength = (1 - distance / range) * exposure;
          hits.push({
            target,
            damage: Math.max(
              1,
              Math.ceil(
                bomb.rule.damage * strength * (1 - equipmentEffects(this.inventories.equipped(target.id)).armor)
              )
            ),
            direction: delta.map((value) => distance > 1e-8 ? value / distance : 0),
            strength: strength * 4,
            position: point
          });
        }
      const patches = this.store.clearMany(blocks.map((block) => block.cell));
      if (!patches) continue;
      this.explosives.remove(bomb.id);
      processed++;
      const closed = /* @__PURE__ */ new Set();
      for (const { cell, state, rule } of blocks) {
        const dropPosition = [
          cell[0] + 0.5,
          cell[1] + 0.2,
          cell[2] + 0.5
        ];
        for (const id of this.inventories.explode(
          cell,
          (stack) => this.drops.add(stack, dropPosition, this.tick)
        ))
          closed.add(id);
        if (rule.explosive)
          this.explosives.add(
            bomb.owner,
            state,
            [cell[0] + 0.5, cell[1] + 0.05, cell[2] + 0.5],
            rule.explosive,
            Math.min(CHAIN_FUSE, rule.explosive.fuse)
          );
        else
          for (const drop of blockDrops(
            rule,
            this.seed,
            cell,
            this.store.revision(cell[0] >> 4, cell[2] >> 4)
          ))
            this.drops.add(
              makeStack(
                this.content.items.find((item) => item.itemType === drop.itemType),
                drop.count
              ),
              dropPosition,
              this.tick
            );
      }
      const event = {
        sequence: ++this.explosionSequence,
        id: bomb.id,
        position,
        radius: bomb.rule.radius,
        removed: blocks.length,
        cancelled: !permitted,
        columns: patches.map(({ x, z, revision }) => ({ x, z, revision }))
      };
      for (const viewer of this.actors.values())
        if (viewer.connection && (viewer.id === bomb.owner || Math.hypot(
          ...this.store.world.player_state(viewer.slot).subarray(0, 3).map((value, axis) => value - position[axis])
        ) <= EXPLOSIVE_RADIUS || patches.some((patch) => viewer.subscriptions.has(columnKey(patch.x, patch.z)))))
          this.send(viewer, { type: "explosion", ...event });
      for (const patch of patches) this.publishEdit(patch);
      for (const id of closed) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
      for (const hit of hits)
        if (hit.target.vitals.strikeDamage(hit.damage)) {
          this.inventories.wearEquipment(hit.target.id, "armor");
          this.finishDamage(hit.target, hit.direction, hit.strength, hit.strength);
          const event2 = {
            sequence: ++this.hitSequence,
            attacker: bomb.owner,
            target: hit.target.id,
            position: hit.position,
            damage: hit.damage,
            dead: hit.target.vitals.dead
          };
          for (const viewer of this.actors.values())
            if (viewer.connection && (viewer.id === bomb.owner || viewer.id === hit.target.id || Math.hypot(
              ...this.store.world.player_state(viewer.slot).subarray(0, 3).map((value, axis) => value - hit.position[axis])
            ) <= 32))
              this.send(viewer, { type: "hit", ...event2 });
        }
    }
  }
  attack(a, message, now) {
    if (!this.survival(a) || !a.capabilities.combat) return { ok: false, reason: "forbidden" };
    if (!a.queue.active(now)) return { ok: false, reason: "input_stale" };
    const held = this.inventories.held(a.id);
    if (held.revision !== message.inventoryRevision) return { ok: false, reason: "conflict" };
    const item = this.content.items.find((item2) => item2.itemType === held.stack?.itemType), profile = combatProfile(item);
    if (!a.vitals.beginAttack(profile.cooldown)) return { ok: false, reason: "cooldown" };
    this.cancelMining(a);
    a.vitals.effort(0.1);
    this.vitalsView(a);
    const p = this.store.world.player_state(a.slot), c = a.controls, cos = Math.cos(c.pitch);
    const origin = [p[0], p[1] + 1.62, p[2]], direction = [Math.sin(c.yaw) * cos, Math.sin(c.pitch), -Math.cos(c.yaw) * cos];
    const candidates = [...this.actors.values()].flatMap((target2) => {
      if (target2.id === a.id || !target2.connection || target2.phase !== "playing" || !this.survival(target2) || !target2.capabilities.combat)
        return [];
      const distance2 = rayBody(
        origin,
        direction,
        this.store.world.player_state(target2.slot),
        profile.reach
      );
      return distance2 === null ? [] : [{ target: target2, distance: distance2 }];
    }).sort((a2, b) => a2.distance - b.distance || a2.target.id.localeCompare(b.target.id));
    const chosen = candidates[0];
    if (!chosen) return { ok: false, reason: "miss" };
    const { target, distance } = chosen, position = origin.map((value, axis) => value + direction[axis] * (distance + 1e-4));
    if (!this.store.world.line_clear(origin[0], origin[1], origin[2], ...position))
      return { ok: false, reason: "occluded" };
    if (!target.vitals.canBeHit) return { ok: false, reason: "protected" };
    const damage = Math.max(
      1,
      Math.ceil(
        profile.damage * (1 - equipmentEffects(this.inventories.equipped(target.id)).armor)
      )
    );
    const outcome = this.inventories.strike(
      a.id,
      held.revision,
      () => target.vitals.strikeDamage(damage)
    );
    if (!outcome.ok) return outcome;
    this.inventories.wearEquipment(target.id, "armor");
    this.inventoryView(a);
    this.finishDamage(target, [Math.sin(c.yaw), 0, -Math.cos(c.yaw)], 2, 1.8);
    const event = {
      sequence: ++this.hitSequence,
      attacker: a.id,
      target: target.id,
      position,
      damage,
      dead: target.vitals.dead
    };
    for (const viewer of this.actors.values())
      if (viewer.connection && (viewer.id === a.id || viewer.id === target.id || Math.hypot(
        ...this.store.world.player_state(viewer.slot).subarray(0, 3).map((v, i) => v - position[i])
      ) <= 32))
        this.send(viewer, { type: "hit", ...event });
    return { ok: true, reason: "hit" };
  }
  aimed(a, cell) {
    const p = this.store.world.player_state(a.slot), c = a.controls, cos = Math.cos(c.pitch);
    const hit = this.store.world.raycast(
      p[0],
      p[1] + 1.62,
      p[2],
      Math.sin(c.yaw) * cos,
      Math.sin(c.pitch),
      -Math.cos(c.yaw) * cos,
      6
    );
    return !!hit[0] && hit[1] === cell[0] && hit[2] === cell[1] && hit[3] === cell[2];
  }
  miningView(a) {
    this.send(a, {
      type: "mining",
      epoch: a.epoch,
      target: a.mining?.target ?? null,
      elapsed: a.mining?.elapsed ?? 0,
      total: a.mining?.total ?? 0
    });
  }
  cancelMining(a) {
    if (a.mining) {
      a.mining = null;
      this.miningView(a);
    }
  }
  startMining(a, message, now) {
    if (this.mode !== "survival" || !a.capabilities.build || a.role !== "participant")
      return { ok: false, reason: "forbidden" };
    const target = message.target;
    if (!target || !a.queue.active(now)) return { ok: false, reason: "input_stale" };
    if (!this.aimed(a, target)) return { ok: false, reason: "out_of_reach" };
    const held = this.inventories.held(a.id);
    if (held.revision !== message.inventoryRevision || this.store.revision(target[0] >> 4, target[2] >> 4) !== message.revision)
      return { ok: false, reason: "conflict" };
    const state = this.store.world.get_block(...target), block = this.content.blocks[state], rule = this.content.behavior.find((b) => b.family === block?.name);
    if (!block || !rule || block.shape === "air" || block.breakable === false || target[1] === 0)
      return { ok: false, reason: "unbreakable" };
    if (!this.inventories.canBreak(target)) return { ok: false, reason: "container_not_empty" };
    const item = this.content.items.find((i) => i.itemType === held.stack?.itemType), plan = miningPlan(rule, item);
    if (!plan.allowed) return { ok: false, reason: "tool_required" };
    const cellRevision = this.store.cellRevision(...target), previous = a.mining;
    if (previous && previous.target.every((v, i) => v === target[i]) && previous.cellRevision === cellRevision && previous.slot === held.slot && !!previous.stack === !!held.stack && (!held.stack || sameStack(previous.stack, held.stack))) {
      this.miningView(a);
      return { ok: true, reason: "mining" };
    }
    a.mining = {
      target: [...target],
      state,
      cellRevision,
      slot: held.slot,
      stack: held.stack,
      elapsed: 0,
      total: plan.ticks
    };
    this.miningView(a);
    return { ok: true, reason: "mining" };
  }
  advanceMining(a, now) {
    const job = a.mining;
    if (!job) return;
    const held = this.inventories.held(a.id);
    if (!a.focused || !a.capabilities.build || a.role !== "participant" || !a.queue.active(now) || !this.aimed(a, job.target) || this.store.world.get_block(job.target[0], job.target[1], job.target[2]) !== job.state || this.store.cellRevision(job.target[0], job.target[1], job.target[2]) !== job.cellRevision || held.slot !== job.slot || !!held.stack !== !!job.stack || held.stack && !sameStack(held.stack, job.stack) || !this.inventories.canBreak(job.target)) {
      this.cancelMining(a);
      return;
    }
    job.elapsed++;
    if (job.elapsed < job.total) {
      if (job.elapsed % 3 === 0) this.miningView(a);
      return;
    }
    const rule = this.content.behavior.find(
      (b) => b.family === this.content.blocks[job.state].name
    );
    const stacks = blockDrops(
      rule,
      this.seed,
      job.target,
      this.store.revision(job.target[0] >> 4, job.target[2] >> 4) + 1
    ).map(
      (drop) => makeStack(this.content.items.find((item) => item.itemType === drop.itemType), drop.count)
    );
    const mutation = { value: null };
    const outcome = this.inventories.mine(a.id, job.slot, job.stack, () => {
      mutation.value = this.store.set(job.target[0], job.target[1], job.target[2], 0);
      return !!mutation.value;
    });
    if (outcome.ok && mutation.value) {
      a.vitals.effort(0.2);
      for (const id of this.inventories.removed(job.target)) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
      for (const stack of stacks)
        this.drops.add(
          stack,
          [job.target[0] + 0.5, job.target[1] + 0.2, job.target[2] + 0.5],
          this.tick
        );
      this.inventoryView(a);
      this.publishEdit(mutation.value);
    }
    this.cancelMining(a);
  }
  publishEdit(changed) {
    for (const viewer of this.actors.values()) {
      const sub = viewer.subscriptions.get(columnKey(changed.x, changed.z));
      if (sub) this.send(viewer, { kind: "patch", ...changed, subscription: sub.id });
    }
  }
  pickups() {
    for (const a of this.actors.values())
      if (a.connection && a.phase === "playing" && a.role === "participant" && a.capabilities.build) {
        const p = this.store.world.player_state(a.slot), origin = [p[0], p[1] + 0.7, p[2]];
        let changed = false;
        for (const drop of this.drops.nearby(origin, PICKUP_RADIUS)) {
          if (!this.drops.eligible(drop.id, a.id, this.tick) || !this.store.world.line_clear(
            ...origin,
            drop.position[0],
            drop.position[1] + 0.125,
            drop.position[2]
          ))
            continue;
          const accepted = this.inventories.receive(a.id, drop.stack);
          if (accepted) {
            this.drops.take(drop.id, accepted);
            changed = true;
          }
        }
        if (changed) this.inventoryView(a);
      }
  }
  dropSnapshots() {
    for (const a of this.actors.values())
      if (a.connection) {
        const nearby = this.drops.nearby(this.store.world.player_state(a.slot), DROP_RADIUS);
        const current = new Map(nearby.map((drop) => [drop.id, drop.revision]));
        const upsert = nearby.filter((drop) => a.visibleDrops.get(drop.id) !== drop.revision);
        const removed = [...a.visibleDrops.keys()].filter((id) => !current.has(id));
        let reset = a.dropsReset;
        do {
          if (reset || upsert.length || removed.length)
            this.send(a, {
              type: "drops",
              reset,
              upsert: upsert.splice(0, 64),
              removed: removed.splice(0, 64)
            });
          reset = false;
        } while (upsert.length || removed.length);
        a.dropsReset = false;
        a.visibleDrops = current;
      }
  }
  explosiveSnapshots() {
    for (const viewer of this.actors.values())
      if (viewer.connection) {
        const bodies = this.explosives.nearby(
          this.store.world.player_state(viewer.slot),
          EXPLOSIVE_RADIUS
        ), visible = new Map(bodies.map((body) => [body.id, body.revision]));
        const upsert = bodies.filter(
          (body) => viewer.visibleExplosives.get(body.id) !== body.revision
        ), removed = [...viewer.visibleExplosives.keys()].filter((id) => !visible.has(id));
        let reset = viewer.explosivesReset;
        do {
          if (reset || upsert.length || removed.length)
            this.send(viewer, {
              type: "explosives",
              reset,
              upsert: upsert.splice(0, 64),
              removed: removed.splice(0, 64)
            });
          reset = false;
        } while (upsert.length || removed.length);
        viewer.visibleExplosives = visible;
        viewer.explosivesReset = false;
      }
  }
  positions() {
    return [...this.actors.values()].filter((a) => a.connection).map((a) => this.store.world.player_state(a.slot)).concat(this.explosives.positions.map((position) => new Float64Array(position)));
  }
  find(connection) {
    return [...this.actors.values()].find((a) => a.connection === connection);
  }
  send(a, event) {
    if (a.connection) this.ports.send(a.connection, event);
  }
  invalidate(a) {
    a.epoch = ++this.epoch;
    a.queue.reset(a.epoch);
    a.catalogSequence = 0;
    a.ledger = new ActionLedger(a.epoch);
    a.controls = { ...NEUTRAL, yaw: a.controls.yaw, pitch: a.controls.pitch };
    a.pending.clear();
    a.mining = null;
  }
  state(a) {
    return Array.from(
      this.store.world.player_state(a.slot),
      (v, i) => i < 6 ? Math.round(v * 1e4) / 1e4 : v
    );
  }
  inventoryView(a) {
    this.inventories.refresh(a.id);
    this.send(a, {
      type: "inventory",
      epoch: a.epoch,
      view: this.inventories.view(
        a.id,
        this.mode === "creative" && a.role === "participant" && a.capabilities.build
      )
    });
  }
  canUseStation(id, cell, _opening) {
    const a = this.actors.get(id);
    if (!a?.connection || !a.capabilities.build || a.role !== "participant" || a.phase !== "playing")
      return false;
    const p = this.store.world.player_state(a.slot), eye = [p[0], p[1] + 1.62, p[2]];
    let dx = cell[0] + 0.5 - eye[0], dy = cell[1] + 0.5 - eye[1], dz = cell[2] + 0.5 - eye[2];
    const length = Math.hypot(dx, dy, dz);
    if (!length || length > 6) return false;
    dx /= length;
    dy /= length;
    dz /= length;
    const hit = this.store.world.raycast(eye[0], eye[1], eye[2], dx, dy, dz, 6);
    return !!hit[0] && hit[1] === cell[0] && hit[2] === cell[1] && hit[3] === cell[2];
  }
  baseline(a, reason) {
    this.send(a, {
      type: "baseline",
      epoch: a.epoch,
      ack: a.queue.ack,
      state: this.state(a),
      phase: this.paused && (a.role === "participant" || this.ended) && a.phase === "playing" ? "paused" : a.phase,
      reason,
      movement: a.movement
    });
    this.inventoryView(a);
    this.miningView(a);
    this.vitalsView(a);
  }
  chunkBaseline(a, sub) {
    this.send(a, {
      kind: "baseline",
      x: sub.x,
      z: sub.z,
      subscription: sub.id,
      revision: this.store.revision(sub.x, sub.z),
      edits: this.store.edits(sub.x, sub.z)
    });
  }
  subscriptions(a) {
    const s = this.store.world.player_state(a.slot), desired = around(Math.floor(s[0] / 16), Math.floor(s[2] / 16), STREAM_RADIUS), keys2 = new Set(desired.map((p) => columnKey(p.x, p.z)));
    for (const [key2, sub] of a.subscriptions)
      if (!keys2.has(key2)) {
        this.send(a, { type: "unload", x: sub.x, z: sub.z, subscription: sub.id });
        a.subscriptions.delete(key2);
      }
    desired.sort(
      (p, q) => (p.x * 16 - s[0]) ** 2 + (p.z * 16 - s[2]) ** 2 - ((q.x * 16 - s[0]) ** 2 + (q.z * 16 - s[2]) ** 2)
    );
    for (const p of desired)
      if (!a.subscriptions.has(columnKey(p.x, p.z))) {
        const sub = { ...p, id: ++a.nextSubscription };
        a.subscriptions.set(columnKey(p.x, p.z), sub);
        this.chunkBaseline(a, sub);
      }
  }
  edit(a, m) {
    if (!a.capabilities.build || a.role !== "participant")
      return { ok: false, reason: "forbidden" };
    if (this.mode === "survival" && m.kind === "remove")
      return { ok: false, reason: "mine_required" };
    if (m.kind === "collect" && (this.mode !== "survival" || m.state !== 0))
      return { ok: false, reason: "invalid_collection" };
    const p = this.store.world.player_state(a.slot), c = a.controls, cos = Math.cos(c.pitch), dx = Math.sin(c.yaw) * cos, dy = Math.sin(c.pitch), dz = -Math.cos(c.yaw) * cos;
    const hit = m.kind === "collect" ? this.store.world.raycast_liquids(p[0], p[1] + 1.62, p[2], dx, dy, dz, 6) : this.store.world.raycast(p[0], p[1] + 1.62, p[2], dx, dy, dz, 6);
    if (!hit[0] || hit[1] !== m.target[0] || hit[2] !== m.target[1] || hit[3] !== m.target[2])
      return { ok: false, reason: "out_of_reach" };
    let [x, y, z] = m.target;
    const before = this.content.blocks[this.store.world.get_block(x, y, z)];
    if (!before) return { ok: false, reason: "unavailable" };
    let state = 0;
    if (m.kind === "remove") {
      if (before.breakable === false || y === 0) return { ok: false, reason: "unbreakable" };
      if (!this.inventories.canBreak([x, y, z]))
        return { ok: false, reason: "container_not_empty" };
    } else if (m.kind === "collect") {
      const held = this.inventories.held(a.id), item = this.content.items.find((i) => i.itemType === held.stack?.itemType);
      if (y === 0 || before.shape !== "liquid" || item?.collects?.family !== before.name)
        return { ok: false, reason: "container_required" };
    } else {
      const requested = this.content.blocks[m.state];
      if (!requested || requested.placeable === false || requested.shape === "air")
        return { ok: false, reason: "invalid_state" };
      if (this.mode === "survival") {
        const held = this.inventories.held(a.id), item = this.content.items.find((i) => i.itemType === held.stack?.itemType);
        if (!item?.places || item.places !== requested.name)
          return { ok: false, reason: "not_owned" };
      }
      if (!before.replaceable) {
        x += hit[4];
        y += hit[5];
        z += hit[6];
      }
      if (!inBounds(x, y, z)) return { ok: false, reason: "bounds" };
      const target = this.content.blocks[this.store.world.get_block(x, y, z)];
      if (!target || !(target.replaceable || target.shape === "air"))
        return { ok: false, reason: "occupied" };
      const rule = this.content.behavior.find((b) => b.family === requested.name);
      if (rule?.support === "wall" && hit[5] !== 0) return { ok: false, reason: "support" };
      if (rule?.support === "below" && this.store.world.collision_top(x, y - 1, z) < 1)
        return { ok: false, reason: "support" };
      const facing = ["north", "east", "south", "west"][(Math.round(c.yaw / (Math.PI / 2)) + 4) % 4];
      const half = hit[5] < 0 || hit[5] === 0 && (p[1] + 1.62 + dy * hit[8]) % 1 > 0.5 ? "top" : "bottom";
      let variant = "";
      if (requested.shape === "stairs") variant = `facing=${facing},half=${half}`;
      else if (requested.shape === "slab") variant = `half=${half}`;
      else if (requested.climbable)
        variant = `facing=${hit[4] === 1 ? "east" : hit[4] === -1 ? "west" : hit[6] === 1 ? "south" : "north"}`;
      state = variant ? this.content.blocks.findIndex((b) => b.name === requested.name && b.state === variant) : m.state;
      if (state < 0 || this.store.world.player_overlaps(x, y, z, state))
        return { ok: false, reason: "collision" };
    }
    const columns = /* @__PURE__ */ new Set([
      columnKey(m.target[0] >> 4, m.target[2] >> 4),
      columnKey(x >> 4, z >> 4)
    ]);
    if (![...columns].every(
      (key2) => m.revisions.some(
        (r) => columnKey(r.x, r.z) === key2 && r.revision === this.store.revision(r.x, r.z)
      )
    ))
      return { ok: false, reason: "conflict" };
    let changed = null;
    if (this.mode === "survival") {
      const outcome = (m.kind === "collect" ? this.inventories.collect.bind(this.inventories) : this.inventories.place.bind(this.inventories))(
        a.id,
        m.inventoryRevision,
        m.kind === "collect" ? before.name : this.content.blocks[state].name,
        () => {
          changed = this.store.set(x, y, z, state);
          return !!changed;
        }
      );
      if (!outcome.ok) return outcome;
      this.inventoryView(a);
    } else changed = this.store.set(x, y, z, state);
    if (!changed) return { ok: false, reason: "unchanged" };
    if (m.kind === "remove")
      for (const id of this.inventories.removed([x, y, z])) {
        const viewer = this.actors.get(id);
        if (viewer) this.inventoryView(viewer);
      }
    this.publishEdit(changed);
    return { ok: true, reason: "edited", cell: [x, y, z], state, revision: changed.revision };
  }
  snapshots(now) {
    const connected = [...this.actors.values()].filter((a) => a.connection);
    const states = new Map(
      connected.filter((a) => a.phase === "playing").map((other) => [
        other.id,
        {
          id: other.id,
          state: this.state(other),
          yaw: other.controls.yaw,
          pitch: other.controls.pitch,
          appearance: this.mode === "survival" ? this.inventories.appearance(other.id) : { ...this.inventories.appearance(other.id), held: other.catalogItem }
        }
      ])
    );
    for (const viewer of connected) {
      const own = this.store.world.player_state(viewer.slot), visible = /* @__PURE__ */ new Map(), changes = [];
      for (const other of connected)
        if (other.id !== viewer.id && other.phase === "playing" && (other.role !== "observer" || viewer.role === "observer")) {
          const actor = states.get(other.id), state = actor.state;
          if (Math.hypot(state[0] - own[0], state[2] - own[2]) > 48) continue;
          visible.set(other.id, actor);
          const old = viewer.visible.get(other.id);
          if (!old) this.send(viewer, { type: "actor_joined", actor });
          else {
            const delta = {
              id: other.id,
              ...state.some((v, i) => v !== old.state[i]) ? { state } : {},
              ...actor.yaw !== old.yaw ? { yaw: actor.yaw } : {},
              ...actor.pitch !== old.pitch ? { pitch: actor.pitch } : {},
              ...!sameAppearance(actor.appearance, old.appearance) ? { appearance: actor.appearance } : {}
            };
            if (Object.keys(delta).length > 1) changes.push(delta);
          }
        }
      for (const id of viewer.visible.keys())
        if (!visible.has(id)) this.send(viewer, { type: "actor_removed", id });
      viewer.visible = visible;
      this.send(viewer, {
        type: "snapshot",
        time: now,
        tick: this.tick,
        self: { epoch: viewer.epoch, ack: viewer.queue.ack, state: this.state(viewer) },
        actors: changes.splice(0, 64)
      });
      while (changes.length)
        this.send(viewer, {
          type: "snapshot",
          time: now,
          tick: this.tick,
          actors: changes.splice(0, 64)
        });
    }
  }
  dispose() {
    this.actors.clear();
    this.vitals.clear();
    this.resting.clear();
    this.policies.clear();
    this.ownerAuthorizations?.clear();
    this.inventories.dispose();
    this.drops.dispose();
    this.explosives.dispose();
    this.store.dispose();
  }
};

// src/server/admission.ts
var MAX_AUTHORIZATION_MS = 6e4;
function object(value, fields) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every((key2) => Object.hasOwn(value, key2));
}
function readAuthorization(value, now, expectedId) {
  if (!object(value, ["actor", "expiresAt"]) && !object(value, ["actor", "expiresAt", "membershipRevision"]) || "membershipRevision" in value && (!Number.isSafeInteger(value.membershipRevision) || value.membershipRevision < 0) || !object(value.actor, ["id", "role", "capabilities"]) || typeof value.actor.id !== "string" || !value.actor.id.length || value.actor.id.length > 128 || expectedId !== void 0 && value.actor.id !== expectedId || !["participant", "observer"].includes(value.actor.role) || !object(value.actor.capabilities, ["build", "fly", "observe", "combat", "explosives"]) || !Object.values(value.actor.capabilities).every((flag) => typeof flag === "boolean") || value.actor.role === "observer" && value.actor.capabilities.observe !== true || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + MAX_AUTHORIZATION_MS)
    throw new Error("invalid server authorization");
  return Object.freeze({
    actor: Object.freeze({
      id: value.actor.id,
      role: value.actor.role,
      capabilities: Object.freeze({
        build: value.actor.capabilities.build,
        fly: value.actor.capabilities.fly,
        observe: value.actor.capabilities.observe,
        combat: value.actor.capabilities.combat,
        explosives: value.actor.capabilities.explosives
      })
    }),
    expiresAt: value.expiresAt,
    ...value.membershipRevision === void 0 ? {} : { membershipRevision: value.membershipRevision }
  });
}

// src/server/owner-authorization.ts
var OWNER_AUTHORIZATION_MS = 5e3;

// src/server/room-policy.ts
var ROOM_POLICY_MS = 5e3;

// src/server/room-worker.ts
var data = workerData;
var ownershipDeadline = data.ownershipDeadline ?? Infinity;
var authorizations = /* @__PURE__ */ new Map();
if (!parentPort) throw new Error("room worker requires supervisor");
var send = (event) => parentPort.postMessage(event);
try {
  if (ownershipDeadline <= performance.now() || Number.isNaN(ownershipDeadline))
    throw new Error("room ownership expired");
  initSync({ module: data.module });
  set_content(JSON.stringify(data.content));
  const ports = {
    send(connection, event) {
      if (performance.now() >= ownershipDeadline) throw new Error("room ownership expired");
      const until = authorizations.get(connection);
      if (until === void 0 || performance.now() >= until) return;
      if ("kind" in event) {
        const payload = encodeChunk(event);
        parentPort.postMessage(
          { type: "send", connection, kind: "reliable", payload },
          [payload.buffer]
        );
      } else
        send({
          type: "send",
          connection,
          kind: event.type === "snapshot" ? "snapshot" : "reliable",
          payload: JSON.stringify(event)
        });
    },
    close: (connection, reason) => {
      authorizations.delete(connection);
      send({ type: "close", connection, reason });
    }
  };
  let room;
  if (data.start.type === "restore") {
    const owners = /* @__PURE__ */ new Map();
    for (const pair of data.start.owners) {
      if (!Array.isArray(pair) || pair.length !== 2 || owners.has(pair[0]))
        throw new Error("invalid restored owner resolution");
      owners.set(pair[0], pair[1]);
    }
    const value = data.start.checkpoint;
    const world = new VoxelWorld(), generator = new TerrainGen(value.seed);
    try {
      room = GameRoom.fromCheckpoint(
        world,
        generator,
        data.content,
        data.build,
        ports,
        data.start.checkpoint,
        performance.now(),
        owners
      );
    } catch (error) {
      world.free();
      generator.free();
      throw error;
    }
  } else if (data.start.type === "fresh") {
    const start = data.start;
    room = new GameRoom(
      new WorldStore(new VoxelWorld(), new TerrainGen(start.seed)),
      data.content,
      data.build,
      ports,
      start.worldId,
      start.seed,
      performance.now(),
      start.initialTick,
      start.mode
    );
  } else throw new Error("invalid room startup");
  const store = room.store;
  const staffLedger = new ActionLedger(1);
  let policyState = "paused", policyUntil = 0, policySequence = 0, nextPolicyCheck = 0, terminalSent = false, manualPause = false;
  let pendingPolicy = null;
  const applyLifecycle = (now) => {
    if (!data.enforceLifecycle) return;
    if (policyState === "ended") {
      room.end(now);
      if (!terminalSent) {
        terminalSent = true;
        send({ type: "session-ended" });
      }
      return;
    }
    const participant = [...room.actors.values()].some(
      (actor) => actor.connection && actor.role === "participant" && (authorizations.get(actor.connection) ?? 0) > now
    );
    const reason = now >= policyUntil ? "policy_unavailable" : policyState === "paused" ? "session" : manualPause ? "manual" : participant ? "allowed" : "no_participants";
    room.setPaused(reason !== "allowed", now, reason);
  };
  const refreshPolicy = (now) => {
    if (!data.enforceLifecycle || terminalSent || pendingPolicy || now < nextPolicyCheck) return;
    if (policySequence === Number.MAX_SAFE_INTEGER)
      throw new Error("room policy sequence exhausted");
    pendingPolicy = { requestId: ++policySequence, deadline: now + ROOM_POLICY_MS };
    send({ type: "room-policy-needed", ...pendingPolicy });
  };
  let nextProjection = 0, lastProjection = "", nextPresenceHeartbeat = 0;
  const projectSession = (now) => {
    if (!data.projectSession || now < nextProjection) return;
    nextProjection = now + 100;
    const view = {
      state: room.lifecycle().state,
      participants: [...room.actors.values()].filter(
        (actor) => actor.role === "participant" && actor.connection && (authorizations.get(actor.connection) ?? 0) > now
      ).map((actor) => actor.id).sort()
    };
    const key2 = JSON.stringify(view);
    if (key2 === lastProjection && now < nextPresenceHeartbeat) return;
    lastProjection = key2;
    nextPresenceHeartbeat = now + 1e4;
    send({ type: "session-projection", ...view });
  };
  applyLifecycle(performance.now());
  if (data.refreshOwners) room.requireOwnerAuthorizations();
  let ownerRequest = 0, nextOwnerCheck = 0, ownerDeadline = 0, appliedOwners = "";
  let pendingOwners = null;
  const refreshOwners = (now) => {
    if (!data.refreshOwners || pendingOwners || now < nextOwnerCheck) return;
    nextOwnerCheck = now + 250;
    const owners = room.explosives.owners(), key2 = JSON.stringify(owners);
    if (!owners.length) {
      room.authorizeOwners([], now);
      appliedOwners = key2;
      return;
    }
    if (key2 === appliedOwners && now < ownerDeadline - OWNER_AUTHORIZATION_MS / 2) return;
    if (ownerRequest === Number.MAX_SAFE_INTEGER)
      throw new Error("owner authorization sequence exhausted");
    pendingOwners = { requestId: ++ownerRequest, owners, deadline: now + OWNER_AUTHORIZATION_MS };
    send({ type: "owner-authorization-needed", ...pendingOwners });
  };
  const expireAuthorizations = (now) => {
    for (const [connection, until] of authorizations)
      if (now >= until) {
        authorizations.delete(connection);
        room.disconnect(connection, now);
        send({ type: "close", connection, reason: "UNAUTHORIZED" });
      }
  };
  let ticks = 0, overrunMs = 0, closed = false, lastCheckpoint = 0;
  const close = (fault) => {
    if (closed) return;
    closed = true;
    if (fault) send({ type: "fault" });
    clearInterval(timer);
    clearInterval(metrics);
    room.dispose();
    authorizations.clear();
    parentPort.close();
    if (fault) process.exitCode = 1;
  };
  const timer = setInterval(() => {
    try {
      if (performance.now() >= ownershipDeadline) throw new Error("room ownership expired");
      expireAuthorizations(performance.now());
      applyLifecycle(performance.now());
      projectSession(performance.now());
      refreshPolicy(performance.now());
      refreshOwners(performance.now());
      const result = room.advance(performance.now());
      ticks += result.steps;
      overrunMs += result.droppedMs;
      const deadline = performance.now() + 4;
      while (performance.now() < deadline && store.generateOne()) {
      }
    } catch {
      close(true);
    }
  }, 4);
  const metrics = setInterval(() => {
    send({ type: "metrics", ticks, columns: store.world.column_count(), overrunMs });
    ticks = 0;
    overrunMs = 0;
  }, 1e4);
  parentPort.on("message", (message) => {
    if (closed) return;
    try {
      if (performance.now() >= ownershipDeadline) throw new Error("room ownership expired");
      const now = performance.now();
      expireAuthorizations(now);
      applyLifecycle(now);
      if (message.type === "staff") {
        const command = readStaffCommand(message.command);
        if (!command || typeof message.requestId !== "string" || !message.requestId.length || message.requestId.length > 128 || typeof message.actorId !== "string" || !message.actorId.length || message.actorId.length > 128 || !Number.isSafeInteger(message.revision) || message.revision < 1 || !Number.isFinite(message.deadline) || message.deadline > now + 5e3)
          throw new Error("invalid staff command");
        const outcome = staffLedger.run(
          1,
          message.revision,
          () => message.deadline <= performance.now() ? { ok: false, reason: "expired" } : room.staff(message.actorId, command, performance.now())
        );
        send({
          type: "staff-result",
          requestId: message.requestId,
          revision: message.revision,
          result: "value" in outcome ? outcome.value : { ok: false, reason: "retired" }
        });
      } else if (message.type === "join") {
        if (terminalSent) {
          send({ type: "close", connection: message.connection, reason: "SESSION_ENDED" });
          return;
        }
        if (!Number.isFinite(message.authorizationUntil))
          throw new Error("invalid actor authorization");
        if (message.authorizationUntil <= now) {
          send({ type: "close", connection: message.connection, reason: "UNAUTHORIZED" });
          return;
        }
        authorizations.set(message.connection, message.authorizationUntil);
        room.join(message.actor, message.connection, now);
        applyLifecycle(performance.now());
      } else if (message.type === "authorization") {
        if (!Number.isFinite(message.deadline)) throw new Error("invalid actor authorization");
        if (authorizations.has(message.connection))
          authorizations.set(message.connection, message.deadline);
        expireAuthorizations(performance.now());
      } else if (message.type === "owner-authorization-unavailable") {
        if (pendingOwners?.requestId !== message.requestId) return;
        pendingOwners = null;
        nextOwnerCheck = now + 500;
      } else if (message.type === "owner-authorization") {
        const pending = pendingOwners;
        if (!pending || pending.requestId !== message.requestId) return;
        pendingOwners = null;
        nextOwnerCheck = now + 500;
        if (!Number.isFinite(message.deadline) || message.deadline > pending.deadline)
          throw new Error("invalid owner authorization deadline");
        if (message.deadline <= now) return;
        if (!Array.isArray(message.owners) || message.owners.length !== pending.owners.length)
          throw new Error("incomplete owner authorization");
        const values = /* @__PURE__ */ new Map();
        const expected = new Set(pending.owners);
        for (const pair of message.owners) {
          if (!Array.isArray(pair) || pair.length !== 2 || !expected.has(pair[0]) || values.has(pair[0]))
            throw new Error("invalid owner authorization identities");
          const actor = pair[1] === null ? null : readAuthorization(
            { actor: pair[1], expiresAt: Date.now() + OWNER_AUTHORIZATION_MS },
            Date.now(),
            pair[0]
          ).actor;
          values.set(pair[0], actor);
        }
        room.authorizeOwners([...values], message.deadline);
        appliedOwners = JSON.stringify(pending.owners);
        ownerDeadline = message.deadline;
      } else if (message.type === "room-policy-unavailable") {
        if (pendingPolicy?.requestId !== message.requestId) return;
        pendingPolicy = null;
        nextPolicyCheck = now + 500;
      } else if (message.type === "room-policy") {
        const pending = pendingPolicy;
        if (!pending || message.requestId !== pending.requestId || terminalSent) return;
        pendingPolicy = null;
        nextPolicyCheck = now + 500;
        if (!["playing", "paused", "ended"].includes(message.state) || !Number.isFinite(message.deadline) || message.deadline > pending.deadline)
          throw new Error("invalid room policy reply");
        if (message.deadline <= now) return;
        policyState = message.state;
        policyUntil = message.deadline;
        nextPolicyCheck = now + (policyUntil - now) / 2;
        applyLifecycle(now);
      } else if (message.type === "leave") {
        authorizations.delete(message.connection);
        room.disconnect(message.connection, now);
        applyLifecycle(performance.now());
      } else if (message.type === "message")
        room.receive(message.connection, message.message, performance.now());
      else if (message.type === "checkpoint") {
        if (!Number.isSafeInteger(message.requestId) || message.requestId <= lastCheckpoint || typeof message.pause !== "boolean")
          throw new Error("invalid checkpoint request");
        lastCheckpoint = message.requestId;
        if (message.pause) {
          if (data.enforceLifecycle) {
            manualPause = true;
            applyLifecycle(performance.now());
          } else room.setPaused(true, performance.now());
        }
        try {
          send({
            type: "checkpoint",
            requestId: message.requestId,
            checkpoint: room.checkpoint(performance.now())
          });
        } catch {
          send({ type: "checkpoint-failed", requestId: message.requestId });
        }
      } else if (message.type === "end") {
        policyState = "ended";
        room.end(now);
        if (!terminalSent) {
          terminalSent = true;
          send({ type: "session-ended" });
        }
      } else if (message.type === "resume" || message.type === "pause") {
        if (data.enforceLifecycle) {
          manualPause = message.type === "pause";
          applyLifecycle(performance.now());
        } else room.setPaused(message.type === "pause", performance.now());
      } else if (message.type === "ownership") {
        if (!Number.isFinite(message.deadline) || message.deadline < ownershipDeadline)
          throw new Error("invalid room ownership deadline");
        ownershipDeadline = message.deadline;
      } else if (message.type === "stop") close(false);
      else throw new Error("invalid supervisor command");
    } catch {
      close(true);
    }
  });
  send({ type: "ready" });
} catch {
  send({ type: "fault" });
  process.exitCode = 1;
}
//# sourceMappingURL=room-worker.js.map
