"""Freeze terminal persisted-chat checks; run from repository root."""
import datetime, hashlib, json, pathlib, re, shutil, subprocess, tarfile
repo=pathlib.Path.cwd(); game=repo/'games/voxel'; web=repo/'apps/web'; dest=game/'evidence/chat'
read=lambda p:json.loads(pathlib.Path(p).read_text())
digest=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
files={}
assert 'Capture is pending.' not in (dest/'README.md').read_text(), 'Resolve the pending-capture notice before freezing final evidence'
def copy(source,name):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,p);files[name]=digest(p)
build=read(game/'artifacts/build.json');release=read(game/'artifacts/release.json')
assert build['buildId']=='bedd62f9b37b2a071c498413c7352033ccd97e94f2bd976101259481c789d3f8'
check=read('/tmp/voxel-chat-core-complete-check.exit.json');assert check['exitCode']==0 and check['signal'] is None
core=pathlib.Path('/tmp/voxel-chat-core-complete-check.log').read_text()
for count,times in [(86,1),(84,1),(40,2)]:assert core.count(f'ℹ tests {count}\n')==times
assert '80 passed; 0 failed; 3 ignored' in core
for name,count in [('sdk',38),('school-gateway',7),('postgres',50)]:
 text=pathlib.Path(f'/tmp/voxel-chat-{name}.log').read_text()
 for marker in [f'ℹ tests {count}\n',f'ℹ pass {count}\n','ℹ fail 0\n','ℹ cancelled 0\n']:assert marker in text,(name,marker)
assert 'server stopped' in pathlib.Path('/tmp/voxel-chat-postgres-stop.log').read_text()
assert 'Tests  94 passed (94)' in pathlib.Path('/tmp/voxel-chat-web-tests.log').read_text()
assert '✓ built in' in pathlib.Path('/tmp/voxel-chat-web-build.log').read_text()
for name in ['service-types','web-types']:assert 'error TS' not in pathlib.Path(f'/tmp/voxel-chat-{name}.log').read_text()
boundary=read(web/'dist/voxel-browser-boundary.json');assert boundary=={'result':'PASS','gameModules':43,'forbiddenModules':0}
flow=read(web/'test-results/voxel-react.json')
assert flow['result'] in ['PASS','PASS_WITH_MOUSE_ACKNOWLEDGEMENT_TIMEOUT'] and flow['errors']==[]
for key in ['buildId','engineHash','contentHash']:assert flow[key]==build[key]
for key in ['lateMountCancelled','strictMode','fullscreenInventory','playerTouchMovement','failedSaveNotConfirmed','sameRequestRetry','noAutomaticReadmission','staffModeAndTeleport','moderationFlow','moderationRetrySameRequest','moderationInventoryPreserved','chatFlow','chatRetrySameRequest','chatEscapedText','chatHiddenStaffReadOnly','chatPersistedAfterReopen','chatDeleteAndClear']:assert flow[key] is True
assert [r['action'] for r in flow['moderationReceipts']]==['remove','ban','unban']
assert flow['expectedModerationFailureResponses']==flow['expectedBannedAdmissionResponses']==flow['expectedControlFailureResponses']==1
assert flow['expectedBrowserNetworkErrors']<=4+flow['expectedBannedSessionResponses']
assert flow['expectedChatFailureResponses']==1
assert len(flow['cleanup'])==3
for v in flow['cleanup']:assert all(n==0 for n in v['resources'].values()) and v['audio']=='closed'
assert len(flow['playerTouchLayout'])==9 and all(v['overlap']==0 and v['reachable'] for v in flow['playerTouchLayout'])
assert [r['action'] for r in flow['receipts']]==['pause','resume','end'] and all(r['completed'] for r in flow['receipts'])
assert all(r['savedSequence']>0 for r in flow['receipts'] if r['action']!='resume')
ready=read('/tmp/voxel-chat-hosted-ready.json');assert ready['result']=='NOT_READY' and ready['privateBucket'] and ready['chatSchema'] is None
assert len(ready['checks'])==7 and all(ready['checks'][name]['ready'] for name in ['checkpoint','projection','controls','roster','staff','moderation'])
assert ready['checks']['chat']=={'ready':False,'code':'PGRST202','operation':'voxel_chat_status'}
assert read('/tmp/voxel-chat-target-match.json')['configuredAndLinkedProjectMatch']
history=read('/tmp/voxel-chat-migration-history-read.json');assert {r['version'] for r in history['rows']}=={f'202610250{i}0000' for i in range(1,7)}
startup=read('/tmp/voxel-chat-startup-missing.json');assert startup['result']=='EXPECTED_NOT_READY' and startup['listenerAttempts']==0 and not startup['serviceCreated'] and startup['remoteApplicationWrites']==0 and len(startup['remoteStatusCalls'])==7
migration=repo/'supabase/migrations/20261025070000_voxel_chat.sql';assert digest(migration)=='f3de58fecd2634105fe4b25ce7875b308ba9eca7c428c43c3552f00f26a0ed5b'
prior=game/'evidence/moderation';assert digest(prior/'verification.json')=='de1ed19dcfeef7446d9a97238cc8169012c5b361eee85ee1cccc749e0b7de159'
for e in read(prior/'verification.json')['artifacts']:assert digest(prior/e['path'])==e['sha256']
subprocess.run(['node','tools/verify-release.mjs'],cwd=game,check=True)
for name in ['build','release','content']:copy(game/f'artifacts/{name}.json',f'{name}.json')
copy(game/'test-results/release-verification.json','source-release-verification.json')
for side in ['client','server']:
 for entry in release[side]:
  p=game/f'dist-{side}'/entry['path'];assert digest(p)==entry['hash'];copy(p,f'release/{side}/'+entry['path'])
copy(web/'test-results/voxel-react.json','browser-react.json')
for suffix in ['inventory','observer','playing','mobile','staff','moderation','chat']:copy(web/f'test-results/voxel-react-{suffix}.png',f'react-{suffix}.png')
for e in flow['clientArtifacts']:
 name=e['path'].removeprefix('/');assert '..' not in pathlib.PurePosixPath(name).parts
 p=web/'test-results/react-fixture'/name;assert digest(p)==e['sha256'];copy(p,'react-fixture/'+name)
inventory=[]
for p in sorted((web/'dist').rglob('*')):
 if p.is_file():
  name=p.relative_to(web/'dist').as_posix();inventory.append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p)})
  if name in ['index.html','voxel-browser-boundary.json'] or re.match(r'assets/(?:index-|HomePage-|TeacherPage-|ClassroomPage-|ClassroomAdminExplorer-|embed-|VoxelSessionContainer-|engine-worker-|voxel_engine_bg-)',name):copy(p,'web-production/'+name)
(dest/'web-production-inventory.json').write_text(json.dumps({'configuration':'Fixture public URLs; actual production application build, not a hosted shell journey','files':inventory},indent=2)+'\n');files['web-production-inventory.json']=digest(dest/'web-production-inventory.json')
for name in ['core-complete-check','sdk','school-gateway','postgres','postgres-stop','postgres-start','postgres-final-start','service-types','web-types','web-tests','web-build','browser','postgres-targeted','contract','web-types-uuid-inference-failure','browser-status-markup-failure','browser-mouse-exit-failure']:
 copy(f'/tmp/voxel-chat-{name}.log',name+'.txt')
copy('/tmp/voxel-chat-core-complete-check.exit.json','check-exit.json');copy('/tmp/voxel-run-chat-core-check.mjs','run-check.mjs')
for name in ['hosted-ready.json','migration-history-read.sql','migration-history-read.json','target-match.json','startup-missing.mjs','startup-missing.json','startup-missing.log']:copy('/tmp/voxel-chat-'+name,name)
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
record={'result':'LOCAL_PASS_WITH_PENDING_HOSTED_CHAT_AND_DEVICE_QUALIFICATION','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**{k:build[k] for k in ['buildId','engineHash','contentHash','protocol']},'counts':{'domain':86,'native':80,'nativeIgnored':3,'wasm':84,'sourceIntegration':40,'packagedIntegration':40,'sdkAndPolicy':38,'schoolGateway':7,'postgresSdk':50,'web':94,'renderedContexts':3},'sourceFiles':len(inputs),'hostedSchemas':6,'chatMigration':{'path':migration.relative_to(repo).as_posix(),'sha256':digest(migration),'locallyQualified':True,'hostedApplied':False},'agentRemoteApplicationWrites':False,'deployment':False,'browserMouseAcknowledged':flow['mouseClickAcknowledged'],'priorModerationArchiveUnchanged':True,'limitations':['Fixture Auth/PostgREST/Storage over actual SQL/SDK/packaged workers, not actual authenticated catalog shell or hosted recovery','First six hosted schemas/private bucket ready; seventh chat RPC missing, guarded startup refuses to listen','Software browser functionality only; earlier status-selector and fullscreen Exit failures retained, input qualification remains open','Rewritten voice grant/mute enforcement, hosted classroom/browser/WebRTC/container, survival balance/bucket UI, device/network/capacity and cutover remain required'],'artifacts':[{'path':name,'sha256':value} for name,value in sorted(files.items())]}
(dest/'verification.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'artifacts':len(files),'sources':len(inputs),'buildId':build['buildId']}))
