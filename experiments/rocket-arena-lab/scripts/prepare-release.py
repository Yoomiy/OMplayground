#!/usr/bin/env python3
"""Copy an identifiable source snapshot; build/activation are separate steps."""
import datetime
import hashlib
import json
import pathlib
import shutil
import sys

source = pathlib.Path(__file__).resolve().parents[1]
releases = pathlib.Path(sys.argv[1]).resolve()
excluded = {"node_modules", "dist", ".run", ".git", "__pycache__"}
files = sorted(path for path in source.rglob("*") if path.is_file()
               and not any(part in excluded for part in path.relative_to(source).parts)
               and not path.name.endswith((".tsbuildinfo", ".log"))
               and (not path.name.startswith(".env") or path.name == ".env.example"))
digest = hashlib.sha256()
for path in files:
    digest.update(path.relative_to(source).as_posix().encode() + b"\0")
    digest.update(path.read_bytes() + b"\0")
source_hash = digest.hexdigest()
created = datetime.datetime.now(datetime.timezone.utc)
release_id = created.strftime("%Y%m%dT%H%M%SZ") + "-" + source_hash[:12]
destination = releases / release_id
destination.mkdir(parents=True, exist_ok=False)
for path in files:
    target = destination / path.relative_to(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
manifest = {"release": release_id, "sourceSha256": source_hash,
            "createdUtc": created.isoformat(), "path": str(destination),
            "upstream": "https://github.com/EndPx/Rocket-Arena",
            "upstreamRevision": "1aead71579bc988b53cc0d181ab9a4585fd52265"}
(destination / "release.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest))
