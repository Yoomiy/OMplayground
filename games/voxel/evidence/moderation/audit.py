"""Independently audit the completed capture; write outside the frozen archive."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile

repo = Path.cwd()
archive = repo / "games/voxel/evidence/moderation"


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def safe_path(base, name):
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and ".." not in relative.parts, name
    path = base / name
    assert path.is_file() and not path.is_symlink(), name
    return path


verification = read(archive / "verification.json")
assert verification["buildId"] == (
    "85b864f78689d78c2f287419f2d1e526e100c407720ba55cc7a5d3d749646a78"
)
entries = verification["artifacts"]
assert len({e["path"] for e in entries}) == len(entries)
for entry in entries:
    assert digest(safe_path(archive, entry["path"])) == entry["sha256"]

inputs = read(archive / "source-inputs.json")["files"]
expected = {e["path"]: e["sha256"] for e in inputs}
assert len(expected) == len(inputs) == verification["sourceFiles"]
for name, sha in expected.items():
    assert digest(safe_path(repo, name)) == sha, name
with tarfile.open(archive / "source.tar.gz") as source:
    members = source.getmembers()
    assert len(members) == len(expected)
    assert {m.name for m in members} == set(expected)
    for member in members:
        assert member.isfile()
        body = source.extractfile(member).read()
        assert hashlib.sha256(body).hexdigest() == expected[member.name]
        assert body == safe_path(repo, member.name).read_bytes()

build = read(archive / "build.json")
assert build == read(repo / "games/voxel/artifacts/build.json")
release = read(archive / "release.json")
assert release == read(repo / "games/voxel/artifacts/release.json")
release_files = 0
for side in ["client", "server"]:
    for entry in release[side]:
        frozen = safe_path(archive / f"release/{side}", entry["path"])
        current = safe_path(repo / f"games/voxel/dist-{side}", entry["path"])
        assert digest(frozen) == digest(current) == entry["hash"]
        release_files += 1
assert release_files == 12

browser = read(archive / "browser-react.json")
assert browser["buildId"] == build["buildId"] and browser["errors"] == []
assert browser["moderationFlow"] and browser["moderationInventoryPreserved"]
assert browser["moderationRetrySameRequest"]
assert len(browser["clientArtifacts"]) == 7
for entry in browser["clientArtifacts"]:
    name = entry["path"].removeprefix("/")
    frozen = safe_path(archive / "react-fixture", name)
    current = safe_path(repo / "apps/web/test-results/react-fixture", name)
    assert digest(frozen) == digest(current) == entry["sha256"]

web_inventory = read(archive / "web-production-inventory.json")["files"]
web_expected = {e["path"]: e for e in web_inventory}
assert len(web_expected) == len(web_inventory)
web_root = repo / "apps/web/dist"
assert {p.relative_to(web_root).as_posix() for p in web_root.rglob("*") if p.is_file()} == set(web_expected)
for name, entry in web_expected.items():
    path = safe_path(web_root, name)
    assert path.stat().st_size == entry["bytes"] and digest(path) == entry["sha256"]
for frozen in (archive / "web-production").rglob("*"):
    if frozen.is_file():
        name = frozen.relative_to(archive / "web-production").as_posix()
        assert digest(frozen) == web_expected[name]["sha256"]
assert read(web_root / "voxel-browser-boundary.json") == {
    "result": "PASS", "gameModules": 42, "forbiddenModules": 0
}

installed = read(archive / "installed-read.json")["rows"]
functions = {r["name"]: r["detail"] for r in installed if r["kind"] == "function"}
assert len(functions) == 9
for expected_function in read(archive / "installed-expected.json")["functions"]:
    name = expected_function["name"]
    observed = functions[name]
    assert observed["bodyMd5"] == expected_function["body_md5"]
    assert not observed["anonExecute"] and not observed["browserExecute"]
    assert observed["serviceExecute"] == (name != "voxel_actor_kind")
assert {r["name"] for r in installed if r["kind"] == "migration"} == {
    f"202610250{i}0000" for i in range(1, 7)
}
tables = [r["detail"] for r in installed if r["kind"] == "table"]
assert len(tables) == 2
assert all(t["rls"] and not t["serviceSelect"] and not t["browserSelect"] for t in tables)
assert digest(repo / verification["moderationMigration"]["path"]) == verification["moderationMigration"]["sha256"]
startup = read(archive / "voxel-startup.json")
assert startup["buildId"] == build["buildId"] and startup["rooms"] == 0
assert startup["remoteApplicationWrites"] == 0 and startup["closed"]
assert len(startup["remoteStatusCalls"]) == 6

prior = repo / "games/voxel/evidence/classroom-extraction"
assert digest(prior / "verification.json") == (
    "a35826433a2f2f644608816654c93811fef7d2bfeaf6af1cc9a85751fa19816a"
)
for entry in read(prior / "verification.json")["artifacts"]:
    assert digest(safe_path(prior, entry["path"])) == entry["sha256"]

result = {
    "result": "PASS",
    "buildId": build["buildId"],
    "verificationSha256": digest(archive / "verification.json"),
    "artifacts": len(entries),
    "sources": len(inputs),
    "releaseFiles": release_files,
    "browserFixtureFiles": len(browser["clientArtifacts"]),
    "productionWebFiles": len(web_inventory),
    "priorClassroomArchiveUnchanged": True,
}
output = repo / "games/voxel/test-results/moderation-evidence-audit.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
