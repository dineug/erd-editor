import { describe, expect, it } from 'vite-plus/test';

import { scopeKeysOf, toScopeKey } from '@/keys';

const bindings = (...shortcuts: string[]) => ({
  name: shortcuts.map(shortcut => ({ shortcut })),
});

describe('toScopeKey', () => {
  it.each([
    ['$mod+KeyK', ['Mod'], 'K'],
    ['Alt+Enter', ['Alt'], 'Enter'],
    ['$mod+Shift+KeyZ', ['Mod', 'Shift'], 'Z'],
    ['$mod+Alt+Digit1', ['Mod', 'Alt'], '1'],
    ['$mod+Digit0', ['Mod'], '0'],
    ['Alt+Space', ['Alt'], ' '],
    ['Space', [], ' '],
    ['$mod+Equal', ['Mod'], '='],
    ['$mod+Minus', ['Mod'], '-'],
    ['Alt+Backspace', ['Alt'], 'Backspace'],
    ['$mod+Delete', ['Mod'], 'Delete'],
    ['Escape', [], 'Escape'],
    ['Control+KeyC', ['Ctrl'], 'C'],
    ['Ctrl+KeyC', ['Ctrl'], 'C'],
    ['Meta+ArrowUp', ['Meta'], 'ArrowUp'],
    ['Shift++', ['Shift'], '+'],
  ])(
    'reads %s as the modifiers and the key Obsidian matches',
    (press, modifiers, key) => {
      expect(toScopeKey(press)).toEqual({ modifiers, key });
    }
  );

  it('leaves a press with no key or a modifier Obsidian cannot name', () => {
    expect(toScopeKey('')).toBeNull();
    expect(toScopeKey('AltGraph+KeyQ')).toBeNull();
  });
});

describe('scopeKeysOf', () => {
  it('lists every press of the map once', () => {
    const keys = scopeKeysOf({
      search: [{ shortcut: '$mod+KeyK' }],
      removeTable: [
        { shortcut: '$mod+Backspace' },
        { shortcut: '$mod+Delete' },
      ],
      again: [{ shortcut: '$mod+KeyK' }],
      reordered: [{ shortcut: 'Alt+$mod+KeyA' }, { shortcut: '$mod+Alt+KeyA' }],
    });

    expect(keys).toEqual([
      { modifiers: ['Mod'], key: 'K' },
      { modifiers: ['Mod'], key: 'Backspace' },
      { modifiers: ['Mod'], key: 'Delete' },
      { modifiers: ['Alt', 'Mod'], key: 'A' },
    ]);
  });

  it('gives each press of a sequence and skips what it cannot register', () => {
    expect(
      scopeKeysOf(bindings(' $mod+KeyG  KeyI ', '', 'AltGraph+KeyQ'))
    ).toEqual([
      { modifiers: ['Mod'], key: 'G' },
      { modifiers: [], key: 'I' },
    ]);
  });
});
