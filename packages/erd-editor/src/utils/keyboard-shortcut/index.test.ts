import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createKeyBindingMap,
  isMod,
  KeyBindingName,
  KeyBindingNameList,
  shortcutToTuple,
  simpleShortcutToString,
} from '@/utils/keyboard-shortcut';

const device = vi.hoisted(() => ({ apple: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
}));

describe('keyboard-shortcut', () => {
  beforeEach(() => {
    device.apple = false;
  });

  describe('KeyBindingName', () => {
    it('exposes every name as its own value', () => {
      for (const [key, value] of Object.entries(KeyBindingName)) {
        expect(value).toBe(key);
      }
    });

    it('lists all 20 binding names', () => {
      expect(KeyBindingNameList).toHaveLength(20);
      expect(KeyBindingNameList).toEqual(Object.values(KeyBindingName));
      expect(KeyBindingNameList).toContain('zoomOut');
    });
  });

  describe('createKeyBindingMap', () => {
    it('returns a fresh object for every call', () => {
      const a = createKeyBindingMap();
      const b = createKeyBindingMap();

      expect(a).not.toBe(b);
      expect(a).toEqual(b);
      expect(a.edit).not.toBe(b.edit);
    });

    it('covers every binding name with at least one shortcut', () => {
      const map = createKeyBindingMap();

      expect(Object.keys(map).sort()).toEqual([...KeyBindingNameList].sort());
      for (const name of KeyBindingNameList) {
        expect(map[name].length).toBeGreaterThan(0);
        for (const option of map[name]) {
          expect(typeof option.shortcut).toBe('string');
        }
      }
    });

    it('uses plain keys without flags for edit and stop', () => {
      const map = createKeyBindingMap();

      expect(map.edit).toEqual([{ shortcut: 'Enter' }]);
      expect(map.stop).toEqual([{ shortcut: 'Escape' }]);
    });

    it('marks $mod shortcuts that must swallow the browser default', () => {
      const map = createKeyBindingMap();

      expect(map.search).toEqual([
        { shortcut: '$mod+KeyK', preventDefault: true, stopPropagation: true },
      ]);
      expect(map.undo).toEqual([
        { shortcut: '$mod+KeyZ', preventDefault: true, stopPropagation: true },
      ]);
      expect(map.redo).toEqual([
        {
          shortcut: '$mod+Shift+KeyZ',
          preventDefault: true,
          stopPropagation: true,
        },
      ]);
      expect(map.zoomIn).toEqual([
        { shortcut: '$mod+Equal', preventDefault: true, stopPropagation: true },
      ]);
      expect(map.zoomOut).toEqual([
        { shortcut: '$mod+Minus', preventDefault: true, stopPropagation: true },
      ]);
    });

    it('binds both Backspace and Delete for the remove actions', () => {
      const map = createKeyBindingMap();

      expect(map.removeTable.map(option => option.shortcut)).toEqual([
        '$mod+Backspace',
        '$mod+Delete',
      ]);
      expect(map.removeColumn.map(option => option.shortcut)).toEqual([
        'Alt+Backspace',
        'Alt+Delete',
      ]);
    });

    it('binds the four relationship types to $mod+Alt+Digit1..4', () => {
      const map = createKeyBindingMap();

      expect([
        map.relationshipZeroOne[0].shortcut,
        map.relationshipZeroN[0].shortcut,
        map.relationshipOneOnly[0].shortcut,
        map.relationshipOneN[0].shortcut,
      ]).toEqual([
        '$mod+Alt+Digit1',
        '$mod+Alt+Digit2',
        '$mod+Alt+Digit3',
        '$mod+Alt+Digit4',
      ]);
    });
  });

  describe('shortcutToTuple', () => {
    it('returns an empty list for undefined', () => {
      expect(shortcutToTuple()).toEqual([]);
    });

    it('returns an empty list for an empty string', () => {
      expect(shortcutToTuple('')).toEqual([]);
    });

    it('renders windows modifier labels on non-apple devices', () => {
      expect(shortcutToTuple('$mod+KeyK')).toEqual([[['Ctrl'], 'K']]);
      expect(shortcutToTuple('Shift+Alt+Meta+KeyA')).toEqual([
        [['Shift', 'Alt', 'Cmd'], 'A'],
      ]);
    });

    it('renders mac symbols on apple devices', () => {
      device.apple = true;

      expect(shortcutToTuple('$mod+KeyK')).toEqual([[['⌘'], 'K']]);
      expect(shortcutToTuple('Shift+Alt+Control+KeyA')).toEqual([
        [['⇧', '⌥', '⌃'], 'A'],
      ]);
    });

    it('passes an unknown modifier through unchanged', () => {
      expect(shortcutToTuple('Hyper+KeyA')).toEqual([[['Hyper'], 'A']]);
    });

    it('strips the Key prefix', () => {
      expect(shortcutToTuple('KeyN')).toEqual([[[], 'N']]);
    });

    it('strips the Digit prefix', () => {
      expect(shortcutToTuple('Digit1')).toEqual([[[], '1']]);
    });

    it('maps Backspace to the erase symbol', () => {
      expect(shortcutToTuple('Backspace')).toEqual([[[], '⌫']]);
    });

    it('maps Escape to ESC', () => {
      expect(shortcutToTuple('Escape')).toEqual([[[], 'ESC']]);
    });

    it('maps Equal to Plus', () => {
      expect(shortcutToTuple('Equal')).toEqual([[[], 'Plus']]);
    });

    it('leaves any other code untouched', () => {
      expect(shortcutToTuple('Enter')).toEqual([[[], 'Enter']]);
      expect(shortcutToTuple('Minus')).toEqual([[[], 'Minus']]);
      expect(shortcutToTuple('Space')).toEqual([[[], 'Space']]);
      expect(shortcutToTuple('Delete')).toEqual([[[], 'Delete']]);
    });

    it('maps every press of a sequence', () => {
      expect(shortcutToTuple('$mod+KeyK Digit2')).toEqual([
        [['Ctrl'], 'K'],
        [[], '2'],
      ]);
    });
  });

  describe('isMod', () => {
    it('reads ctrlKey on non-apple devices', () => {
      expect(isMod(new KeyboardEvent('keydown', { ctrlKey: true }))).toBe(true);
      expect(isMod(new KeyboardEvent('keydown', { metaKey: true }))).toBe(
        false
      );
    });

    it('reads metaKey on apple devices', () => {
      device.apple = true;

      expect(isMod(new KeyboardEvent('keydown', { metaKey: true }))).toBe(true);
      expect(isMod(new KeyboardEvent('keydown', { ctrlKey: true }))).toBe(
        false
      );
    });

    it('works with mouse events too', () => {
      expect(isMod(new MouseEvent('click', { ctrlKey: true }))).toBe(true);
      expect(isMod(new MouseEvent('click'))).toBe(false);
    });
  });

  describe('simpleShortcutToString', () => {
    it('returns an empty string when there is no shortcut', () => {
      expect(simpleShortcutToString()).toBe('');
      expect(simpleShortcutToString('')).toBe('');
    });

    it('joins modifiers and key with " + "', () => {
      expect(simpleShortcutToString('$mod+Shift+KeyZ')).toBe(
        'Ctrl + Shift + Z'
      );
      expect(simpleShortcutToString('Alt+Space')).toBe('Alt + Space');
    });

    it('renders a bare key without separators', () => {
      expect(simpleShortcutToString('Enter')).toBe('Enter');
    });

    it('joins a sequence with a single space', () => {
      expect(simpleShortcutToString('$mod+KeyK KeyA')).toBe('Ctrl + K A');
    });

    it('renders mac symbols on apple devices', () => {
      device.apple = true;

      expect(simpleShortcutToString('$mod+Alt+Digit1')).toBe('⌘ + ⌥ + 1');
    });
  });
});
