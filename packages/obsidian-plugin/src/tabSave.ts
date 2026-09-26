/** Where a tab stands, which decides what it hands Obsidian to save. */
export type TabSaveState = {
  /** The file is no diagram the editor can read; the tab shows it read-only. */
  unreadable: boolean;
  /** Opened beside other tabs of the file, it waits to load until their replicas saved. */
  seeding: boolean;
  /** The first tab of the file, the one that writes it. */
  writer: boolean;
  /** The text the tab loaded. */
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

/** A value a save would write that the file does not hold yet, which the quit task writes. */
export function hasUnsavedValue(state: TabSaveState): boolean {
  return (
    !state.unreadable &&
    state.writer &&
    state.saved !== null &&
    viewData(state) !== state.saved
  );
}

/**
 * The text a tab opened beside others loads once its wait ends: another tab's
 * replica value, else what the file's last writer handed Obsidian (none after an
 * outside change), which can be newer than the text Obsidian last gave this tab.
 */
export function seedValue(sources: {
  peer: string | undefined;
  handed: string | undefined;
  file: string | null;
  opened: string;
}): string {
  return sources.peer ?? sources.handed ?? sources.file ?? sources.opened;
}
