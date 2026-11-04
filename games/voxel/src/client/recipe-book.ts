import type { ItemDefinition, Recipe } from '../shared/content.ts';
import type { InventoryView, SlotRef } from '../shared/inventory.ts';
import { copyStack, sameStack } from '../shared/inventory.ts';
import { ingredientMatches } from '../shared/recipes.ts';

export type RecipeCategory = 'available' | 'all' | 'tools' | 'building' | 'food';
export type PlannedMove = { from: SlotRef; to: SlotRef; count: number; itemType: string };

export function recipeCategory(
  recipe: Recipe,
  items: ReadonlyMap<string, ItemDefinition>,
): RecipeCategory {
  const item = items.get(recipe.result.itemType);
  if (
    item?.tool ||
    item?.equipment ||
    item?.collects ||
    item?.igniter ||
    ['crafting_table', 'chest', 'torch', 'stick', 'flint_and_steel'].includes(
      recipe.result.itemType,
    )
  )
    return 'tools';
  return item?.places && !item.food ? 'building' : 'food';
}

/** Count each owned ingredient once, reserving literal requirements before tags. */
export function recipeMaterials(
  recipe: Recipe,
  view: InventoryView,
  items: ReadonlyMap<string, ItemDefinition>,
) {
  const available = new Map<string, number>();
  for (const stack of [...view.bag, ...view.craft2, ...view.craft3])
    if (stack && !stack.instance)
      available.set(stack.itemType, (available.get(stack.itemType) ?? 0) + stack.count);
  const choices = new Map<number, string>();
  const missing: string[] = [];
  const needed = recipe.ingredients
    .flatMap((ingredient, index) => (ingredient ? [{ ingredient, index }] : []))
    .sort((a, b) => Number(a.ingredient.startsWith('#')) - Number(b.ingredient.startsWith('#')));
  for (const { ingredient, index } of needed) {
    const kind = [...available.keys()].find(
      (kind) => available.get(kind)! > 0 && ingredientMatches(ingredient, kind, items),
    );
    if (kind) {
      choices.set(index, kind);
      available.set(kind, available.get(kind)! - 1);
    } else missing.push(ingredient);
  }
  return { choices, missing };
}

/** A read-only plan; the adapter sends each move only after the prior server view. */
export function arrangeRecipe(
  recipe: Recipe,
  view: InventoryView,
  size: 2 | 3,
  items: ReadonlyMap<string, ItemDefinition>,
): { moves: PlannedMove[]; error?: string } {
  if (recipe.size > size)
    return { moves: [], error: 'המתכון דורש שולחן יצירה 3×3. הניחו שולחן ולחצו עליו לחיצה ימנית.' };
  const bag = view.bag.map(copyStack),
    area = size === 3 ? 'craft3' : 'craft2';
  const grids = { craft2: view.craft2.map(copyStack), craft3: view.craft3.map(copyStack) };
  const moves: PlannedMove[] = [];
  // Return the active grid first, merging before taking an empty bag slot.
  for (let slot = 0; slot < grids[area].length; slot++) {
    const stack = grids[area][slot];
    if (!stack) continue;
    const item = items.get(stack.itemType)!;
    let remaining = stack.count;
    while (remaining > 0) {
      const target = bag.findIndex(
        (other) => other && sameStack(other, stack) && other.count < item.maxStack,
      );
      const to = target >= 0 ? target : bag.findIndex((other) => !other);
      if (to < 0)
        return { moves: [], error: 'פנו מקום בתיק כדי להחזיר את הפריטים שכבר ברשת היצירה.' };
      const count = Math.min(remaining, item.maxStack - (bag[to]?.count ?? 0));
      moves.push({
        from: { area, slot },
        to: { area: 'bag', slot: to },
        count,
        itemType: stack.itemType,
      });
      bag[to] = { ...stack, count: (bag[to]?.count ?? 0) + count };
      remaining -= count;
    }
    grids[area][slot] = null;
  }
  const shadow = { ...view, bag, ...grids };
  const materials = recipeMaterials(recipe, shadow, items);
  if (materials.missing.length)
    return { moves: [], error: 'חסרים חומרים למתכון הזה. פירוט המרכיבים מופיע בספר המתכונים.' };
  for (const [index, itemType] of materials.choices) {
    const sources = [
      ...bag.map((stack, slot) => ({ stack, ref: { area: 'bag' as const, slot } })),
      ...grids[size === 3 ? 'craft2' : 'craft3'].map((stack, slot) => ({
        stack,
        ref: { area: size === 3 ? ('craft2' as const) : ('craft3' as const), slot },
      })),
    ];
    const source = sources.find(({ stack }) => stack?.itemType === itemType && stack.count > 0)!;
    const slot = Math.floor(index / recipe.size) * size + (index % recipe.size);
    moves.push({ from: source.ref, to: { area, slot }, count: 1, itemType });
    const sourceSlots = source.ref.area === 'bag' ? bag : grids[source.ref.area];
    sourceSlots[source.ref.slot] =
      source.stack!.count > 1 ? { ...source.stack!, count: source.stack!.count - 1 } : null;
  }
  return { moves };
}
