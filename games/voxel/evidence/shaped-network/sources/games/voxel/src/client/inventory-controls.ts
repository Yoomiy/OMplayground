import { EQUIPMENT, matchRecipe } from '../shared/inventory.ts';
import type { InventoryArea, InventoryView, Slot, SlotRef } from '../shared/inventory.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { HudState, VoxelRuntime } from './runtime.ts';
import { describeItem } from './item-description.ts';
import './inventory.css';

/** Optional DOM adapter. All writes are public runtime intents, never optimistic stack changes. */
export function mountInventoryControls(
  toolbar: HTMLElement,
  runtime: VoxelRuntime,
  content: Pick<ContentManifest, 'items' | 'recipes'>,
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
  message.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'inventory-hint';
  hint.textContent =
    'בחרו ערימה ואז משבצת יעד. לחיצה ימנית או Shift מעבירים פריט אחד. פתיחת התיק משאירה את שאר העולם פעיל.';
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
      if (readSlot(ref)) selected = ref;
      render();
      return;
    }
    if (selected.area === ref.area && selected.slot === ref.slot) {
      selected = null;
      render();
      return;
    }
    const source = readSlot(selected);
    if (source)
      runtime.command({
        type: 'inventory',
        operation: {
          kind: 'move',
          from: selected,
          to: ref,
          count: one ? 1 : source.count,
          revision: view.revision,
          containerId: view.container?.id ?? null,
          containerRevision: view.container?.revision ?? null,
        },
      });
    selected = null;
  };
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
      b.textContent = stack ? `${label(stack.itemType)} ×${stack.count}` : '—';
      b.title = description;
      b.setAttribute('aria-label', `${title} ${equipmentLabel}: ${description}`);
      b.disabled = busy();
      b.setAttribute('aria-pressed', String(selected?.area === area && selected.slot === index));
      b.addEventListener('click', (event) => activate(ref, event.shiftKey));
      b.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        activate(ref, true);
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
    eat.hidden = hud.mode !== 'survival';
    eat.disabled =
      selected?.area !== 'bag' ||
      !content.items.find((i) => i.itemType === (selected ? readSlot(selected)?.itemType : null))
        ?.food ||
      busy() ||
      hud.vitals?.food === 20;
    const focus = document.activeElement as HTMLElement | null,
      area = focus?.dataset.area,
      index = focus?.dataset.slot;
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
      const select = document.createElement('select');
      select.id = 'inventory-catalog';
      select.setAttribute('aria-label', 'פריט מהקטלוג היצירתי');
      for (const item of content.items) {
        const option = document.createElement('option');
        option.value = item.itemType;
        option.textContent = label(item.itemType);
        select.append(option);
      }
      select.value = catalogChoice;
      select.addEventListener('change', () => {
        catalogChoice = select.value;
      });
      const grant = button('הוספה לתיק', () => {
        const item = content.items.find((i) => i.itemType === select.value);
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
      section.append(title, select, grant);
      body.append(section);
    }
    const recipes = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = 'מתכונים';
    recipes.append(summary);
    for (const recipe of content.recipes) {
      const line = document.createElement('p');
      line.textContent = `${label(recipe.result.itemType)} ×${recipe.result.count} (${recipe.size}×${recipe.size}): ${Array.from(
        { length: recipe.size },
        (_, y) =>
          recipe.ingredients
            .slice(y * recipe.size, (y + 1) * recipe.size)
            .map((item) => (item ? label(item) : '—'))
            .join(' / '),
      ).join(' · ')}`;
      recipes.append(line);
    }
    body.append(recipes);
    if (area && index)
      body.querySelector<HTMLButtonElement>(`[data-area="${area}"][data-slot="${index}"]`)?.focus();
  }
  const unsubscribe = runtime.subscribe((state) => {
    const pendingChanged = hud?.inventoryPending !== state.inventoryPending;
    const statusChanged = hud?.status !== state.status || hud?.lifecycle !== state.lifecycle;
    const foodChanged = hud?.vitals?.food !== state.vitals?.food;
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
    message.textContent = state.inventoryPending
      ? 'ממתינים לעדכון…'
      : state.message.startsWith('לחצו על העולם')
        ? ''
        : state.message;
    if (state.inventory !== previous || pendingChanged || statusChanged || foodChanged) {
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
