import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.argv[2] ?? process.cwd());
const destination = join(root, 'games/voxel/evidence/media-composition');
assert(!existsSync(destination), 'Never overwrite an existing immutable archive');
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const build = json('games/voxel/artifacts/build.json');
const release = json('games/voxel/artifacts/release.json');
const react = json('apps/web/test-results/voxel-react.json');
const cleanup = json('apps/web/test-results/voxel-react-media-cleanup.json');
const startup = json('/tmp/voxel-composition-startup.json');
assert.equal(react.result, 'PASS');
assert.equal(react.buildId, build.buildId);
assert.equal(release.buildId, build.buildId);
assert.equal(startup.buildId, build.buildId);
assert(react.terminalGameOwnersReleased && react.voice.enabled);
for (const key of ['hiddenStaff', 'retrySameRequest', 'nativeFarSceneSilent', 'bannedProviderIdentityAbsent', 'terminalOwnerClosed']) assert(react.voice[key], key);
assert.equal(cleanup.cleaned, true);
assert.equal(cleanup.schoolDatabaseWrites, 0);
assert.equal(react.cleanup.length, 3);
assert(react.cleanup.every(value => value.audio === 'closed' && Object.values(value.resources).every(n => n === 0)));
assert.deepEqual(react.errors, []);
assert.equal(startup.statusRpcs.length, 8);
assert.equal(startup.remoteApplicationWrites, false);
for (const path of ['/tmp/voxel-resync-core-check.exit', '/tmp/voxel-composition-postgres.exit']) assert.equal(read(path).toString().trim(), '0');
for (const path of ['/tmp/voxel-composition-web-types.log', '/tmp/voxel-composition-service-types.log']) assert.equal(read(path).length, 0);
assert.match(read('/tmp/voxel-prediction-resync-before.log').toString(), /3 !== 9/);
assert.match(read('/tmp/voxel-prediction-resync-after.log').toString(), /pass 3/);
assert.match(read('/tmp/voxel-composition-postgres.log').toString(), /pass 61/);
assert.match(read('/tmp/voxel-composition-sdk-tests.log').toString(), /pass 46/);
assert.match(read('/tmp/voxel-composition-web-tests.log').toString(), /180 passed/);
assert.match(read('/tmp/voxel-composition-web-build.log').toString(), /built in/);
const artifacts = [];
function copy(input, output) {
  const bytes = read(input), target = join(destination, output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  artifacts.push({ path: output, sha256: sha(bytes) });
  return sha(bytes);
}
function files(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const prior = json('games/voxel/evidence/media/verification.json');
const sources = [...new Set([...prior.sourceInputs.map(value => value.path),
  'apps/voxel-server/tests/postgres/pooled-fixture.test.ts'])].sort();
const sourceInputs = sources.map(path => ({ path, sha256: copy(path, 'sources/' + path) }));
const releaseFiles = [];
for (const [kind, directory] of [['client', 'dist-client'], ['server', 'dist-server']]) {
  for (const file of release[kind]) {
    const path = `games/voxel/${directory}/${file.path}`;
    const hash = copy(path, 'release/' + directory + '/' + file.path);
    assert.equal(hash, file.hash);
    releaseFiles.push({ path, sha256: hash });
  }
}
const copies = {
  'build.json': 'games/voxel/artifacts/build.json', 'release.json': 'games/voxel/artifacts/release.json',
  'core.txt': '/tmp/voxel-resync-core-check.log', 'core.exit': '/tmp/voxel-resync-core-check.exit',
  'postgres.txt': '/tmp/voxel-composition-postgres.log', 'postgres.exit': '/tmp/voxel-composition-postgres.exit',
  'sdk.txt': '/tmp/voxel-composition-sdk-tests.log', 'web-tests.txt': '/tmp/voxel-composition-web-tests.log',
  'web-types.txt': '/tmp/voxel-composition-web-types.log', 'service-types.txt': '/tmp/voxel-composition-service-types.log',
  'web-build.txt': '/tmp/voxel-composition-web-build.log', 'release-verify.txt': '/tmp/voxel-composition-release-verify.log',
  'startup.json': '/tmp/voxel-composition-startup.json', 'startup.mjs': '/tmp/voxel-composition-startup.mjs',
  'pool-tests.txt': '/tmp/voxel-pool-fixture-tests.log',
  'prediction-before.txt': '/tmp/voxel-prediction-resync-before.log', 'prediction-after.txt': '/tmp/voxel-prediction-resync-after.log',
  'react.txt': '/tmp/voxel-media-composition-browser.log', 'react.json': 'apps/web/test-results/voxel-react.json',
  'media-cleanup.json': 'apps/web/test-results/voxel-react-media-cleanup.json',
  'media.md': 'apps/voxel-server/docs/media.md', 'progress.md': 'docs/voxel-runtime-rewrite-progress.md',
  'producer.mjs': '/tmp/voxel-composition-capture.mjs',
};
for (const [output, input] of Object.entries(copies)) copy(input, output);
for (const path of files('apps/web/test-results/react-fixture')) copy(path, 'react-fixture/' + relative('apps/web/test-results/react-fixture', path));
for (const entry of readdirSync('/tmp')) if (/^voxel-media-composition-attempt-\d+\.(log|cleanup\.json)$/.test(entry)) copy('/tmp/' + entry, 'negative/' + entry);
const webInventory = files('apps/web/dist').sort().map(path => ({ path, sha256: sha(read(path)) }));
const inventory = JSON.stringify(webInventory, null, 2) + '\n';
writeFileSync(join(destination, 'web-inventory.json'), inventory);
artifacts.push({ path: 'web-inventory.json', sha256: sha(inventory) });
const scope = 'Real React/native packaged game/local PostgreSQL/configured LiveKit with generated audio; fixture Auth/PostgREST/Storage. No hosted school writes, hardware qualification, complete outage qualification, deployment, or standalone production web bundle.';
const note = `# Composed media qualification\n\nGame build ${build.buildId}. ${scope}\n\nSame-epoch prediction identity reuse fails before the correction and passes afterward using real Wasm and the authoritative input queue. Authoritative terminal metadata releases native game ownership and media even after a gameplay disconnect. The complete combined browser flow passes, including actual proximity poses/audio, hidden staff, lost committed SQL mute reply with same-ID retry, provider-confirmed ban removal, resume/end, trusted mouse/touch Exit and three zero-resource teardowns. Its unique SFU room is deleted and absence verified.\n\nAll core gates, 61 SQL, 46 service and 180 web tests, strict types, production web build and read-only eight-status startup pass. Production web bytes are inventoried, not copied. The exact compiled React fixture and 12 published game files are copied. Prior source inputs are read afresh and copied with the new pool regression. Earlier archives remain unchanged.\n\nNegative composition runs remain archived, including policy/voice/input/terminal/Exit failures. The local subprocess-based database fixture caused substantial query/scheduling overhead; its pool is test-only and preserves role isolation and SQL codes. The passing pool run measures at most ${cleanup.voice.fixtureTiming.slowestDatabase[0].elapsed.toFixed(1)} ms/query and ${cleanup.voice.fixtureTiming.eventLoopMaxMs.toFixed(1)} ms gateway event-loop delay. These are controlled fixture measurements, not proof of school-device performance or a cause for every earlier timeout. The sequential trusted mouse action now waits for normal browser acknowledgements; no DOM click or dropped event assertion is substituted.\n\nActual school Auth/catalog/hosted recovery, classroom rollout, survival progression/bucket UI/balance, physical devices/networks/capacity, product ratification and cutover/legacy removal remain required. No admission headcount caps were introduced.\n`;
writeFileSync(join(destination, 'README.md'), note);
artifacts.push({ path: 'README.md', sha256: sha(note) });
const verification = {
  result: 'LOCAL_GAME_SQL_SFU_COMPOSITION_PASS', capturedAt: new Date().toISOString(),
  buildId: build.buildId, runtimeHash: build.runtimeHash, scope,
  qualified: { domain: 91, native: 80, nativeIgnored: 3, wasm: 85, sourceIntegration: 41, packagedIntegration: 41, postgres: 61, sdk: 46, web: 180, browserContexts: 3, readOnlyStartupStatuses: 8 },
  priorMediaVerificationSha256: sha(read('games/voxel/evidence/media/verification.json')),
  sourceInputs, releaseFiles, webInventoryFiles: webInventory.length, artifacts,
};
const serialized = JSON.stringify(verification, null, 2) + '\n';
writeFileSync(join(destination, 'verification.json'), serialized);
const pointer = { result: verification.result, buildId: build.buildId, archive: relative(root, destination), verificationSha256: sha(serialized), sourceFiles: sources.length, releaseFiles: releaseFiles.length, artifacts: artifacts.length, scope };
writeFileSync(join(root, 'apps/voxel-server/test-results/media-composition.json'), JSON.stringify(pointer, null, 2) + '\n');
console.log(JSON.stringify(pointer));
