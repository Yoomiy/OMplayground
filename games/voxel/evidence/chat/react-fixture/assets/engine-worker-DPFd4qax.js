class ChunkMesher {
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
}
if (Symbol.dispose) ChunkMesher.prototype[Symbol.dispose] = ChunkMesher.prototype.free;
class TerrainGen {
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
  add_blueprint(ox, oy, oz, sx, sy, sz, data) {
    const ptr0 = passArray16ToWasm0(data, wasm.__wbindgen_malloc);
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
}
if (Symbol.dispose) TerrainGen.prototype[Symbol.dispose] = TerrainGen.prototype.free;
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
const ChunkMesherFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_chunkmesher_free(ptr, 1));
typeof FinalizationRegistry === "undefined" ? {} : new FinalizationRegistry((ptr) => wasm.__wbg_culler_free(ptr, 1));
const TerrainGenFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_terraingen_free(ptr, 1));
typeof FinalizationRegistry === "undefined" ? {} : new FinalizationRegistry((ptr) => wasm.__wbg_voxelworld_free(ptr, 1));
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
let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
  if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
    cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32ArrayMemory0;
}
function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}
let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}
let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}
let cachedUint8ArrayMemory0 = null;
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
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
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
let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
const cachedTextEncoder = new TextEncoder();
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
let WASM_VECTOR_LEN = 0;
let wasm;
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
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
  return __wbg_finalize_init(instance);
}
let generator, mesher;
self.onmessage = ({
  data
}) => {
  try {
    if (data.type === "init") {
      initSync({ module: data.config.module });
      set_content(JSON.stringify(data.config.content));
      generator = new TerrainGen(data.config.seed);
      mesher = new ChunkMesher();
      self.postMessage({ type: "ready" });
      return;
    }
    const job = data.job;
    if (!generator || !mesher) throw new Error("worker not initialized");
    const result = job.kind === "generate" ? {
      id: job.id,
      tag: job.tag,
      kind: "generate",
      data: generator.generate(job.tag.x, job.tag.z)
    } : { id: job.id, tag: job.tag, kind: "mesh", data: mesher.mesh(job.region) };
    self.postMessage({ type: "result", result }, { transfer: [result.data.buffer] });
  } catch (error) {
    self.postMessage({
      type: "failed",
      id: data.type === "job" ? data.job.id : 0,
      reason: error instanceof Error ? error.message.slice(0, 160) : "worker failure"
    });
  }
};
