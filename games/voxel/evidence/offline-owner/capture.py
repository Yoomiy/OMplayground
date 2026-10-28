"""Run from the repository root after the referenced checks complete."""
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile

repo = pathlib.Path.cwd()
game, app = repo / "games/voxel", repo / "apps/voxel-server"
dest = game / "evidence/offline-owner"
j = lambda path: json.loads(pathlib.Path(path).read_text())
h = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
subprocess.run(["node", "tools/verify-release.mjs"], cwd=game, check=True)
build, release = j(game / "artifacts/build.json"), j(game / "artifacts/release.json")
check = j("/tmp/voxel-owner-core-complete-check.exit.json")
suite = j("/tmp/voxel-owner-browser-suite.json")
assert check["exitCode"] == 0 and check["signal"] is None
log = pathlib.Path("/tmp/voxel-owner-core-complete-check.log").read_text()
for marker in ["Voxel build " + build["buildId"][:12], "ℹ tests 75", "80 passed; 0 failed; 3 ignored", "ℹ tests 78"]:
    assert marker in log, marker
assert log.count("ℹ tests 26") == 2
assert suite["buildId"] == build["buildId"]
assert {r["name"] for r in suite["results"]} == {"tnt", "observer", "release"}
for run in suite["results"]:
    assert run["exitCode"] == 0 and run["signal"] is None
    assert run["startedAt"] >= check["finishedAt"]
for name, count in [("sdk", 19), ("school-gateway", 5), ("postgres", 12)]:
    output = pathlib.Path(f"/tmp/voxel-owner-{name}.log").read_text()
    assert f"ℹ tests {count}\n" in output and f"ℹ pass {count}\n" in output and "ℹ fail 0\n" in output
hosted_sql = j("/tmp/voxel-owner-hosted-sql.json")["rows"][0]["qualification"]
assert hosted_sql["result"] == "PASS" and hosted_sql["rollbackOnly"] and hosted_sql["fixtureSessionAbsent"]
assert len(hosted_sql["checks"]) == 9
storage = j(app / "test-results/live-storage.json")
assert storage["result"] == "PASS" and storage["cleanup"] and storage["privateBucket"] and storage["immutable"]
assert storage["path"] == "qualification/" + storage["run"] + ".json"
assert storage["anonymousStatus"] in [400, 401, 403, 404] and storage["publicStatus"] in [400, 401, 403, 404]
assert j(app / "test-results/hosted-status.json")["result"] == "PASS"
assert j("/tmp/voxel-owner-target-match.json")["configuredAndLinkedProjectMatch"] is True

files = {}
def copy(source, name):
    output = dest / name
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, output)
    files[name] = h(output)

for name in ["build", "release", "content"]:
    copy(game / f"artifacts/{name}.json", f"{name}.json")
copy(game / "test-results/release-verification.json", "source-release-verification.json")
for side in ["client", "server"]:
    for entry in release[side]:
        source = game / f"dist-{side}" / entry["path"]
        assert h(source) == entry["hash"]
        copy(source, f"release/{side}/{entry['path']}")
tnt = j(game / "test-results/browser-tnt.json")
assert tnt["result"] == "PASS" and tnt["errors"] == []
for field in ["buildId", "engineHash", "contentHash"]:
    assert tnt[field] == build[field]
copy(game / "test-results/browser-tnt.json", "browser-tnt.json")
observer = j(app / "test-results/browser-school.json")
assert observer["result"] == "PASS" and observer["errors"] == [] and observer["buildId"] == build["buildId"]
assert [e["on"] for e in observer["controls"] if e["type"] == "flight"] == [False, True, False]
copy(app / "test-results/browser-school.json", "browser-school.json")
for name in ["tnt-fuse", "tnt-crater"]:
    copy(game / f"test-results/{name}.png", f"{name}.png")
copy(app / "test-results/school-observer.png", "school-observer.png")
copy(app / "test-results/live-storage.json", "live-storage.json")
copy(app / "test-results/hosted-status.json", "hosted-status.json")
for source, name in [
    ("/tmp/voxel-owner-core-complete-check.log", "check.txt"),
    ("/tmp/voxel-owner-core-complete-check.exit.json", "check-exit.json"),
    ("/tmp/voxel-owner-browser-suite.json", "browser-suite.json"),
    ("/tmp/voxel-run-owner-core-check.mjs", "run-check.mjs"),
    ("/tmp/voxel-owner-browser-suite.mjs", "run-browser.mjs"),
    ("/tmp/voxel-owner-hosted-sql.json", "hosted-sql.json"),
    ("/tmp/voxel-owner-target-match.json", "hosted-target-match.json"),
]:
    copy(source, name)
for name in ["sdk", "school-gateway", "postgres"]:
    copy(f"/tmp/voxel-owner-{name}.log", f"platform-{name}.txt")
for run in suite["results"]:
    copy(run["log"], f"browser-{run['name']}.txt")

inputs = set()
for base in [game, app]:
    for directory in ["src", "tests", "tools", "content", "docs", "engine/src"]:
        inputs.update(p.relative_to(repo).as_posix() for p in (base / directory).rglob("*") if p.is_file())
    for name in ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", "README.md", "UPSTREAM.md", "LICENSE", "engine/Cargo.toml", "engine/Cargo.lock", "engine/LICENSE"]:
        if (base / name).is_file(): inputs.add((base / name).relative_to(repo).as_posix())
for name in ["package.json", "package-lock.json", ".github/workflows/voxel.yml", "packages/game-logic/package.json", "packages/game-logic/tsconfig.json", "docs/voxel-runtime-rewrite-proposal.md", "docs/voxel-runtime-rewrite-progress.md", "docs/adr/002-voxel-native-websocket.md", "supabase/migrations/20261025010000_voxel_checkpoint_storage.sql"]:
    inputs.add(name)
inputs.update(p.relative_to(repo).as_posix() for p in (repo / "packages/game-logic/src").rglob("*") if p.is_file())
for name in inputs:
    assert (repo / name).is_file() and not (repo / name).is_symlink()
    assert not pathlib.Path(name).name.startswith(".env")
with tarfile.open(dest / "source.tar.gz", "w:gz") as archive:
    for name in sorted(inputs): archive.add(repo / name, arcname=name, recursive=False)
with tarfile.open(dest / "source.tar.gz") as archive:
    assert len(archive.getmembers()) == len(inputs)
    for member in archive.getmembers():
        assert member.isfile() and archive.extractfile(member).read() == (repo / member.name).read_bytes()
(dest / "source-inputs.json").write_text(json.dumps({"layout": "repository-relative", "files": [{"path": name, "sha256": h(repo / name)} for name in sorted(inputs)]}, indent=2) + "\n")
for name in ["source.tar.gz", "source-inputs.json", "README.md", "capture.py"]: files[name] = h(dest / name)
record = {
    "result": "PASS_WITH_HOSTED_ORCHESTRATION_LIFECYCLE_AND_DEVICE_LIMITATIONS",
    "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "buildId": build["buildId"], "engineHash": build["engineHash"], "contentHash": build["contentHash"],
    "counts": {"domain": 75, "native": 80, "nativeIgnored": 3, "wasm": 78, "sourceIntegration": 26, "packagedIntegration": 26, "sdkAndSchoolPolicy": 19, "schoolGateway": 5, "postgresSdk": 12, "hostedSqlChecks": 9},
    "sourceFiles": len(inputs),
    "remoteChanges": {"migrationAppliedBy": "user", "codexMigrationApplied": False, "oneQualificationObjectCreatedAndRemoved": True, "hostedSqlRolledBack": True, "fixtureSessionAbsent": True},
    "hostedInstallation": j(dest / "hosted-status.json"),
    "limitations": ["Hosted SQL uses fixture object metadata, separate from the real Storage-byte check; no full hosted SDK/Storage/worker recovery proof", "School Auth/PostgREST and local combined-test Storage bytes are fixtures", "Two rendered regressions on software Chromium; not all eleven scenarios or hardware/input/capacity qualification", "Central room lifecycle, fenced status projection, abandoned cold allocations, React, moderation/chat, LiveKit and classroom extraction unfinished"],
    "artifacts": [{"path": name, "sha256": digest} for name, digest in sorted(files.items())],
}
(dest / "verification.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"buildId": build["buildId"], "artifacts": len(files), "sources": len(inputs)}))
