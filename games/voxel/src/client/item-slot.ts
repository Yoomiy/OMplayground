import type { ItemDefinition, Stack } from '../shared/content.ts';

/** The same thumbnail/count/durability treatment is used by every inventory grid. */
export function fillItemSlot(
  node: HTMLElement,
  item: ItemDefinition | undefined,
  stack: Stack | null,
  icon: string | null,
  emptyLabel = '',
): void {
  node.classList.add('voxel-item-slot');
  if (icon) {
    const image = document.createElement('img');
    image.src = icon;
    image.alt = '';
    image.draggable = false;
    node.append(image);
  } else if (item || emptyLabel) {
    const name = document.createElement('span');
    name.className = 'voxel-item-slot__empty';
    name.textContent = emptyLabel || 'פריט';
    node.append(name);
  }
  if (stack && stack.count > 1) {
    const count = document.createElement('span');
    count.className = 'voxel-item-slot__count';
    count.textContent = String(stack.count);
    node.append(count);
  }
  if (item?.durability && stack?.instance?.durability !== undefined) {
    const bar = document.createElement('span');
    bar.className = 'voxel-item-slot__durability';
    const value = document.createElement('span');
    const ratio = stack.instance.durability / item.durability;
    value.style.width = `${ratio * 100}%`;
    value.style.background = `hsl(${Math.round(ratio * 110)} 65% 55%)`;
    bar.append(value);
    node.append(bar);
  }
}
