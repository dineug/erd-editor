import { query } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { fieldIcon } from '@/components/erd/fieldIcon';
import { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import type { I18n, MessageKey } from '@/i18n/translate';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindMatch,
  isTableLogicalName,
  Matcher,
  walkFields,
} from '@/utils/find-replace';

import {
  Action,
  createMatchAction,
  keywordHolder,
  named,
  searchActions,
} from './documentSearch';
import {
  HangulQuery,
  hangulQueryOf,
  hitRange,
  matchText,
  rankHits,
  TextHit,
} from './hangul';
import { PALETTE_PREFIXES, PaletteQuery, PaletteScope } from './paletteQuery';
import * as styles from './QuickSearch.styles';

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

/** What the at sign searches: a column's name and logical name, whatever the view draws. */
const COLUMN_FIELDS: FindField[] = [
  FindField.columnName,
  FindField.logicalName,
];

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
      return rankTableActions(found, keyword);
    case PaletteScope.columns:
      return createFieldActions(app, COLUMN_FIELDS, keyword, table, i18n);
    case PaletteScope.text:
      return createFieldActions(app, TEXT_FIELDS, keyword, null, i18n);
    case PaletteScope.help:
      return createHelpActions(keyword, i18n);
  }
}

/** The table rows the keyword fuzzes to, every one, those holding it as typed or by its Hangul letters first. */
export function rankTableActions(found: Action[], keyword: string): Action[] {
  const holds = keywordHolder(keyword);
  return [...found.filter(holds), ...found.filter(row => !holds(row))];
}

/** A field a search found and how it holds the keyword, or one listed with no keyword yet. */
type FieldHit = {
  field: Omit<FindMatch, 'start' | 'end'>;
  hit: TextHit | null;
};

type RankedHit = FieldHit & { hit: TextHit };

/** Whether a table is one a column search names: any without a table part, else those whose name or logical name holds it, Hangul letters too. */
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
      .filter(
        ({ name, logicalName }) =>
          matchText(name, matcher, hangul) ||
          (logicalName !== '' && matchText(logicalName, matcher, hangul))
      )
      .map(({ id }) => id)
  );
  return tableId => ids.has(tableId);
}

/**
 * A field's row, built the first time the list draws or picks it: the range a
 * Hangul hit lies in spells the text again, so a long list spells only the rows
 * it shows.
 */
function lazyMatchAction(
  state: RootState,
  { field, hit }: FieldHit,
  hangul: HangulQuery | null,
  i18n: I18n
): Action {
  let built: Action | null = null;
  const build = () =>
    (built ??= createMatchAction(
      state,
      { ...field, ...(hit ? hitRange(field.text, hit, hangul) : NO_RANGE) },
      i18n
    ));

  return {
    icon: fieldIcon(field.field, 16),
    get name() {
      return build().name;
    },
    get keywords() {
      return build().keywords;
    },
    perform: app => build().perform?.(app),
  };
}

/** Where a row with no keyword lights nothing. */
const NO_RANGE = { start: 0, end: 0 };

/**
 * One row for each field of the kinds given holding the keyword, Hangul letters
 * too, or for every column name or text that is not empty while there is none,
 * the table part narrowing a column search; the list draws only the rows in view.
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
  const hangul = matcher ? hangulQueryOf(keyword) : null;
  const found: FieldHit[] = [];

  for (const field of walkFields(state, fields)) {
    if (!inTable(field.tableId)) continue;
    // A table's logical name is no column's.
    if (isTableLogicalName(field)) continue;
    if (matcher) {
      const hit = matchText(field.text, matcher, hangul);
      if (hit) found.push({ field, hit });
    } else if (
      // With no keyword a column lists once, by its name.
      field.field === FindField.columnName ||
      (field.text && field.field !== FindField.logicalName)
    ) {
      found.push({ field, hit: null });
    }
  }

  const ranked = hangul ? rankHits(found as RankedHit[]) : found;
  return ranked.map(hit => lazyMatchAction(state, hit, hangul, i18n));
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
