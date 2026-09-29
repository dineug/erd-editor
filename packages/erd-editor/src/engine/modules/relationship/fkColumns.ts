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

/** Letters, marks and digits only; any other character splits words. */
const WORD_CHARACTERS = /^[\p{L}\p{M}\p{N}]+$/u;

/**
 * A lower case letter before an upper case one, or an upper case letter before
 * a capitalized word, as camelCase splits: IDCard, and so IDs and UUIDv4 too.
 */
const CASE_BOUNDARY = /\p{Ll}\p{Lu}|\p{Lu}\p{Lu}\p{Ll}/u;

/** Marks and digits, which join the word they sit in. */
const CASELESS = /[\p{M}\p{N}]/gu;

/**
 * Tells a name of one word, id, ID, Id, UUID or id2, from one of several,
 * user_id, userId, UserID or IDCard: one word is letters and digits with no
 * case change from lower to upper and no acronym run into a capitalized word.
 */
export const isSingleWord = (name: string) =>
  WORD_CHARACTERS.test(name) && !CASE_BOUNDARY.test(name.replace(CASELESS, ''));

/**
 * Joins the table name and the key name with an underscore when the key name
 * is a single word other than the table name, compared without case; a blank
 * table name, or a key name of several words, leaves the key name alone.
 */
function prefixKeyName(tableName: string, keyName: string): string {
  const table = tableName.trim();
  const key = keyName.trim();
  if (!table || !isSingleWord(key) || toNameKey(key) === toNameKey(table)) {
    return key;
  }

  return `${table}${SEPARATOR}${key}`;
}

/**
 * Names the foreign key column of each single word key after the start table,
 * user_id for the key id of user, keeps other key names, and numbers a name
 * already taken, user_id_2, without case; kept names claim theirs first.
 */
export function toForeignKeyNames(
  startTableName: string,
  keyNames: string[],
  endColumnNames: string[]
): string[] {
  const taken = new Set(endColumnNames.map(toNameKey).filter(Boolean));
  const bases = keyNames.map(keyName => prefixKeyName(startTableName, keyName));
  const names = [...bases];
  const isKept = (index: number) => bases[index] === keyNames[index].trim();
  const indexes = bases.map((_, index) => index);

  for (const index of [
    ...indexes.filter(isKept),
    ...indexes.filter(index => !isKept(index)),
  ]) {
    const base = bases[index];
    if (!base) continue;

    let name = base;
    for (let suffix = 2; taken.has(toNameKey(name)); suffix++) {
      name = `${base}${SEPARATOR}${suffix}`;
    }
    taken.add(toNameKey(name));
    names[index] = name;
  }

  return names;
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
