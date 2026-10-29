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
  const use = button('שולחן / תיבה', () => runtime.command({ type: 'inventory-target' }));
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
  const subtitle = document.createElement('p');
  subtitle.className = 'inventory-subtitle';
  subtitle.textContent = 'E או Esc לסגירה וחזרה למשחק';
  const titleGroup = document.createElement('div');
  titleGroup.append(heading, subtitle);
  top.append(titleGroup, close);
  const message = document.createElement('p');
  message.className = 'inventory-notice';
  message.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'inventory-hint';
  hint.textContent = 'לחיצה: ערימה · ימנית: חצי / הנחת פריט אחד · Shift ולחיצה: העברה מהירה';
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
  itemDetails.textContent = 'בחרו פריט כדי לראות את פרטיו.';
  const discard = button('השלכה (Q)', () => {
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
  const eat = button('אכילה (R)', () => {
    if (selected?.area === 'bag' && hud.inventory && !busy())
      runtime.command({
        type: 'inventory',
        operation: { kind: 'consume', slot: selected.slot, revision: hud.inventory.revision },
      });
  });
  eat.id = 'inventory-eat';
  const body = document.createElement('div');
  body.className = 'inventory-body';
  const actions = document.createElement('div');
  actions.className = 'inventory-actions';
  actions.append(use, discard, eat);
  const footer = document.createElement('footer');
  footer.className = 'inventory-footer';
  footer.append(itemDetails, actions, hint);
  dialog.append(top, message, body, footer, cursorLine, cursor);
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
  const book = document.createElement('dialog');
  book.className = 'voxel-inventory voxel-recipe-book';
  book.dir = 'rtl';
  book.setAttribute('aria-labelledby', 'inventory-recipe-title');
  dialogHost.append(book);
  const bookThumbnails = new VisibleItemIcons(book, (itemType, cachedOnly) =>
    runtime.itemIcon(itemType, cachedOnly),
  );
  const closeBook = () => {
    if (book.open) book.close();
    dialog
      .querySelector<HTMLButtonElement>('.inventory-book-toggle')
      ?.focus({ preventScroll: true });
  };
  book.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeBook();
  });
  let selectedCount = 0,
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
    if (message.textContent !== text)
      message.textContent = text || 'גררו פריטים בין המשבצות, או בחרו ערימה והניחו אותה בלחיצה.';
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
    closeBook();
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
  const slotNodes: {
    node: HTMLButtonElement;
    ref: SlotRef;
    title: string;
    equipmentLabel: string;
  }[] = [];
  let layoutKey = '',
    renderedView: InventoryView | null = null;
  let refreshCraft = () => {};
  let refreshRecipes = () => {};
  function updateSlots() {
    for (const { node, ref, title, equipmentLabel } of slotNodes) {
      const stack = readSlot(ref),
        item = stack && recipeItems.get(stack.itemType);
      const carried = selected?.area === ref.area && selected.slot === ref.slot ? selectedCount : 0;
      const shown =
        stack && stack.count > carried
          ? { ...stack, count: stack.count - carried }
          : carried
            ? null
            : stack;
      node.replaceChildren();
      fillItemSlot(
        node,
        shown ? item || undefined : undefined,
        shown,
        shown ? runtime.itemIcon(shown.itemType) : null,
        ref.area === 'equipment' ? equipmentLabel : '',
      );
      if (ref.area === 'bag' && ref.slot < 9) {
        const number = document.createElement('span');
        number.className = 'voxel-item-slot__key';
        number.textContent = String(ref.slot + 1);
        node.append(number);
      }
      const description = stack
        ? `${label(stack.itemType)} ×${stack.count}${item && describeItem(item) ? ` · ${describeItem(item)}` : ''}`
        : 'ריק';
      node.title = description;
      node.setAttribute('aria-label', `${title} ${equipmentLabel}: ${description}`);
      node.disabled = busy() && (!placement || !selected);
      node.draggable = !!stack && !busy();
      node.setAttribute(
        'aria-pressed',
        String(selected?.area === ref.area && selected.slot === ref.slot),
      );
      if (ref.area === 'equipment') {
        const selectedItem = selected && recipeItems.get(readSlot(selected)?.itemType ?? '');
        if (selectedItem)
          node.dataset.compatible = String(selectedItem.equipment === EQUIPMENT[ref.slot]);
        else delete node.dataset.compatible;
      }
    }
  }
  function updateSelection() {
    const stack = selected && readSlot(selected),
      item = stack && recipeItems.get(stack.itemType);
    itemDetails.textContent = item
      ? `${label(item.itemType)}${describeItem(item) ? ` · ${describeItem(item)}` : ''}`
      : panel === 'catalog'
        ? label(catalogChoice)
        : 'בחרו פריט כדי לראות את פרטיו.';
    itemDetails.title = itemDetails.textContent;
    discard.disabled = selected?.area !== 'bag' || busy();
    eat.disabled =
      hud.mode !== 'survival' ||
      selected?.area !== 'bag' ||
      !item?.food ||
      busy() ||
      hud.vitals?.food === 20;
    const hold = body.querySelector<HTMLButtonElement>('#inventory-hold');
    if (hold) hold.disabled = busy() || selected?.area !== 'bag' || selected.slot >= 9;
    const give = body.querySelector<HTMLButtonElement>('#inventory-give');
    if (give) give.disabled = busy();
    const choose = body.querySelector<HTMLButtonElement>('#inventory-choose');
    if (choose) choose.disabled = busy();
    cursor.hidden = !stack || !hud.inventoryOpen;
    cursor.replaceChildren();
    if (stack)
      fillItemSlot(
        cursor,
        recipeItems.get(stack.itemType),
        { ...stack, count: selectedCount },
        runtime.itemIcon(stack.itemType),
      );
    cursorLine.textContent = stack ? `ביד: ${label(stack.itemType)} ×${selectedCount}` : '';
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
      slotNodes.push({ node: b, ref, title, equipmentLabel });
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
        selectedCount = readSlot(ref)?.count ?? 0;
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
    const current = hud.inventory;
    if (!current) return;
    if (!current.catalog) panel = 'inventory';
    const nextLayout = JSON.stringify([
      hud.mode,
      panel,
      current.station,
      current.container?.id,
      current.container?.slots.length,
      !!current.catalog,
      current.craft3.some(Boolean) && current.station !== 'workbench',
    ]);
    if (layoutKey === nextLayout) {
      updateSlots();
      updateSelection();
      refreshCraft();
      if (book.open && (current !== renderedView || hud.inventoryPending)) refreshRecipes();
      renderedView = current;
      return;
    }
    layoutKey = nextLayout;
    slotNodes.length = 0;
    bookThumbnails.reset();
    const focus = document.activeElement as HTMLElement | null,
      area = focus?.dataset.area,
      index = focus?.dataset.slot;
    const scrollTop = dialog.scrollTop;
    const bookScroll = book.querySelector('.inventory-recipe-list')?.scrollTop ?? 0;
    const catalogScroll = body.querySelector('#inventory-catalog')?.scrollTop ?? 0;
    thumbnails.reset();
    body.replaceChildren();
    const view = hud.inventory;
    if (!view) return;
    if (!view.catalog) panel = 'inventory';
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
    const storage = document.createElement('div');
    storage.className = 'inventory-storage';
    primary.append(storage);
    sectionsHost = storage;
    const size = view.station === 'workbench' ? 3 : 2,
      grid = size === 3 ? view.craft3 : view.craft2;
    const upper = document.createElement('div');
    upper.className = 'inventory-upper';
    storage.append(upper);
    const craft = slots(
      size === 3 ? 'שולחן יצירה 3×3' : 'יצירה 2×2',
      size === 3 ? 'craft3' : 'craft2',
      grid,
      size,
    );
    upper.append(craft);
    const bookToggle = button('ספר מתכונים', () => {
      refreshRecipes();
      book.showModal();
    });
    bookToggle.setAttribute('aria-haspopup', 'dialog');
    bookToggle.className = 'inventory-book-toggle';
    craft.prepend(bookToggle);
    const make = button('', () =>
      runtime.command({
        type: 'inventory',
        operation: { kind: 'craft', grid: size, count: 1, revision: hud.inventory!.revision },
      }),
    );
    make.id = 'inventory-craft';
    make.className = 'inventory-result';
    const craftRow = document.createElement('div');
    craftRow.className = 'inventory-craft-row';
    craftRow.dir = 'ltr';
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    craftRow.append(craft.querySelector('.inventory-grid')!, arrow, make);
    const outputName = document.createElement('p');
    outputName.className = 'inventory-output-label';
    refreshCraft = () => {
      const current = hud.inventory!;
      const recipe = matchRecipe(
        size === 3 ? current.craft3 : current.craft2,
        size,
        content.recipes,
        recipeItems,
      );
      make.disabled = !recipe || busy();
      make.title = recipe
        ? `יצירה: ${label(recipe.result.itemType)} ×${recipe.result.count}`
        : 'סדרו מרכיבים ברשת או בחרו מתכון מהספר';
      make.setAttribute('aria-label', make.title);
      make.replaceChildren();
      fillItemSlot(
        make,
        recipe ? recipeItems.get(recipe.result.itemType) : undefined,
        recipe?.result ?? null,
        recipe ? runtime.itemIcon(recipe.result.itemType) : null,
        'תוצר',
      );
      outputName.textContent = recipe
        ? `${label(recipe.result.itemType)} ×${recipe.result.count} · לחצו ליצירה`
        : 'הניחו מרכיבים ברשת כדי ליצור פריט';
    };
    craft.append(craftRow, outputName);
    const equipment = slots('ציוד', 'equipment', view.equipment, EQUIPMENT.length);
    equipment.className = 'inventory-equipment';
    if (view.container) slots('תיבה משותפת', 'container', view.container.slots, 9);
    slots('תיק', 'bag', view.bag.slice(9), 9, 9);
    sectionsHost = primary;
    const hotbar = slots('סרגל מהיר · מקשים 1–9', 'bag', view.bag.slice(0, 9), 9);
    hotbar.className = 'inventory-hotbar';
    if (hud.mode === 'creative') {
      const hold = button('החזקה מהתיק', () => {
        if (selected?.area === 'bag' && selected.slot < 9 && !busy())
          runtime.command({ type: 'select-slot', slot: selected.slot });
      });
      hold.id = 'inventory-hold';
      hold.disabled = busy() || selected?.area !== 'bag' || selected.slot >= 9;
      hotbar.querySelector('h3')!.append(hold);
    }
    sectionsHost = storage;
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
            catalog.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((node) =>
              node.setAttribute('aria-pressed', String(node.dataset.item === catalogChoice)),
            );
            updateSelection();
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
      choose.id = 'inventory-choose';
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
              revision: hud.inventory!.revision,
            },
          });
      });
      grant.id = 'inventory-give';
      grant.disabled = busy();
      section.append(title, search, catalog, choose, grant);
      body.append(section);
    }
    const recipes = document.createElement('div');
    recipes.className = 'inventory-recipes';
    const bookHeader = document.createElement('header');
    const bookTitle = document.createElement('h2');
    bookTitle.id = 'inventory-recipe-title';
    bookTitle.textContent = 'ספר המתכונים';
    bookHeader.append(bookTitle, button('חזרה למלאי', closeBook));
    book.replaceChildren(bookHeader, recipes);
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
      const view = hud.inventory!;
      const scrollTop = recipeList.scrollTop;
      bookThumbnails.forget(recipeList);
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
          if (item) bookThumbnails.observe(node, item.itemType);
          node.title = ingredient
            ? `${item ? label(item.itemType) : ingredient}${ingredient.startsWith('#') ? ' (או פריט מקביל)' : ''}${owned ? '' : ' · חסר בתיק'}`
            : 'משבצת ריקה';
          grid.append(node);
        }
        const result = document.createElement('span');
        fillItemSlot(result, recipeItems.get(recipe.result.itemType), recipe.result, null);
        bookThumbnails.observe(result, recipe.result.itemType);
        result.title = label(recipe.result.itemType);
        const availability = document.createElement('p');
        availability.className = 'inventory-recipe-availability';
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
        const preview = document.createElement('div');
        preview.className = 'inventory-recipe-preview';
        preview.dir = 'ltr';
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        preview.append(grid, arrow, result);
        ingredients.title = ingredients.textContent;
        card.append(name, preview, ingredients, availability, arrange);
        recipeList.append(card);
      }
      recipeList.scrollTop = scrollTop;
    };
    refreshRecipes = drawRecipes;
    search.addEventListener('input', () => {
      recipeSearch = search.value;
      if (recipeSearch.trim()) recipeTab = 'all';
      drawRecipes();
    });
    recipes.append(categories, search, recipeList);
    updateSlots();
    updateSelection();
    refreshCraft();
    renderedView = view;
    if (book.open) refreshRecipes();
    if (area && index)
      body.querySelector<HTMLButtonElement>(`[data-area="${area}"][data-slot="${index}"]`)?.focus();
    else if (focus?.id === 'inventory-recipe-search' || focus?.id === 'inventory-catalog-search') {
      const input = dialogHost.querySelector<HTMLInputElement>(`#${focus.id}`);
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
      if (book.open) book.close();
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
    closeInventory();
  };
  const key = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      !['KeyE', 'KeyQ', 'KeyR'].includes(event.code) ||
      (!dialog.open && !!dialogHost.querySelector('dialog[open]')) ||
      (event.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))
    )
      return;
    if (book.open) {
      if (event.code === 'KeyE') {
        event.preventDefault();
        closeBook();
      }
      return;
    }
    if (event.code !== 'KeyE') {
      if (!hud.inventoryOpen) return;
      event.preventDefault();
      const action = event.code === 'KeyQ' ? discard : eat;
      if (!action.disabled) action.click();
      return;
    }
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
      bookThumbnails.reset();
      book.close();
      book.remove();
      open.remove();
      use.remove();
    },
  };
}
