"""Run from the repository root after the checks referenced below complete."""
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile

repo = pathlib.Path.cwd()
game = repo / "games/voxel"
app = repo / "apps/voxel-server"
dest = game / "evidence/school-admission"
j = lambda path: json.loads(pathlib.Path(path).read_text())
h = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
subprocess.run(["node", "tools/verify-release.mjs"], cwd=game, check=True)
build = j(game / "artifacts/build.json")
release = j(game / "artifacts/release.json")
check = j("/tmp/voxel-school-core-complete-check.exit.json")
suite = j("/tmp/voxel-school-browser-suite.json")
assert check["exitCode"] == 0 and check["signal"] is None
log = pathlib.Path("/tmp/voxel-school-core-complete-check.log").read_text()
for marker in ["Voxel build " + build["buildId"][:12], "ℹ tests 73", "80 passed; 0 failed; 3 ignored", "ℹ tests 75"]:
    assert marker in log, marker
assert log.count("ℹ tests 24") == 2
assert suite["buildId"] == build["buildId"]
assert {r["name"] for r in suite["results"]} == {"wasm", "creative", "inventory", "benchmark", "release"}
for run in suite["results"]:
    assert run["exitCode"] == 0 and run["signal"] is None
    assert run["startedAt"] >= check["finishedAt"]
for name, count in [("sdk", 19), ("gateway", 4), ("postgres", 12)]:
    output = pathlib.Path(f"/tmp/voxel-school-final-{name}.log").read_text()
    assert f"ℹ tests {count}\n" in output and f"ℹ pass {count}\n" in output and "ℹ fail 0\n" in output

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
for name in ["browser-creative", "browser-inventory"]:
    source = game / f"test-results/{name}.json"
    report = j(source)
    assert report["result"] == "PASS" and report["errors"] == []
    for field in ["buildId", "engineHash", "contentHash"]:
        assert report[field] == build[field]
    copy(source, f"{name}.json")
observer = j(app / "test-results/browser-school.json")
assert observer["result"] == "PASS" and observer["errors"] == [] and observer["buildId"] == build["buildId"]
assert [e["on"] for e in observer["controls"] if e["type"] == "flight"] == [False, True, False]
copy(app / "test-results/browser-school.json", "browser-school.json")
parity = j(game / "test-results/browser-wasm.json")
assert parity["result"] == "PASS" and parity["engineHash"] == build["engineHash"] and parity["errors"] == []
assert [s[10] for s in parity["productionContentScenario"]["observerTrace"]] == [1, 0, 1]
copy(game / "test-results/browser-wasm.json", "browser-wasm.json")
copy(game / "test-results/engine-benchmark.json", "engine-benchmark.json")
for name in ["creative", "inventory-crafting", "inventory-chest"]:
    copy(game / f"test-results/{name}.png", f"{name}.png")
copy(app / "test-results/school-observer.png", "school-observer.png")
for source, name in [
    ("/tmp/voxel-school-core-complete-check.log", "check.txt"),
    ("/tmp/voxel-school-core-complete-check.exit.json", "check-exit.json"),
    ("/tmp/voxel-school-browser-suite.json", "browser-suite.json"),
    ("/tmp/voxel-run-school-core-check.mjs", "run-check.mjs"),
    ("/tmp/voxel-school-browser-suite.mjs", "run-browser.mjs"),
    ("/tmp/voxel-school-browser.log", "browser-school.txt"),
    ("/tmp/voxel-school-browser-ghost-diagnostic.log", "observer-before-fix.txt"),
    ("/tmp/voxel-school-hosted-status.json", "hosted-status.json"),
]:
    copy(source, name)
for name in ["sdk", "gateway", "postgres"]:
    copy(f"/tmp/voxel-school-final-{name}.log", f"platform-{name}.txt")
for run in suite["results"]:
    copy(run["log"], f"browser-{run['name']}.txt")

inputs = set()
for base in [game, app]:
    for directory in ["src", "tests", "tools", "content", "docs", "engine/src"]:
        inputs.update(p.relative_to(repo).as_posix() for p in (base / directory).rglob("*") if p.is_file())
    for name in ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", "README.md", "UPSTREAM.md", "LICENSE", "engine/Cargo.toml", "engine/Cargo.lock", "engine/LICENSE"]:
        if (base / name).is_file():
            inputs.add((base / name).relative_to(repo).as_posix())
for name in ["package.json", "package-lock.json", ".github/workflows/voxel.yml", "packages/game-logic/package.json", "packages/game-logic/tsconfig.json", "docs/voxel-runtime-rewrite-proposal.md", "docs/voxel-runtime-rewrite-progress.md", "docs/adr/002-voxel-native-websocket.md", "supabase/migrations/20261025010000_voxel_checkpoint_storage.sql"]:
    inputs.add(name)
inputs.update(p.relative_to(repo).as_posix() for p in (repo / "packages/game-logic/src").rglob("*") if p.is_file())
for name in inputs:
    assert (repo / name).is_file() and not (repo / name).is_symlink()
    assert not pathlib.Path(name).name.startswith(".env")
with tarfile.open(dest / "source.tar.gz", "w:gz") as archive:
    for name in sorted(inputs):
        archive.add(repo / name, arcname=name, recursive=False)
with tarfile.open(dest / "source.tar.gz") as archive:
    for member in archive.getmembers():
        assert member.isfile() and archive.extractfile(member).read() == (repo / member.name).read_bytes()
(dest / "source-inputs.json").write_text(json.dumps({"layout": "repository-relative", "files": [{"path": name, "sha256": h(repo / name)} for name in sorted(inputs)]}, indent=2) + "\n")
for name in ["source.tar.gz", "source-inputs.json", "README.md", "capture.py"]:
    files[name] = h(dest / name)
record = {
    "result": "PASS_WITH_HOSTED_LIFECYCLE_AND_DEVICE_LIMITATIONS",
    "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "buildId": build["buildId"], "engineHash": build["engineHash"], "contentHash": build["contentHash"],
    "counts": {"domain": 73, "native": 80, "nativeIgnored": 3, "wasm": 75, "sourceIntegration": 24, "packagedIntegration": 24, "sdkAndSchoolPolicy": 19, "schoolGateway": 4, "postgresSdk": 12},
    "sourceFiles": len(inputs), "remoteWriteExecuted": False,
    "hostedInstallation": j(dest / "hosted-status.json"),
    "limitations": ["Fixture Auth/PostgREST and Storage bytes; no hosted school journey or durable-backend browser proof", "Three rendered regressions; not all eleven scenarios rerun", "Software creative maximum frame gap 4149.8 ms; hardware/input/capacity qualification remains open", "Production lifecycle, offline-owner refresh, React, moderation/chat, LiveKit and classroom extraction unfinished", "Automatic review rejected remote migration without explicit authorization; existing approval request pending"],
    "artifacts": [{"path": name, "sha256": digest} for name, digest in sorted(files.items())],
}
(dest / "verification.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"buildId": build["buildId"], "artifacts": len(files), "sources": len(inputs)}))
