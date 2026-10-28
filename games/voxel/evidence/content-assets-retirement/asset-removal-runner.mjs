import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=b=>createHash('sha256').update(b).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{
 const p=path.join(dir,e.name);assert(!e.isSymbolicLink(),p);assert(!e.name.startsWith('.env'),p);
 assert(e.isDirectory()||e.isFile(),p);return e.isDirectory()?files(p):[p];
});}
const hosted=JSON.parse(fs.readFileSync('/tmp/voxel-legacy-assets-hosted-read.json'));
assert.equal(hosted.result,'NO_CONFIGURED_CATALOG_OR_AVATAR_REFERENCES_TO_RETIRED_ASSETS');
assert.deepEqual(Object.values(hosted.matchingCounts),[0,0,0]);assert.equal(hosted.hostedWrites,false);
const assetRoot='apps/web/public/minecraft-assets',assetFiles=files(assetRoot),backup='/tmp/voxel-legacy-assets-before';
assert.equal(assetFiles.length,1946);
const sourceFiles=['scripts/borrow-voxel-textures.ts','scripts/borrow-voxel-audio.ts'];
const selected=[...assetFiles,...sourceFiles],head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const tree=execFileSync('git',['ls-tree','-r','-z',head,'--',assetRoot,...sourceFiles],{encoding:'utf8'}).split('\0').filter(Boolean);
const gitObjects=new Map(tree.map(row=>{const [meta,p]=row.split('\t');return[p,meta.split(' ')[2]];}));
const publicBefore=files('apps/web/public').map(p=>({path:p,sha256:sha(fs.readFileSync(p))}));
fs.writeFileSync('/tmp/voxel-legacy-assets-public-before.json',JSON.stringify(publicBefore,null,2)+'\n');
for(const name of ['package.json','package-lock.json'])fs.copyFileSync(name,'/tmp/voxel-legacy-assets-'+name+'-before');
const rows=selected.map(p=>{
 const raw=fs.readFileSync(p),out=path.join(backup,p);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,raw);
 const blob=createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
 return{path:p,sha256:sha(raw),bytes:raw.length,kind:sourceFiles.includes(p)?'obsolete-import-tool':'unused-public-asset',gitCommit:gitObjects.get(p)===blob?head:null};
});
for(const r of rows){assert.equal(sha(fs.readFileSync(r.path)),r.sha256);assert.equal(sha(fs.readFileSync(path.join(backup,r.path))),r.sha256);}
fs.writeFileSync('/tmp/voxel-legacy-assets-removal-inputs.json',JSON.stringify({head,backup,assetRoot,assetFiles:assetFiles.length,assetBytes:rows.filter(r=>r.kind==='unused-public-asset').reduce((n,r)=>n+r.bytes,0),unrelatedPublicFiles:publicBefore.length-assetFiles.length,files:rows},null,2)+'\n');
for(const r of rows)fs.unlinkSync(r.path);
function prune(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory())prune(path.join(dir,e.name));assert.equal(fs.readdirSync(dir).length,0);fs.rmdirSync(dir);}
prune(assetRoot);
const pkg=JSON.parse(fs.readFileSync('package.json'));delete pkg.scripts['borrow-voxel-textures'];delete pkg.scripts['borrow-voxel-audio'];
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
for(const f of publicBefore)if(!f.path.startsWith(assetRoot+'/'))assert.equal(sha(fs.readFileSync(f.path)),f.sha256,f.path);
console.log(JSON.stringify({retiredAssets:assetFiles.length,retiredImportTools:sourceFiles.length,assetBytes:rows.filter(r=>r.kind==='unused-public-asset').reduce((n,r)=>n+r.bytes,0),unchangedUnrelatedPublicFiles:publicBefore.length-assetFiles.length,nonGitPreimages:rows.filter(r=>!r.gitCommit).length,backup}));
