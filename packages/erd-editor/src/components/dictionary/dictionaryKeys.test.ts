import { describe, expect, it, vi } from 'vite-plus/test';

import {
  type DictionaryKeyContext,
  handleDictionaryKeydown,
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

/** Hands a press to the tab's root and says whether it went on, and whether it was prevented. */
function handle(
  init: KeyboardEventInit,
  context: Partial<DictionaryKeyContext> = {}
) {
  const event = press(init);
  const stopped = vi.spyOn(event, 'stopPropagation');
  const sheet = { undo: vi.fn(), redo: vi.fn() };

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
