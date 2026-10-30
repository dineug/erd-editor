import { SLOT_BASE } from '@/engine/clock';

/** The version a clock stamps at the counter given, with the slot given. */
export const versionOf = (counter: number, slot: number): number =>
  counter * SLOT_BASE + slot;

/** The counter a version stands at, its slot dropped. */
export const counterOf = (version: number): number =>
  Math.floor(version / SLOT_BASE);
