/** Runs unchanged in Node, browser main thread, and worker against the same release artifact. */
export async function runScenario(engine, manifest) {
  engine.set_content(JSON.stringify(manifest));
  const id = (family) => manifest.blocks.findIndex((b) => b.name === family);
  const digest = async (bytes) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen(4242),
    mesher = new engine.ChunkMesher();
  try {
    const columns = [];
    for (let z = -1; z <= 1; z++)
      for (let x = -1; x <= 1; x++) {
        const bytes = generator.generate(x, z);
        columns.push(await digest(bytes));
        world.insert_column(x, z, bytes);
      }
    // High state IDs, negative positions, and a chunk boundary edit in actual production buffers.
    const synthetic = id('test_299');
    if (synthetic !== -1 && synthetic <= 255) throw new Error('high-ID fixture truncated');
    const high = synthetic !== -1 ? synthetic : id('glowstone');
    world.set_block(-1, 140, 0, high);
    world.set_block(0, 140, 0, id('z_glow') !== -1 ? id('z_glow') : id('glowstone'));
    if (world.get_block(-1, 140, 0) !== high) throw new Error('truncated state');
    const editHash = await digest(world.export_edits());
    const region = world.extract_region(0, 0),
      mesh = mesher.mesh(region);
    if (mesh[79] !== 2) throw new Error('wrong mesh version');
    const slot = world.player_add(0.5, 155, 0.5);
    for (let step = 0; step < 180; step++)
      world.player_step(slot, 0.25, -0.75, step === 60, false, false, false, 1, 1, 1, 1, 1 / 60);
    const observer = world.player_add(4.5, 180, 4.5),
      observerTrace = [];
    world.set_ghost(observer, true);
    for (const flying of [true, false, true]) {
      world.set_flying(observer, flying);
      for (let step = 0; step < 18; step++) {
        world.player_step(observer, 0, 0, flying, false, false, false, 1, 1, 1, 1, 1 / 60);
        if (world.player_state(observer)[10] !== Number(flying))
          throw new Error('spectator identity overrode explicit flight state');
      }
      observerTrace.push(Array.from(world.player_state(observer)));
    }
    let body = [-0.5, 143, 0.5],
      velocity = 0;
    const sweepTrace = [];
    for (let step = 0; step < 120; step++) {
      velocity = Math.max(-12, velocity - 18 / 30);
      const moved = world.sweep_body(...body, 0, velocity / 30, 0, 0.125, 0.25);
      body = Array.from(moved.subarray(0, 3));
      if (moved[4]) velocity = 0;
      if (step % 15 === 0) sweepTrace.push(Array.from(moved));
    }
    return {
      columns,
      editHash,
      meshHash: await digest(mesh),
      state: Array.from(world.player_state(slot)),
      observerTrace,
      sweepTrace,
      high,
      regionBytes: region.byteLength,
      meshBytes: mesh.byteLength,
    };
  } finally {
    generator.free();
    world.free();
    mesher.free();
  }
}
