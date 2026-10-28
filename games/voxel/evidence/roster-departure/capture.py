"""Run from repository root after the named checks have terminated."""
import datetime
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import tarfile

repo = pathlib.Path.cwd()
game, app, web = (repo / p for p in ["games/voxel", "apps/voxel-server", "apps/web"])
dest = game / "evidence/roster-departure"


def read(path):
    return json.loads(pathlib.Path(path).read_text())


def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


subprocess.run(["node", "tools/verify-release.mjs"], cwd=game, check=True)
build, release = read(game / "artifacts/build.json"), read(game / "artifacts/release.json")
assert build["buildId"] == "34251aac77af9364bb083ce50bdbb406dc0cb61ec8bbcfe3ac58a249bec3535c"
check = read("/tmp/voxel-roster-core-complete-check.exit.json")
assert check["exitCode"] == 0 and check["signal"] is None
core = pathlib.Path("/tmp/voxel-roster-core-complete-check.log").read_text()
assert "Voxel build " + build["buildId"][:12] in core
assert core.count("ℹ tests 81\n") == 1 and core.count("ℹ tests 80\n") == 1 and core.count("ℹ tests 36\n") == 2
assert "80 passed; 0 failed; 3 ignored" in core
for name, count in [("sdk", 33), ("school-gateway", 7), ("postgres", 30)]:
    output = pathlib.Path(f"/tmp/voxel-roster-{name}.log").read_text()
    for marker in [f"ℹ tests {count}\n", f"ℹ pass {count}\n", "ℹ fail 0\n", "ℹ cancelled 0\n"]:
        assert marker in output, (name, marker)
assert "server stopped" in pathlib.Path("/tmp/voxel-roster-postgres-stop.log").read_text()
for name in ["types", "web-types"]:
    assert "error TS" not in pathlib.Path(f"/tmp/voxel-roster-{name}.log").read_text()
assert "Tests  88 passed (88)" in pathlib.Path("/tmp/voxel-roster-web-tests.log").read_text()
assert "✓ built in" in pathlib.Path("/tmp/voxel-roster-web-build.log").read_text()
boundary = read(web / "dist/voxel-browser-boundary.json")
assert boundary == {"result": "PASS", "gameModules": 40, "forbiddenModules": 0}
flow = read(web / "test-results/voxel-react.json")
assert flow["result"] in ["PASS", "PASS_WITH_MOUSE_ACKNOWLEDGEMENT_TIMEOUT"] and flow["errors"] == []
for key in ["buildId", "engineHash", "contentHash"]:
    assert flow[key] == build[key]
for key in ["lateMountCancelled", "strictMode", "fullscreenInventory", "playerTouchMovement",
            "failedSaveNotConfirmed", "sameRequestRetry", "noAutomaticReadmission"]:
    assert flow[key] is True
assert len(flow["playerTouchLayout"]) == 9
assert all(v["overlap"] == 0 and v["reachable"] for v in flow["playerTouchLayout"])
assert flow["teacherRise"] > 2
assert flow["expectedControlFailureResponses"] == 1
assert flow["expectedBrowserNetworkErrors"] <= 1
assert len(flow["cleanup"]) == 3
for value in flow["cleanup"]:
    assert all(count == 0 for count in value["resources"].values())
    assert value["audio"] == "closed"
assert flow["exitInteractions"] == ["mouse click while fullscreen", "touch tap"]
assert flow["rosterReceipt"]["left"] and flow["rosterReceipt"]["ended"] and flow["rosterReceipt"]["revision"] == 1
assert "saved" not in flow["rosterReceipt"]
physical=[v for v in flow["exitInputEvents"] if v.get("tag")=="BUTTON" and v.get("text")=="יציאה"]
assert [v["type"] for v in physical]==["pointerdown","mousedown","pointerup","mouseup","click"]
assert all(v["trusted"] for v in physical)
assert [v["action"] for v in flow["receipts"]] == ["pause", "resume", "end"]
assert all(v["completed"] for v in flow["receipts"])
assert all(v["savedSequence"] > 0 for v in flow["receipts"] if v["action"] != "resume")
assert next(v for v in flow["receipts"] if v["action"] == "resume")["savedSequence"] is None
ready = read("/tmp/voxel-roster-hosted-ready.json")
assert ready["result"] == "NOT_READY" and ready["privateBucket"] is True
assert all(ready[k] == 1 for k in ["schema", "sessionProjectionSchema", "controlsSchema"])
assert ready["rosterSchema"] is None
assert ready["checks"]["roster"] == {"ready":False,"code":"PGRST202","operation":"voxel_roster_status"}
versions = {"20261025010000", "20261025020000", "20261025030000"}

files = {}


def copy(source, name):
    output = dest / name
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, output)
    files[name] = digest(output)


for name in ["build", "release", "content"]:
    copy(game / f"artifacts/{name}.json", f"{name}.json")
copy(game / "test-results/release-verification.json", "source-release-verification.json")
for side in ["client", "server"]:
    for entry in release[side]:
        source = game / f"dist-{side}" / entry["path"]
        assert digest(source) == entry["hash"]
        copy(source, f"release/{side}/{entry['path']}")
copy(web / "test-results/voxel-react.json", "browser-react.json")
for suffix in ["inventory", "observer", "playing", "mobile"]:
    copy(web / f"test-results/voxel-react-{suffix}.png", f"react-{suffix}.png")
for entry in flow["clientArtifacts"]:
    path = entry["path"].removeprefix("/")
    assert ".." not in pathlib.PurePosixPath(path).parts
    source = web / "test-results/react-fixture" / path
    assert digest(source) == entry["sha256"]
    copy(source, "react-fixture/" + path)
inventory = []
for source in sorted((web / "dist").rglob("*")):
    if source.is_file():
        path = source.relative_to(web / "dist").as_posix()
        inventory.append({"path": path, "bytes": source.stat().st_size, "sha256": digest(source)})
        if path == "index.html" or re.match(r"(?:voxel-browser-boundary\.json|assets/(?:index-|HomePage-|embed-|VoxelSessionContainer-|engine-worker-|voxel_engine_bg-))", path):
            copy(source, "web-production/" + path)
(dest / "web-production-inventory.json").write_text(json.dumps({
    "configuration": "Fixture public Supabase/runtime URLs; production application build, not a hosted shell journey",
    "retained": "index/root/home, voxel browser boundary, voxel container/embed/worker/Wasm chunks",
    "files": inventory,
}, indent=2) + "\n")
files["web-production-inventory.json"] = digest(dest / "web-production-inventory.json")
for name in ["core-complete-check", "sdk", "types", "school-gateway", "postgres", "postgres-stop", "web-tests", "web-types", "web-build", "browser", "school-gateway-roster-fixture-failure", "browser-mouse-ack-failure", "browser-mouse-move-ack-failure"]:
    copy(f"/tmp/voxel-roster-{name}.log", f"{name}.txt")
copy("/tmp/voxel-roster-core-complete-check.exit.json", "check-exit.json")
copy("/tmp/voxel-run-roster-core-check.mjs", "run-check.mjs")
copy("/tmp/voxel-exit-postgres-start.log", "postgres-start.txt")
copy("/tmp/voxel-roster-hosted-ready.json", "hosted-ready.json")
for name in ["exit-input-failure", "exit-no-input-failure"]:
    copy(f"/tmp/voxel-roster-{name}.json", f"{name}.json")
for extension in ["mjs", "json", "log"]:
    copy(f"/tmp/voxel-fullscreen-repro.{extension}", f"fullscreen-repro.{extension}")

inputs = set()
for base in [game, app, web]:
    for directory in ["src", "tests", "tools", "content", "docs", "engine/src"]:
        inputs.update(p.relative_to(repo).as_posix() for p in (base / directory).rglob("*") if p.is_file())
    for name in ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", "README.md", "UPSTREAM.md", "LICENSE", "engine/Cargo.toml", "engine/Cargo.lock", "engine/LICENSE"]:
        if (base / name).is_file():
            inputs.add((base / name).relative_to(repo).as_posix())
inputs.update(["package.json", "package-lock.json", ".github/workflows/voxel.yml", "packages/game-logic/package.json", "packages/game-logic/tsconfig.json", "docs/voxel-runtime-rewrite-proposal.md", "docs/voxel-runtime-rewrite-progress.md", "docs/adr/002-voxel-native-websocket.md", "packages/observability/package.json", "packages/observability/tsconfig.json", "packages/observability/jest.config.js"])
inputs.update(p.relative_to(repo).as_posix() for p in (repo / "supabase/migrations").glob("*voxel*.sql"))
for workspace in ["game-logic", "observability", "voxel-content"]:
    inputs.update(p.relative_to(repo).as_posix() for p in (repo / f"packages/{workspace}/src").rglob("*") if p.is_file())
    for name in ["package.json", "tsconfig.json"]:
        inputs.add(f"packages/{workspace}/{name}")
for name in inputs:
    path = repo / name
    assert path.is_file() and not path.is_symlink()
    assert not path.name.startswith(".env")
    assert not {"node_modules", "evidence", ".git"}.intersection(path.relative_to(repo).parts)
with tarfile.open(dest / "source.tar.gz", "w:gz") as archive:
    for name in sorted(inputs):
        archive.add(repo / name, arcname=name, recursive=False)
with tarfile.open(dest / "source.tar.gz") as archive:
    assert len(archive.getmembers()) == len(inputs)
    for member in archive.getmembers():
        assert member.isfile() and archive.extractfile(member).read() == (repo / member.name).read_bytes()
(dest / "source-inputs.json").write_text(json.dumps({"layout": "repository-relative", "files": [{"path": name, "sha256": digest(repo / name)} for name in sorted(inputs)]}, indent=2) + "\n")
for name in ["source.tar.gz", "source-inputs.json", "README.md", "capture.py"]:
    files[name] = digest(dest / name)
record = {
    "result": "LOCAL_PASS_WITH_HOSTED_ROSTER_INPUT_AND_DEVICE_LIMITATIONS",
    "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    **{k: build[k] for k in ["buildId", "engineHash", "contentHash"]},
    "counts": {"domain": 81, "native": 80, "nativeIgnored": 3, "wasm": 80, "sourceIntegration": 36, "packagedIntegration": 36, "sdkAndPolicy": 33, "schoolGateway": 7, "postgresSdk": 30, "web": 88, "renderedContexts": 3},
    "sourceFiles": len(inputs),
    "agentRemoteChangesThisPhase": {"schemaWrites": False, "objectWrites": False, "rowWrites": False},
    "hostedMigrations": {"appliedBy": "user", "versions": sorted(versions), "firstThreeReadOnlyReadiness": True, "privateBucket": True},
    "rosterMigration": {"path":"supabase/migrations/20261025040000_voxel_roster_departure.sql", "sha256":digest(repo/"supabase/migrations/20261025040000_voxel_roster_departure.sql"), "locallyQualified":True,"hostedApplied":False},
    "browserMouseAcknowledged": flow["mouseClickAcknowledged"],
    "priorEvidence": ["games/voxel/evidence/react-session/verification.json", "games/voxel/evidence/lifecycle-controls/verification.json", "games/voxel/evidence/offline-owner/verification.json"],
    "limitations": [
        "Built React StrictMode fixture with real local SQL/SDK/packaged workers but fixture Auth/PostgREST/Storage, not the real authenticated catalog-shell or a hosted school journey",
        "Current hosted checks are read-only: first three schemas/private bucket ready, fourth roster RPC missing; full hosted school/SDK/Storage/worker recovery and deployment/provider failure remain unqualified",
        "Earlier locator-click acknowledgement failures remain retained and their cause unproven; final direct trusted physical mouse dispatch and touch disposal pass, protocol acknowledgement separately recorded",
        "Software Chromium functional evidence, not full prior browser suite, hardware/OS-focus/frame/input/network/capacity qualification",
        "Hosted roster installation, remaining staff teleport/mode/removal/bans/moderation, chat, enforced LiveKit media/proximity, classroom extraction, survival balance/bucket UI, release and cutover/removal remain unfinished",
    ],
    "artifacts": [{"path": name, "sha256": value} for name, value in sorted(files.items())],
}
(dest / "verification.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps({"buildId": build["buildId"], "artifacts": len(files), "sources": len(inputs)}))
