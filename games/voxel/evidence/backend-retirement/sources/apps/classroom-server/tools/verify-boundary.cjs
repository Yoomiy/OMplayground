const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  repo = path.resolve(root, "../..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const sources = fs
  .readdirSync(path.join(root, "src"))
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
for (const name of sources) {
  const file = path.join(root, "src", name);
  for (const entry of ts.preProcessFile(fs.readFileSync(file, "utf8"))
    .importedFiles) {
    const module = entry.fileName;
    if (module.startsWith(".")) {
      const target = path.resolve(path.dirname(file), module);
      assert(
        target.startsWith(path.join(root, "src") + path.sep),
        `${name} imports outside classroom source`,
      );
    } else if (
      !module.startsWith("node:") &&
      !["path", "crypto", "http", "events"].includes(module)
    ) {
      const dependency = module.startsWith("@")
        ? module.split("/").slice(0, 2).join("/")
        : module.split("/")[0];
      assert(
        Object.hasOwn(pkg.dependencies, dependency),
        `${name} imports undeclared dependency ${dependency}`,
      );
      assert(
        ![
          "@playground/game-logic",
          "@playground/voxel-content",
          "@playground/minecraft-server",
          "socket.io",
        ].includes(dependency),
      );
    }
  }
}
require(path.join(root, "dist/service.js"));
const ownModules = Object.keys(require.cache).filter((file) =>
  ["apps", "games", "packages"].some((name) =>
    file.startsWith(path.join(repo, name) + path.sep),
  ),
);
for (const file of ownModules) {
  assert(
    file.startsWith(root + path.sep) ||
      file.startsWith(
        path.join(repo, "packages/observability/dist") + path.sep,
      ),
    `Classroom loads ${path.relative(repo, file)}`,
  );
}
const legacyPath = path.join(repo, "apps/minecraft-server/src/index.ts");
const legacy = fs.existsSync(legacyPath)
  ? fs.readFileSync(legacyPath, "utf8")
  : "";
assert(
  !/classroom/i.test(legacy),
  "Legacy game entry still owns classroom work",
);
const routes = JSON.parse(
  fs.readFileSync(path.join(root, "docs/route-contract.json"), "utf8"),
).routes;
assert.equal(routes.length, 20);
const current = [
  ...fs
    .readFileSync(path.join(root, "src/routes.ts"), "utf8")
    .matchAll(/app\.(post|get|delete)\(\s*"(\/rtc\/[^\"]+)"/g),
]
  .map((m) => `${m[1]} ${m[2]}`)
  .sort();
assert.deepEqual(current, routes);
const dist = fs
  .readdirSync(path.join(root, "dist"))
  .filter((name) => fs.statSync(path.join(root, "dist", name)).isFile())
  .sort();
assert(
  dist.every((name) => !name.includes(".test.")),
  "Production directory includes tests",
);
const inventory = dist.map((name) => ({
  path: name,
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, "dist", name)))
    .digest("hex"),
}));
const report = {
  result: "PASS",
  sourceModules: sources.length,
  repositoryModules: ownModules.map((file) => path.relative(repo, file)).sort(),
  classroomRoutes: routes.length,
  legacyClassroomOwnership: false,
  gameImports: 0,
  productionFiles: inventory,
};
fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
fs.writeFileSync(
  path.join(root, "test-results/boundary.json"),
  JSON.stringify(report, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({
    result: report.result,
    sourceModules: sources.length,
    classroomRoutes: routes.length,
    gameImports: 0,
    productionFiles: inventory.length,
  }) + "\n",
);
