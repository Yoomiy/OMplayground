"""Run from repository root after the named checks have terminated."""
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile

repo=pathlib.Path.cwd()
game,app=repo/'games/voxel',repo/'apps/voxel-server'
dest=game/'evidence/session-projection'
j=lambda path:json.loads(pathlib.Path(path).read_text())
h=lambda path:hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
subprocess.run(['node','tools/verify-release.mjs'],cwd=game,check=True)
build,release=j(game/'artifacts/build.json'),j(game/'artifacts/release.json')
assert build['buildId']=='717c400421718f34793e0c1137420238b56d336b058e53a7baf64aa20f386f29'
check=j('/tmp/voxel-projection-core-complete-check.exit.json')
assert check['exitCode']==0 and check['signal'] is None
log=pathlib.Path('/tmp/voxel-projection-core-complete-check.log').read_text()
assert 'Voxel build '+build['buildId'][:12] in log
assert log.count('ℹ tests 80\n')==2 and log.count('ℹ tests 35\n')==2
assert '80 passed; 0 failed; 3 ignored' in log
for name,count in [('sdk',25),('school-gateway',6),('postgres',18)]:
    output=pathlib.Path(f'/tmp/voxel-projection-{name}.log').read_text()
    for marker in [f'ℹ tests {count}\n',f'ℹ pass {count}\n','ℹ fail 0\n','ℹ cancelled 0\n']:
        assert marker in output,(name,marker)
assert 'server stopped' in pathlib.Path('/tmp/voxel-projection-postgres-stop.log').read_text()
assert 'error TS' not in pathlib.Path('/tmp/voxel-projection-types.log').read_text()
flow=j(app/'test-results/browser-lifecycle.json')
assert flow['result']=='PASS' and flow['errors']==[] and flow['noAutomaticReadmission']
for field in ['buildId','engineHash','contentHash']:assert flow[field]==build[field]
assert flow['teacherRise']>2 and flow['resumed']['freshBackward']['z']>0
assert flow['resumed']['freshBackward']['epoch']==flow['resumed']['epoch']
for cleanup in flow['cleanup']:
    assert all(n==0 for n in cleanup['resources'].values())
    assert cleanup['audio']['contexts']==0 and cleanup['audio']['state']=='closed'
files={}
def copy(source,name):
    output=dest/name;output.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,output);files[name]=h(output)
for name in ['build','release','content']:copy(game/f'artifacts/{name}.json',f'{name}.json')
copy(game/'test-results/release-verification.json','source-release-verification.json')
for side in ['client','server']:
    for entry in release[side]:
        source=game/f'dist-{side}'/entry['path'];assert h(source)==entry['hash']
        copy(source,f"release/{side}/{entry['path']}")
copy(app/'test-results/browser-lifecycle.json','browser-lifecycle.json')
copy(app/'test-results/school-lifecycle-paused.png','school-lifecycle-paused.png')
for source,name in [
    ('/tmp/voxel-projection-core-complete-check.log','check.txt'),
    ('/tmp/voxel-projection-core-complete-check.exit.json','check-exit.json'),
    ('/tmp/voxel-run-projection-core-check.mjs','run-check.mjs'),
]:copy(source,name)
for name in ['sdk','types','school-gateway','postgres','postgres-stop','browser-lifecycle','browser-missing-library','browser-input-window-failure']:
    copy(f'/tmp/voxel-projection-{name}.log',f'{name}.txt')
# The earlier hosted installation/Storage/rollback evidence is not rerun here.
prior=game/'evidence/offline-owner'
old={e['path']:e['sha256'] for e in j(prior/'source-inputs.json')['files']}
migration='supabase/migrations/20261025010000_voxel_checkpoint_storage.sql'
assert old[migration]==h(repo/migration)
inputs=set()
for base in [game,app]:
    for directory in ['src','tests','tools','content','docs','engine/src']:
        inputs.update(p.relative_to(repo).as_posix() for p in (base/directory).rglob('*') if p.is_file())
    for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','README.md','UPSTREAM.md','LICENSE','engine/Cargo.toml','engine/Cargo.lock','engine/LICENSE']:
        if(base/name).is_file():inputs.add((base/name).relative_to(repo).as_posix())
inputs.update(['package.json','package-lock.json','.github/workflows/voxel.yml','packages/game-logic/package.json','packages/game-logic/tsconfig.json','docs/voxel-runtime-rewrite-proposal.md','docs/voxel-runtime-rewrite-progress.md','docs/adr/002-voxel-native-websocket.md'])
inputs.update(p.relative_to(repo).as_posix() for p in (repo/'supabase/migrations').glob('*voxel*.sql'))
inputs.update(p.relative_to(repo).as_posix() for p in (repo/'packages/game-logic/src').rglob('*') if p.is_file())
for name in inputs:
    assert(repo/name).is_file() and not(repo/name).is_symlink()
    assert not pathlib.Path(name).name.startswith('.env')
with tarfile.open(dest/'source.tar.gz','w:gz') as archive:
    for name in sorted(inputs):archive.add(repo/name,arcname=name,recursive=False)
with tarfile.open(dest/'source.tar.gz') as archive:
    assert len(archive.getmembers())==len(inputs)
    for member in archive.getmembers():assert member.isfile() and archive.extractfile(member).read()==(repo/member.name).read_bytes()
(dest/'source-inputs.json').write_text(json.dumps({'layout':'repository-relative','files':[{'path':name,'sha256':h(repo/name)} for name in sorted(inputs)]},indent=2)+'\n')
for name in ['source.tar.gz','source-inputs.json','README.md','capture.py']:files[name]=h(dest/name)
record={
    'result':'PASS_WITH_PLATFORM_HOSTED_AND_DEVICE_LIMITATIONS',
    'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'buildId':build['buildId'],'engineHash':build['engineHash'],'contentHash':build['contentHash'],
    'counts':{'domain':80,'native':80,'nativeIgnored':3,'wasm':80,'sourceIntegration':35,'packagedIntegration':35,'sdkAndPolicy':25,'schoolGateway':6,'postgresSdk':18,'renderedScenarios':1},
    'sourceFiles':len(inputs),
    'remoteChangesThisPhase':{'schemaWrites':False,'objectWrites':False,'rowWrites':False},
    'projectionMigration':{'path':'supabase/migrations/20261025020000_voxel_session_projection.sql','sha256':h(repo/'supabase/migrations/20261025020000_voxel_session_projection.sql'),'locallyQualified':True,'hostedApplied':False},
    'priorEvidence':['games/voxel/evidence/room-lifecycle/verification.json','games/voxel/evidence/offline-owner/verification.json'],
    'limitations':[
        'New projection migration is local only; earlier user-applied checkpoint migration is unchanged',
        'School Auth/PostgREST transport reads real local PostgreSQL rows through fixtures; combined Storage bytes remain a fixture; no full hosted school/worker recovery proof',
        'One current-release rendered scenario on software Chromium, not all previous browser scenarios or device/frame/input/network/capacity qualification',
        'Teacher/host mutation APIs and audit, production entry, React/presence expiry UI, chat/moderation, LiveKit, classroom extraction and release qualification unfinished',
    ],
    'artifacts':[{'path':name,'sha256':digest} for name,digest in sorted(files.items())],
}
(dest/'verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'buildId':build['buildId'],'artifacts':len(files),'sources':len(inputs)}))
