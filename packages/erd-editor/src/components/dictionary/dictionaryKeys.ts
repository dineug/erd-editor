import type { RxStore } from '@/engine/rx-store';
import {
  isComposing,
  type KeyBindingMap,
  KeyBindingName,
  matchesShortcut,
  stopsAtPanel,
} from '@/utils/keyboard-shortcut';
import { isEditableTarget } from '@/utils/validation';

/**
 * The editor's chords a press in the Dictionary tab still hands on: the
 * palette, the document's undo and redo, and find, whose chord works on
 * every tab.
 */
export const DICTIONARY_PASSING_BINDINGS: ReadonlyArray<KeyBindingName> = [
  KeyBindingName.search,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.findReplace,
];

export type DictionaryKeyContext = {
  keyBindingMap: KeyBindingMap;
  store: Pick<RxStore, 'undo' | 'redo'>;
  /** Whether the press came from inside the tab's grid. */
  inGrid: boolean;
  /** Whether the grid holds an open edit, whose own undo takes the press. */
  isEditing: () => boolean;
};

/**
 * Reads a press at the tab's root: undo and redo undo the document, which the
 * root does on the ERD tab alone, unless an open edit or a field takes them for
 * its text; any other press stopsAtPanel names stops here, unprevented.
 */
export function handleDictionaryKeydown(
  event: KeyboardEvent,
  { keyBindingMap, store, inGrid, isEditing }: DictionaryKeyContext
) {
  if (!isComposing(event)) {
    const undo = matchesShortcut(event, keyBindingMap[KeyBindingName.undo]);
    const redo =
      !undo && matchesShortcut(event, keyBindingMap[KeyBindingName.redo]);

    if (undo || redo) {
      const ownText = inGrid ? isEditing() : isEditableTarget(event.target);
      if (ownText) {
        event.stopPropagation();
        return;
      }

      undo ? store.undo() : store.redo();
      return;
    }
  }

  if (stopsAtPanel(event, keyBindingMap, DICTIONARY_PASSING_BINDINGS)) {
    event.stopPropagation();
  }
}

/** Keeps a copy, a cut or a paste in the tab, which the editor root would read as a diagram's. */
export const keepClipboard = (event: ClipboardEvent) => {
  event.stopPropagation();
};
