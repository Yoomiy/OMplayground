import type { ItemDefinition, Recipe } from './content.ts';

/** Tags belong to compiled item definitions; client stacks never supply membership. */
export function ingredientMatches(
  ingredient: string | null,
  actual: string | null,
  items?: ReadonlyMap<string, ItemDefinition>,
): boolean {
  if (ingredient === null || actual === null) return ingredient === actual;
  return ingredient.startsWith('#')
    ? (items?.get(actual)?.tags?.includes(ingredient.slice(1)) ?? false)
    : ingredient === actual;
}
function pattern(recipe: Recipe, mirror: boolean) {
  const occupied = recipe.ingredients.flatMap((value, index) => (value ? [index] : []));
  const minX = Math.min(...occupied.map((i) => i % recipe.size)),
    maxX = Math.max(...occupied.map((i) => i % recipe.size));
  const minY = Math.min(...occupied.map((i) => Math.floor(i / recipe.size))),
    maxY = Math.max(...occupied.map((i) => Math.floor(i / recipe.size)));
  const width = maxX - minX + 1,
    height = maxY - minY + 1;
  return {
    width,
    height,
    cells: Array.from(
      { length: width * height },
      (_, index) =>
        recipe.ingredients[
          (minY + Math.floor(index / width)) * recipe.size +
            minX +
            (mirror ? width - 1 - (index % width) : index % width)
        ],
    ),
  };
}
/** Overlapping tag/literal patterns are rejected at build time, including translations/mirrors. */
export function recipesOverlap(
  a: Recipe,
  b: Recipe,
  items: ReadonlyMap<string, ItemDefinition>,
): boolean {
  const first = pattern(a, false);
  return [false, true].some((mirror) => {
    const second = pattern(b, mirror);
    if (first.width !== second.width || first.height !== second.height) return false;
    return first.cells.every((ingredient, index) => {
      const other = second.cells[index];
      if (ingredient === null || other === null) return ingredient === other;
      return [...items.keys()].some(
        (kind) =>
          ingredientMatches(ingredient, kind, items) && ingredientMatches(other, kind, items),
      );
    });
  });
}
