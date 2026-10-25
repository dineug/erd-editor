import { query } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import Fues from 'fuse.js';

import type { AppContext } from '@/components/appContext';
import { toErdTarget } from '@/components/erd/erdTarget';
import { fieldIcon } from '@/components/erd/fieldIcon';
import { goToErdTarget } from '@/components/erd/goToErdTarget';
import {
  nameLabelText,
  toNameLabel,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import type { LocaleOption } from '@/i18n/locales';
import { type LabeledMenu, menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import type { AppearanceOption } from '@/themes/radix-ui-theme';
import {
  describeMatch,
  FindField,
  FindMatch,
  snippetOf,
} from '@/utils/find-replace';
import { orderByNameASC } from '@/utils/tableName';

import { HangulQuery, hangulQueryOf, HangulTier, hangulTier } from './hangul';

export type Action = {
  icon?: DOMTemplateLiterals | null;
  name: string;
  keywords?: string;
  shortcut?: string;
  /** The table a row jumps to, whose keyword names the kind of row, not the table. */
  tableId?: string;
  /** A table row's own names, its name and logical name, which a search reads whatever the name view shows. */
  tableNames?: string[];
  /** What choosing the row types into the input, which stays open, instead of running a command. */
  insert?: string;
  /** The English of a translated name and keywords, each its own text, which a search also reads and the list never shows. */
  alias?: string[];
  /** The option in force among a submenu's rows, which the submenu opens on. */
  checked?: boolean;
  /** The message key of a row opening a submenu, by which an open palette finds that submenu again in a rebuilt level. */
  id?: PlainMessageKey;
  filter?: (app: AppContext) => boolean;
  perform?: (app: AppContext) => void;
  next?: Action[];
};

/** The theme and the display language the element holds, each given only while it offers that picker. */
export type PalettePreferences = {
  appearance?: AppearanceOption;
  locale?: LocaleOption;
};

const isNonEmpty = (text: string | undefined): text is string => Boolean(text);

/** What a search reads of a table row: its table's own names, or its label while the table has none. */
function tableTextsOf({ name, tableNames = [] }: Action): string[] {
  const names = tableNames.filter(isNonEmpty);
  return names.length ? names : [name];
}

/** The texts of a row a search reads: a table's names, or the name, keywords and English alias of a row that is no table. */
const textsOf = (action: Action): string[] => {
  const { name, keywords, alias = [], tableId } = action;
  return tableId
    ? tableTextsOf(action)
    : [name, keywords, ...alias].filter(isNonEmpty);
};

/** What names a row: a message key, or a shared menu whose name stays as written where it has no key. */
type RowLabel = PlainMessageKey | LabeledMenu;

type RowTexts = Pick<Action, 'name' | 'keywords'>;

function textsIn(
  i18n: Pick<I18n, 't'>,
  label: RowLabel,
  keywordsKey?: PlainMessageKey
): RowTexts {
  const name =
    typeof label === 'string' ? i18n.t(label) : menuLabel(i18n, label);
  return keywordsKey ? { name, keywords: i18n.t(keywordsKey) } : { name };
}

/**
 * A row's name and keywords in the reader's language. The English of each one
 * a translation changes goes into its alias apart, so a search scores it as in
 * English and a command is found by its English words too; English has none.
 */
export function named(
  i18n: Pick<I18n, 't'>,
  label: RowLabel,
  keywordsKey?: PlainMessageKey
): Pick<Action, 'name' | 'keywords' | 'alias'> {
  const row = textsIn(i18n, label, keywordsKey);
  const english = textsIn(sourceI18n, label, keywordsKey);
  const alias = [
    [row.name, english.name],
    [row.keywords, english.keywords],
  ]
    .filter(([shown, source]) => shown !== source)
    .map(([, source]) => source)
    .filter(isNonEmpty);

  return alias.length ? { ...row, alias } : row;
}

/** Whether a row holds the keyword as typed, in any case, in a text a search reads: what Find and Replace would find. */
const holdsAsTyped = (action: Action, keyword: string): boolean => {
  const needle = keyword.toLowerCase();
  return textsOf(action).some(text => text.toLowerCase().includes(needle));
};

/** How closely a row holds a Hangul keyword in the texts a search reads, or null. */
function tierOfAction(action: Action, query: HangulQuery): HangulTier | null {
  return textsOf(action).reduce<HangulTier | null>((best, text) => {
    const tier = hangulTier(text, query);
    return tier !== null && (best === null || tier < best) ? tier : best;
  }, null);
}

/**
 * Whether a row holds the keyword: as typed, or by its Hangul letters, which
 * an IME spells out one jamo at a time and a choseong search abbreviates.
 */
export function keywordHolder(keyword: string): (action: Action) => boolean {
  const query = hangulQueryOf(keyword);
  return action =>
    holdsAsTyped(action, keyword) ||
    (query !== null && tierOfAction(action, query) !== null);
}

/**
 * How loose a fuzzy hit may be: stricter than fuse.js's 0.6, which fuzzed most
 * words to some command (memo to the relationships, #us to orders), while a
 * typo such as tabel still finds New Table. A row holding the keyword stays.
 */
export const SEARCH_THRESHOLD = 0.4;

export function searchActions(actions: Action[], keyword: string): Action[] {
  const fuse = new Fues(actions, {
    keys: [
      // A table is found by its name and logical name, whatever the view draws.
      {
        name: 'name',
        getFn: action => (action.tableId ? tableTextsOf(action) : action.name),
      },
      // A table row's Table would fuzz to most keywords and list every table.
      {
        name: 'keywords',
        getFn: action => (action.tableId ? [] : (action.keywords ?? [])),
      },
      {
        name: 'alias',
        getFn: action => (action.tableId ? [] : (action.alias ?? [])),
      },
    ],
    threshold: SEARCH_THRESHOLD,
  });
  const found = fuse.search(keyword).map(result => result.item);
  const query = hangulQueryOf(keyword);

  return query
    ? rankHangulActions(actions, found, query)
    : [...found, ...heldPastFuse(actions, found, keyword)];
}

/**
 * The rows holding the keyword as typed that Fuse drops: it scores a hit by how
 * far in it starts, so at SEARCH_THRESHOLD a word starting past index 40 of a
 * long table name is let go. They follow Fuse's hits in the level's order.
 */
function heldPastFuse(
  actions: Action[],
  found: Action[],
  keyword: string
): Action[] {
  const fuzzy = new Set(found);
  return actions.filter(
    action => !fuzzy.has(action) && holdsAsTyped(action, keyword)
  );
}

/**
 * The rows a Hangul keyword finds: those holding it whole, then from their
 * start, then inside, each tier in Fuse's order and then the level's, and
 * last what Fuse alone fuzzes to, which a jamo typed mid-syllable never reaches.
 */
function rankHangulActions(
  actions: Action[],
  found: Action[],
  query: HangulQuery
): Action[] {
  const fuzzy = new Map(found.map((action, index) => [action, index]));
  const hits = actions.flatMap((action, index) => {
    const tier = tierOfAction(action, query);
    const order = fuzzy.get(action) ?? found.length + index;
    return tier === null ? [] : [{ action, tier, order }];
  });
  hits.sort((a, b) => a.tier - b.tier || a.order - b.order);

  const spelled = new Set(hits.map(hit => hit.action));
  return [
    ...hits.map(hit => hit.action),
    ...found.filter(action => !spelled.has(action)),
  ];
}

/** The row for one field a search found, saying where it is, which stands the reader on it when chosen. */
export function createMatchAction(
  state: RootState,
  match: FindMatch,
  i18n: I18n = sourceI18n
): Action {
  return {
    icon: fieldIcon(match.field, 16),
    name: snippetOf(match, 16, 64).text || i18n.t('common.unnamed'),
    keywords: describeMatch(state, match, i18n),
    perform: ({ store }) => {
      goToErdTarget(store, toErdTarget(match));
    },
  };
}

/** A jump to each table in the order of the names, named as the name view names it, which only the # prefix lists. */
export function createTableActions(
  { store }: AppContext,
  i18n: I18n
): Action[] {
  const {
    doc: { tableIds },
    collections,
    settings,
  } = store.state;
  const unnamed = i18n.t('common.unnamed');
  const keywords = i18n.t('common.table');
  const nameOf = (table: { name: string; logicalName: string }) => {
    const name = nameLabelText(toNameLabel(settings, table));
    return isEmpty(name.trim()) ? unnamed : name;
  };

  // A row names its table as the name view does, still listed by the name.
  return query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .map<Action>(table => ({
      icon: fieldIcon(FindField.tableName, 16),
      name: nameOf(table),
      keywords,
      tableId: table.id,
      tableNames: [table.name, table.logicalName],
      perform: ({ store }) => {
        goToErdTarget(store, { kind: 'table', tableId: table.id });
      },
    }));
}
