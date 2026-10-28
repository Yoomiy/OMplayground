import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(path.join(dir, e.name))
      : /\.tsx?$/.test(e.name)
        ? [path.join(dir, e.name)]
        : [],
  );
}
let failed = false;
for (const file of files(path.join(root, 'src'))) {
  const layer = path.relative(path.join(root, 'src'), file).split(path.sep)[0];
  const code = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    let spec;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) spec = node.moduleSpecifier;
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      spec = node.arguments[0];
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      spec = node.argument.literal;
    if (spec) {
      if (!ts.isStringLiteral(spec)) {
        console.error(`Nonliteral import: ${file}`);
        failed = true;
      } else {
        const target = spec.text;
        const resolved = target.startsWith('.') ? path.resolve(path.dirname(file), target) : target;
        const forbidden =
          (['shared', 'sim'].includes(layer) &&
            /^(?:ws|socket\.io(?:-client)?|node:(?:http|https|net|fs)(?:\/promises)?)$/.test(
              target,
            )) ||
          /(?:^|\/)(?:react(?:-dom)?|@supabase|livekit(?:-client|-server-sdk)?|apps|noa-engine|@babylonjs)(?:\/|$)/.test(
            resolved,
          ) ||
          (['shared', 'sim'].includes(layer) &&
            /(?:^|\/)(?:client|render|server|world)(?:\/|$)/.test(resolved)) ||
          (layer === 'shared' && /(?:^|\/)(?:sim|tools)(?:\/|$)/.test(resolved)) ||
          (['client', 'render', 'world'].includes(layer) &&
            /(?:^|\/)(?:sim|server)(?:\/|$)/.test(resolved));
        if (forbidden) {
          console.error(`Forbidden ${layer} import: ${file} -> ${target}`);
          failed = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(code);
}
if (failed) process.exit(1);
console.log('Voxel import boundaries pass');
