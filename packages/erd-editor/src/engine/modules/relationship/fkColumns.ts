import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';

import { ColumnOption } from '@/constants/schema';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import type { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';

import { toReferenceDataType } from './referenceType';

const SEPARATOR = '_';

/**
 * The start table's name and the names the end table's columns hold, which
 * name the copies, and the document's database, which types a serial key's copy.
 */
export type ForeignKeyContext = {
  startTableName: string;
  endColumnNames: string[];
  database: number;
};

/**
 * The columns a relationship drawn from a table copies into the table it ends
 * on, the start table's primary key in column order, which a press on a table
 * and the + button beside it both read.
 */
export const getStartKeyColumns = (
  collections: RootState['collections'],
  startTable: Table
): Column[] =>
  query(collections)
    .collection('tableColumnEntities')
    .selectByIds(startTable.columnIds)
    .filter(({ options }) => bHas(options, ColumnOption.primaryKey));

/** A name as two names compare: trimmed, without case. */
export const toNameKey = (name: string) => name.trim().toLowerCase();

/** Letters, marks and digits only; any other character splits words. */
const WORD_CHARACTERS = /^[\p{L}\p{M}\p{N}]+$/u;

/**
 * Lower case before upper, or an acronym before a capitalized word, as camelCase
 * splits IDCard, IDs and UUIDv4; or a letter without case, Hangul, kana or Han,
 * beside one with case, either way, as in 회원ID and IDカード.
 */
const CASE_BOUNDARY =
  /\p{Ll}\p{Lu}|\p{Lu}\p{Lu}\p{Ll}|[\p{Lo}\p{Lm}][\p{Lu}\p{Ll}]|[\p{Lu}\p{Ll}][\p{Lo}\p{Lm}]/u;

/** Marks and digits, which join the word they sit in. */
const MARKS_AND_DIGITS = /[\p{M}\p{N}]/gu;

/**
 * Tells a name of one word, id, ID, Id, UUID, id2 or 회원번호, from one of
 * several, user_id, userId, UserID, IDCard or 회원ID: one word is letters and
 * digits with none of the breaks CASE_BOUNDARY finds, read past marks and digits.
 */
export const isSingleWord = (name: string) =>
  WORD_CHARACTERS.test(name) &&
  !CASE_BOUNDARY.test(name.replace(MARKS_AND_DIGITS, ''));

/**
 * Joins the table name and the key name with an underscore when the key name
 * is a single word other than the table name, compared without case; a blank
 * table name, or a key name of several words, leaves the key name alone.
 */
export function prefixKeyName(tableName: string, keyName: string): string {
  const table = tableName.trim();
  const key = keyName.trim();
  if (!table || !isSingleWord(key) || toNameKey(key) === toNameKey(table)) {
    return key;
  }

  return `${table}${SEPARATOR}${key}`;
}

/**
 * Takes the first of base, base_2, base_3 that no taken name holds, compared
 * without case, and adds it to taken.
 */
function claimName(base: string, taken: Set<string>): string {
  let name = base;
  for (let suffix = 2; taken.has(toNameKey(name)); suffix++) {
    name = `${base}${SEPARATOR}${suffix}`;
  }
  taken.add(toNameKey(name));
  return name;
}

/**
 * Names the foreign key column of each single word key after the start table,
 * user_id for the key id of user, keeps other key names, and numbers a name
 * already taken, user_id_2, without case; free names, kept first, claim first.
 */
export function toForeignKeyNames(
  startTableName: string,
  keyNames: string[],
  endColumnNames: string[]
): string[] {
  const taken = new Set(endColumnNames.map(toNameKey).filter(Boolean));
  const bases = keyNames.map(keyName => prefixKeyName(startTableName, keyName));
  const isKept = (index: number) => bases[index] === keyNames[index].trim();
  const indexes = bases.map((_, index) => index);
  const claimOrder = [
    ...indexes.filter(isKept),
    ...indexes.filter(index => !isKept(index)),
  ];
  const clashing = claimOrder.filter(index => {
    const key = toNameKey(bases[index]);
    const clashes = taken.has(key);
    if (key) taken.add(key);
    return clashes;
  });
  const names = [...bases];

  for (const index of clashing) {
    names[index] = claimName(bases[index], taken);
  }

  return names;
}

/**
 * Adds a NOT NULL copy of each start column to the end table under the id at
 * the same index of endColumnIds, named by toForeignKeyNames, typed by
 * toReferenceDataType, with its default and comment. The caller owns the ids.
 */
export const toForeignKeyActions = (
  startColumns: Column[],
  endTableId: string,
  endColumnIds: string[],
  { startTableName, endColumnNames, database }: ForeignKeyContext
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
        value: toReferenceDataType(startColumn.dataType, database),
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
