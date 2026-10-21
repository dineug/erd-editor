import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import type { RootState } from '@/engine/state';

/**
 * The switch that shows a store opened from the file in the name view its
 * reader is looking at, since the file holds the view its lock keeps. It
 * changes that store's screen alone, as a readonly reader's switch does.
 *
 * @example
 * store.dispatchSync(initialLoadJsonAction$(json), readerNameViewAction(store.state, reader));
 */
export const readerNameViewAction = (opened: RootState, reader: RootState) =>
  toNameViewModeAction(opened, reader.settings.nameViewMode, true);
