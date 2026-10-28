import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Offline source inventory only. The new runtime never imports the old registries.
const repo = new URL('../../../', import.meta.url);
function read(name: string) {
  const path = `packages/voxel-content/src/${name}.ts`;
  const source = readFileSync(new URL(path, repo), 'utf8');
  return {
    path,
    hash: createHash('sha256').update(source).digest('hex'),
    ast: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true),
  };
}
function array(file: ReturnType<typeof read>, name: string) {
  let found: ts.ArrayLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file.ast) === name &&
      node.initializer
    ) {
      let value = node.initializer;
      while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)) value = value.expression;
      if (!ts.isArrayLiteralExpression(value))
        throw new Error(`${name} is no longer a static array`);
      found = value;
    }
    ts.forEachChild(node, visit);
  };
  visit(file.ast);
  if (!found) throw new Error(`Missing inventory source ${name}`);
  return found;
}
function definitions(file: ReturnType<typeof read>, name: string) {
  return array(file, name).elements.map((entry) => {
    if (!ts.isObjectLiteralExpression(entry)) throw new Error(`Unrecognized ${name} definition`);
    let id: number | undefined, key: string | undefined;
    for (const property of entry.properties) {
      if (!ts.isPropertyAssignment(property)) throw new Error(`Unrecognized ${name} property`);
      const propertyName = property.name.getText(file.ast);
      if (propertyName === 'id' && ts.isNumericLiteral(property.initializer))
        id = Number(property.initializer.text);
      if (propertyName === 'key' && ts.isStringLiteral(property.initializer))
        key = property.initializer.text;
    }
    if (id === undefined || !key) throw new Error(`Unrecognized ${name} identity`);
    return { legacyId: id, key };
  });
}
const blocks = read('blocks'),
  items = read('items'),
  recipes = read('recipes');
const recipeKeys = array(recipes, 'RECIPES').elements.map((entry) => {
  if (!ts.isCallExpression(entry) || !entry.arguments[0] || !ts.isStringLiteral(entry.arguments[0]))
    throw new Error('Unrecognized recipe declaration');
  const references = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ['BLOCK_REGISTRY', 'ITEM_REGISTRY'].includes(node.expression.text)
    )
      references.add(node.getText(recipes.ast));
    ts.forEachChild(node, visit);
  };
  visit(entry);
  return {
    key: entry.arguments[0].text,
    helper: entry.expression.getText(recipes.ast),
    references: [...references].sort(),
  };
});
const inventory = {
  schema: 1,
  purpose:
    'Legacy product inventory for explicit retain/replace/combine/remove decisions; no runtime dependency or ID compatibility',
  sources: [blocks, items, recipes].map(({ path, hash }) => ({ path, hash })),
  blocks: definitions(blocks, 'BASE_BLOCK_DEFS'),
  items: definitions(items, 'ITEM_DEFS'),
  recipes: recipeKeys,
};
for (const entries of [inventory.blocks, inventory.items, inventory.recipes])
  if (new Set(entries.map((v) => v.key)).size !== entries.length)
    throw new Error('Duplicate inventory key');
writeFileSync(
  new URL('../content/legacy-inventory.json', import.meta.url),
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log(
  `Inventoried ${inventory.blocks.length} blocks, ${inventory.items.length} items, ${inventory.recipes.length} recipes`,
);
