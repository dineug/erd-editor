import { observable } from '@dineug/r-html';

import { ActionType } from '@/engine/modules/dictionary/actions';
import {
  checkColumn,
  checkTable,
  type DictionaryCheckField,
  DictionaryCheckLevel,
  markOf,
} from '@/engine/modules/dictionary/checks';
import type { RxStore } from '@/engine/rx-store';
import type { Column, Table } from '@/internal-types';
import type { Theme } from '@/themes/tokens';

type Writes = { count: number };

const DICTIONARY_WRITES: ReadonlySet<string> = new Set(
  Object.values(ActionType)
);

const writesByStore = new WeakMap<RxStore, Writes>();

/**
 * Registers the render in hand on the store's dictionary writes. A row edited
 * in place keeps its sheet's list and its length, all a cached index reads, so
 * this count is what redraws a cell marked by a word renamed or a term changed.
 */
function observeDictionaryWrites(store: RxStore): number {
  let writes = writesByStore.get(store);

  if (!writes) {
    const held = observable({ count: 0 });
    // One subscription per store, which leaves with it, rather than one per
    // cell: a drag sends a batch a frame and every table would hear each one.
    store.subscribe(actions => {
      if (actions.some(({ type }) => DICTIONARY_WRITES.has(type))) {
        held.count += 1;
      }
    });
    writesByStore.set(store, held);
    writes = held;
  }

  return writes.count;
}

/** The colour a check level writes a cell's text in: red for an error, amber for a warning. */
export const dictionaryMarkFill = (
  theme: Theme,
  level: DictionaryCheckLevel | null
): string | null => {
  if (level === DictionaryCheckLevel.error) {
    return theme.dictionaryErrorForeground;
  }
  if (level === DictionaryCheckLevel.warning) {
    return theme.dictionaryWarningForeground;
  }
  return null;
};

/**
 * The colour a header cell's text takes for what the checks find in the field
 * it draws, null for nothing found. Empty dictionaries find nothing.
 *
 * @example
 * const fill = tableMarkFill(store, theme, table, 'logicalName');
 */
export function tableMarkFill(
  store: RxStore,
  theme: Theme,
  table: Table,
  field: DictionaryCheckField
): string | null {
  observeDictionaryWrites(store);
  return dictionaryMarkFill(
    theme,
    markOf(checkTable(store.state, table, field))
  );
}

/**
 * The colour a row cell's text takes for what the checks find in the field it
 * draws, null for nothing found, as a header cell's is.
 *
 * @example
 * const fill = columnMarkFill(store, theme, column, 'name');
 */
export function columnMarkFill(
  store: RxStore,
  theme: Theme,
  column: Column,
  field: DictionaryCheckField
): string | null {
  observeDictionaryWrites(store);
  return dictionaryMarkFill(
    theme,
    markOf(checkColumn(store.state, column, field))
  );
}
