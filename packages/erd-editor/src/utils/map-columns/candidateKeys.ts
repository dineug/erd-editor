import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { ColumnKey, getColumnKeys } from '@/utils/tableKeys';

import { sameSet } from './mapping';

/** The References choice that keeps a stored mapping no key of the parent covers. */
export const CURRENT_KEY_ID = 'current';

/** A key a mapping can reference, or the stored columns kept as they are. */
export type CandidateKey = {
  id: string;
  kind: ColumnKey['kind'] | 'current';
  columnIds: string[];
};

type KeyState = Pick<RootState, 'collections' | 'settings'>;

/**
 * The keys a foreign key can reference on the table: its primary key, in
 * column order, then each unique column; a unique column over the very columns
 * of a key before it is left out, so a primary key also marked unique is one.
 */
export function getCandidateKeys(
  state: KeyState,
  table: Table
): CandidateKey[] {
  const keys: CandidateKey[] = [];

  for (const { id, kind, columnIds } of getColumnKeys(state, table)) {
    if (keys.some(key => sameSet(key.columnIds, columnIds))) continue;
    keys.push({ id, kind, columnIds });
  }

  return keys;
}

/** The key the table's columns declare under the id, as they declare it now. */
export const findColumnKey = (
  state: KeyState,
  table: Table,
  keyId: string
): ColumnKey | undefined =>
  getColumnKeys(state, table).find(({ id }) => id === keyId);

/** The References choice of a stored mapping no key covers. */
export const toCurrentKey = (columnIds: string[]): CandidateKey => ({
  id: CURRENT_KEY_ID,
  kind: 'current',
  columnIds: [...columnIds],
});
