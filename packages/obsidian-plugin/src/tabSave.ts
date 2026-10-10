import { stripBom } from '@dineug/erd-editor-agent-hub-host';

/** Where a tab stands, which decides what it hands Obsidian to save. */
export type TabSaveState = {
  /** The file is no diagram the editor can read; the tab shows it read-only. */
  unreadable: boolean;
  /** Opened beside other tabs of the file, it waits to load until their replicas saved. */
  seeding: boolean;
  /** The first tab of the file, the one that writes it. */
  writer: boolean;
  /** The text the tab loaded, in the form a file holds, never a runtime value its editor started from. */
  loaded: string;
  /** The document as the tab's replica last serialized it. */
  replica: string | null;
  /** What the file held when the tab last loaded or saved it, which Obsidian keeps in step. */
  saved: string | null;
};

/**
 * The document the tab holds, which a save of the writer writes. A tab still
 * waiting to load holds what the file holds: its own text is from when it
 * opened, older than a write another tab made while it waited.
 */
export function currentValue(state: TabSaveState): string {
  if (state.seeding) return state.saved ?? state.loaded;
  return state.replica ?? state.loaded;
}

/**
 * What getViewData hands back. Obsidian writes it when it differs from saved,
 * so a tab that is not the writer, or still waits to load, hands back what the
 * file holds; an unreadable file hands back its own text.
 */
export function viewData(state: TabSaveState): string {
  if (state.unreadable) return state.loaded;
  if (state.seeding || !state.writer) return state.saved ?? state.loaded;
  return currentValue(state);
}

/** A value a save would write that the file does not hold yet, which a quit or a page hide writes. */
export function hasUnsavedValue(state: TabSaveState): boolean {
  return (
    !state.unreadable &&
    state.writer &&
    state.saved !== null &&
    viewData(state) !== state.saved
  );
}

/** What a tab does with its unsaved value as the window goes: write it now, leave it to a quit task, or neither. */
export type ExitSave = 'none' | 'write' | 'defer' | 'conflict';

/**
 * A write goes only where the file still holds what the tab last loaded or
 * saved: a write under way would interleave with it, and an outside change the
 * watcher has not delivered yet wins, as it does while the window is open.
 */
export function exitSave(
  state: TabSaveState,
  saving: boolean,
  readFile: () => string | null
): ExitSave {
  if (!hasUnsavedValue(state)) return 'none';
  if (saving) return 'defer';
  const onDisk = readFile();
  if (onDisk === null) return 'defer';
  // Obsidian drops a leading byte order mark as it reads a file, so saved has none.
  return stripBom(onDisk) === state.saved ? 'write' : 'conflict';
}

/**
 * What a tab opened beside others keeps as loaded once its wait ends: another
 * tab's replica value, else what the file's last writer handed Obsidian (none
 * after an outside change), which can be newer than what Obsidian gave the tab.
 */
export function seedValue(sources: {
  /** What the file's tabs last saved as their replicas hold it, which keeps removed entities for an undo. */
  runtimeValue: string | null;
  peer: string | undefined;
  handed: string | undefined;
  file: string | null;
  opened: string;
}): {
  /** The text the tab keeps as loaded and hands back, in the form a file holds. */
  loaded: string;
  /** What the editor and its replica start from: the runtime value, else the loaded text. */
  initialValue: string;
} {
  const loaded =
    sources.peer ?? sources.handed ?? sources.file ?? sources.opened;
  return { loaded, initialValue: sources.runtimeValue ?? loaded };
}
