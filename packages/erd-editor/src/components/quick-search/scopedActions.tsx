import { query } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import type { I18n, MessageKey } from '@/i18n/translate';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindMatch,
  findMatches,
  Matcher,
  walkFields,
} from '@/utils/find-replace';

import {
  Action,
  createMatchAction,
  createShowAllAction,
  keywordHolder,
  named,
  searchActions,
} from './actions';
import {
  hangulQueryOf,
  hitRange,
  matchText,
  rankHits,
  TextHit,
} from './hangul';
import { PALETTE_PREFIXES, PaletteQuery, PaletteScope } from './paletteQuery';
import * as styles from './QuickSearch.styles';

/** How many rows a prefixed list shows, few enough to draw at once. */
export const SCOPED_ACTION_LIMIT = 100;

type SearchMessageKey = Extract<MessageKey, `palette.search${string}`>;

/** The scopes that search the document, which a search with no prefix offers once no command listed holds it, each with the sentence its row reads. */
const DOCUMENT_SCOPES: Readonly<
  Partial<Record<PaletteScope, SearchMessageKey>>
> = {
  [PaletteScope.tables]: 'palette.searchTables',
  [PaletteScope.columns]: 'palette.searchColumns',
  [PaletteScope.text]: 'palette.searchText',
};

/** What the colon searches: the free text, never a name. */
export const TEXT_FIELDS: FindField[] = [
  FindField.tableComment,
  FindField.columnComment,
  FindField.memo,
];

const COLUMN_FIELDS: FindField[] = [FindField.columnName];

const TABLE_FIELDS: FindField[] = [FindField.tableName];

const matcherOf = (keyword: string): Matcher | null =>
  createMatcher(keyword, DEFAULT_FIND_OPTIONS).matcher;

/**
 * The rows of a level a scope hands to the fuzzy search: the commands without
 * a prefix, the tables after # alone, and none for a scope whose rows are read
 * from the document. A submenu holds commands only.
 */
export function scopeBase(
  actions: Action[],
  scope: PaletteScope | null
): Action[] {
  switch (scope) {
    case null:
      return actions.filter(action => !action.tableId);
    case PaletteScope.tables:
      return actions.filter(action => action.tableId);
    default:
      return [];
  }
}

/**
 * What the top level lists for a query, from the fuzzy hits of its scope: the
 * commands, then the prefixes when none holds the keyword; the tables; or rows
 * read from the document for the columns, the free text and the help.
 */
export function paletteRows(
  app: AppContext,
  found: Action[],
  { scope, keyword, table }: PaletteQuery,
  i18n: I18n = sourceI18n
): Action[] {
  switch (scope) {
    case null:
      // Fuse still fuzzes many words to some command, tables to New Table,
      // so a hit alone never means the keyword names one: only a command
      // holding it keeps them away.
      return keyword && !found.some(keywordHolder(keyword))
        ? [...found, ...createPrefixActions(keyword, i18n)]
        : found;
    case PaletteScope.tables:
      return rankTableActions(app, found, keyword, i18n);
    case PaletteScope.columns:
      return createFieldActions(app, COLUMN_FIELDS, keyword, table, i18n);
    case PaletteScope.text:
      return createFieldActions(app, TEXT_FIELDS, keyword, null, i18n);
    case PaletteScope.help:
      return createHelpActions(keyword, i18n);
  }
}

/**
 * The table rows the keyword fuzzes to, those holding it as typed or by its
 * Hangul letters first, up to the scoped limit, past which a table whose name
 * the panel finds it in hands the search to Find and Replace over the names.
 */
export function rankTableActions(
  app: AppContext,
  found: Action[],
  keyword: string,
  i18n: I18n = sourceI18n
): Action[] {
  const holds = keywordHolder(keyword);
  const ranked = [...found.filter(holds), ...found.filter(row => !holds(row))];
  const rows = ranked.slice(0, SCOPED_ACTION_LIMIT);
  const matcher = matcherOf(keyword);
  if (!matcher) return rows;

  // Read in the name, not the row, which says unnamed for a table without one.
  const { tableEntities } = app.store.state.collections;
  const hidden = ranked
    .slice(SCOPED_ACTION_LIMIT)
    .some(
      ({ tableId = '' }) =>
        matcher.find(tableEntities[tableId]?.name ?? '').length > 0
    );
  if (!hidden) return rows;

  const count = findMatches(app.store.state, matcher, TABLE_FIELDS).length;
  return [
    ...rows,
    createShowAllAction(count, { query: keyword, fields: TABLE_FIELDS }, i18n),
  ];
}

/** A field a search found, and how it holds the keyword. */
type FieldHit = { field: Omit<FindMatch, 'start' | 'end'>; hit: TextHit };

/** Whether a table is one a column search names: any without a table part, else those whose name holds it, Hangul letters too. */
function tableFilter(
  { doc, collections }: RootState,
  table: string | null
): (tableId: string) => boolean {
  const matcher = table ? matcherOf(table) : null;
  if (!matcher) return () => true;

  const hangul = hangulQueryOf(table as string);
  const ids = new Set(
    query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .filter(({ name }) => matchText(name, matcher, hangul))
      .map(({ id }) => id)
  );
  return tableId => ids.has(tableId);
}

/**
 * One row a field of the kinds given holding the keyword, Hangul letters too,
 * or every column or text, up to the scoped limit, past which one holding it as
 * typed hands it to Find and Replace over those kinds, without the table part.
 */
export function createFieldActions(
  app: AppContext,
  fields: FindField[],
  keyword: string,
  table: string | null = null,
  i18n: I18n = sourceI18n
): Action[] {
  const { state } = app.store;
  const matcher = matcherOf(keyword);
  const inTable = tableFilter(state, table);
  if (!matcher) return listFieldActions(state, fields, inTable, i18n);

  const hangul = hangulQueryOf(keyword);
  const found: FieldHit[] = [];
  for (const field of walkFields(state, fields)) {
    if (!inTable(field.tableId)) continue;

    const hit = matchText(field.text, matcher, hangul);
    if (!hit) continue;
    found.push({ field, hit });
    // Without Hangul every hit is one the panel finds, so one past the limit
    // settles the last row; a Hangul search ranks them all before it cuts.
    if (!hangul && found.length > SCOPED_ACTION_LIMIT) break;
  }

  const ranked = hangul ? rankHits(found) : found;
  const rows = ranked
    .slice(0, SCOPED_ACTION_LIMIT)
    .map(({ field, hit }) =>
      createMatchAction(
        state,
        { ...field, ...hitRange(field.text, hit, hangul) },
        i18n
      )
    );
  if (!ranked.slice(SCOPED_ACTION_LIMIT).some(({ hit }) => hit.literal)) {
    return rows;
  }

  const count = findMatches(state, matcher, fields).length;
  return [
    ...rows,
    createShowAllAction(count, { query: keyword, fields }, i18n),
  ];
}

/** Every column, or every text that is not empty, of the kinds given, up to the scoped limit: a scope with no keyword yet. */
function listFieldActions(
  state: RootState,
  fields: FindField[],
  inTable: (tableId: string) => boolean,
  i18n: I18n
): Action[] {
  const rows: Action[] = [];
  for (const field of walkFields(state, fields)) {
    if (rows.length === SCOPED_ACTION_LIMIT) break;
    if (!inTable(field.tableId)) continue;
    if (!field.text && field.field !== FindField.columnName) continue;
    rows.push(createMatchAction(state, { ...field, start: 0, end: 0 }, i18n));
  }
  return rows;
}

/** A prefix character drawn as a key, the icon of a row that types it. */
const prefixIcon = (prefix: string) => (
  <span class={styles.prefix}>{prefix}</span>
);

/** The prefixes as rows, each typing its character into the input when chosen; a keyword fuzzes them. */
export function createHelpActions(
  keyword = '',
  i18n: I18n = sourceI18n
): Action[] {
  const rows = PALETTE_PREFIXES.filter(
    ({ scope }) => scope !== PaletteScope.help
  ).map<Action>(({ prefix, labelKey, descriptionKey }) => ({
    icon: prefixIcon(prefix),
    ...named(i18n, labelKey, descriptionKey),
    insert: prefix,
  }));

  return keyword ? searchActions(rows, keyword) : rows;
}

/**
 * The prefixes that search the document as rows offering the keyword to one,
 * what a search with no prefix lists below its commands once none holds it:
 * choosing one types its prefix before the keyword, so users becomes #users.
 */
export function createPrefixActions(
  keyword: string,
  i18n: I18n = sourceI18n
): Action[] {
  return PALETTE_PREFIXES.flatMap<Action>(({ prefix, scope }) => {
    const message = DOCUMENT_SCOPES[scope];
    if (!message) return [];

    return [
      {
        icon: prefixIcon(prefix),
        name: i18n.t(message, { keyword }),
        insert: `${prefix}${keyword}`,
      },
    ];
  });
}
