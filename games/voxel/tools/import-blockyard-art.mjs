import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const revision = 'a79346108fc5ed3b68e3827608fdb448e5a7e5db';
const source = resolve(process.argv[2] ?? '/tmp/blockyard-sync-review');
if (
  execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision
)
  throw Error('Expected the pinned Blockyard revision ' + revision);
const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'src/render/upstream/blockyard');
const header = `/*! Blockyard, copyright 2026 Patrick Blais. MIT; see public/blockyard-LICENSE.txt.\n * Source: https://github.com/Potrock/blockyard/tree/${revision}\n * Imported by tools/import-blockyard-art.mjs; only module paths adapted. */\n`;
for (const relative of [
  'avatar.ts',
  'character/look.ts',
  'character/build.ts',
  'character/voxels.ts',
]) {
  const target = join(out, relative);
  mkdirSync(resolve(target, '..'), { recursive: true });
  const code = readFileSync(join(source, 'src/platform', relative), 'utf8').replace(
    /from '(\.[^']+)'/g,
    (_, path) => `from '${path}.ts'`,
  );
  writeFileSync(target, header + code);
}
// Keep the upstream silhouette extrusion algorithm; adapt only its atlas interface.
const entities = readFileSync(join(source, 'src/platform/render/entities.ts'), 'utf8');
const extrusion = entities.slice(
  entities.indexOf('function extrudeSprite('),
  entities.indexOf('/** What a figure is doing'),
);
writeFileSync(
  join(out, 'sprite-geometry.ts'),
  header +
    "import * as THREE from 'three';\n" +
    'type Atlas = { pixels: Uint8Array; width: number; height: number };\n' +
    extrusion.replace('function extrudeSprite(', 'export function extrudeSprite('),
);
const license = readFileSync(join(source, 'LICENSE'), 'utf8');
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public/blockyard-LICENSE.txt'), license);
const scratch = mkdtempSync(join(tmpdir(), 'blockyard-art-'));
try {
  const file = join(scratch, 'bedwars.mjs');
  await build({
    stdin: {
      contents: `export {paintBedwarsAtlas, Sprite} from ${JSON.stringify(join(source, 'src/games/bedwars/art/index.ts'))};
        export {pickaxe} from ${JSON.stringify(join(source, 'src/games/bedwars/art/sprites.ts'))};
        export {Canvas} from ${JSON.stringify(join(source, 'src/platform/art/index.ts'))};`,
      resolveDir: source,
    },
    plugins: [
      {
        name: 'expose-upstream-pickaxe-painter',
        setup(plugin) {
          plugin.onLoad({ filter: /bedwars\/art\/sprites\.ts$/ }, ({ path }) => ({
            contents: readFileSync(path, 'utf8') + '\nexport {pickaxe};',
            loader: 'ts',
            resolveDir: resolve(path, '..'),
          }));
        },
      },
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: file,
    alias: { '@platform/art': join(source, 'src/platform/art/index.ts') },
  });
  const { paintBedwarsAtlas, Sprite, pickaxe, Canvas } = await import(pathToFileURL(file).href);
  const { albedo, width } = paintBedwarsAtlas();
  const matches = {
    iron_ingot: 'iron_ingot',
    gold_ingot: 'gold_ingot',
    diamond: 'diamond',
    wooden_pickaxe: 'wooden_pickaxe',
    iron_pickaxe: 'iron_pickaxe',
    diamond_pickaxe: 'diamond_pickaxe',
    iron_vest: 'iron_armor',
  };
  const sprites = {};
  for (const [local, name] of Object.entries(matches)) {
    const { x, y } = Sprite[name],
      pixel = new Uint8Array(1024);
    for (let row = 0; row < 16; row++)
      pixel.set(
        albedo.subarray(((y + row) * width + x) * 4, ((y + row) * width + x + 16) * 4),
        row * 64,
      );
    sprites[local] = Buffer.from(pixel).toString('hex');
  }
  // Locally supplied stone palette; silhouette, wooden handle and outline logic are upstream.
  const stone = new Canvas();
  pickaxe({ o: 0x303033, d: 0x57595d, m: 0x85888b, l: 0xb6b8b6, w: 0xd9d8d0 }).blit(stone, 0, 0);
  const stoneAtlas = stone.finish().albedo,
    stonePixels = new Uint8Array(1024);
  for (let row = 0; row < 16; row++)
    stonePixels.set(stoneAtlas.subarray(row * 256 * 4, row * 256 * 4 + 64), row * 64);
  sprites.stone_pickaxe = Buffer.from(stonePixels).toString('hex');
  writeFileSync(
    join(out, 'item-pixels.ts'),
    header.replace(
      'only module paths adapted',
      'seven exact sprites plus a stone-palette pickaxe from src/games/bedwars/art',
    ) +
      '\nexport const ITEM_PIXELS: Readonly<Record<string, string>> = ' +
      JSON.stringify(sprites, null, 2) +
      ';\n',
  );
  // Reference poses evaluated from the unmodified upstream implementation.
  const shim = join(scratch, 'math.ts'),
    poseFile = join(scratch, 'poses.mjs');
  writeFileSync(
    shim,
    `export {Euler,Matrix4 as Mat4,Quaternion as Quat,Vector3 as Vec3} from ${JSON.stringify(join(root, 'node_modules/three/build/three.module.js'))};`,
  );
  await build({
    entryPoints: [join(source, 'src/platform/client-kits/firstperson/poses.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: poseFile,
    alias: { '@platform/client/math': shim },
  });
  const { attachedRest, newRest, STYLES } = await import(pathToFileURL(poseFile).href);
  const poses = {};
  for (const [name, style] of [
    ['tool', 'sword'],
    ['item', 'item'],
  ]) {
    const rest = newRest();
    attachedRest(
      STYLES[style],
      undefined,
      (x, y, out) => out.set(x / 16 - 0.5, 0.5 - y / 16, 0),
      1,
      0,
      rest,
    );
    poses[name] = Object.fromEntries(
      ['grip', 'gripLocal', 'itemRot', 'itemScale', 'armRot', 'armOffset'].map((key) => [
        key,
        typeof rest[key] === 'number' ? rest[key] : rest[key].toArray(),
      ]),
    );
  }
  writeFileSync(
    join(root, 'tests/fixtures/blockyard-hold-rest.json'),
    JSON.stringify({ revision, poses }, null, 2) + '\n',
  );
  console.log(
    'Imported eight character presets/generator and seven exact item sprites, stone pickaxe variant and sprite extrusion from ' +
      revision,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
