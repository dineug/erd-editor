import { query } from '@dineug/erd-editor-schema';

import {
  prefixKeyName,
  toNameKey,
} from '@/engine/modules/relationship/fkColumns';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { tableNamePart } from '@/utils/schema-sql/utils';

import { CandidateKey } from './candidateKeys';
import { ColumnPick, toPickedColumnIds } from './mapping';

/**
 * The names a child column may hold to reference the parent column, compared
 * without case: the name a new foreign key column would take, that name from
 * the table name without its schema, and for a unique key the column's own.
 */
export function toPrefillNames(
  tableName: string,
  columnName: string,
  bracketType: number,
  unique: boolean
): Set<string> {
  const names = [
    prefixKeyName(tableName, columnName),
    prefixKeyName(tableNamePart(tableName, bracketType), columnName),
  ];
  if (unique) names.push(columnName);

  return new Set(names.map(toNameKey).filter(Boolean));
}

export type PrefillInput = {
  parentTable: Table;
  childTable: Table;
  keyKind: CandidateKey['kind'];
  rows: Array<{ parentColumnId: string; pick: ColumnPick | null }>;
};

/**
 * Picks a child column for each empty row, in row order, where exactly one
 * column holds a name of toPrefillNames; never the parent column itself, nor
 * one a row holds or an earlier row was just given. Only the fills come back.
 */
export function prefillPicks(
  { collections, settings }: Pick<RootState, 'collections' | 'settings'>,
  { parentTable, childTable, keyKind, rows }: PrefillInput
): Record<string, ColumnPick> {
  const columns = query(collections).collection('tableColumnEntities');
  const childColumns = columns.selectByIds(childTable.columnIds);
  const taken = new Set(toPickedColumnIds(rows));
  const fills: Record<string, ColumnPick> = {};

  for (const { parentColumnId, pick } of rows) {
    const parent = columns.selectById(parentColumnId);
    if (pick || !parent) continue;

    const names = toPrefillNames(
      parentTable.name,
      parent.name,
      settings.bracketType,
      keyKind === 'unique'
    );
    const matches = childColumns.filter(
      ({ id, name }) =>
        id !== parent.id && !taken.has(id) && names.has(toNameKey(name))
    );
    if (matches.length !== 1) continue;

    const [{ id }] = matches;
    taken.add(id);
    fills[parentColumnId] = { kind: 'existing', columnId: id };
  }

  return fills;
}
