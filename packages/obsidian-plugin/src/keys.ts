import type { Modifier } from 'obsidian';

/** A press as Obsidian's Scope.register takes it: the modifiers, and the key it compares with the event's. */
export type ScopeKey = { modifiers: Modifier[]; key: string };

/** The tinykeys modifiers Obsidian can name; $mod is Cmd on macOS and Ctrl elsewhere, as Mod is. */
const MODIFIERS: Readonly<Record<string, Modifier>> = {
  $mod: 'Mod',
  Alt: 'Alt',
  Control: 'Ctrl',
  Ctrl: 'Ctrl',
  Meta: 'Meta',
  Shift: 'Shift',
};

/** Codes Obsidian reads off the key code as the character they type. */
const CHARACTER_KEYS: Readonly<Record<string, string>> = {
  Space: ' ',
  Equal: '=',
  Minus: '-',
};

function toKey(code: string): string {
  const match = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (match) return match[1] ?? match[2];
  return CHARACTER_KEYS[code] ?? code;
}

/** One tinykeys press, $mod+KeyK say, as a scope key; null for no key or a modifier Obsidian cannot name. */
export function toScopeKey(press: string): ScopeKey | null {
  const names = press.split(/\b\+/);
  const code = names.pop();
  // An empty key would match every press with those modifiers.
  if (!code) return null;

  const modifiers: Modifier[] = [];
  for (const name of names) {
    const modifier = MODIFIERS[name];
    if (!modifier) return null;
    modifiers.push(modifier);
  }
  return { modifiers, key: toKey(code) };
}

/**
 * Every press a key binding map listens for, once each. A sequence gives each
 * of its presses, since every one of them has to reach the editor.
 */
export function scopeKeysOf(
  keyBindingMap: Readonly<Record<string, readonly { shortcut: string }[]>>
): ScopeKey[] {
  const keys = new Map<string, ScopeKey>();
  for (const options of Object.values(keyBindingMap)) {
    for (const { shortcut } of options) {
      for (const press of shortcut.trim().split(/\s+/)) {
        const key = toScopeKey(press);
        if (!key) continue;
        const id = [...[...key.modifiers].sort(), key.key].join('+');
        if (!keys.has(id)) keys.set(id, key);
      }
    }
  }
  return [...keys.values()];
}
