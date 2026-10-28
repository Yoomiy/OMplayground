import hashlib, json, pathlib, shutil, subprocess, tarfile, datetime
repo=pathlib.Path('/home/ubuntu/OMplayground')
game=repo/'games/voxel'
dest=game/'evidence/room-recovery'
j=lambda p: json.loads(pathlib.Path(p).read_text())
h=lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
subprocess.run(['node','tools/verify-release.mjs'],cwd=game,check=True)
build=j(game/'artifacts/build.json');release=j(game/'artifacts/release.json')
check=j('/tmp/voxel-whole-room-complete-check.exit.json');suite=j('/tmp/voxel-whole-room-browser-suite.json')
assert check['exitCode']==0 and check['signal'] is None
log=pathlib.Path('/tmp/voxel-whole-room-complete-check.log').read_text()
for marker in ['Voxel build '+build['buildId'][:12],'ℹ tests 72','79 passed; 0 failed; 3 ignored','ℹ tests 74']:
    assert marker in log,marker
assert log.count('ℹ tests 17')==2
assert suite['buildId']==build['buildId'] and suite['active'] is None
expected={'test:creative:browser','test:inventory:browser'}
assert {v['script'] for v in suite['checks']}==expected
for v in suite['checks']:
    assert v['code']==0 and v['signal'] is None
    assert v['startedAt']>=check['finishedAt']
files={}
def copy(src,name):
    out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,out)
    files[name]=h(out)
for name in ['build','release','content']:
    copy(game/f'artifacts/{name}.json',f'{name}.json')
copy(game/'test-results/release-verification.json','source-release-verification.json')
for side,folder in [('client','dist-client'),('server','dist-server')]:
    for entry in release[side]:
        src=game/folder/entry['path'];assert h(src)==entry['hash']
        copy(src,f'release/{side}/{entry["path"]}')
for src,name in [('/tmp/voxel-whole-room-complete-check.log','check.txt'),
                 ('/tmp/voxel-whole-room-complete-check.exit.json','check-exit.json'),
                 ('/tmp/voxel-whole-room-browser-suite.json','browser-suite.json'),
                 ('/tmp/voxel-run-whole-room-check.mjs','run-check.mjs'),
                 ('/tmp/voxel-run-whole-room-browser.mjs','run-browser.mjs'),
                 ('/tmp/voxel-capture-room-recovery.py','capture.py')]:
    copy(src,name)
for v in suite['checks']:
    stem=v['script'].replace(':','-')
    copy(v['path'],stem+'.txt');copy(v['path']+'.exit.json',stem+'-exit.json')
for name in ['browser-creative','browser-inventory']:
    report=j(game/f'test-results/{name}.json')
    assert report['result']=='PASS' and report['errors']==[]
    for field in ['buildId','engineHash','contentHash']:assert report[field]==build[field]
    copy(game/f'test-results/{name}.json',name+'.json')
screens=[]
for name,script in [('creative','test:creative:browser'),('inventory-crafting','test:inventory:browser'),('inventory-chest','test:inventory:browser')]:
    run=next(v for v in suite['checks'] if v['script']==script)
    src=game/f'test-results/{name}.png';mtime=src.stat().st_mtime
    parse=lambda s: datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
    assert parse(run['startedAt'])-1<=mtime<=parse(run['finishedAt'])+1
    copy(src,name+'.png');screens.append({'path':name+'.png','script':script,'startedAt':run['startedAt'],'finishedAt':run['finishedAt'],'sourceModifiedAt':datetime.datetime.fromtimestamp(mtime,datetime.timezone.utc).isoformat()})
with tarfile.open(game/'evidence/content/source.tar.gz') as old:
    inputs={m.name for m in old.getmembers() if m.isfile()}
for directory in ['src','tests','tools','content','docs','engine/src']:
    inputs.update(str(p.relative_to(repo)) for p in (game/directory).rglob('*') if p.is_file())
for name in inputs:assert (repo/name).is_file() and not (repo/name).is_symlink(),name
with tarfile.open(dest/'source.tar.gz','w:gz') as out:
    for name in sorted(inputs):out.add(repo/name,arcname=name,recursive=False)
with tarfile.open(dest/'source.tar.gz') as out:
    members=[m for m in out.getmembers() if m.isfile()]
    assert {m.name for m in members}==inputs
    for m in members:assert out.extractfile(m).read()==(repo/m.name).read_bytes(),m.name
source={'layout':'repository-relative','files':[{'path':name,'hash':h(repo/name)} for name in sorted(inputs)]}
(dest/'source-inputs.json').write_text(json.dumps(source,indent=2)+'\n')
scenarios=['tests/wasm/checkpoint-room.test.ts','tests/wasm/checkpoint-storage.test.ts','tests/wasm/checkpoint-world.test.ts','tests/wasm/checkpoint-objects.test.ts','tests/inventory-checkpoint.test.ts','tests/object-checkpoint.test.ts','tests/vitals-checkpoint.test.ts','tests/integration/durability.test.ts','tests/integration/worker-checkpoint.test.ts','tests/integration/creative.test.ts','tests/fixtures/checkpoint-storage.ts','tests/fixtures/socket-probe.ts','tools/browser-creative.ts','tools/browser-inventory.ts','tools/browser-harness.ts']
for name in ['source.tar.gz','source-inputs.json','README.md']:files[name]=h(dest/name)
record={'result':'PASS_WITH_SERVICE_AND_DEVICE_LIMITATIONS','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'buildId':build['buildId'],'runtimeHash':build['runtimeHash'],'engineHash':build['engineHash'],'contentHash':build['contentHash'],
        'checksExitCode':check['exitCode'],'matchedReleaseFiles':12,
        'counts':{'domain':72,'nativePassed':79,'nativeIgnored':3,'actualWasm':74,'sourceIntegration':17,'packagedIntegration':17},
        'browserExitCodes':[{k:v[k] for k in ['script','code','signal']} for v in suite['checks']],
        'limitations':'Injected storage/metadata contract fixture, not Supabase/Postgres. No actual provider transaction, private-bucket, retention, deployment-overlap or school lifecycle qualification. Two ordinary built-client regressions only; no durable-backend browser proof and no new full eleven-scenario browser suite. Software Chromium creative frame gap 700 ms; hardware/input/audio/latency/capacity remain open. Full rewrite remains incomplete.',
        'screenshots':screens,'scenarios':[{'path':p,'hash':h(game/p)} for p in scenarios],
        'sourceArchive':{'path':'source.tar.gz','layout':'repository-relative','verifiedSourceFiles':len(inputs),'verification':'All archived regular files compared byte-for-byte with the workspace at capture'},
        'files':[{'path':p,'hash':v} for p,v in sorted(files.items())]}
for f in record['files']:assert h(dest/f['path'])==f['hash']
(dest/'verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'artifacts':len(files),'sources':len(inputs),'scenarios':len(scenarios),'buildId':build['buildId']}))
