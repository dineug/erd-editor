import type { ValuesType } from '@/internal-types';
import {
  isComposing,
  type KeyBindingMap,
  KeyBindingName,
  matchesShortcut,
  type ShortcutOption,
  shortcutToTuple,
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

/** What a press does to a sheet's rows in the grid. */
export const RowCommand = {
  insertBelow: 'insertBelow',
  insertAbove: 'insertAbove',
  deleteRows: 'deleteRows',
} as const;
export type RowCommand = ValuesType<typeof RowCommand>;

const RowCommandList = Object.values(RowCommand);

/**
 * The options of a column chord the grid runs: those of one press, since a key
 * matches a sequence by its last press alone, and the grid keeps no sequence.
 */
const onePressOptions = (
  keyBindingMap: KeyBindingMap,
  name: KeyBindingName
): ShortcutOption[] =>
  keyBindingMap[name].filter(
    ({ shortcut }) => shortcutToTuple(shortcut).length === 1
  );

/** A one-press option with Shift held as well, none for one that holds it already. */
function withShift({ shortcut, ...option }: ShortcutOption): ShortcutOption[] {
  const mods = shortcut.split(/\b\+/);
  const key = mods.pop() as string;
  return mods.includes('Shift')
    ? []
    : [{ ...option, shortcut: [...mods, 'Shift', key].join('+') }];
}

/**
 * The chords of a row command: Insert below and Delete on the column chords,
 * as the ERD tab adds and removes a table's columns by them, and Insert above
 * on the add chord with Shift held as well.
 */
function rowOptions(
  keyBindingMap: KeyBindingMap,
  command: RowCommand
): ShortcutOption[] {
  switch (command) {
    case RowCommand.insertBelow:
      return onePressOptions(keyBindingMap, KeyBindingName.addColumn);
    case RowCommand.insertAbove:
      return onePressOptions(keyBindingMap, KeyBindingName.addColumn).flatMap(
        withShift
      );
    case RowCommand.deleteRows:
      return onePressOptions(keyBindingMap, KeyBindingName.removeColumn);
  }
}

/** The chord a menu row shows for a row command, if one is bound. */
export const rowChordOf = (
  keyBindingMap: KeyBindingMap,
  command: RowCommand
): string | undefined => rowOptions(keyBindingMap, command)[0]?.shortcut;

/**
 * Every chord the grid runs a row command by under the bindings given, Insert
 * above's among them, which no binding names: what a host that keeps its own
 * hotkeys off the editor's keys registers beside the binding map's.
 */
export const dictionaryRowChords = (
  keyBindingMap: KeyBindingMap
): ShortcutOption[] =>
  RowCommandList.flatMap(command => rowOptions(keyBindingMap, command));

/** The row command a press runs in the grid, with the option it matched. */
function rowChord(
  event: KeyboardEvent,
  keyBindingMap: KeyBindingMap
): { command: RowCommand; option: ShortcutOption } | undefined {
  for (const command of RowCommandList) {
    const option = rowOptions(keyBindingMap, command).find(option =>
      matchesShortcut(event, [option])
    );
    if (option) return { command, option };
  }
  return undefined;
}

/** The option of one of the bindings named that a press matches, if any. */
const chordOf = (
  event: KeyboardEvent,
  keyBindingMap: KeyBindingMap,
  names: ReadonlyArray<KeyBindingName>
): ShortcutOption | undefined =>
  names
    .flatMap(name => keyBindingMap[name])
    .find(option => matchesShortcut(event, [option]));

export type DictionaryKeyContext = {
  keyBindingMap: KeyBindingMap;
  /** Undoes the last edit of the sheet shown, from its own history. */
  undo: () => void;
  redo: () => void;
  /** Whether the press came from inside the tab's grid. */
  inGrid: boolean;
  /** Whether the grid holds an open edit, whose own undo takes the press and which keeps the palette and find. */
  isEditing: () => boolean;
  /** Inserts as many rows below the selection as it covers. */
  insertRows: () => void;
  /** Inserts as many rows above the selection as it covers. */
  insertRowsAbove: () => void;
  /** Deletes the rows the selection covers. */
  deleteRows: () => void;
};

/**
 * Reads a press at the tab's root: undo and redo undo the sheet shown unless an
 * edit or a field takes them, the row chords insert and delete rows in a grid
 * with no edit open, which keeps find and the palette, and the rest stops.
 */
export function handleDictionaryKeydown(
  event: KeyboardEvent,
  {
    keyBindingMap,
    undo: undoSheet,
    redo: redoSheet,
    inGrid,
    isEditing,
    insertRows,
    insertRowsAbove,
    deleteRows,
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

    // An open edit keeps them as text keys: Alt+Backspace deletes a word.
    const row =
      inGrid && !isEditing() ? rowChord(event, keyBindingMap) : undefined;
    if (row) {
      if (row.option.preventDefault) event.preventDefault();
      event.stopPropagation();
      const run = {
        [RowCommand.insertBelow]: insertRows,
        [RowCommand.insertAbove]: insertRowsAbove,
        [RowCommand.deleteRows]: deleteRows,
      }[row.command];
      run();
      return;
    }

    // Prevented as the root would prevent it, so no host's own find opens.
    const kept = inGrid
      ? chordOf(event, keyBindingMap, KEPT_BY_AN_EDIT)
      : undefined;
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
