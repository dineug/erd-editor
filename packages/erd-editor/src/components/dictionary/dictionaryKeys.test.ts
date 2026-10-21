import { describe, expect, it, vi } from 'vite-plus/test';

import {
  type DictionaryKeyContext,
  handleDictionaryKeydown,
  rowChordOf,
} from '@/components/dictionary/dictionaryKeys';
import { createKeyBindingMap, KeyBindingName } from '@/utils/keyboard-shortcut';

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => false,
  hasWindows: () => false,
}));

const press = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

const FIND = { key: 'f', code: 'KeyF', ctrlKey: true };
const PALETTE = { key: 'k', code: 'KeyK', ctrlKey: true };
const UNDO = { key: 'z', code: 'KeyZ', ctrlKey: true };
const REDO = { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true };
const INSERT = { key: 'Enter', code: 'Enter', altKey: true };
const DELETE = { key: 'Delete', code: 'Delete', altKey: true };
const BACKSPACE = { key: 'Backspace', code: 'Backspace', altKey: true };

/** Hands a press to the tab's root and says whether it went on, and whether it was prevented. */
function handle(
  init: KeyboardEventInit,
  context: Partial<DictionaryKeyContext> = {}
) {
  const event = press(init);
  const stopped = vi.spyOn(event, 'stopPropagation');
  const sheet = {
    undo: vi.fn(),
    redo: vi.fn(),
    insertRows: vi.fn(),
    deleteRows: vi.fn(),
  };

  handleDictionaryKeydown(event, {
    keyBindingMap: createKeyBindingMap(),
    ...sheet,
    inGrid: true,
    isEditing: () => false,
    ...context,
  });
  return {
    passed: stopped.mock.calls.length === 0,
    prevented: event.defaultPrevented,
    sheet,
  };
}

describe('handleDictionaryKeydown', () => {
  it('hands the palette and find on while no edit is open, unprevented', () => {
    expect(handle(FIND)).toMatchObject({ passed: true, prevented: false });
    expect(handle(PALETTE)).toMatchObject({ passed: true, prevented: false });
  });

  it('keeps the palette and find for an open edit, prevented as the option says', () => {
    const editing = { isEditing: () => true };
    expect(handle(FIND, editing)).toMatchObject({
      passed: false,
      prevented: true,
    });
    expect(handle(PALETTE, editing)).toMatchObject({
      passed: false,
      prevented: true,
    });

    const keyBindingMap = createKeyBindingMap();
    keyBindingMap[KeyBindingName.findReplace] = [{ shortcut: '$mod+KeyF' }];
    expect(handle(FIND, { ...editing, keyBindingMap })).toMatchObject({
      passed: false,
      prevented: false,
    });
  });

  it('hands find on from the search field, whose text is kept as it is typed', () => {
    expect(
      handle(FIND, { inGrid: false, isEditing: () => true })
    ).toMatchObject({ passed: true, prevented: false });
  });

  it("runs undo and redo on the sheet's own history unless an open edit takes them", () => {
    const undone = handle(UNDO);
    expect(undone.passed).toBe(true);
    expect(undone.sheet.undo).toHaveBeenCalledTimes(1);

    const redone = handle(REDO);
    expect(redone.passed).toBe(true);
    expect(redone.sheet.redo).toHaveBeenCalledTimes(1);

    const kept = handle(REDO, { isEditing: () => true });
    expect(kept.passed).toBe(false);
    expect(kept.sheet.redo).not.toHaveBeenCalled();
  });

  it("inserts and deletes rows by the column chords in the grid, prevented and stopped as the ERD tab's", () => {
    const inserted = handle(INSERT);
    expect(inserted).toMatchObject({ passed: false, prevented: true });
    expect(inserted.sheet.insertRows).toHaveBeenCalledTimes(1);
    expect(inserted.sheet.deleteRows).not.toHaveBeenCalled();

    for (const chord of [DELETE, BACKSPACE]) {
      const deleted = handle(chord);
      expect(deleted).toMatchObject({ passed: false, prevented: true });
      expect(deleted.sheet.deleteRows).toHaveBeenCalledTimes(1);
      expect(deleted.sheet.insertRows).not.toHaveBeenCalled();
    }
  });

  it('reads the rows by the bindings the editor holds, so a rebound column chord moves them too', () => {
    const keyBindingMap = createKeyBindingMap();
    keyBindingMap[KeyBindingName.addColumn] = [{ shortcut: 'Alt+KeyR' }];

    const rebound = handle(
      { key: 'r', code: 'KeyR', altKey: true },
      { keyBindingMap }
    );
    expect(rebound).toMatchObject({ passed: false, prevented: false });
    expect(rebound.sheet.insertRows).toHaveBeenCalledTimes(1);

    const old = handle(INSERT, { keyBindingMap });
    expect(old.sheet.insertRows).not.toHaveBeenCalled();
  });

  it('runs no sequence a column chord is rebound to, whose last press alone would match a letter typed into a cell', () => {
    const keyBindingMap = createKeyBindingMap();
    keyBindingMap[KeyBindingName.addColumn] = [
      { shortcut: 'KeyC KeyA', preventDefault: true },
    ];
    keyBindingMap[KeyBindingName.removeColumn] = [
      { shortcut: '$mod+KeyE KeyD', preventDefault: true },
    ];

    for (const letter of ['a', 'd']) {
      const typed = handle(
        { key: letter, code: `Key${letter.toUpperCase()}` },
        { keyBindingMap }
      );
      expect(typed.prevented).toBe(false);
      expect(typed.sheet.insertRows).not.toHaveBeenCalled();
      expect(typed.sheet.deleteRows).not.toHaveBeenCalled();
    }
    expect(rowChordOf(keyBindingMap, KeyBindingName.addColumn)).toBeUndefined();
    expect(rowChordOf(createKeyBindingMap(), KeyBindingName.removeColumn)).toBe(
      'Alt+Backspace'
    );
  });

  it('leaves the column chords to an open edit and the search field, as text keys, and stops them', () => {
    for (const context of [
      { isEditing: () => true },
      { inGrid: false, isEditing: () => false },
    ]) {
      for (const chord of [INSERT, BACKSPACE]) {
        const kept = handle(chord, context);
        expect(kept).toMatchObject({ passed: false, prevented: false });
        expect(kept.sheet.insertRows).not.toHaveBeenCalled();
        expect(kept.sheet.deleteRows).not.toHaveBeenCalled();
      }
    }
  });

  it('inserts nothing for a press an input method is composing', () => {
    const composing = handle({ ...INSERT, isComposing: true });
    expect(composing.passed).toBe(false);
    expect(composing.sheet.insertRows).not.toHaveBeenCalled();
  });

  it('stops the other chords and the moving keys, unprevented', () => {
    expect(handle({ key: 'n', code: 'KeyN', altKey: true })).toMatchObject({
      passed: false,
      prevented: false,
    });
    expect(handle({ key: 'ArrowDown', code: 'ArrowDown' })).toMatchObject({
      passed: false,
      prevented: false,
    });
    expect(handle({ key: 'a', code: 'KeyA' })).toMatchObject({
      passed: true,
    });
  });
});
