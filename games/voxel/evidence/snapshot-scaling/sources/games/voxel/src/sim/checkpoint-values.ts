import { inBounds, BOUNDS } from '../shared/protocol.ts';
import type { Cell } from '../shared/protocol.ts';
import type { ItemDefinition } from '../shared/content.ts';
import { copyStack, validStack } from '../shared/inventory.ts';
import type { Slot } from '../shared/inventory.ts';

/** Exact private snapshot objects; transport commands do not use these decoders. */
export function checkpointObject(
  value: unknown,
  fields: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}
export function checkpointInteger(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}
export function checkpointIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}
export function checkpointCell(value: unknown): value is Cell {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    Array.from(value).every(Number.isSafeInteger) &&
    inBounds(value[0], value[1], value[2])
  );
}
export function checkpointSlots(
  value: unknown,
  length: number,
  items: ReadonlyMap<string, ItemDefinition>,
): value is readonly Slot[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    Array.from(value).every((slot) => slot === null || validStack(slot, items))
  );
}
export function freezeStack(value: Slot): Slot {
  const copied = copyStack(value);
  if (!copied) return null;
  if (copied.instance) Object.freeze(copied.instance);
  return Object.freeze(copied);
}
export function freezeSlots(slots: readonly Slot[]): readonly Slot[] {
  return Object.freeze(slots.map(freezeStack));
}
export function checkpointVector(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    Array.from(value).every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
export function checkpointPosition(value: unknown): value is readonly [number, number, number] {
  return (
    checkpointVector(value) &&
    value[0] >= BOUNDS.minX &&
    value[0] < BOUNDS.maxX &&
    value[1] >= 0 &&
    value[1] < BOUNDS.height &&
    value[2] >= BOUNDS.minZ &&
    value[2] < BOUNDS.maxZ
  );
}
export function checkpointVelocity(value: unknown): value is readonly [number, number, number] {
  return checkpointVector(value) && value.every((n) => Math.abs(n) <= 12);
}
export function checkpointCounterId(
  value: unknown,
  prefix: string,
  counter: number,
): value is string {
  if (typeof value !== 'string' || !value.startsWith(`${prefix}-`)) return false;
  const suffix = value.slice(prefix.length + 1);
  return /^[1-9][0-9]*$/.test(suffix) && checkpointInteger(Number(suffix), 1, counter);
}
