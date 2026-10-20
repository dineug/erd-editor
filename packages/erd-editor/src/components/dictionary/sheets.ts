import type { GridColumn } from '@dineug/grid';
import type { AnyAction } from '@dineug/r-html';
import { isString } from 'es-toolkit';

import {
  ActionType as DictionaryActionType,
  DictionaryFields,
  DictionaryKind,
} from '@/engine/modules/dictionary/actions';
import { selectDictionaryRow } from '@/engine/modules/dictionary/atom.actions';
import {
  checkDictionaryRow,
  type DictionaryCheckField,
  type DictionaryCheckLevel,
  markOf,
} from '@/engine/modules/dictionary/checks';
import {
  dictionaryCache,
  type DictionaryRowOf,
} from '@/engine/modules/dictionary/dictionaryIndex';
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import { ActionType as ColumnActionType } from '@/engine/modules/table-column/actions';
import type { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import type { ValuesType } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

/** The tab's sheets in the order its bar lists them: the three dictionaries, then their checks. */
export const DictionarySheet = {
  word: DictionaryKind.word,
  term: DictionaryKind.term,
  domain: DictionaryKind.domain,
  check: 'check',
} as const;
export type DictionarySheet = ValuesType<typeof DictionarySheet>;

export const DictionarySheetList: ReadonlyArray<DictionarySheet> =
  Object.values(DictionarySheet);

/** Whether the sheet lists a dictionary's own rows, which it edits, rather than the checks over them. */
export const isEntrySheet = (sheet: DictionarySheet): sheet is DictionaryKind =>
  sheet !== DictionarySheet.check;

export const DictionarySheetLabelKey: Readonly<
  Record<DictionarySheet, PlainMessageKey>
> = {
  [DictionarySheet.word]: 'dictionary.sheet.words',
  [DictionarySheet.term]: 'dictionary.sheet.terms',
  [DictionarySheet.domain]: 'dictionary.sheet.domains',
  [DictionarySheet.check]: 'dictionary.sheet.checks',
};

/** A field of a dictionary's rows, which is the id of its column on the sheet. */
export type SheetField<K extends DictionaryKind = DictionaryKind> =
  (typeof DictionaryFields)[K][number];

type SheetColumnSpec = {
  labelKey: PlainMessageKey;
  /** The width a column opens at before a resize, in CSS pixels. */
  width: number;
};

const SHEET_COLUMNS: {
  [K in DictionaryKind]: Readonly<Record<SheetField<K>, SheetColumnSpec>>;
} = {
  [DictionaryKind.word]: {
    name: { labelKey: 'dictionary.field.word', width: 160 },
    abbreviation: { labelKey: 'dictionary.field.abbreviation', width: 120 },
    englishName: { labelKey: 'dictionary.field.englishName', width: 160 },
    description: { labelKey: 'dictionary.field.description', width: 280 },
    synonyms: { labelKey: 'dictionary.field.synonyms', width: 160 },
    forbiddenWords: { labelKey: 'dictionary.field.forbiddenWords', width: 160 },
  },
  [DictionaryKind.term]: {
    name: { labelKey: 'dictionary.field.term', width: 180 },
    physicalName: { labelKey: 'dictionary.field.physicalName', width: 180 },
    domainId: { labelKey: 'dictionary.field.domain', width: 140 },
    description: { labelKey: 'dictionary.field.description', width: 280 },
    synonyms: { labelKey: 'dictionary.field.synonyms', width: 160 },
  },
  [DictionaryKind.domain]: {
    name: { labelKey: 'dictionary.field.domain', width: 160 },
    category: { labelKey: 'dictionary.field.category', width: 120 },
    dataType: { labelKey: 'dictionary.field.dataType', width: 160 },
    description: { labelKey: 'dictionary.field.description', width: 280 },
  },
};

export type SheetColumnOptions = {
  /** A read-only document makes every column read-only. */
  readonly: boolean;
  /** The widths a resize left, by column id, in place of each column's own. */
  widths?: Readonly<Record<string, number>>;
};

/**
 * A dictionary's columns, one per field in the order its rows hold them, each
 * labelled in the reader's language. A term's domain column shows and takes
 * the domain's name, which the commit reads back to the domain's id.
 */
export function sheetColumns(
  kind: DictionaryKind,
  { readonly, widths = {} }: SheetColumnOptions,
  i18n: Pick<I18n, 't'> = sourceI18n
): GridColumn[] {
  const specs: Readonly<Record<string, SheetColumnSpec>> = SHEET_COLUMNS[kind];

  return DictionaryFields[kind].map(field => ({
    id: field,
    label: i18n.t(specs[field].labelKey),
    width: widths[field] ?? specs[field].width,
    readonly,
  }));
}

/** The field a column of the sheet writes, or undefined for an id the sheet has no column of. */
export function sheetField<K extends DictionaryKind>(
  kind: K,
  columnId: string
): SheetField<K> | undefined {
  const fields: ReadonlyArray<string> = DictionaryFields[kind];
  return fields.includes(columnId) ? (columnId as SheetField<K>) : undefined;
}

/**
 * What a row's cell shows: the field as the row holds it, and for a term's
 * domain the name of the domain it links while the document lists that one,
 * else nothing; nothing too for an id with no row or a column the sheet lacks.
 */
export function sheetCellText(
  state: RootState,
  kind: DictionaryKind,
  id: string,
  columnId: string
): string {
  const field = sheetField(kind, columnId);
  const row = field ? selectDictionaryRow(state, kind, id) : undefined;
  if (!field || !row) return '';

  const value: unknown = Reflect.get(row, field);
  if (!isString(value)) return '';

  return kind === DictionaryKind.term && field === 'domainId'
    ? getLiveDomainName(state, value)
    : value;
}

/** The cells a row's checks read: its name, and a term's domain. */
const CHECKED_FIELDS: ReadonlyArray<string> = [
  'name',
  'domainId',
] satisfies DictionaryCheckField[];

const isCheckedField = (columnId: string): columnId is DictionaryCheckField =>
  CHECKED_FIELDS.includes(columnId);

/**
 * How loud a row's cell shows what the checks find in it: an error, a warning,
 * or null for nothing found, a column no check reads or an id with no row. It
 * reads the dictionaries' indexes, so a draw marks only the cells it paints.
 */
export function sheetCellMark(
  state: RootState,
  kind: DictionaryKind,
  id: string,
  columnId: string
): DictionaryCheckLevel | null {
  if (!isCheckedField(columnId) || !sheetField(kind, columnId)) return null;

  const row = selectDictionaryRow(state, kind, id);
  return row ? markOf(checkDictionaryRow(state, kind, row, columnId)) : null;
}

/** The fields a search reads of each sheet's rows. */
const SEARCHED_FIELDS: {
  [K in DictionaryKind]: ReadonlyArray<SheetField<K>>;
} = {
  [DictionaryKind.word]: ['name', 'abbreviation', 'englishName', 'description'],
  [DictionaryKind.term]: ['name', 'physicalName', 'description'],
  [DictionaryKind.domain]: ['name', 'dataType', 'description'],
};

/** A text as a search compares it, composed and in lower case, so a match ignores both. */
export const toSearchText = (text: string): string =>
  text.normalize('NFC').toLowerCase();

/**
 * The listed rows of one generation of a sheet. Its ids are frozen, so the
 * snapshot a grid is handed stays as it was; the texts a search reads are
 * built on the first search, never for a sheet nobody searches.
 */
type SheetListing<Row> = {
  rows: ReadonlyArray<Row>;
  ids: ReadonlyArray<string>;
  texts: string[] | null;
};

const toListing = <Row extends { id: string }>(
  rows: Row[]
): SheetListing<Row> => ({
  rows,
  ids: Object.freeze(rows.map(({ id }) => id)),
  texts: null,
});

const LISTINGS: {
  [K in DictionaryKind]: (state: RootState) => SheetListing<DictionaryRowOf[K]>;
} = {
  [DictionaryKind.word]: dictionaryCache(DictionaryKind.word, toListing),
  [DictionaryKind.term]: dictionaryCache(DictionaryKind.term, toListing),
  [DictionaryKind.domain]: dictionaryCache(DictionaryKind.domain, toListing),
};

function searchTextsOf(
  kind: DictionaryKind,
  listing: SheetListing<DictionaryRowOf[DictionaryKind]>
): string[] {
  const fields: ReadonlyArray<string> = SEARCHED_FIELDS[kind];

  // A line break keeps a match inside one field, since a search input holds none.
  listing.texts ??= listing.rows.map(row =>
    fields
      .map(field => {
        const value: unknown = Reflect.get(row, field);
        return isString(value) ? toSearchText(value) : '';
      })
      .join('\n')
  );
  return listing.texts;
}

/**
 * The ids of a sheet's rows, its listed rows in their order, those whose
 * searched fields hold the search's text while it holds any; with no search
 * the same frozen array comes back until the sheet is written.
 */
export function sheetRowIds(
  state: RootState,
  kind: DictionaryKind,
  search = ''
): ReadonlyArray<string> {
  const listing = LISTINGS[kind](state);
  const query = toSearchText(search.trim());
  if (!query) return listing.ids;

  const texts = searchTextsOf(kind, listing);
  return listing.ids.filter((_, index) => texts[index].includes(query));
}

/** A load or a clear brings every dictionary anew, or none. */
const isReload = arrayHas<string>([
  EditorActionType.loadJson,
  EditorActionType.initialLoadJson,
  EditorActionType.clear,
  EditorActionType.initialClear,
]);

const isDictionaryWrite = arrayHas<string>(Object.values(DictionaryActionType));

const isSchemaWrite = arrayHas<string>([
  ...Object.values(TableActionType),
  ...Object.values(ColumnActionType),
]);

/**
 * The sheets whose version a batch raises. A dictionary's write or a load
 * raises all four, since a term shows its domain's name and the checks read
 * every dictionary; a table's or a column's write raises the checks alone.
 */
export function bumpedSheets(
  actions: ReadonlyArray<AnyAction>
): ReadonlyArray<DictionarySheet> {
  let checks = false;

  for (const { type } of actions) {
    if (isDictionaryWrite(type) || isReload(type)) return DictionarySheetList;
    if (isSchemaWrite(type)) checks = true;
  }

  return checks ? [DictionarySheet.check] : [];
}
