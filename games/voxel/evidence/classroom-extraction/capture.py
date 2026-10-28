"""Freeze terminal classroom-extraction checks; run from repository root."""
import datetime,hashlib,json,pathlib,re,shutil,tarfile
repo=pathlib.Path.cwd(); dest=repo/'games/voxel/evidence/classroom-extraction'
read=lambda p:json.loads(pathlib.Path(p).read_text())
digest=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
files={}
def copy(source,name):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,p);files[name]=digest(p)
for name,count in [('tests',69),('observability-tests',32),('legacy-tests',120),('drawing-tests',19)]:
 text=pathlib.Path('/tmp/voxel-classroom-'+name+'.log').read_text()
 assert re.search(r'Tests:\s+'+str(count)+r' passed, '+str(count)+r' total',text),name
 copy('/tmp/voxel-classroom-'+name+'.log',name+'.txt')
assert 'Tests  90 passed (90)' in pathlib.Path('/tmp/voxel-classroom-web-tests.log').read_text()
assert '✓ built in' in pathlib.Path('/tmp/voxel-classroom-web-build.log').read_text()
for name in ['web-tests','web-build','web-types','legacy-types','voxel-types','boundary','game-release','lock']:
 text=pathlib.Path('/tmp/voxel-classroom-'+name+'.log').read_text()
 assert 'error TS' not in text,name
 copy('/tmp/voxel-classroom-'+name+'.log',name+'.txt')
boundary=read(repo/'apps/classroom-server/test-results/boundary.json')
assert boundary['result']=='PASS' and boundary['sourceModules']==15 and boundary['gameImports']==0 and boundary['classroomRoutes']==20 and not boundary['legacyClassroomOwnership']
assert len(boundary['productionFiles'])==30
copy(repo/'apps/classroom-server/test-results/boundary.json','classroom-boundary.json')
for e in boundary['productionFiles']:
 p=repo/'apps/classroom-server/dist'/e['path'];assert digest(p)==e['sha256'];copy(p,'classroom-production/'+e['path'])
for p in sorted((repo/'packages/observability/dist').rglob('*')):
 if p.is_file():copy(p,'observability-production/'+p.relative_to(repo/'packages/observability/dist').as_posix())
ready=read('/tmp/voxel-classroom-hosted-ready.json');assert ready['result']=='PASS' and ready['privateBucket'] and ready['staffSchema']==1 and len(ready['checks'])==5
provider=read('/tmp/voxel-classroom-provider-ready.json');assert provider['result']=='PASS' and provider['readOnly'] and all(v['ready'] for v in provider['checks'].values())
audit=read('/tmp/voxel-classroom-staff-installed-audit.json');assert audit['result']=='PASS' and audit['matchingFunctionBodies']==6 and len(audit['allFiveMigrationVersions'])==5
assert read('/tmp/voxel-classroom-target-match.json')['configuredAndLinkedProjectMatch']
startup=read('/tmp/voxel-classroom-voxel-startup.json');assert startup['result']=='PASS' and startup['rooms']==0 and startup['remoteApplicationWrites']==0 and startup['closed']
for name in ['hosted-ready.json','provider-ready.json','staff-installed-audit.json','staff-installed-read.sql','staff-installed-read.json','staff-expected.json','target-match.json','voxel-startup.json','voxel-startup.log','voxel-startup.mjs']:
 copy('/tmp/voxel-classroom-'+name,name)
for name in ['legacy-index.ts','legacy-livekitService.ts','legacy-livekitService.test.ts']:
 copy('/tmp/voxel-classroom-'+name,'before-extraction/'+name)
build=read(repo/'games/voxel/artifacts/build.json');release=read(repo/'games/voxel/artifacts/release.json')
assert build['buildId']==startup['buildId']=='66a9ff4dc9d4a0a38acdffdb68a05776d271c445395bd1d1a3d379208b584e68'
copy(repo/'games/voxel/artifacts/build.json','game-build.json');copy(repo/'games/voxel/artifacts/release.json','game-release.json')
for side in ['client','server']:
 for entry in release[side]:assert digest(repo/f'games/voxel/dist-{side}'/entry['path'])==entry['hash']
prior=repo/'games/voxel/evidence/staff-commands'
assert digest(prior/'verification.json')=='2b3f708ff73d7179b0385ec32c1694de78500ee59cf235cdf3f0ffe267a17b63'
for e in read(prior/'verification.json')['artifacts']:assert digest(prior/e['path'])==e['sha256']
core_inputs=[e for e in read(prior/'source-inputs.json')['files'] if any(e['path'].startswith('games/voxel/'+d+'/') for d in ['src','tests','tools','content','engine/src'])]
for e in core_inputs:assert digest(repo/e['path'])==e['sha256'],e['path']
web_boundary=read(repo/'apps/web/dist/voxel-browser-boundary.json');assert web_boundary=={'result':'PASS','gameModules':41,'forbiddenModules':0}
inventory=[]
for p in sorted((repo/'apps/web/dist').rglob('*')):
 if p.is_file():
  name=p.relative_to(repo/'apps/web/dist').as_posix();inventory.append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p)})
  if name in ['index.html','voxel-browser-boundary.json'] or re.match(r'assets/(?:index-|HomePage-|TeacherPage-|ClassroomPage-|ClassroomAdminExplorer-|embed-|VoxelSessionContainer-|engine-worker-|voxel_engine_bg-)',name):copy(p,'web-production/'+name)
(dest/'web-production-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n');files['web-production-inventory.json']=digest(dest/'web-production-inventory.json')
inputs=set()
for base in ['apps/classroom-server','apps/minecraft-server','apps/game-server','apps/web','apps/voxel-server','games/voxel']:
 for directory in ['src','tests','tools','content','docs','engine/src']:
  inputs.update(p.relative_to(repo).as_posix() for p in (repo/base/directory).rglob('*') if p.is_file())
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
for name in ['source.tar.gz','source-inputs.json','capture.py','README.md']:files[name]=digest(dest/name)
record={'result':'LOCAL_AND_READ_ONLY_PROVIDER_PASS_WITH_HOSTED_JOURNEY_AND_CONTAINER_LIMITATIONS','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'buildId':build['buildId'],'counts':{'classroom':69,'observability':32,'legacyGame':120,'drawingAndCapabilities':19,'web':90},'sourceFiles':len(inputs),'classroomSourceModules':15,'classroomProductionFiles':30,'classroomRoutes':20,'gameImports':0,'unchangedCoreSourceInputs':len(core_inputs),'coreEvidence':'games/voxel/evidence/staff-commands/verification.json','hostedVoxelSchemas':5,'installedStaffFunctionsMatch':6,'classroomProviderReadinessOnly':True,'agentRemoteApplicationWrites':False,'deployment':False,'containerQualified':False,'priorStaffArchiveUnchanged':True,'limitations':['Classroom combined flows use fixture providers; actual Auth/WebRTC/browser/cookie/board/presentation/restart/outage qualification remains open','Actual hosted reads establish base-table and LiveKit API connectivity, not a hosted classroom journey','Guarded voxel startup uses five status RPCs and zero rooms; full hosted school/checkpoint/worker recovery remains open','Docker image and CI are prepared but not executed locally','Remaining voxel moderation/chat/voice, survival balance/bucket UI, device/network/load/capacity and cutover/legacy removal remain required'],'artifacts':[{'path':name,'sha256':value} for name,value in sorted(files.items())]}
(dest/'verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'artifacts':len(files),'sources':len(inputs),'unchangedCoreInputs':len(core_inputs)}))
