import { AnyAction } from '@dineug/r-html';

import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import { Column } from '@/internal-types';

const SEPARATOR = '_';

/** The start table's name and the names the end table's columns hold. */
export type ForeignKeyNaming = {
  startTableName: string;
  endColumnNames: string[];
};

const toNameKey = (name: string) => name.trim().toLowerCase();

/**
 * Joins the table name and the key name with an underscore, unless either is
 * blank or the key name already is the table name or starts with it and an
 * underscore, compared without case; then the key name stands alone.
 */
function prefixKeyName(tableName: string, keyName: string): string {
  const table = tableName.trim();
  const key = keyName.trim();
  if (!table || !key) return key;

  const tableKey = toNameKey(table);
  const keyKey = toNameKey(key);
  if (keyKey === tableKey || keyKey.startsWith(tableKey + SEPARATOR)) {
    return key;
  }

  return `${table}${SEPARATOR}${key}`;
}

/**
 * Names the foreign key column of each key after the start table, user_id for
 * the key id of user, and numbers a name the end table or an earlier key took,
 * user_id_2, without case; a key with no name gives a column with none.
 */
export function toForeignKeyNames(
  startTableName: string,
  keyNames: string[],
  endColumnNames: string[]
): string[] {
  const taken = new Set(endColumnNames.map(toNameKey).filter(Boolean));

  return keyNames.map(keyName => {
    const base = prefixKeyName(startTableName, keyName);
    if (!base) return base;

    let name = base;
    for (let suffix = 2; taken.has(toNameKey(name)); suffix++) {
      name = `${base}${SEPARATOR}${suffix}`;
    }
    taken.add(toNameKey(name));

    return name;
  });
}

/**
 * Adds a NOT NULL copy of each start column to the end table under the id at
 * the same index of endColumnIds, named by toForeignKeyNames, carrying its data
 * type, default and comment. The caller owns the ids the relationship needs.
 */
export const toForeignKeyActions = (
  startColumns: Column[],
  endTableId: string,
  endColumnIds: string[],
  { startTableName, endColumnNames }: ForeignKeyNaming
): AnyAction[] => {
  const names = toForeignKeyNames(
    startTableName,
    startColumns.map(({ name }) => name),
    endColumnNames
  );

  return startColumns.flatMap((startColumn, index) => {
    const payload = {
      id: endColumnIds[index],
      tableId: endTableId,
    };

    return [
      addColumnAction(payload),
      changeColumnNotNullAction({
        ...payload,
        value: true,
      }),
      changeColumnNameAction({
        ...payload,
        value: names[index],
      }),
      changeColumnDataTypeAction({
        ...payload,
        value: startColumn.dataType,
      }),
      changeColumnDefaultAction({
        ...payload,
        value: startColumn.default,
      }),
      changeColumnCommentAction({
        ...payload,
        value: startColumn.comment,
      }),
    ];
  });
};
