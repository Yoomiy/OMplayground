import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url),
  build = JSON.parse(readFileSync(new URL('artifacts/build.json', root), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function entries(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((e) =>
      e.isDirectory()
        ? entries(new URL(`${e.name}/`, dir), `${prefix}${e.name}/`)
        : [{ path: `${prefix}${e.name}`, hash: hash(readFileSync(new URL(e.name, dir))) }],
    );
}
const client = entries(new URL('dist-client/', root)),
  server = entries(new URL('dist-server/', root));
if (
  !client.some((e) => e.path.endsWith('.wasm') && e.hash === build.engineHash) ||
  hash(readFileSync(new URL('dist-server/engine.wasm', root))) !== build.engineHash
)
  throw new Error('client/server Wasm mismatch');
const release = {
  buildId: build.buildId,
  engineHash: build.engineHash,
  contentHash: build.contentHash,
  clientHash: hash(JSON.stringify(client)),
  serverHash: hash(JSON.stringify(server)),
  client,
  server,
};
writeFileSync(new URL('artifacts/release.json', root), JSON.stringify(release, null, 2) + '\n');
console.log(`Matched client/server release ${build.buildId.slice(0, 12)}`);
