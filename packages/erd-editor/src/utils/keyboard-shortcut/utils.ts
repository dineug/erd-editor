import type { ValuesType } from '@/internal-types';
import { hasAppleDevice, hasWindows } from '@/utils/device-detect';

export type KeyBindingPress = [string[], string];

/** The modifiers that change what a press means; AltGraph is read through them. */
export const ModifierKey = {
  Shift: 'Shift',
  Meta: 'Meta',
  Alt: 'Alt',
  Control: 'Control',
} as const;
export type ModifierKey = ValuesType<typeof ModifierKey>;

const MODIFIER_KEYS: ReadonlyArray<string> = Object.values(ModifierKey);

export function parseKeybinding(str: string): KeyBindingPress[] {
  const MOD = hasAppleDevice() ? 'Meta' : 'Control';
  return str
    .trim()
    .split(' ')
    .map(press => {
      let mods = press.split(/\b\+/);
      const key = mods.pop() as string;
      mods = mods.map(mod => (mod === '$mod' ? MOD : mod));
      return [mods, key];
    });
}

/** What AltGraph holds: Control and Alt on Windows, Option on an Apple device. */
const altGraphAliases = (): string[] =>
  hasWindows() ? ['Control', 'Alt'] : hasAppleDevice() ? ['Alt'] : [];

/**
 * Whether the modifier is held, AltGraph counting as the ones it aliases. A
 * keydown Chrome sends for a function key may lack getModifierState, and then
 * holds nothing.
 */
export function isModifierHeld(event: KeyboardEvent, mod: string): boolean {
  if (typeof event.getModifierState !== 'function') return false;

  return (
    event.getModifierState(mod) ||
    (event.getModifierState('AltGraph') && altGraphAliases().includes(mod))
  );
}

/**
 * Whether the event is the press: the key by its value in any case or by its
 * code, every modifier the press names held, and no other modifier unless it
 * is the key itself.
 */
export function matchesPress(
  event: KeyboardEvent,
  [mods, key]: KeyBindingPress
): boolean {
  return (
    (key.toUpperCase() === event.key.toUpperCase() || key === event.code) &&
    mods.every(mod => isModifierHeld(event, mod)) &&
    !MODIFIER_KEYS.some(
      mod => !mods.includes(mod) && key !== mod && isModifierHeld(event, mod)
    )
  );
}
