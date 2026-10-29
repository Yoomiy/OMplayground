import { EQUIPMENT, matchRecipe, sameStack } from '../shared/inventory.ts';
import { ingredientMatches } from '../shared/recipes.ts';
import type { InventoryArea, InventoryView, Slot, SlotRef } from '../shared/inventory.ts';
import type { ContentManifest, Recipe } from '../shared/content.ts';
import type { HudState, VoxelRuntime } from './runtime.ts';
import { describeItem } from './item-description.ts';
import { fillItemSlot } from './item-slot.ts';
import { VisibleItemIcons } from './visible-item-icons.ts';
import { arrangeRecipe, recipeCategory, recipeMaterials } from './recipe-book.ts';
import type { PlannedMove, RecipeCategory } from './recipe-book.ts';
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
  heading.textContent = 'מלאי ויצירה';
  const closeInventory = (resume = true) => {
    runtime.command({ type: 'inventory', operation: { kind: 'close' } });
    if (resume) runtime.command({ type: 'resume' });
  };
  const close = button('סגירה (E)', () => closeInventory());
  close.id = 'inventory-close';
  const top = document.createElement('header');
  top.append(heading, use, close);
  const message = document.createElement('p');
  message.className = 'inventory-notice';
  message.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'inventory-hint';
  hint.textContent =
    'לחיצה בוחרת ערימה; לחיצה ימנית על יעד מניחה פריט אחד ומשאירה את השאר ביד. לחיצה ימנית על ערימה בוחרת חצי. אפשר גם לגרור או להעביר במהירות עם Shift.';
  const cursorLine = document.createElement('p');
  cursorLine.className = 'inventory-cursor-status';
  cursorLine.setAttribute('role', 'status');
  const cursor = document.createElement('div');
  cursor.className = 'inventory-cursor';
  cursor.hidden = true;
  cursor.setAttribute('aria-hidden', 'true');
  const itemDetails = document.createElement('p');
  itemDetails.id = 'inventory-item-details';
  itemDetails.setAttribute('aria-live', 'polite');
  itemDetails.hidden = true;
  const discard = button('השלכת פריט מהערימה שנבחרה', () => {
    if (selected?.area === 'bag' && hud.inventory && !busy())
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
  dialog.append(top, message, cursorLine, body, hint, itemDetails, discard, eat, cursor);
  dialogHost.append(dialog);
  const thumbnails = new VisibleItemIcons(dialog, (itemType, cachedOnly) =>
    runtime.itemIcon(itemType, cachedOnly),
  );
  let hud: HudState,
    selected: SlotRef | null = null,
    previous: InventoryView | null = null,
    disposed = false;
  let catalogChoice = content.items[0]?.itemType ?? '';
  let localNotice: { text: string; until: number } | null = null;
  let sectionsHost = body;
  let placement: {
    from: SlotRef;
    view: InventoryView;
    stack: NonNullable<Slot>;
    target: Slot;
    count: number;
    carry: number;
  } | null = null;
  const placements: { to: SlotRef; count: number }[] = [];
  let arrangement: {
    moves: PlannedMove[];
    waiting: { view: InventoryView; move: PlannedMove; before: number } | null;
  } | null = null;
  let transfer: {
    from: SlotRef;
    stack: NonNullable<Slot>;
    destinations: SlotRef[];
    containerId: string | null;
    waiting: { view: InventoryView; count: number; before: number } | null;
  } | null = null;
  let selectedCount = 0,
    recipesOpen = true,
    recipeSearch = '',
    catalogSearch = '';
  let recipeTab: RecipeCategory = 'available';
  let chosenRecipe = '';
  let panel: 'inventory' | 'catalog' = 'inventory';
  const renderMessage = () => {
    const local = localNotice && performance.now() < localNotice.until ? localNotice.text : null;
    const text = arrangement
      ? 'מסדרים את המתכון…'
      : hud.inventoryPending
        ? 'ממתינים לעדכון…'
        : (local ?? (hud.message.startsWith('לחצו על העולם') ? '' : hud.message));
    if (message.textContent !== text) message.textContent = text;
  };
  const notify = (text: string) => {
    localNotice = { text, until: performance.now() + 3000 };
    renderMessage();
  };
  const unavailable = () =>
    hud.inventoryPending ||
    hud.lifecycle !== 'playing' ||
    !['playing', 'paused'].includes(hud.status);
  const busy = () =>
    unavailable() || transfer !== null || arrangement !== null || placement !== null;
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
    if (!view || (busy() && !placement)) return;
    if (!selected && placement) return;
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
      selectedCount = 0;
      placements.length = 0;
      if (placement) placement.carry = 0;
      render();
      return;
    }
    const available =
      selectedCount - (placement?.count ?? 0) - placements.reduce((n, move) => n + move.count, 0);
    const count = one ? Math.min(1, available) : available;
    if (count <= 0) return;
    if (placement) placements.push({ to: ref, count });
    else place(ref, count);
  };
  function place(to: SlotRef, count: number) {
    const view = hud.inventory,
      from = selected,
      stack = from && readSlot(from);
    if (!view || !from || !stack || unavailable()) return;
    count = Math.min(count, selectedCount, stack.count);
    placement = {
      from,
      view,
      stack: { ...stack },
      target: readSlot(to),
      count,
      carry: selectedCount - count,
    };
    move(from, to, count);
  }
  function advancePlacement() {
    const sent = placement,
      view = hud.inventory;
    if (!sent || !view || hud.inventoryPending || view === sent.view || disposed) return;
    placement = null;
    const source = readSlot(sent.from);
    const accepted = view.revision === sent.view.revision + 1;
    if (
      accepted &&
      selected &&
      !sent.carry &&
      sent.target &&
      source &&
      !sameStack(sent.stack, sent.target) &&
      sameStack(source, sent.target) &&
      source.count === sent.target.count
    ) {
      selectedCount = source.count;
      placements.length = 0;
      render();
      return;
    }
    if (
      !accepted ||
      !selected ||
      !sent.carry ||
      !source ||
      !sameStack(source, sent.stack) ||
      source.count !== sent.stack.count - sent.count
    ) {
      placements.length = 0;
      if (!accepted && selected && source && sameStack(source, sent.stack))
        selectedCount = Math.min(selectedCount, source.count);
      else {
        selected = null;
        selectedCount = 0;
      }
    } else selectedCount = Math.min(sent.carry, source.count);
    render();
    const next = placements.shift();
    if (next && selected) place(next.to, next.count);
  }
  function move(from: SlotRef, to: SlotRef, count: number) {
    const view = hud.inventory,
      source = readSlot(from);
    if (!view || unavailable() || !source) return;
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
  function prepareRecipe(recipe: Recipe) {
    if (!hud.inventory || busy() || placement) return;
    const plan = arrangeRecipe(
      recipe,
      hud.inventory,
      hud.inventory.station === 'workbench' ? 3 : 2,
      recipeItems,
    );
    if (plan.error) {
      notify(plan.error);
      return;
    }
    selected = null;
    chosenRecipe = recipe.key;
    arrangement = { moves: plan.moves, waiting: null };
    advanceArrangement();
  }
  function advanceArrangement() {
    const job = arrangement,
      view = hud.inventory;
    if (!job || !view || disposed || hud.inventoryPending) return;
    if (job.waiting) {
      const sent = job.waiting;
      if (view === sent.view) return;
      const source = readSlot(sent.move.from);
      if (
        view.revision !== sent.view.revision + 1 ||
        (source?.count ?? 0) !== sent.before - sent.move.count ||
        (source && source.itemType !== sent.move.itemType)
      ) {
        arrangement = null;
        notify('סידור המתכון נעצר כי המלאי השתנה. אפשר לבחור שוב את המתכון.');
        render();
        return;
      }
      job.waiting = null;
    }
    const next = job.moves.shift();
    if (!next) {
      arrangement = null;
      notify('המתכון מוכן ברשת. לחצו על התוצר כדי ליצור אותו.');
      render();
      return;
    }
    const source = readSlot(next.from);
    if (!source || source.itemType !== next.itemType || source.count < next.count) {
      arrangement = null;
      notify('החומרים השתנו. בחרו שוב את המתכון.');
      render();
      return;
    }
    job.waiting = { view, move: next, before: source.count };
    move(next.from, next.to, next.count);
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
    selected = null;
    transfer = {
      from: ref,
      stack: { ...stack },
      destinations,
      containerId: view.container?.id ?? null,
      waiting: null,
    };
    advanceTransfer();
  }
  function advanceTransfer() {
    const job = transfer,
      view = hud.inventory;
    if (!job || !view || disposed) return;
    if (!hud.inventoryOpen || unavailable() || (view.container?.id ?? null) !== job.containerId) {
      if (!hud.inventoryPending) transfer = null;
      return;
    }
    const stack = readSlot(job.from);
    if (job.waiting) {
      // A result clears pending before its inventory view arrives. Wait for that
      // fresh view, then verify this exact move before sending another revision.
      const sent = job.waiting;
      if (view === sent.view) return;
      if (
        view.revision !== sent.view.revision + 1 ||
        (stack?.count ?? 0) !== sent.before - sent.count ||
        (stack && !sameStack(stack, job.stack))
      ) {
        transfer = null;
        render();
        return;
      }
      job.waiting = null;
    }
    if (!stack || !sameStack(stack, job.stack)) {
      transfer = null;
      render();
      return;
    }
    const item = recipeItems.get(stack.itemType)!;
    const target =
      job.destinations.find((target) => {
        const other = readSlot(target);
        return other && sameStack(other, stack) && other.count < item.maxStack;
      }) ?? job.destinations.find((target) => !readSlot(target));
    if (target) {
      const other = readSlot(target);
      const count = Math.min(stack.count, item.maxStack - (other?.count ?? 0));
      job.waiting = { view, count, before: stack.count };
      move(job.from, target, count);
    } else {
      transfer = null;
      notify('אין משבצת פנויה להעברה מהירה');
      render();
    }
  }
  function slots(
    title: string,
    area: InventoryArea,
    values: readonly Slot[],
    columns: number,
    offset = 0,
  ) {
    const section = document.createElement('section'),
      titleNode = document.createElement('h3');
    titleNode.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    grid.style.setProperty('--columns', String(columns));
    values.forEach((stack, localIndex) => {
      const index = localIndex + offset;
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
      const carried = selected?.area === area && selected.slot === index ? selectedCount : 0;
      const shown =
        stack && stack.count > carried
          ? { ...stack, count: stack.count - carried }
          : carried
            ? null
            : stack;
      fillItemSlot(
        b,
        shown ? item || undefined : undefined,
        shown,
        shown ? runtime.itemIcon(shown.itemType) : null,
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
      b.disabled = busy() && (!placement || !selected);
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
    sectionsHost.append(section);
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
    const bookScroll = body.querySelector('.inventory-recipe-list')?.scrollTop ?? 0;
    const catalogScroll = body.querySelector('#inventory-catalog')?.scrollTop ?? 0;
    thumbnails.reset();
    body.replaceChildren();
    const view = hud.inventory;
    if (!view) return;
    if (!view.catalog) panel = 'inventory';
    dialog.dataset.book = String(recipesOpen && panel === 'inventory');
    body.dataset.panel = panel;
    if (view.catalog) {
      const tabs = document.createElement('nav');
      tabs.className = 'inventory-panel-tabs';
      tabs.setAttribute('aria-label', 'תצוגת מלאי');
      for (const [id, text] of [
        ['inventory', 'מלאי ויצירה'],
        ['catalog', 'קטלוג יצירתי'],
      ] as const) {
        const tab = button(text, () => {
          panel = id;
          render();
        });
        tab.setAttribute('aria-pressed', String(panel === id));
        tabs.append(tab);
      }
      body.append(tabs);
    }
    const primary = document.createElement('div');
    primary.className = 'inventory-primary';
    primary.hidden = panel === 'catalog' && view.catalog;
    body.append(primary);
    sectionsHost = primary;
    const size = view.station === 'workbench' ? 3 : 2,
      grid = size === 3 ? view.craft3 : view.craft2;
    const upper = document.createElement('div');
    upper.className = 'inventory-upper';
    primary.append(upper);
    const craft = slots(
      size === 3 ? 'שולחן יצירה 3×3' : 'יצירה 2×2',
      size === 3 ? 'craft3' : 'craft2',
      grid,
      size,
    );
    const equipment = slots('ציוד', 'equipment', view.equipment, EQUIPMENT.length);
    equipment.className = 'inventory-equipment';
    upper.append(craft, equipment);
    const bookToggle = button('ספר מתכונים', () => {
      recipesOpen = !recipesOpen;
      render();
    });
    bookToggle.setAttribute('aria-expanded', String(recipesOpen));
    bookToggle.className = 'inventory-book-toggle';
    craft.prepend(bookToggle);
    const recipe = matchRecipe(grid, size, content.recipes, recipeItems);
    const make = button('', () =>
      runtime.command({
        type: 'inventory',
        operation: { kind: 'craft', grid: size, count: 1, revision: view.revision },
      }),
    );
    make.id = 'inventory-craft';
    make.className = 'inventory-result';
    make.disabled = !recipe || busy();
    make.title = recipe
      ? `יצירה: ${label(recipe.result.itemType)} ×${recipe.result.count}`
      : 'סדרו מרכיבים ברשת או בחרו מתכון מהספר';
    make.setAttribute('aria-label', make.title);
    fillItemSlot(
      make,
      recipe ? recipeItems.get(recipe.result.itemType) : undefined,
      recipe?.result ?? null,
      recipe ? runtime.itemIcon(recipe.result.itemType) : null,
      'תוצר',
    );
    const craftRow = document.createElement('div');
    craftRow.className = 'inventory-craft-row';
    craftRow.dir = 'ltr';
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    craftRow.append(craft.querySelector('.inventory-grid')!, arrow, make);
    const outputName = document.createElement('p');
    outputName.className = 'inventory-output-label';
    outputName.textContent = recipe
      ? `${label(recipe.result.itemType)} ×${recipe.result.count} — לחצו ליצירה`
      : 'גזע אחד ← 4 לוחות. ארבעה לוחות בריבוע ← שולחן יצירה.';
    craft.append(craftRow, outputName);
    if (view.container) slots('תיבה משותפת', 'container', view.container.slots, 9);
    slots('תיק', 'bag', view.bag.slice(9), 9, 9);
    const hotbar = slots('סרגל מהיר · מקשים 1–9', 'bag', view.bag.slice(0, 9), 9);
    if (hud.mode === 'creative') {
      const hold = button('החזקה מהתיק', () => {
        if (selected?.area === 'bag' && selected.slot < 9 && !busy())
          runtime.command({ type: 'select-slot', slot: selected.slot });
      });
      hold.id = 'inventory-hold';
      hold.disabled = busy() || selected?.area !== 'bag' || selected.slot >= 9;
      const help = document.createElement('p');
      help.className = 'inventory-hint';
      help.textContent =
        'כלים ופריטים מחזיקים מתוך הסרגל המהיר. לבחירת בלוק ללא הגבלה, עברו לקטלוג היצירתי.';
      hotbar.append(hold, help);
    }
    if (size !== 3 && view.craft3.some(Boolean))
      slots('פריטים משולחן היצירה', 'craft3', view.craft3, 3);
    if (view.catalog) {
      const section = document.createElement('section'),
        title = document.createElement('h3');
      title.textContent = 'קטלוג יצירתי';
      section.className = 'inventory-catalog';
      section.hidden = panel !== 'catalog';
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
        thumbnails.forget(catalog);
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
          fillItemSlot(choice, item, null, null);
          thumbnails.observe(choice, item.itemType);
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
          closeInventory();
        } else notify('הוסיפו את הפריט לתיק, העבירו למשבצות 1–9 ובחרו החזקה מהתיק.');
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
    summary.textContent = 'ספר מתכונים';
    recipes.className = 'inventory-recipes';
    recipes.open = recipesOpen;
    recipes.hidden = panel === 'catalog';
    recipes.addEventListener('toggle', () => {
      recipesOpen = recipes.open;
      dialog.dataset.book = String(recipesOpen && panel === 'inventory');
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
    const categories = document.createElement('nav');
    categories.className = 'inventory-recipe-tabs';
    categories.setAttribute('aria-label', 'קטגוריות מתכונים');
    const drawRecipes = () => {
      thumbnails.forget(recipeList);
      recipeList.replaceChildren();
      categories.replaceChildren();
      for (const [id, text] of [
        ['available', 'אפשר ליצור'],
        ['all', 'הכל'],
        ['tools', 'כלים וציוד'],
        ['building', 'בנייה'],
        ['food', 'אוכל וחומרים'],
      ] as const) {
        const tab = button(text, () => {
          recipeTab = id;
          drawRecipes();
        });
        tab.setAttribute('aria-pressed', String(recipeTab === id));
        categories.append(tab);
      }
      const basics = [
        'oak_planks',
        'crafting_table',
        'stick',
        'torch',
        'wooden_pickaxe',
        'wooden_axe',
        'wooden_shovel',
        'chest',
      ];
      const list = content.recipes
        .map((recipe) => ({ recipe, materials: recipeMaterials(recipe, view, recipeItems) }))
        .filter(
          ({ recipe, materials }) =>
            `${label(recipe.result.itemType)} ${recipe.result.itemType}`
              .toLocaleLowerCase()
              .includes(recipeSearch.toLocaleLowerCase()) &&
            (recipeTab === 'all' ||
              (recipeTab === 'available'
                ? !materials.missing.length && recipe.size <= size
                : recipeCategory(recipe, recipeItems) === recipeTab)),
        )
        .sort(
          (a, b) =>
            Number(!!a.materials.missing.length || a.recipe.size > size) -
              Number(!!b.materials.missing.length || b.recipe.size > size) ||
            (basics.indexOf(a.recipe.result.itemType) < 0
              ? 100
              : basics.indexOf(a.recipe.result.itemType)) -
              (basics.indexOf(b.recipe.result.itemType) < 0
                ? 100
                : basics.indexOf(b.recipe.result.itemType)) ||
            label(a.recipe.result.itemType).localeCompare(label(b.recipe.result.itemType), 'he'),
        );
      if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'inventory-recipe-empty';
        empty.textContent =
          recipeTab === 'available'
            ? 'עדיין אין מספיק חומרים. התחילו באיסוף גזע עץ והפכו אותו ללוחות, או עברו לקטגוריה אחרת כדי לראות מה צריך.'
            : 'לא נמצאו מתכונים. נסו חיפוש אחר.';
        recipeList.append(empty);
      }
      for (const { recipe, materials } of list) {
        const card = document.createElement('article');
        card.className = 'inventory-recipe';
        card.dataset.recipe = recipe.key;
        card.dataset.selected = String(chosenRecipe === recipe.key);
        const name = document.createElement('h4');
        name.textContent = `${label(recipe.result.itemType)} ×${recipe.result.count}`;
        const grid = document.createElement('div');
        grid.className = 'inventory-recipe-grid';
        grid.dir = 'ltr';
        grid.style.setProperty('--columns', String(recipe.size));
        for (const [index, ingredient] of recipe.ingredients.entries()) {
          const node = document.createElement('span');
          const matching = ingredient
            ? content.items.filter((item) =>
                ingredientMatches(ingredient, item.itemType, recipeItems),
              )
            : [];
          const owned = materials.choices.get(index);
          const item = (owned && recipeItems.get(owned)) || matching[0];
          if (ingredient && !owned) node.dataset.missing = 'true';
          fillItemSlot(node, item, null, null);
          if (item) thumbnails.observe(node, item.itemType);
          node.title = ingredient
            ? `${item ? label(item.itemType) : ingredient}${ingredient.startsWith('#') ? ' (או פריט מקביל)' : ''}${owned ? '' : ' · חסר בתיק'}`
            : 'משבצת ריקה';
          grid.append(node);
        }
        const result = document.createElement('span');
        fillItemSlot(result, recipeItems.get(recipe.result.itemType), recipe.result, null);
        thumbnails.observe(result, recipe.result.itemType);
        result.title = label(recipe.result.itemType);
        const availability = document.createElement('p');
        availability.textContent =
          recipe.size === 3 && view.station !== 'workbench'
            ? 'נדרש שולחן יצירה 3×3'
            : materials.missing.length
              ? 'חסרים מרכיבים'
              : 'כל המרכיבים בתיק';
        const amounts = new Map<string, number>();
        for (const ingredient of recipe.ingredients)
          if (ingredient) amounts.set(ingredient, (amounts.get(ingredient) ?? 0) + 1);
        const ingredients = document.createElement('p');
        ingredients.className = 'inventory-recipe-ingredients';
        ingredients.textContent = [...amounts]
          .map(([ingredient, count]) => {
            const item = content.items.find((item) =>
              ingredientMatches(ingredient, item.itemType, recipeItems),
            );
            return `${count} × ${item ? label(item.itemType) : ingredient}${ingredient.startsWith('#') ? ' (או סוג מקביל)' : ''}`;
          })
          .join(' · ');
        const arrange = button('סידור ברשת', () => prepareRecipe(recipe));
        arrange.disabled = busy() || !!materials.missing.length || recipe.size > size;
        card.append(
          name,
          grid,
          document.createTextNode(' → '),
          result,
          ingredients,
          availability,
          arrange,
        );
        recipeList.append(card);
      }
    };
    search.addEventListener('input', () => {
      recipeSearch = search.value;
      if (recipeSearch.trim()) recipeTab = 'all';
      drawRecipes();
    });
    // Generate recipe thumbnails only when the reference panel is used.
    recipes.addEventListener('toggle', () => {
      if (recipes.open) drawRecipes();
    });
    if (recipesOpen) drawRecipes();
    recipes.append(categories, search, recipeList);
    body.append(recipes);
    const carried = selected && readSlot(selected);
    cursor.hidden = !carried || !hud.inventoryOpen;
    cursor.replaceChildren();
    if (carried)
      fillItemSlot(
        cursor,
        recipeItems.get(carried.itemType),
        { ...carried, count: selectedCount },
        runtime.itemIcon(carried.itemType),
      );
    cursorLine.textContent = carried
      ? `ביד: ${label(carried.itemType)} ×${selectedCount} · לחיצה ימנית מניחה אחד בכל משבצת; לחיצה על המקור מחזירה את הערימה.`
      : '';
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
    recipeList.scrollTop = bookScroll;
    const catalog = body.querySelector('#inventory-catalog');
    if (catalog) catalog.scrollTop = catalogScroll;
  }
  const unsubscribe = runtime.subscribe((state) => {
    const opening = !hud?.inventoryOpen && state.inventoryOpen;
    if ((opening && !previous) || (hud && hud.mode !== state.mode))
      panel = state.inventory?.catalog ? 'catalog' : 'inventory';
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
    if (
      !state.inventoryOpen ||
      statusChanged ||
      state.inventory === null ||
      previous?.container?.id !== state.inventory?.container?.id
    ) {
      transfer = null;
      placement = null;
      placements.length = 0;
      arrangement = null;
      selected = null;
      cursor.hidden = true;
    }
    if (state.inventoryOpen && !dialog.open) {
      dialog.showModal();
      close.focus();
    }
    if (!state.inventoryOpen && dialog.open) {
      thumbnails.reset();
      dialog.close();
      selected = null;
    }
    if (transfer && !state.inventoryPending) queueMicrotask(advanceTransfer);
    if (placement && !state.inventoryPending) queueMicrotask(advancePlacement);
    if (arrangement && !state.inventoryPending) queueMicrotask(advanceArrangement);
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
        !placement &&
        (state.inventory?.revision !== previous?.revision ||
          state.inventory?.container?.id !== previous?.container?.id)
      )
        selected = null;
      previous = state.inventory;
      render();
    }
  });
  const cancel = (event: Event) => {
    event.preventDefault();
    closeInventory(false);
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
    if (hud.inventoryOpen) closeInventory();
    else runtime.command({ type: 'inventory', operation: { kind: 'open', target: null } });
  };
  const followCursor = (event: PointerEvent) => {
    cursor.style.left = `${event.clientX + 14}px`;
    cursor.style.top = `${event.clientY + 14}px`;
  };
  dialog.addEventListener('pointermove', followCursor);
  dialog.addEventListener('cancel', cancel);
  window.addEventListener('keydown', key);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      transfer = null;
      placement = null;
      placements.length = 0;
      arrangement = null;
      dialog.removeEventListener('pointermove', followCursor);
      thumbnails.reset();
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
