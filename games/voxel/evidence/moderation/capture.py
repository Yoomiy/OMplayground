"""Freeze terminal moderation checks; run from repository root."""
import datetime, hashlib, json, pathlib, re, shutil, subprocess, tarfile
repo=pathlib.Path.cwd(); game=repo/'games/voxel'; web=repo/'apps/web'; dest=game/'evidence/moderation'
read=lambda p:json.loads(pathlib.Path(p).read_text())
digest=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
files={}
assert 'Capture is pending.' not in (dest/'README.md').read_text(), 'Resolve the pending-capture notice before freezing final evidence'
def copy(source,name):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,p);files[name]=digest(p)
build=read(game/'artifacts/build.json');release=read(game/'artifacts/release.json')
assert build['buildId']=='85b864f78689d78c2f287419f2d1e526e100c407720ba55cc7a5d3d749646a78'
check=read('/tmp/voxel-moderation-core-complete-check.exit.json');assert check['exitCode']==0 and check['signal'] is None
core=pathlib.Path('/tmp/voxel-moderation-core-complete-check.log').read_text()
for count,times in [(85,1),(84,1),(40,2)]:assert core.count(f'ℹ tests {count}\n')==times
assert '80 passed; 0 failed; 3 ignored' in core
for name,count in [('sdk',38),('school-gateway',7),('postgres',42)]:
 text=pathlib.Path(f'/tmp/voxel-moderation-{name}.log').read_text()
 for marker in [f'ℹ tests {count}\n',f'ℹ pass {count}\n','ℹ fail 0\n','ℹ cancelled 0\n']:assert marker in text,(name,marker)
assert 'server stopped' in pathlib.Path('/tmp/voxel-moderation-postgres-stop.log').read_text()
assert 'Tests  92 passed (92)' in pathlib.Path('/tmp/voxel-moderation-web-tests.log').read_text()
assert '✓ built in' in pathlib.Path('/tmp/voxel-moderation-web-build.log').read_text()
for name in ['game-types','service-types','web-types']:assert 'error TS' not in pathlib.Path(f'/tmp/voxel-moderation-{name}.log').read_text()
boundary=read(web/'dist/voxel-browser-boundary.json');assert boundary=={'result':'PASS','gameModules':42,'forbiddenModules':0}
flow=read(web/'test-results/voxel-react.json')
assert flow['result'] in ['PASS','PASS_WITH_MOUSE_ACKNOWLEDGEMENT_TIMEOUT'] and flow['errors']==[]
for key in ['buildId','engineHash','contentHash']:assert flow[key]==build[key]
for key in ['lateMountCancelled','strictMode','fullscreenInventory','playerTouchMovement','failedSaveNotConfirmed','sameRequestRetry','noAutomaticReadmission','staffModeAndTeleport','moderationFlow','moderationRetrySameRequest','moderationInventoryPreserved']:assert flow[key] is True
assert [r['action'] for r in flow['moderationReceipts']]==['remove','ban','unban']
assert flow['expectedModerationFailureResponses']==flow['expectedBannedAdmissionResponses']==flow['expectedControlFailureResponses']==1
assert flow['expectedBrowserNetworkErrors']<=3+flow['expectedBannedSessionResponses']
assert len(flow['cleanup'])==3
for v in flow['cleanup']:assert all(n==0 for n in v['resources'].values()) and v['audio']=='closed'
assert len(flow['playerTouchLayout'])==9 and all(v['overlap']==0 and v['reachable'] for v in flow['playerTouchLayout'])
assert [r['action'] for r in flow['receipts']]==['pause','resume','end'] and all(r['completed'] for r in flow['receipts'])
assert all(r['savedSequence']>0 for r in flow['receipts'] if r['action']!='resume')
ready=read('/tmp/voxel-moderation-hosted-ready.json');assert ready['result']=='PASS' and ready['privateBucket'] and ready['moderationSchema']==1 and len(ready['checks'])==6
installed=read('/tmp/voxel-moderation-installed-audit.json');assert installed['result']=='PASS' and installed['matchedFunctions']==9 and installed['privateTables']==2 and installed['migrations']==6
assert read('/tmp/voxel-moderation-target-match.json')['configuredAndLinkedProjectMatch']
startup=read('/tmp/voxel-moderation-voxel-startup.json');assert startup['result']=='PASS' and startup['buildId']==build['buildId'] and startup['rooms']==0 and startup['remoteApplicationWrites']==0 and startup['closed'] and len(startup['remoteStatusCalls'])==6
migration=repo/'supabase/migrations/20261025060000_voxel_moderation.sql';assert digest(migration)==installed['migrationSha256']
prior=game/'evidence/classroom-extraction';assert digest(prior/'verification.json')=='a35826433a2f2f644608816654c93811fef7d2bfeaf6af1cc9a85751fa19816a'
for e in read(prior/'verification.json')['artifacts']:assert digest(prior/e['path'])==e['sha256']
subprocess.run(['node','tools/verify-release.mjs'],cwd=game,check=True)
for name in ['build','release','content']:copy(game/f'artifacts/{name}.json',f'{name}.json')
copy(game/'test-results/release-verification.json','source-release-verification.json')
for side in ['client','server']:
 for entry in release[side]:
  p=game/f'dist-{side}'/entry['path'];assert digest(p)==entry['hash'];copy(p,f'release/{side}/'+entry['path'])
copy(web/'test-results/voxel-react.json','browser-react.json')
for suffix in ['inventory','observer','playing','mobile','staff','moderation']:copy(web/f'test-results/voxel-react-{suffix}.png',f'react-{suffix}.png')
for e in flow['clientArtifacts']:
 name=e['path'].removeprefix('/');assert '..' not in pathlib.PurePosixPath(name).parts
 p=web/'test-results/react-fixture'/name;assert digest(p)==e['sha256'];copy(p,'react-fixture/'+name)
inventory=[]
for p in sorted((web/'dist').rglob('*')):
 if p.is_file():
  name=p.relative_to(web/'dist').as_posix();inventory.append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p)})
  if name in ['index.html','voxel-browser-boundary.json'] or re.match(r'assets/(?:index-|HomePage-|TeacherPage-|ClassroomPage-|ClassroomAdminExplorer-|embed-|VoxelSessionContainer-|engine-worker-|voxel_engine_bg-)',name):copy(p,'web-production/'+name)
(dest/'web-production-inventory.json').write_text(json.dumps({'configuration':'Fixture public URLs; actual production application build, not a hosted shell journey','files':inventory},indent=2)+'\n');files['web-production-inventory.json']=digest(dest/'web-production-inventory.json')
for name in ['core-complete-check','sdk','school-gateway','postgres','postgres-stop','postgres-start','postgres-final-start','game-types','service-types','web-types','web-tests','web-build','browser','stale-ticket-reproducer','stale-ticket-fixed','unban-noop-reproducer','postgres-fixture-failure','postgres-schema-fixture-failure','session-fixture-fixed','browser-epoch-assertion-failure','browser-session-error-assertion-failure','browser-end-confirmation-failure']:
 copy(f'/tmp/voxel-moderation-{name}.log',name+'.txt')
copy('/tmp/voxel-moderation-core-complete-check.exit.json','check-exit.json');copy('/tmp/voxel-run-moderation-core-check.mjs','run-check.mjs')
for name in ['hosted-ready.json','installed-expected.json','installed-read.json','installed-read.sql','installed-audit.json','target-match.json','voxel-startup.mjs','voxel-startup.json','voxel-startup.log']:copy('/tmp/voxel-moderation-'+name,name)
inputs=set()
for base in ['apps/classroom-server','apps/minecraft-server','apps/game-server','apps/web','apps/voxel-server','games/voxel']:
 for directory in ['src','tests','tools','content','docs','engine/src']:inputs.update(p.relative_to(repo).as_posix() for p in (repo/base/directory).rglob('*') if p.is_file())
 for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','jest.config.cjs','index.html','README.md','UPSTREAM.md','LICENSE','engine/Cargo.toml','engine/Cargo.lock','engine/LICENSE','Dockerfile','.env.example']:
  if (repo/base/name).is_file():inputs.add(base+'/'+name)
for workspace in ['game-logic','observability','voxel-content']:
 inputs.update(p.relative_to(repo).as_posix() for p in (repo/f'packages/{workspace}/src').rglob('*') if p.is_file())
 for name in ['package.json','tsconfig.json','jest.config.js']:
  if (repo/f'packages/{workspace}/{name}').is_file():inputs.add(f'packages/{workspace}/{name}')
inputs.update(['package.json','package-lock.json','.github/workflows/voxel.yml','.github/workflows/classroom.yml','docs/voxel-runtime-rewrite-proposal.md','docs/voxel-runtime-rewrite-progress.md','docs/LOGGING.md','docs/virtual_classrooms.md','docs/supabase-key-migration.md','docs/adr/002-voxel-native-websocket.md'])
inputs.update(p.relative_to(repo).as_posix() for p in (repo/'supabase/migrations').glob('*voxel*.sql'))
for name in inputs:
 p=repo/name;assert p.is_file() and not p.is_symlink();assert not {'node_modules','evidence','.git','dist','test-results'}.intersection(p.relative_to(repo).parts);assert not p.name.startswith('.env') or p.name=='.env.example'
with tarfile.open(dest/'source.tar.gz','w:gz') as tar:
 for name in sorted(inputs):tar.add(repo/name,arcname=name,recursive=False)
(dest/'source-inputs.json').write_text(json.dumps({'layout':'repository-relative','files':[{'path':name,'sha256':digest(repo/name)} for name in sorted(inputs)]},indent=2)+'\n')
for name in ['source.tar.gz','source-inputs.json','capture.py','audit.py','README.md']:files[name]=digest(dest/name)
record={'result':'LOCAL_AND_READ_ONLY_HOSTED_SCHEMA_PASS_WITH_JOURNEY_AND_DEVICE_LIMITATIONS','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**{k:build[k] for k in ['buildId','engineHash','contentHash','protocol']},'counts':{'domain':85,'native':80,'nativeIgnored':3,'wasm':84,'sourceIntegration':40,'packagedIntegration':40,'sdkAndPolicy':38,'schoolGateway':7,'postgresSdk':42,'web':92,'renderedContexts':3},'sourceFiles':len(inputs),'hostedSchemas':6,'installedFunctionsMatch':9,'privateTables':2,'moderationMigration':{'path':migration.relative_to(repo).as_posix(),'sha256':digest(migration),'userReportedApplied':True,'readOnlyVerified':True},'agentRemoteApplicationWrites':False,'deployment':False,'browserMouseAcknowledged':flow['mouseClickAcknowledged'],'priorClassroomArchiveUnchanged':True,'limitations':['Fixture Auth/PostgREST/Storage over actual SQL/SDK/packaged workers, not actual authenticated catalog shell or hosted recovery','Six hosted schemas/private bucket and guarded zero-room startup are read-only installation/connectivity evidence','Software browser input/teardown only; retained acknowledgement and end-confirmation failure has no proven cause','Voice grant/mute enforcement, chat, hosted classroom/browser/WebRTC/container, survival balance/bucket UI, device/network/capacity and cutover remain required'],'artifacts':[{'path':name,'sha256':value} for name,value in sorted(files.items())]}
(dest/'verification.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'artifacts':len(files),'sources':len(inputs),'buildId':build['buildId']}))
