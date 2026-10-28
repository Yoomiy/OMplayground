/** Browser-only observation. Weak references avoid retaining measured Wasm
 * memories or GL handles. Executable game/worker responses remain unchanged.
 * BufferData binding queries add overhead; never use this probe for frame timing.
 */
export function installMemoryProbe() {
  const memories: WeakRef<WebAssembly.Memory>[] = [];
  const Instance = WebAssembly.Instance;
  WebAssembly.Instance = new Proxy(Instance, {
    construct(target, args, newTarget) {
      const instance = Reflect.construct(target, args, newTarget) as WebAssembly.Instance;
      for (const value of Object.values(instance.exports))
        if (value instanceof WebAssembly.Memory) memories.push(new WeakRef(value));
      return instance;
    },
  });
  type Counts = {
    created: number;
    deleted: number;
    live: number;
    bytes: number;
  };
  let liveBytes = 0,
    peakBytes = 0;
  const contexts = new WeakMap<WebGL2RenderingContext, Counts>();
  const counts: Counts[] = [];
  const buffers = new WeakMap<WebGLBuffer, { owner: Counts; bytes: number }>();
  const owner = (gl: WebGL2RenderingContext) => {
    let c = contexts.get(gl);
    if (!c) {
      c = { created: 0, deleted: 0, live: 0, bytes: 0 };
      contexts.set(gl, c);
      counts.push(c);
    }
    return c;
  };
  const proto = WebGL2RenderingContext.prototype;
  const create = proto.createBuffer,
    remove = proto.deleteBuffer,
    data = proto.bufferData;
  proto.createBuffer = function () {
    const buffer = create.call(this);
    if (buffer) {
      const c = owner(this);
      c.created++;
      c.live++;
      buffers.set(buffer, { owner: c, bytes: 0 });
    }
    return buffer;
  };
  proto.deleteBuffer = function (buffer) {
    remove.call(this, buffer);
    if (!buffer) return;
    const row = buffers.get(buffer);
    if (row) {
      row.owner.live--;
      row.owner.deleted++;
      row.owner.bytes -= row.bytes;
      liveBytes -= row.bytes;
      buffers.delete(buffer);
    }
  };
  proto.bufferData = function (
    this: WebGL2RenderingContext,
    target: number,
    source: any,
    usage: number,
    offset?: number,
    length?: number,
  ) {
    Reflect.apply(data, this, arguments);
    const binding = new Map<number, number>([
      [this.ARRAY_BUFFER, this.ARRAY_BUFFER_BINDING],
      [this.ELEMENT_ARRAY_BUFFER, this.ELEMENT_ARRAY_BUFFER_BINDING],
      [this.COPY_READ_BUFFER, this.COPY_READ_BUFFER_BINDING],
      [this.COPY_WRITE_BUFFER, this.COPY_WRITE_BUFFER_BINDING],
      [this.PIXEL_PACK_BUFFER, this.PIXEL_PACK_BUFFER_BINDING],
      [this.PIXEL_UNPACK_BUFFER, this.PIXEL_UNPACK_BUFFER_BINDING],
      [this.UNIFORM_BUFFER, this.UNIFORM_BUFFER_BINDING],
      [this.TRANSFORM_FEEDBACK_BUFFER, this.TRANSFORM_FEEDBACK_BUFFER_BINDING],
    ]).get(target);
    if (binding === undefined) throw Error('untracked GL buffer binding');
    const buffer = this.getParameter(binding) as WebGLBuffer | null;
    const row = buffer && buffers.get(buffer);
    if (!row) throw Error('untracked GL buffer');
    const elementBytes = source?.BYTES_PER_ELEMENT ?? 1;
    const bytes =
      typeof source === 'number'
        ? source
        : source == null
          ? 0
          : length
            ? length * elementBytes
            : source.byteLength - (offset ?? 0) * elementBytes;
    row.owner.bytes += bytes - row.bytes;
    liveBytes += bytes - row.bytes;
    row.bytes = bytes;
    peakBytes = Math.max(peakBytes, liveBytes);
  } as typeof proto.bufferData;
  (window as any).voxelMemoryProbe = () => ({
    wasm: memories.map((ref) => ref.deref()?.buffer.byteLength ?? 0),
    gpuBuffers: {
      created: counts.reduce((n, c) => n + c.created, 0),
      deleted: counts.reduce((n, c) => n + c.deleted, 0),
      live: counts.reduce((n, c) => n + c.live, 0),
      bytes: counts.reduce((n, c) => n + c.bytes, 0),
      peakBytes,
    },
  });
}
