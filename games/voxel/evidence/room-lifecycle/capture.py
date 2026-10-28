"""Capture completed lifecycle checks; run from the repository root."""
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile

repo = pathlib.Path.cwd()
game, app = repo / 'games/voxel', repo / 'apps/voxel-server'
dest = game / 'evidence/room-lifecycle'
prior = game / 'evidence/offline-owner'
j = lambda path: json.loads(pathlib.Path(path).read_text())
h = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
subprocess.run(['node', 'tools/verify-release.mjs'], cwd=game, check=True)
build, release = j(game / 'artifacts/build.json'), j(game / 'artifacts/release.json')
assert build['buildId'] == '32f0fda71111b20ba54d355f17d09e645ad87f58b7f19440e0e3141ae695d6c0'
assert build['protocol'] == 12
check = j('/tmp/voxel-lifecycle-core-complete-check.exit.json')
suite = j('/tmp/voxel-lifecycle-final-suite.json')
assert check['exitCode'] == 0 and check['signal'] is None
log = pathlib.Path('/tmp/voxel-lifecycle-core-complete-check.log').read_text()
for marker in ['Voxel build ' + build['buildId'][:12], 'ℹ tests 78', '80 passed; 0 failed; 3 ignored', 'ℹ tests 80']:
    assert marker in log, marker
assert log.count('ℹ tests 33') == 2
assert suite['buildId'] == build['buildId']
assert {r['name'] for r in suite['results']} == {'school-gateway', 'postgres-start', 'postgres', 'postgres-stop', 'observer', 'creative', 'inventory', 'tnt', 'release'}
for run in suite['results']:
    assert run['exitCode'] == 0 and run['signal'] is None
    assert run['startedAt'] >= check['finishedAt']
for name, count in [('sdk', 22), ('school-gateway', 6), ('postgres', 12)]:
    output = pathlib.Path(f'/tmp/voxel-lifecycle-{name}.log').read_text()
    for marker in [f'ℹ tests {count}\n', f'ℹ pass {count}\n', 'ℹ fail 0\n']:
        assert marker in output, (name, marker)
files = {}
def copy(source, name):
    output = dest / name
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, output)
    files[name] = h(output)

for name in ['build', 'release', 'content']:
    copy(game / f'artifacts/{name}.json', f'{name}.json')
copy(game / 'test-results/release-verification.json', 'source-release-verification.json')
for side in ['client', 'server']:
    for entry in release[side]:
        source = game / f'dist-{side}' / entry['path']
        assert h(source) == entry['hash']
        copy(source, f"release/{side}/{entry['path']}")
for base, names in [(game, ['creative', 'inventory', 'tnt']), (app, ['school', 'lifecycle'])]:
    for name in names:
        report = j(base / f'test-results/browser-{name}.json')
        assert report['result'] == 'PASS' and report['errors'] == []
        assert report['buildId'] == build['buildId']
        for field in ['engineHash', 'contentHash']:
            if field in report: assert report[field] == build[field]
        copy(base / f'test-results/browser-{name}.json', f'browser-{name}.json')
flow = j(dest / 'browser-lifecycle.json')
assert flow['teacherRise'] > 2 and flow['noAutomaticReadmission']
for cleanup in flow['cleanup']:
    assert all(n == 0 for n in cleanup['resources'].values())
    assert cleanup['audio']['contexts'] == 0 and cleanup['audio']['state'] == 'closed'
for base, names in [(game, ['creative', 'inventory-crafting', 'inventory-chest', 'tnt-fuse', 'tnt-crater']), (app, ['school-observer', 'school-lifecycle-paused'])]:
    for name in names: copy(base / f'test-results/{name}.png', f'{name}.png')
for source, name in [
    ('/tmp/voxel-lifecycle-core-complete-check.log', 'check.txt'),
    ('/tmp/voxel-lifecycle-core-complete-check.exit.json', 'check-exit.json'),
    ('/tmp/voxel-lifecycle-final-suite.json', 'suite.json'),
    ('/tmp/voxel-run-lifecycle-core-check.mjs', 'run-check.mjs'),
    ('/tmp/voxel-lifecycle-final-suite.mjs', 'run-suite.mjs'),
    ('/tmp/voxel-lifecycle-hosted-ready.json', 'hosted-status.json'),
    ('/tmp/voxel-lifecycle-storage-policy-read.sql', 'storage-policy-read.sql'),
    ('/tmp/voxel-lifecycle-storage-policy-read.json', 'storage-policy-read.json'),
]: copy(source, name)
assert j(dest / 'hosted-status.json')['result'] == 'PASS'
policies = j(dest / 'storage-policy-read.json')['rows']
assert len(policies) == 6
for policy in policies:
    assert policy['permissive'] == 'PERMISSIVE'
    for field in ['qual', 'with_check']:
        if policy[field]:
            assert "bucket_id = 'avatars'::text" in policy[field] or "bucket_id = 'feedback-screenshots'::text" in policy[field]
for suffix in ['', '-toolbar-failure', '-resume-forward-timeout', '-diagnostic-scope-failure']:
    copy(f'/tmp/voxel-lifecycle-browser-flow{suffix}.log', f'browser-flow{suffix}.txt')
for name in ['sdk', 'school-gateway', 'postgres']:
    copy(f'/tmp/voxel-lifecycle-{name}.log', f'platform-{name}.txt')
for run in suite['results']: copy(run['log'], f"suite-{run['name']}.txt")
for name in ['live-storage.json', 'hosted-sql.json', 'hosted-target-match.json']:
    copy(prior / name, f'prior-{name}')
old_inputs = {e['path']: e['sha256'] for e in j(prior / 'source-inputs.json')['files']}
unchanged = [
    'apps/voxel-server/src/supabase-persistence.ts',
    'supabase/migrations/20261025010000_voxel_checkpoint_storage.sql',
    'apps/voxel-server/tests/hosted/checkpoint-rollback.sql',
    'apps/voxel-server/tools/check-live-storage.ts',
]
for name in unchanged: assert old_inputs[name] == h(repo / name), name
inputs = set()
for base in [game, app]:
    for directory in ['src', 'tests', 'tools', 'content', 'docs', 'engine/src']:
        inputs.update(p.relative_to(repo).as_posix() for p in (base / directory).rglob('*') if p.is_file())
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'README.md', 'UPSTREAM.md', 'LICENSE', 'engine/Cargo.toml', 'engine/Cargo.lock', 'engine/LICENSE']:
        if (base / name).is_file(): inputs.add((base / name).relative_to(repo).as_posix())
for name in ['package.json', 'package-lock.json', '.github/workflows/voxel.yml', 'packages/game-logic/package.json', 'packages/game-logic/tsconfig.json', 'docs/voxel-runtime-rewrite-proposal.md', 'docs/voxel-runtime-rewrite-progress.md', 'docs/adr/002-voxel-native-websocket.md', 'supabase/migrations/20261025010000_voxel_checkpoint_storage.sql']:
    inputs.add(name)
inputs.update(p.relative_to(repo).as_posix() for p in (repo / 'packages/game-logic/src').rglob('*') if p.is_file())
for name in inputs:
    assert (repo / name).is_file() and not (repo / name).is_symlink()
    assert not pathlib.Path(name).name.startswith('.env')
with tarfile.open(dest / 'source.tar.gz', 'w:gz') as archive:
    for name in sorted(inputs): archive.add(repo / name, arcname=name, recursive=False)
with tarfile.open(dest / 'source.tar.gz') as archive:
    assert len(archive.getmembers()) == len(inputs)
    for member in archive.getmembers():
        assert member.isfile() and archive.extractfile(member).read() == (repo / member.name).read_bytes()
(dest / 'source-inputs.json').write_text(json.dumps({'layout': 'repository-relative', 'files': [{'path': name, 'sha256': h(repo / name)} for name in sorted(inputs)]}, indent=2) + '\n')
for name in ['source.tar.gz', 'source-inputs.json', 'README.md', 'capture.py']: files[name] = h(dest / name)
record = {
    'result': 'PASS_WITH_PLATFORM_HOSTED_AND_DEVICE_LIMITATIONS',
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'buildId': build['buildId'], 'engineHash': build['engineHash'], 'contentHash': build['contentHash'],
    'counts': {'domain': 78, 'native': 80, 'nativeIgnored': 3, 'wasm': 80, 'sourceIntegration': 33, 'packagedIntegration': 33, 'sdkAndSchoolPolicy': 22, 'schoolGateway': 6, 'postgresSdk': 12, 'renderedScenarios': 5, 'priorHostedSqlChecks': 9},
    'sourceFiles': len(inputs), 'hostedInstallation': j(dest / 'hosted-status.json'),
    'remoteChangesThisPhase': {'schemaWrites': False, 'objectWrites': False, 'readOnlyStoragePolicyAudit': True},
    'priorHostedSourceHashesUnchanged': unchanged,
    'limitations': [
        'Hosted SQL fixture metadata and separate Storage byte/cleanup checks are retained from the earlier offline-owner phase; no full hosted SDK/Storage/worker recovery proof',
        'School Auth/PostgREST and local combined-test Storage bytes are fixtures',
        'Five rendered scenarios on software Chromium; not all eleven scenarios, hardware/input/network/capacity qualification',
        'Fenced platform status/roster/presence projection, accepted membership, host controls, production entry, React, moderation/chat, LiveKit and classroom extraction unfinished',
    ],
    'artifacts': [{'path': name, 'sha256': digest} for name, digest in sorted(files.items())],
}
(dest / 'verification.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'buildId': build['buildId'], 'artifacts': len(files), 'sources': len(inputs)}))
