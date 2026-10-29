import { EQUIPMENT, matchRecipe, sameStack } from '../shared/inventory.ts';
import { ingredientMatches } from '../shared/recipes.ts';
import type { InventoryArea, InventoryView, Slot, SlotRef } from '../shared/inventory.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { HudState, VoxelRuntime } from './runtime.ts';
import { describeItem } from './item-description.ts';
import { fillItemSlot } from './item-slot.ts';
import './inventory.css';

/** Optional DOM adapter. All writes are public runtime intents, never optimistic stack changes. */
export function mountInventoryControls(
  toolbar: HTMLElement,
  runtime: VoxelRuntime,
  content: Pick<ContentManifest, 'items' | 'recipes' | 'blocks'>,
  labels: Readonly<Record<string, string>>,
  dialogHost: HTMLElement = toolbar.ownerDocument.body,
) {
  const recipeItems = new Map(content.items.map((item) => [item.itemType, item]));
  const button = (text: string, action: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', action);
    return b;
  };
  const open = button('תיק ויצירה (E)', () =>
    runtime.command({ type: 'inventory', operation: { kind: 'open', target: null } }),
  );
  open.id = 'inventory-open';
  const use = button('פתיחת שולחן / תיבה', () => runtime.command({ type: 'inventory-target' }));
  use.id = 'inventory-use';
  toolbar.prepend(open);
  const dialog = document.createElement('dialog');
  dialog.className = 'voxel-inventory';
  dialog.dir = 'rtl';
  dialog.setAttribute('aria-labelledby', 'inventory-title');
  const heading = document.createElement('h2');
  heading.id = 'inventory-title';
  heading.textContent = 'תיק ויצירה';
  const close = button('סגירה', () =>
    runtime.command({ type: 'inventory', operation: { kind: 'close' } }),
  );
  close.id = 'inventory-close';
  const top = document.createElement('header');
  top.append(heading, use, close);
  const message = document.createElement('p');
  message.className = 'inventory-notice';
  message.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'inventory-hint';
  hint.textContent =
    'גררו פריטים או בחרו ערימה ואז יעד. לחיצה ימנית בוחרת חצי ערימה או מעבירה פריט אחד. Shift ולחיצה מעבירים במהירות. העולם ממשיך לפעול כשהתיק פתוח.';
  const itemDetails = document.createElement('p');
  itemDetails.id = 'inventory-item-details';
  itemDetails.setAttribute('aria-live', 'polite');
  itemDetails.hidden = true;
  const discard = button('השלכת פריט מהערימה שנבחרה', () => {
    if (selected?.area === 'bag' && hud.inventory && !hud.inventoryPending)
      runtime.command({
        type: 'inventory',
        operation: {
          kind: 'drop',
          slot: selected.slot,
          count: 1,
          revision: hud.inventory.revision,
        },
      });
  });
  discard.id = 'inventory-drop';
  const eat = button('אכילת פריט מהערימה שנבחרה', () => {
    if (selected?.area === 'bag' && hud.inventory && !busy())
      runtime.command({
        type: 'inventory',
        operation: { kind: 'consume', slot: selected.slot, revision: hud.inventory.revision },
      });
  });
  eat.id = 'inventory-eat';
  const body = document.createElement('div');
  body.className = 'inventory-body';
  dialog.append(top, message, hint, itemDetails, discard, eat, body);
  dialogHost.append(dialog);
  let hud: HudState,
    selected: SlotRef | null = null,
    previous: InventoryView | null = null,
    disposed = false;
  let catalogChoice = content.items[0]?.itemType ?? '';
  let localNotice: { text: string; until: number } | null = null;
  let selectedCount = 0,
    recipesOpen = false,
    recipeSearch = '',
    catalogSearch = '';
  const renderMessage = () => {
    const local = localNotice && performance.now() < localNotice.until ? localNotice.text : null;
    const text = hud.inventoryPending
      ? 'ממתינים לעדכון…'
      : (local ?? (hud.message.startsWith('לחצו על העולם') ? '' : hud.message));
    if (message.textContent !== text) message.textContent = text;
  };
  const notify = (text: string) => {
    localNotice = { text, until: performance.now() + 3000 };
    renderMessage();
  };
  const busy = () =>
    hud.inventoryPending ||
    hud.lifecycle !== 'playing' ||
    !['playing', 'paused'].includes(hud.status);
  const label = (itemType: string) =>
    labels[itemType] ??
    content.items.find((item) => item.itemType === itemType)?.labelKey ??
    itemType;
  const readSlot = (ref: SlotRef): Slot =>
    ref.area === 'container'
      ? (hud.inventory?.container?.slots[ref.slot] ?? null)
      : (hud.inventory?.[ref.area][ref.slot] ?? null);
  const activate = (ref: SlotRef, one: boolean) => {
    const view = hud.inventory;
    if (!view || hud.inventoryPending) return;
    if (!selected) {
      const source = readSlot(ref);
      if (source) {
        selected = ref;
        selectedCount = one ? Math.ceil(source.count / 2) : source.count;
      }
      render();
      return;
    }
    if (selected.area === ref.area && selected.slot === ref.slot) {
      selected = null;
      render();
      return;
    }
    const from = selected;
    selected = null;
    move(from, ref, one ? 1 : selectedCount);
  };
  function move(from: SlotRef, to: SlotRef, count: number) {
    const view = hud.inventory,
      source = readSlot(from);
    if (!view || busy() || !source) return;
    selected = null;
    if (source)
      runtime.command({
        type: 'inventory',
        operation: {
          kind: 'move',
          from,
          to,
          count: Math.min(count, source.count),
          revision: view.revision,
          containerId: view.container?.id ?? null,
          containerRevision: view.container?.revision ?? null,
        },
      });
  }
  function quickMove(ref: SlotRef) {
    const view = hud.inventory,
      stack = readSlot(ref);
    if (!view || busy() || !stack) return;
    const item = recipeItems.get(stack.itemType)!;
    let destinations: SlotRef[];
    if (ref.area === 'bag' && view.container)
      destinations = view.container.slots.map((_, slot) => ({ area: 'container', slot }));
    else if (
      ref.area === 'bag' &&
      item.equipment &&
      !view.equipment[EQUIPMENT.indexOf(item.equipment)]
    )
      destinations = [{ area: 'equipment', slot: EQUIPMENT.indexOf(item.equipment) }];
    else
      destinations = view.bag.flatMap((_, slot) =>
        ref.area !== 'bag' || slot < 9 !== ref.slot < 9 ? [{ area: 'bag' as const, slot }] : [],
      );
    const target =
      destinations.find((target) => {
        const other = readSlot(target);
        return other && sameStack(other, stack) && other.count < item.maxStack;
      }) ?? destinations.find((target) => !readSlot(target));
    if (target) {
      const other = readSlot(target);
      move(ref, target, Math.min(stack.count, item.maxStack - (other?.count ?? 0)));
    } else notify('אין משבצת פנויה להעברה מהירה');
  }
  function slots(title: string, area: InventoryArea, values: readonly Slot[], columns: number) {
    const section = document.createElement('section'),
      titleNode = document.createElement('h3');
    titleNode.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    grid.style.setProperty('--columns', String(columns));
    values.forEach((stack, index) => {
      const ref = { area, slot: index },
        b = button('', () => {});
      b.dataset.area = area;
      b.dataset.slot = String(index);
      const equipmentLabel =
        area === 'equipment'
          ? ['ראש', 'גוף', 'רגליים', 'כפות רגליים', 'יד שנייה'][index]
          : String(index + 1);
      const item = stack && content.items.find((item) => item.itemType === stack.itemType);
      const description = stack
        ? `${label(stack.itemType)} ×${stack.count}${stack.instance?.durability ? ` · עמידות ${stack.instance.durability}` : ''}${item && describeItem(item) ? ` · ${describeItem(item)}` : ''}`
        : 'ריק';
      fillItemSlot(
        b,
        item || undefined,
        stack,
        stack ? runtime.itemIcon(stack.itemType) : null,
        area === 'equipment' ? equipmentLabel : '',
      );
      if (area === 'bag' && index < 9) {
        const number = document.createElement('span');
        number.className = 'voxel-item-slot__key';
        number.textContent = String(index + 1);
        b.append(number);
      }
      b.title = description;
      b.setAttribute('aria-label', `${title} ${equipmentLabel}: ${description}`);
      b.disabled = busy();
      b.setAttribute('aria-pressed', String(selected?.area === area && selected.slot === index));
      if (area === 'equipment' && selected) {
        const selectedItem = recipeItems.get(readSlot(selected)?.itemType ?? '');
        b.dataset.compatible = String(selectedItem?.equipment === EQUIPMENT[index]);
      }
      b.addEventListener('click', (event) =>
        event.shiftKey ? quickMove(ref) : activate(ref, false),
      );
      b.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        activate(ref, true);
      });
      b.draggable = !!stack && !busy();
      b.addEventListener('dragstart', (event) => {
        selected = ref;
        selectedCount = stack?.count ?? 0;
        event.dataTransfer?.setData('text/plain', JSON.stringify(ref));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      b.addEventListener('dragover', (event) => {
        if (selected && !busy()) event.preventDefault();
      });
      b.addEventListener('drop', (event) => {
        event.preventDefault();
        if (selected && (selected.area !== area || selected.slot !== index)) activate(ref, false);
      });
      grid.append(b);
    });
    section.append(titleNode, grid);
    body.append(section);
    return section;
  }
  function render() {
    const selection = selected && readSlot(selected),
      item = selection && content.items.find((item) => item.itemType === selection.itemType);
    itemDetails.textContent = item ? `${label(item.itemType)}: ${describeItem(item)}` : '';
    itemDetails.hidden = !item || !describeItem(item);
    discard.disabled = selected?.area !== 'bag' || busy();
    discard.hidden = selected?.area !== 'bag';
    eat.hidden = hud.mode !== 'survival' || selected?.area !== 'bag';
    eat.disabled =
      selected?.area !== 'bag' ||
      !content.items.find((i) => i.itemType === (selected ? readSlot(selected)?.itemType : null))
        ?.food ||
      busy() ||
      hud.vitals?.food === 20;
    const focus = document.activeElement as HTMLElement | null,
      area = focus?.dataset.area,
      index = focus?.dataset.slot;
    const scrollTop = dialog.scrollTop;
    body.replaceChildren();
    const view = hud.inventory;
    if (!view) return;
    slots('תיק', 'bag', view.bag, 9);
    slots('ציוד', 'equipment', view.equipment, EQUIPMENT.length);
    const size = view.station === 'workbench' ? 3 : 2,
      grid = size === 3 ? view.craft3 : view.craft2;
    const craft = slots(
      size === 3 ? 'שולחן יצירה 3×3' : 'יצירה 2×2',
      size === 3 ? 'craft3' : 'craft2',
      grid,
      size,
    );
    const recipe = matchRecipe(grid, size, content.recipes, recipeItems);
    const make = button(
      recipe
        ? `יצירה: ${label(recipe.result.itemType)} ×${recipe.result.count}`
        : 'סדרו פריטים לפי מתכון',
      () =>
        runtime.command({
          type: 'inventory',
          operation: { kind: 'craft', grid: size, count: 1, revision: view.revision },
        }),
    );
    make.id = 'inventory-craft';
    make.disabled = !recipe || busy();
    craft.append(make);
    if (size !== 3 && view.craft3.some(Boolean))
      slots('פריטים שנשמרו משולחן יצירה', 'craft3', view.craft3, 3);
    if (view.container) slots('תיבה משותפת', 'container', view.container.slots, 9);
    if (view.catalog) {
      const section = document.createElement('section'),
        title = document.createElement('h3');
      title.textContent = 'קטלוג יצירתי';
      section.className = 'inventory-catalog';
      const search = document.createElement('input');
      search.type = 'search';
      search.id = 'inventory-catalog-search';
      search.placeholder = 'חיפוש פריטים ובלוקים…';
      search.setAttribute('aria-label', 'חיפוש בקטלוג היצירתי');
      search.value = catalogSearch;
      const catalog = document.createElement('div');
      catalog.id = 'inventory-catalog';
      catalog.className = 'inventory-catalog-grid';
      const drawCatalog = () => {
        catalog.replaceChildren();
        for (const item of content.items.filter((item) =>
          `${label(item.itemType)} ${item.itemType}`
            .toLocaleLowerCase()
            .includes(catalogSearch.toLocaleLowerCase()),
        )) {
          const choice = button('', () => {
            catalogChoice = item.itemType;
            localNotice = null;
            renderMessage();
            drawCatalog();
          });
          choice.dataset.item = item.itemType;
          choice.title = label(item.itemType);
          choice.setAttribute('aria-label', label(item.itemType));
          choice.setAttribute('aria-pressed', String(catalogChoice === item.itemType));
          fillItemSlot(choice, item, null, runtime.itemIcon(item.itemType));
          catalog.append(choice);
        }
      };
      search.addEventListener('input', () => {
        catalogSearch = search.value;
        drawCatalog();
      });
      drawCatalog();
      const choose = button('בחירת בלוק לסרגל', () => {
        const item = recipeItems.get(catalogChoice);
        const state = content.blocks.findIndex(
          (block) => block.name === item?.places && block.placeable !== false,
        );
        if (state >= 0) {
          runtime.command({ type: 'select', state });
          runtime.command({ type: 'inventory', operation: { kind: 'close' } });
        } else notify('הפריט הזה אינו בלוק. אפשר להוסיף אותו לתיק.');
      });
      choose.disabled = busy();
      const grant = button('הוספה לתיק', () => {
        const item = recipeItems.get(catalogChoice);
        if (item)
          runtime.command({
            type: 'inventory',
            operation: {
              kind: 'give',
              itemType: item.itemType,
              count: Math.min(64, item.maxStack),
              revision: view.revision,
            },
          });
      });
      grant.id = 'inventory-give';
      grant.disabled = busy();
      section.append(title, search, catalog, choose, grant);
      body.append(section);
    }
    const recipes = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = 'מתכונים';
    recipes.className = 'inventory-recipes';
    recipes.open = recipesOpen;
    recipes.addEventListener('toggle', () => {
      recipesOpen = recipes.open;
    });
    recipes.append(summary);
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'inventory-recipe-search';
    search.placeholder = 'חיפוש מתכון…';
    search.setAttribute('aria-label', 'חיפוש מתכונים');
    search.value = recipeSearch;
    const recipeList = document.createElement('div');
    recipeList.className = 'inventory-recipe-list';
    const drawRecipes = () => {
      recipeList.replaceChildren();
      for (const recipe of content.recipes.filter((recipe) =>
        `${label(recipe.result.itemType)} ${recipe.result.itemType}`
          .toLocaleLowerCase()
          .includes(recipeSearch.toLocaleLowerCase()),
      )) {
        const card = document.createElement('article');
        card.className = 'inventory-recipe';
        const name = document.createElement('h4');
        name.textContent = `${label(recipe.result.itemType)} ×${recipe.result.count}`;
        const grid = document.createElement('div');
        grid.className = 'inventory-recipe-grid';
        grid.dir = 'ltr';
        grid.style.setProperty('--columns', String(recipe.size));
        const available = new Map<string, number>();
        for (const stack of [...view.bag, ...view.craft2, ...view.craft3])
          if (stack)
            available.set(stack.itemType, (available.get(stack.itemType) ?? 0) + stack.count);
        let missing = false;
        for (const ingredient of recipe.ingredients) {
          const node = document.createElement('span');
          const matching = ingredient
            ? content.items.filter((item) =>
                ingredientMatches(ingredient, item.itemType, recipeItems),
              )
            : [];
          const owned = matching.find((item) => (available.get(item.itemType) ?? 0) > 0);
          const item = owned ?? matching[0];
          if (owned) available.set(owned.itemType, available.get(owned.itemType)! - 1);
          if (ingredient && !owned) {
            node.dataset.missing = 'true';
            missing = true;
          }
          fillItemSlot(node, item, null, item ? runtime.itemIcon(item.itemType) : null);
          node.title = ingredient
            ? `${item ? label(item.itemType) : ingredient}${ingredient.startsWith('#') ? ' (או פריט מקביל)' : ''}${owned ? '' : ' · חסר בתיק'}`
            : 'משבצת ריקה';
          grid.append(node);
        }
        const result = document.createElement('span');
        fillItemSlot(
          result,
          recipeItems.get(recipe.result.itemType),
          recipe.result,
          runtime.itemIcon(recipe.result.itemType),
        );
        result.title = label(recipe.result.itemType);
        const availability = document.createElement('p');
        availability.textContent =
          recipe.size === 3 && view.station !== 'workbench'
            ? 'נדרש שולחן יצירה 3×3'
            : missing
              ? 'חסרים מרכיבים'
              : 'כל המרכיבים בתיק';
        card.append(name, grid, document.createTextNode(' → '), result, availability);
        recipeList.append(card);
      }
    };
    search.addEventListener('input', () => {
      recipeSearch = search.value;
      drawRecipes();
    });
    // Generate recipe thumbnails only when the reference panel is used.
    recipes.addEventListener('toggle', () => {
      if (recipes.open) drawRecipes();
    });
    if (recipesOpen) drawRecipes();
    recipes.append(search, recipeList);
    body.append(recipes);
    if (area && index)
      body.querySelector<HTMLButtonElement>(`[data-area="${area}"][data-slot="${index}"]`)?.focus();
    else if (focus?.id === 'inventory-recipe-search' || focus?.id === 'inventory-catalog-search') {
      const input = body.querySelector<HTMLInputElement>(`#${focus.id}`);
      input?.focus();
      input?.setSelectionRange(
        focus instanceof HTMLInputElement ? focus.selectionStart : null,
        focus instanceof HTMLInputElement ? focus.selectionEnd : null,
      );
    }
    dialog.scrollTop = scrollTop;
  }
  const unsubscribe = runtime.subscribe((state) => {
    const opening = !hud?.inventoryOpen && state.inventoryOpen;
    const pendingChanged = hud?.inventoryPending !== state.inventoryPending;
    const statusChanged = hud?.status !== state.status || hud?.lifecycle !== state.lifecycle;
    const foodChanged = hud?.vitals?.food !== state.vitals?.food;
    if (
      opening ||
      !state.inventoryOpen ||
      state.inventoryPending ||
      statusChanged ||
      hud?.inventory?.revision !== state.inventory?.revision ||
      hud?.inventory?.container?.id !== state.inventory?.container?.id ||
      hud?.inventory?.container?.revision !== state.inventory?.container?.revision ||
      (hud?.message !== state.message &&
        state.message &&
        !state.message.startsWith('לחצו על העולם'))
    )
      localNotice = null;
    hud = state;
    if (state.inventoryOpen && !dialog.open) {
      dialog.showModal();
      close.focus();
    }
    if (!state.inventoryOpen && dialog.open) {
      dialog.close();
      selected = null;
    }
    const available =
      state.inventory !== null &&
      state.lifecycle === 'playing' &&
      !state.inventoryPending &&
      ['playing', 'paused'].includes(state.status);
    open.disabled = use.disabled = !available;
    renderMessage();
    if (
      state.inventoryOpen &&
      (opening || state.inventory !== previous || pendingChanged || statusChanged || foodChanged)
    ) {
      if (
        state.inventory?.revision !== previous?.revision ||
        state.inventory?.container?.id !== previous?.container?.id
      )
        selected = null;
      previous = state.inventory;
      render();
    }
  });
  const cancel = (event: Event) => {
    event.preventDefault();
    runtime.command({ type: 'inventory', operation: { kind: 'close' } });
  };
  const key = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      event.code !== 'KeyE' ||
      (!dialog.open && !!dialogHost.querySelector('dialog[open]')) ||
      (event.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))
    )
      return;
    if (!hud.inventoryOpen && (!hud.inventory || busy() || hud.role === 'observer')) return;
    event.preventDefault();
    runtime.command({
      type: 'inventory',
      operation: hud.inventoryOpen ? { kind: 'close' } : { kind: 'open', target: null },
    });
  };
  dialog.addEventListener('cancel', cancel);
  window.addEventListener('keydown', key);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      window.removeEventListener('keydown', key);
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
      dialog.remove();
      open.remove();
      use.remove();
    },
  };
}
