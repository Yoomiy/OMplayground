import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.argv[2] ?? process.cwd());
const dest = join(root, 'games/voxel/evidence/bucket-browser');
assert(!existsSync(dest), 'Never overwrite an evidence archive');
const read = p => readFileSync(resolve(root, p));
const json = p => JSON.parse(read(p));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const priorPath = 'games/voxel/evidence/media-composition/verification.json';
const prior = json(priorPath);
assert.equal(sha(read(priorPath)), '09525ad797b46dbd42429f7f8f7b4b7c51fc9ecd85d1a0da69f1a2be22df01ac');
const build = json('games/voxel/artifacts/build.json');
const release = json('games/voxel/artifacts/release.json');
const report = json('games/voxel/test-results/browser-bucket.json');
const inventory = json('games/voxel/test-results/browser-inventory.json');
assert.equal(report.result, 'PASS');
assert.equal(inventory.result, 'PASS');
for (const r of [report, inventory, prior, release]) assert.equal(r.buildId, build.buildId);
assert.equal(report.contentHash, build.contentHash);
const content = json('games/voxel/artifacts/content.json');
const water = content.blocks.findIndex(b => b.name === 'water');
assert(water > 0);
const bucket = report.bucket;
assert(bucket.oreHarvested >= 3);
assert.equal(bucket.finalRevision, bucket.initialRevision + 4);
assert.equal(bucket.desktop.initialRevision, bucket.finalRevision);
assert.equal(bucket.desktop.finalRevision, bucket.desktop.initialRevision + 2);
for (const r of bucket.collections) assert.equal(r.outcome.state, 0);
for (const r of [...bucket.placements, bucket.desktop.placed]) assert.equal(r.outcome.state, water);
assert.equal(bucket.desktop.collected.outcome.state, 0);
assert.equal(bucket.reconnected.bag[0].itemType, 'water_bucket');
assert(bucket.desktop.sameIdentity && bucket.desktop.pointerLock);
assert.equal(bucket.desktop.events.filter(e => e.type === 'mousedown' && e.button === 2 && e.trusted).length, 2);
assert(bucket.desktop.events.every(e => e.trusted));
assert(bucket.desktop.keyboard.some(e => e.trusted && e.code === 'Digit1'));
assert.deepEqual(bucket.finalBucket, {itemType: 'bucket', count: 1});
assert.deepEqual(bucket.desktop.finalBucket, bucket.finalBucket);
assert.deepEqual(bucket.desktop.cleanup.resources, {geometries: 0, textures: 0, workers: 0});
assert.equal(bucket.desktop.cleanup.audio, 'closed');
for (const key of ['geometries', 'textures', 'workers']) assert.equal(report.cleanup[key], 0);
assert.equal(report.cleanup.audio.state, 'closed');
assert.equal(report.cleanup.audio.contexts, 0);
assert.deepEqual(report.errors, []);
assert.deepEqual(bucket.desktop.errors, []);
assert.equal(read('/tmp/voxel-bucket-types.log').length, 0);
assert.match(read('/tmp/voxel-bucket-release-verify.log').toString(), /Verified current source\/content and 12 release files/);
assert.match(read('/tmp/voxel-bucket-inventory-regression.log').toString(), /Inventory, crafting, equipment, reconnect and teardown pass/);
const changed = prior.sourceInputs.filter(f => sha(read(f.path)) !== f.sha256).map(f => f.path).sort();
assert.deepEqual(changed, ['games/voxel/package.json', 'games/voxel/tools/browser-harness.ts', 'games/voxel/tools/browser-survival.ts']);
const artifacts = [];
function copy(input, output) {
  const bytes = read(input), p = join(dest, output);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, bytes);
  const hash = sha(bytes);
  artifacts.push({path: output, sha256: hash});
  return hash;
}
const sourcePaths = [...changed, 'games/voxel/tools/browser-survival-bucket.ts',
  'games/voxel/tools/browser-bucket-mouse.ts', 'games/voxel/tools/browser-inventory.ts',
  'games/voxel/docs/content-progression.md', 'docs/voxel-runtime-rewrite-progress.md'];
const sources = sourcePaths.map(path => ({path, sha256: copy(path, 'sources/' + path)}));
for (const f of prior.sourceInputs) assert.equal(sha(read('games/voxel/evidence/media-composition/sources/' + f.path)), f.sha256);
const releaseFiles = [];
for (const [kind, directory] of [['client', 'dist-client'], ['server', 'dist-server']]) {
  for (const file of release[kind]) {
    const path = `games/voxel/${directory}/${file.path}`;
    assert.equal(sha(read(path)), file.hash);
    assert.equal(sha(read('games/voxel/evidence/media-composition/release/' + directory + '/' + file.path)), file.hash);
    releaseFiles.push({path, sha256: file.hash});
  }
}
const copies = {
  'browser.json': 'games/voxel/test-results/browser-bucket.json',
  'browser.txt': '/tmp/voxel-bucket-browser.log',
  'inventory-regression.json': 'games/voxel/test-results/browser-inventory.json',
  'inventory-regression.txt': '/tmp/voxel-bucket-inventory-regression.log',
  'types.txt': '/tmp/voxel-bucket-types.log',
  'release-verify.txt': '/tmp/voxel-bucket-release-verify.log',
  'build.json': 'games/voxel/artifacts/build.json',
  'release.json': 'games/voxel/artifacts/release.json',
  'producer.mjs': '/tmp/voxel-bucket-capture.mjs',
  'input/pointer-probe.mjs': '/tmp/voxel-bucket-pointer-probe.mjs',
  'input/pointer-probe.json': '/tmp/voxel-bucket-pointer-probe.json',
  'input/pointer-probe.txt': '/tmp/voxel-bucket-pointer-probe.log',
  'input/xvfb-provenance.json': '/tmp/voxel-x11-runtime/provenance.json',
  'input/xvfb.txt': '/tmp/voxel-x11-server.log',
  'input/webgl-before.json': '/tmp/voxel-headed-webgl-probe.json',
  'input/webgl-glx-before.json': '/tmp/voxel-headed-glx-probe.json',
  'input/gpu.txt': '/tmp/voxel-headed-gpu.log',
  'input/gpu-strace.txt': '/tmp/voxel-headed-gpu-strace.log',
  'input/gpu-strace-output.txt': '/tmp/voxel-headed-gpu-strace-output.log',
  'input/webgl-after.json': '/tmp/voxel-headed-webgl-after-library.json',
};
for (const [output, input] of Object.entries(copies)) copy(input, output);
for (const name of ['bucket-crafted', 'bucket-filled', 'bucket-held-filled', 'bucket-reused', 'bucket-desktop-filled', 'bucket-desktop-reused']) copy('games/voxel/test-results/' + name + '.png', 'screenshots/' + name + '.png');
for (const name of readdirSync('/tmp').sort()) {
  const match = /^voxel-bucket-browser-attempt-(\d+)\.(log|json|png)$/.exec(name);
  if (match) copy('/tmp/' + name, (['4','5'].includes(match[1]) ? 'history/touch-only/' : 'negative/') + name);
}
const packages = readdirSync('/tmp/voxel-x11-runtime/packages').filter(n => n.endsWith('.deb')).sort().map(name => ({name, sha256: sha(read('/tmp/voxel-x11-runtime/packages/' + name))}));
const packageBytes = JSON.stringify(packages, null, 2) + '\n';
writeFileSync(join(dest, 'input/packages.json'), packageBytes);
artifacts.push({path: 'input/packages.json', sha256: sha(packageBytes)});
const scope = 'One natural seed-4242 empty-inventory route on headed software Chromium, emulated touch plus trusted OS desktop input, volatile local development gateway. No hosted Auth/SQL/LiveKit, physical devices, durable recovery, multi-seed balance or deployment qualification.';
const note = `# Natural iron and reusable bucket browser qualification

${scope}

The route mines its own logs/stone/iron, crafts tools and an owned workbench,
refines exactly three ingots with charcoal, crafts the bucket in the Hebrew
inventory and exits the shaft using earned blocks. It performs touch fill,
place, recollect and a filled-bucket reconnect, then a same-identity desktop
handoff with actual OS pointer-lock movement, key 1 and two right-clicks.
Private ownership advances 114→118→120; actual water edits use state ${water}.
Both clients conserve the bucket/other stacks and dispose owned resources.
The top-level completed snapshot is the replaced touch client at revision 118;
the desktop subsection records final ownership revision 120.

Game build ${build.buildId} is unchanged. Its 12 published files match the
previous media-composition archive byte for byte. That archive supplies unchanged
source/release bytes; this increment copies all changed test inputs and new
helpers, docs and the existing inventory regression runner. It independently
rechecks ${prior.sourceInputs.length} prior source hashes: only the package script,
shared browser harness and survival browser runner changed. Production runtime,
engine, content and service inputs remain identical to that qualified release.
Current types, release verification and the original inventory browser scenario pass.

Run from games/voxel on a host with Xvfb and xdotool installed:

    xvfb-run -a env VOXEL_XDOTOOL=/usr/bin/xdotool npm run test:bucket:browser

The actual run used DISPLAY=:0, VOXEL_XDOTOOL=/tmp/voxel-x11-runtime/root/usr/bin/xdotool,
GSETTINGS_SCHEMA_DIR=/tmp/voxel-x11-runtime/root/usr/share/glib-2.0/schemas,
LD_LIBRARY_PATH=/tmp/voxel-x11-runtime/root/usr/lib/aarch64-linux-gnu:/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu,
FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf and VOXEL_SURVIVAL_BUCKET=1
with node games/voxel/tools/browser-survival.ts. No tools were globally installed.
Official Ubuntu package hashes and the private Xvfb compiler-directory patch
are recorded. A missing libX11-xcb bridge caused headed GPU startup failure;
the lookup/SIGTRAP trace and subsequent successful WebGL2 probe are retained.
The OS probe independently records trusted movement (20,30). CDP activation/move
experiments are not treated as valid OS mouse qualification.

Earlier attempts 4/5 passed touch only and are labeled history. Retained negative
attempts cover grass occlusion, shaft descent/pillar timing, pickup height,
incidental continuous mining, failed CDP desktop aiming/timeouts and missing
headed WebGL. Attempt 2's original timeout cause remains unproven. No missing
raw artifact is fabricated, and previous archives are untouched.

The shell is visible in the held screenshot; the front view does not prove
filled-water visual clarity. Natural extended progression across seeds,
resource/yield balance, physical input/device/network/capacity qualification,
actual school Auth and hosted recovery, classroom rollout, product ratification
and cutover/legacy retirement remain required. No admission headcount caps.
`;
writeFileSync(join(dest, 'README.md'), note);
artifacts.push({path: 'README.md', sha256: sha(note)});
const verification = {result: 'NATURAL_BUCKET_TOUCH_OS_DESKTOP_PASS', capturedAt: new Date().toISOString(),
  buildId: build.buildId, runtimeHash: build.runtimeHash, scope, waterState: water,
  priorArchive: 'games/voxel/evidence/media-composition', priorVerificationSha256: sha(read(priorPath)),
  comparedPriorSources: prior.sourceInputs.length, changedPriorSources: changed,
  sources, releaseFiles, artifacts};
const bytes = JSON.stringify(verification, null, 2) + '\n';
writeFileSync(join(dest, 'verification.json'), bytes);
const pointer = {result: verification.result, archive: 'games/voxel/evidence/bucket-browser',
  buildId: build.buildId, verificationSha256: sha(bytes), scope, artifacts: artifacts.length};
writeFileSync(join(root, 'games/voxel/test-results/bucket-browser-increment.json'), JSON.stringify(pointer, null, 2) + '\n');
console.log(JSON.stringify(pointer));
