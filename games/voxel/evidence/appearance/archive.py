import hashlib
import json
import pathlib
import tarfile

repo = pathlib.Path('/home/ubuntu/OMplayground')
game = repo / 'games/voxel'
dest = game / 'evidence/appearance'
with tarfile.open(game / 'evidence/equipment/source.tar.gz') as previous:
    inputs = {m.name for m in previous.getmembers() if m.isfile()}
for directory in ['src', 'tests', 'tools', 'content', 'docs', 'engine/src']:
    inputs.update(str(p.relative_to(repo)) for p in (game / directory).rglob('*') if p.is_file())
for name in inputs:
    path = repo / name
    assert path.is_file() and not path.is_symlink(), name
archive = dest / 'source.tar.gz'
with tarfile.open(archive, 'w:gz') as out:
    for name in sorted(inputs):
        out.add(repo / name, arcname=name, recursive=False)
hash_bytes = lambda b: hashlib.sha256(b).hexdigest()
with tarfile.open(archive) as stored:
    members = [m for m in stored.getmembers() if m.isfile()]
    assert {m.name for m in members} == inputs
    for member in members:
        assert stored.extractfile(member).read() == (repo / member.name).read_bytes(), member.name
source_inputs = {'layout': 'repository-relative', 'files': [
    {'path': name, 'hash': hash_bytes((repo / name).read_bytes())} for name in sorted(inputs)
]}
(dest / 'source-inputs.json').write_text(json.dumps(source_inputs, indent=2) + '\n')
record = dest / 'verification.json'
verification = json.loads(record.read_text())
verification['sourceArchive'] = {
    'path': 'source.tar.gz', 'layout': 'repository-relative',
    'purpose': 'Preserve the exact verified milestone sources, tests, content, toolchain inputs and provenance before later development',
    'verifiedSourceFiles': len(inputs),
    'verification': 'Every archived regular file matched the workspace byte-for-byte at capture; all evidence and scenario hashes also matched'
}
for path in ['source.tar.gz', 'source-inputs.json', 'README.md']:
    verification['files'].append({'path': path, 'hash': hash_bytes((dest / path).read_bytes())})
verification['files'].sort(key=lambda entry: entry['path'])
for entry in verification['files']:
    assert hash_bytes((dest / entry['path']).read_bytes()) == entry['hash'], entry['path']
for entry in verification['scenarios']:
    assert hash_bytes((game / entry['path']).read_bytes()) == entry['hash'], entry['path']
record.write_text(json.dumps(verification, indent=2) + '\n')
print(f'Verified {len(inputs)} archived sources, {len(verification["files"])} artifacts, and {len(verification["scenarios"])} scenarios')
