import type { KeyBindingMap } from '@dineug/erd-editor';
import { describe, expect, it, vi } from 'vite-plus/test';

import { editorScopeKeys, scopeKeysOf, toScopeKey } from '@/keys';

const bindings = (...shortcuts: string[]) => ({
  name: shortcuts.map(shortcut => ({ shortcut })),
});

describe('toScopeKey', () => {
  it.each([
    ['$mod+KeyK', ['Mod'], 'K'],
    ['$mod+KeyF', ['Mod'], 'F'],
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

describe('editorScopeKeys', () => {
  /** A loaded module's map, cut to the column chords the Dictionary tab's rows follow. */
  const keyBindingMap = {
    addColumn: [{ shortcut: 'Alt+Enter' }],
    removeColumn: [{ shortcut: 'Alt+Backspace' }],
  } as unknown as KeyBindingMap;

  it("registers the row chords the map derives, Insert above's among them, beside the map's own presses", () => {
    const dictionaryRowChords = vi.fn(() => [
      { shortcut: 'Alt+Enter' },
      { shortcut: 'Alt+Shift+Enter' },
      { shortcut: 'Alt+Backspace' },
    ]);

    const keys = editorScopeKeys({
      createKeyBindingMap: () => keyBindingMap,
      dictionaryRowChords,
    });

    expect(dictionaryRowChords).toHaveBeenCalledWith(keyBindingMap);
    expect(keys).toEqual([
      { modifiers: ['Alt'], key: 'Enter' },
      { modifiers: ['Alt'], key: 'Backspace' },
      { modifiers: ['Alt', 'Shift'], key: 'Enter' },
    ]);
  });

  it('registers the map alone from a module with no row chords, and nothing from one with no map', () => {
    expect(
      editorScopeKeys({ createKeyBindingMap: () => keyBindingMap })
    ).toEqual([
      { modifiers: ['Alt'], key: 'Enter' },
      { modifiers: ['Alt'], key: 'Backspace' },
    ]);
    expect(editorScopeKeys({ dictionaryRowChords: vi.fn(() => []) })).toEqual(
      []
    );
  });
});
