import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  GRID_KEYS,
  isApplePlatform,
  type KeyAction,
  keyAction,
  type KeyInput,
  selectionModifiers,
} from '@/model/keys';

const press = (key: string, init: Partial<KeyInput> = {}): KeyInput => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...init,
});

const PC = { apple: false };

const MAC = { apple: true };

const EDITING = { apple: false, editing: true };

/** Every way Shift, Ctrl, Meta and Alt can be held together, the empty one first. */
const MODIFIER_SETS: Partial<KeyInput>[] = Array.from(
  { length: 16 },
  (_, bits) => ({
    shiftKey: Boolean(bits & 1),
    ctrlKey: Boolean(bits & 2),
    metaKey: Boolean(bits & 4),
    altKey: Boolean(bits & 8),
  })
);

/** Keys a host binds or a textarea types, which the grid must never take. */
const HOST_KEYS = ['z', 's', 'c', 'v', 'x', 'y', 'f', ' ', '1', 'F1', 'F5'];

describe('the keys the grid takes while navigating', () => {
  it('reads a real keydown event', () => {
    expectTypeOf<KeyboardEvent>().toExtend<KeyInput>();
    expect(
      keyAction(
        new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }),
        PC
      )
    ).toEqual({
      type: 'move',
      key: 'ArrowDown',
      mods: { shift: true, ctrl: false },
    });
  });

  it('moves with the arrows, Home and End, reading Ctrl on a PC and Cmd on Apple as the edge', () => {
    for (const key of [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ]) {
      expect(keyAction(press(key), PC)).toEqual({
        type: 'move',
        key,
        mods: { shift: false, ctrl: false },
      });
      expect(keyAction(press(key, { ctrlKey: true }), PC)).toEqual({
        type: 'move',
        key,
        mods: { shift: false, ctrl: true },
      });
      expect(
        keyAction(press(key, { metaKey: true, shiftKey: true }), MAC)
      ).toEqual({ type: 'move', key, mods: { shift: true, ctrl: true } });
    }
  });

  it('leaves every key to the system when the other platform modifier or Alt is held', () => {
    for (const key of GRID_KEYS) {
      expect(keyAction(press(key, { ctrlKey: true }), MAC)).toBeNull();
      expect(keyAction(press(key, { metaKey: true }), PC)).toBeNull();
      expect(keyAction(press(key, { altKey: true }), PC)).toBeNull();
      expect(
        keyAction(press(key, { ctrlKey: true, altKey: true }), PC)
      ).toBeNull();
    }
  });

  it('pages and tabs with Shift as the way back, and leaves them to the browser under Ctrl', () => {
    for (const key of ['PageUp', 'PageDown', 'Tab']) {
      expect(keyAction(press(key, { shiftKey: true }), PC)).toEqual({
        type: 'move',
        key,
        mods: { shift: true, ctrl: false },
      });
      expect(keyAction(press(key, { ctrlKey: true }), PC)).toBeNull();
    }
  });

  it('opens the editor on Enter and F2, and moves up on Shift+Enter', () => {
    expect(keyAction(press('Enter'), PC)).toEqual({ type: 'edit' });
    expect(keyAction(press('F2'), MAC)).toEqual({ type: 'edit' });
    expect(keyAction(press('Enter', { shiftKey: true }), PC)).toEqual({
      type: 'move',
      key: 'Enter',
      mods: { shift: true, ctrl: false },
    });
    expect(keyAction(press('Enter', { ctrlKey: true }), PC)).toBeNull();
    expect(keyAction(press('F2', { shiftKey: true }), PC)).toBeNull();
    expect(keyAction(press('F2', { ctrlKey: true }), PC)).toBeNull();
  });

  it('clears on Delete and Backspace alone', () => {
    for (const key of ['Delete', 'Backspace']) {
      expect(keyAction(press(key), PC)).toEqual({ type: 'clear' });
      expect(keyAction(press(key, { shiftKey: true }), PC)).toBeNull();
      expect(keyAction(press(key, { metaKey: true }), MAC)).toBeNull();
    }
  });

  it('selects all on Ctrl+A or Cmd+A, and leaves a plain A to type', () => {
    const selectAll: KeyAction = {
      type: 'move',
      key: 'SelectAll',
      mods: { shift: false, ctrl: false },
    };

    expect(keyAction(press('a', { ctrlKey: true }), PC)).toEqual(selectAll);
    expect(keyAction(press('a', { metaKey: true }), MAC)).toEqual(selectAll);
    expect(keyAction(press('A', { ctrlKey: true }), PC)).toEqual(selectAll);
    expect(keyAction(press('a'), PC)).toBeNull();
    expect(
      keyAction(press('A', { ctrlKey: true, shiftKey: true }), PC)
    ).toBeNull();
  });

  it('finds the A key by its position on a layout of another script, and by its letter on a Latin one', () => {
    expect(
      keyAction(press('ф', { code: 'KeyA', ctrlKey: true }), PC)
    ).toMatchObject({ key: 'SelectAll' });
    expect(
      keyAction(press('q', { code: 'KeyA', ctrlKey: true }), PC)
    ).toBeNull();
    expect(
      keyAction(press('a', { code: 'KeyQ', ctrlKey: true }), PC)
    ).toMatchObject({ key: 'SelectAll' });
  });

  it('leaves Escape, a host shortcut and every typed key to the host', () => {
    expect(keyAction(press('Escape'), PC)).toBeNull();

    for (const key of HOST_KEYS) {
      expect(keyAction(press(key), PC)).toBeNull();
      expect(keyAction(press(key, { ctrlKey: true }), PC)).toBeNull();
      expect(keyAction(press(key, { metaKey: true }), MAC)).toBeNull();
    }
  });
});

describe('the keys the grid takes while the editor is open', () => {
  it('commits on Enter and Tab, carrying the move the key makes afterwards', () => {
    expect(keyAction(press('Enter'), EDITING)).toEqual({
      type: 'commit',
      key: 'Enter',
      mods: { shift: false, ctrl: false },
    });
    expect(keyAction(press('Enter', { shiftKey: true }), EDITING)).toEqual({
      type: 'commit',
      key: 'Enter',
      mods: { shift: true, ctrl: false },
    });
    expect(keyAction(press('Tab', { shiftKey: true }), EDITING)).toEqual({
      type: 'commit',
      key: 'Tab',
      mods: { shift: true, ctrl: false },
    });
  });

  it('cancels on Escape', () => {
    expect(keyAction(press('Escape'), EDITING)).toEqual({ type: 'cancel' });
    expect(keyAction(press('Escape', { shiftKey: true }), EDITING)).toEqual({
      type: 'cancel',
    });
  });

  it('leaves the caret keys, select-all and a modified Enter to the textarea', () => {
    for (const key of [
      'ArrowUp',
      'ArrowLeft',
      'Home',
      'End',
      'PageDown',
      'Delete',
      'Backspace',
      'F2',
    ]) {
      expect(keyAction(press(key), EDITING)).toBeNull();
    }

    expect(keyAction(press('a', { ctrlKey: true }), EDITING)).toBeNull();
    expect(keyAction(press('Enter', { ctrlKey: true }), EDITING)).toBeNull();
    expect(
      keyAction(press('Enter', { metaKey: true }), { ...EDITING, apple: true })
    ).toBeNull();
  });
});

describe('a key an input method is composing', () => {
  it('belongs to the input method in either mode, by the flag or by key code 229', () => {
    for (const options of [PC, EDITING]) {
      expect(
        keyAction(press('Enter', { isComposing: true }), options)
      ).toBeNull();
      expect(keyAction(press('Enter', { keyCode: 229 }), options)).toBeNull();
      expect(
        keyAction(press('ArrowDown', { isComposing: true }), options)
      ).toBeNull();
    }

    expect(keyAction(press('Enter', { keyCode: 13 }), PC)).toEqual({
      type: 'edit',
    });
  });
});

describe('the list of keys the grid consumes', () => {
  /** Every action any modifier set, platform and mode yields for the key. */
  const actionsOf = (key: string, code?: string) =>
    MODIFIER_SETS.flatMap(mods =>
      [PC, MAC, EDITING, { apple: true, editing: true }].map(options =>
        keyAction(press(key, { ...mods, code }), options)
      )
    ).filter(action => action !== null);

  it('names every key that maps to an action', () => {
    for (const key of GRID_KEYS) {
      expect(actionsOf(key), key).not.toHaveLength(0);
    }
  });

  it('names no key that maps to nothing, under any modifier', () => {
    for (const key of [...HOST_KEYS, 'Esc', 'Insert', 'Shift', 'Control']) {
      expect(actionsOf(key, 'KeyZ'), key).toEqual([]);
    }
  });

  it('is fixed, so a caller cannot widen what the grid swallows', () => {
    expect(Object.isFrozen(GRID_KEYS)).toBe(true);
  });
});

describe('the platform and the selection modifiers', () => {
  it('reads macOS and iOS as Apple, and nothing else', () => {
    for (const platform of ['MacIntel', 'iPhone', 'iPad', 'iPod touch']) {
      expect(isApplePlatform(platform)).toBe(true);
    }

    for (const platform of ['Win32', 'Linux x86_64', '']) {
      expect(isApplePlatform(platform)).toBe(false);
    }
  });

  it('reads Cmd on Apple and Ctrl elsewhere off a pointer event too', () => {
    const cmdClick = new MouseEvent('pointerdown', { metaKey: true });
    const ctrlClick = new MouseEvent('pointerdown', {
      ctrlKey: true,
      shiftKey: true,
    });

    expect(selectionModifiers(cmdClick, true)).toEqual({
      shift: false,
      ctrl: true,
    });
    expect(selectionModifiers(cmdClick, false)).toEqual({
      shift: false,
      ctrl: false,
    });
    expect(selectionModifiers(ctrlClick, false)).toEqual({
      shift: true,
      ctrl: true,
    });
    expect(selectionModifiers(ctrlClick, true)).toEqual({
      shift: true,
      ctrl: false,
    });
  });
});
