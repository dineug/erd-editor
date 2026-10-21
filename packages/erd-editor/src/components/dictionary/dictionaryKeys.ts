import {
  isComposing,
  type KeyBindingMap,
  KeyBindingName,
  matchesShortcut,
  type ShortcutOption,
  stopsAtPanel,
} from '@/utils/keyboard-shortcut';
import { isEditableTarget } from '@/utils/validation';

/**
 * The editor's chords a press in the Dictionary tab still hands on: the
 * palette, undo and redo, which the tab runs on the sheet's own history, and
 * find, whose chord works on every tab.
 */
export const DICTIONARY_PASSING_BINDINGS: ReadonlyArray<KeyBindingName> = [
  KeyBindingName.search,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.findReplace,
];

/**
 * The passing chords an open grid edit keeps, as a cell editor on the ERD tab
 * keeps them: the palette and find would take the focus or the tab, and with
 * them the text typed so far.
 */
const KEPT_BY_AN_EDIT: ReadonlyArray<KeyBindingName> = [
  KeyBindingName.search,
  KeyBindingName.findReplace,
];

/** The option of a chord an open edit keeps that a press matches, if any. */
const keptChord = (
  event: KeyboardEvent,
  keyBindingMap: KeyBindingMap
): ShortcutOption | undefined =>
  KEPT_BY_AN_EDIT.flatMap(name => keyBindingMap[name]).find(option =>
    matchesShortcut(event, [option])
  );

export type DictionaryKeyContext = {
  keyBindingMap: KeyBindingMap;
  /** Undoes the last edit of the sheet shown, from its own history. */
  undo: () => void;
  redo: () => void;
  /** Whether the press came from inside the tab's grid. */
  inGrid: boolean;
  /** Whether the grid holds an open edit, whose own undo takes the press and which keeps the palette and find. */
  isEditing: () => boolean;
};

/**
 * Reads a press at the tab's root: undo and redo undo the sheet shown, unless
 * an open edit or a field takes them, an open edit keeps the palette and find,
 * and any other stopsAtPanel names stops.
 */
export function handleDictionaryKeydown(
  event: KeyboardEvent,
  {
    keyBindingMap,
    undo: undoSheet,
    redo: redoSheet,
    inGrid,
    isEditing,
  }: DictionaryKeyContext
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

      undo ? undoSheet() : redoSheet();
      return;
    }

    // Prevented as the root would prevent it, so no host's own find opens.
    const kept = inGrid ? keptChord(event, keyBindingMap) : undefined;
    if (kept && isEditing()) {
      if (kept.preventDefault) event.preventDefault();
      event.stopPropagation();
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
