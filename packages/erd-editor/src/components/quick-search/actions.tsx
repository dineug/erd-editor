import { query, toDocumentJson } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import Fues from 'fuse.js';

import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as tablePlacementMenus } from '@/components/erd/erd-context-menu/menus/tablePlacementMenus';
import {
  goToErdTarget,
  selectTableAloneAction$,
  showErdTab,
} from '@/components/erd/goToErdTarget';
import { addTableGroupAndRename } from '@/components/erd/table-group/tableGroupName';
import { fieldIcon } from '@/components/find-replace/fieldIcon';
import { toErdTarget } from '@/components/find-replace/matchTarget';
import {
  coveredWidth,
  isTakenOver,
} from '@/components/find-replace/panelLayout';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import { toggleGeneratorCodePanel } from '@/components/generator-code/generatorCodeView';
import { readsBracket } from '@/components/generator-code/languageSettings';
import Icon from '@/components/primitives/icon/Icon';
import type { IconName } from '@/components/primitives/icon/icons';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import {
  isHeaderSupported,
  menus as headerMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/headerMenus';
import {
  isStatementsSupported,
  menus as statementsMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/statementsMenus';
import {
  schemaSQLViewOf,
  showSchemaSQLExport,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { APPEARANCE_BUTTONS } from '@/components/theme-builder/ThemeBuilder';
import { START_X, START_Y } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { changeDrawTableGroupAction } from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeTableNameCaseAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addTableGroupFromTablesAction$ } from '@/engine/modules/table-group/generator.actions';
import { RootState } from '@/engine/state';
import { type LocaleOption, LOCALES, SYSTEM_LOCALE } from '@/i18n/locales';
import { type LabeledMenu, menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import { getOriginToPlace } from '@/konva/scene/viewport';
import type { AppearanceOption } from '@/themes/radix-ui-theme';
import {
  FindReplaceQuery,
  openAutomaticTablePlacementAction,
  openExportImageAction,
  openFindReplaceAction,
  setLocaleOptionAction,
  setThemeOptionsAction,
} from '@/utils/emitter';
import { exportJSON } from '@/utils/file/exportFile';
import {
  importAML,
  importDBML,
  importGraphQL,
  importJSON,
  type ImportMode,
  importSchemaSQL,
} from '@/utils/file/importFile';
import {
  describeMatch,
  FindField,
  FindMatch,
  snippetOf,
} from '@/utils/find-replace';
import { resolveSchemaSQLOptions, schemaSQLSupport } from '@/utils/schema-sql';
import { orderByNameASC } from '@/utils/schema-sql/utils';
import { isTableGroupShown } from '@/utils/tableGroup';

import { HangulQuery, hangulQueryOf, HangulTier, hangulTier } from './hangul';

export type Action = {
  icon?: DOMTemplateLiterals | null;
  name: string;
  keywords?: string;
  shortcut?: string;
  /** The table a row jumps to, whose keyword names the kind of row, not the table. */
  tableId?: string;
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

const isNonEmpty = (text: string | undefined): text is string => Boolean(text);

/** The texts of a row a search reads: its name, and the keywords and English alias of a row that is no table. */
const textsOf = ({ name, keywords, alias = [], tableId }: Action): string[] =>
  tableId ? [name] : [name, keywords, ...alias].filter(isNonEmpty);

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

/** A row opening a submenu, named as named() names it and known by its message key in any language. */
const submenuNamed = (
  i18n: Pick<I18n, 't'>,
  key: PlainMessageKey,
  keywordsKey?: PlainMessageKey
): Pick<Action, 'id' | 'name' | 'keywords' | 'alias'> => ({
  id: key,
  ...named(i18n, key, keywordsKey),
});

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
      'name',
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

/** The five formats under Import, or under Import and Add for an append. */
function createImportActions(mode: ImportMode, i18n: I18n): Action[] {
  return [
    {
      icon: <Icon name="braces" size={16} />,
      name: 'json',
      perform: app => {
        importJSON(app, mode);
      },
    },
    {
      icon: <Icon name="database" size={16} />,
      ...named(i18n, 'common.tab.schemaSql'),
      perform: app => {
        importSchemaSQL(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'GraphQL' }, 'palette.keywords.graphql'),
      perform: app => {
        importGraphQL(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'DBML' }, 'palette.keywords.dbml'),
      perform: app => {
        importDBML(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'AML' }, 'palette.keywords.aml'),
      perform: app => {
        importAML(app, mode);
      },
    },
  ];
}

/** The theme and the display language the element holds, each given only while it offers that picker. */
export type PalettePreferences = {
  appearance?: AppearanceOption;
  locale?: LocaleOption;
};

/** A submenu row's check, drawn beside the option in force, which the submenu opens on. */
const checkOf = (checked: boolean): Pick<Action, 'icon' | 'checked'> => ({
  icon: checked ? <Icon name="check" size={16} /> : null,
  checked,
});

/**
 * The palette's top level: the commands of every tab, then a jump to each
 * table, which only the # prefix lists, each in the reader's language. Theme
 * and Display Language show on every tab, each only while its picker is given.
 */
export function createScopeActions(
  app: AppContext,
  i18n: I18n = sourceI18n,
  preferences: PalettePreferences = {}
): Action[] {
  const { store, keyBindingMap } = app;
  const { settings } = store.state;

  return [
    {
      ...submenuNamed(i18n, 'palette.tab'),
      next: createTabActions(i18n),
    },
    {
      icon: <Icon name="database" size={16} />,
      ...submenuNamed(i18n, 'common.database'),
      next: databaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.database),
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeDatabaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return (
          store.state.settings.canvasType === CanvasType.ERD ||
          store.state.settings.canvasType === CanvasType.schemaSQL ||
          store.state.settings.canvasType === CanvasType.generatorCode
        );
      },
    },
    {
      icon: <Icon name="file-input" size={16} />,
      ...submenuNamed(i18n, 'common.import'),
      next: createImportActions('replace', i18n),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="file-input" size={16} />,
      ...submenuNamed(i18n, 'common.importAndAdd'),
      next: createImportActions('append', i18n),
      filter: ({ store }) => {
        return (
          store.state.settings.canvasType === CanvasType.ERD &&
          !store.getReadonly()
        );
      },
    },
    {
      icon: <Icon name="file-output" size={16} />,
      ...submenuNamed(i18n, 'common.export'),
      next: [
        {
          icon: <Icon name="braces" size={16} />,
          name: 'json',
          perform: ({ store }) => {
            exportJSON(
              toDocumentJson(store.state),
              store.state.settings.databaseName
            );
          },
        },
        {
          icon: <Icon name="database" size={16} />,
          ...named(i18n, 'common.tab.schemaSql'),
          perform: showSchemaSQLExport,
        },
        {
          icon: <Icon name="file-image" size={16} />,
          ...named(i18n, 'common.image', 'palette.keywords.image'),
          perform: ({ emitter }) => {
            emitter.emit(openExportImageAction());
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="table-2" size={16} />,
      ...named(i18n, 'common.newTable'),
      shortcut: keyBindingMap.addTable[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addTableAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="sticky-note" size={16} />,
      ...named(i18n, 'common.newMemo'),
      shortcut: keyBindingMap.addMemo[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addMemoAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="group" size={16} />,
      ...named(i18n, 'common.newTableGroup'),
      perform: ({ store }) => {
        store.dispatch(changeDrawTableGroupAction({ value: true }));
      },
      filter: canAddTableGroup,
    },
    {
      icon: <Icon name="group" size={16} />,
      ...named(i18n, 'palette.groupSelectedTables'),
      perform: ({ store }) => {
        addTableGroupAndRename(store, addTableGroupFromTablesAction$());
      },
      filter: app => canAddTableGroup(app) && hasSelectedTable(app),
    },
    ...drawRelationshipMenus.map<Action>(menu => ({
      icon: <Icon name={menu.iconName} size={16} />,
      ...named(i18n, menu, 'common.relationship'),
      shortcut: keyBindingMap[menu.keyBindingName][0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(drawStartRelationshipAction$(menu.relationshipType));
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    })),
    {
      icon: <Icon name="wand-sparkles" size={16} />,
      ...submenuNamed(i18n, 'common.autoLayout'),
      next: tablePlacementMenus.map<Action>(menu => ({
        icon: <Icon name={menu.iconName} size={16} />,
        ...named(i18n, menu),
        perform: ({ emitter }) => {
          emitter.emit(
            openAutomaticTablePlacementAction({ placement: menu.placement })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="brackets" size={16} />,
      ...submenuNamed(i18n, 'common.bracket'),
      next: bracketMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.bracketType),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeBracketTypeAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: app => isSchemaSQLTab(app) || readsBracketHere(app),
    },
    ...createSchemaSQLActions(app, i18n),
    {
      icon: <Icon name="code" size={16} />,
      ...submenuNamed(i18n, 'common.codeLanguage'),
      next: languageMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.language),
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeLanguageAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      icon: <Icon name="case-sensitive" size={16} />,
      ...submenuNamed(i18n, 'common.tableNameCase'),
      next: tableNameCaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.tableNameCase),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeTableNameCaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      icon: <Icon name="case-sensitive" size={16} />,
      ...submenuNamed(i18n, 'common.columnNameCase'),
      next: columnNameCaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.columnNameCase),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeColumnNameCaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      icon: <Icon name="panel-right" size={16} />,
      ...named(
        i18n,
        'palette.codeGeneratorOptionsPanel',
        'palette.keywords.codeGeneratorOptionsPanel'
      ),
      perform: toggleGeneratorCodePanel,
      filter: isGeneratorCodeTab,
    },
    {
      icon: <Icon name="text-search" size={16} />,
      ...named(i18n, 'common.findAndReplace', 'palette.keywords.findReplace'),
      shortcut: keyBindingMap.findReplace[0]?.shortcut,
      perform: ({ emitter }) => {
        emitter.emit(openFindReplaceAction());
      },
      filter: canOpenFindReplace,
    },
    ...createPreferenceActions(i18n, preferences),
    ...createTableActions(app, i18n),
  ];
}

const isSchemaSQLTab = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.schemaSQL;

const isGeneratorCodeTab = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.generatorCode;

/** The Code Generator tab of a language that quotes names by the bracket type. */
const readsBracketHere = (app: AppContext) =>
  isGeneratorCodeTab(app) && readsBracket(app.store.state.settings.language);

/** Whether a group may be made: on the ERD tab, showing its groups, of an editor that is not readonly. */
const canAddTableGroup = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.ERD &&
  isTableGroupShown(store.state) &&
  !store.getReadonly();

const hasSelectedTable = ({ store }: AppContext) => {
  const { doc, editor } = store.state;
  return getSelectTypeIds(editor.selectedMap).tableIds.some(id =>
    doc.tableIds.includes(id)
  );
};

/**
 * The Schema SQL tab's own rows, the statements and the header listing only
 * what the database writes, checked as it writes them; then Export: Schema
 * SQL, on every tab, which opens that tab with its options out to save from.
 */
function createSchemaSQLActions(app: AppContext, i18n: I18n): Action[] {
  const { settings } = app.store.state;
  const view = schemaSQLViewOf(app);
  const resolved = resolveSchemaSQLOptions(
    settings.database,
    view,
    settings.databaseName
  );
  const support = schemaSQLSupport(settings.database);

  return [
    {
      icon: <Icon name="settings-2" size={16} />,
      ...submenuNamed(
        i18n,
        'palette.schemaSqlStatements',
        'palette.keywords.schemaSqlStatements'
      ),
      next: statementsMenus
        .filter(menu => isStatementsSupported(support, menu.id))
        .map<Action>(menu => ({
          ...checkOf(menu.id === resolved.statements),
          name: menu.name,
          perform: app => {
            schemaSQLViewOf(app).statements = menu.id;
          },
        })),
      filter: isSchemaSQLTab,
    },
    {
      icon: <Icon name="settings-2" size={16} />,
      ...submenuNamed(
        i18n,
        'palette.schemaSqlHeader',
        'palette.keywords.schemaSqlHeader'
      ),
      next: headerMenus
        .filter(menu => isHeaderSupported(support, menu.id))
        .map<Action>(menu => ({
          ...checkOf(menu.id === resolved.header),
          ...named(i18n, menu),
          perform: app => {
            schemaSQLViewOf(app).header = menu.id;
          },
        })),
      filter: isSchemaSQLTab,
    },
    {
      icon: <Icon name="panel-right" size={16} />,
      ...named(
        i18n,
        'palette.schemaSqlOptionsPanel',
        'palette.keywords.schemaSqlOptionsPanel'
      ),
      perform: toggleSchemaSQLPanel,
      filter: isSchemaSQLTab,
    },
    {
      icon: <Icon name="file-output" size={16} />,
      ...named(
        i18n,
        'palette.exportSchemaSql',
        'palette.keywords.exportSchemaSql'
      ),
      perform: showSchemaSQLExport,
    },
  ];
}

/**
 * Theme and Display Language, each only while the element offers its picker,
 * with a check on the option in force. A pick goes through the emitter as the
 * pickers' own do, so the host hears it; a language is named in itself.
 */
export function createPreferenceActions(
  i18n: I18n,
  { appearance, locale }: PalettePreferences
): Action[] {
  const actions: Action[] = [];

  if (appearance !== undefined) {
    actions.push({
      icon: <Icon name="contrast" size={16} />,
      ...submenuNamed(i18n, 'common.theme'),
      next: APPEARANCE_BUTTONS.map<Action>(option => ({
        ...checkOf(option.appearance === appearance),
        ...named(i18n, option.labelKey),
        perform: ({ emitter }) => {
          emitter.emit(
            setThemeOptionsAction({ appearance: option.appearance })
          );
        },
      })),
    });
  }

  if (locale !== undefined) {
    const pick =
      (option: LocaleOption): Action['perform'] =>
      ({ emitter }) => {
        emitter.emit(setLocaleOptionAction({ locale: option }));
      };

    actions.push({
      icon: <Icon name="languages" size={16} />,
      ...submenuNamed(i18n, 'common.displayLanguage'),
      next: [
        {
          ...checkOf(locale === SYSTEM_LOCALE),
          ...named(i18n, 'common.system'),
          perform: pick(SYSTEM_LOCALE),
        },
        ...LOCALES.map<Action>(({ code, label, english }) => ({
          ...checkOf(locale === code),
          name: label,
          alias: [english, code],
          perform: pick(code),
        })),
      ],
    });
  }

  return actions;
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

/** Whether choosing a row that opens Find and Replace would open it: an overlay taking the canvas over keeps it shut. */
const canOpenFindReplace = ({ store }: AppContext) => !isTakenOver(store.state);

/** The row handing a search to Find and Replace, named with the count the panel opens on. */
export function createShowAllAction(
  count: number,
  payload: FindReplaceQuery,
  i18n: I18n = sourceI18n
): Action {
  return {
    icon: <Icon name="search" size={16} />,
    name: i18n.t('palette.showMatches', { count }),
    perform: ({ emitter }) => {
      emitter.emit(openFindReplaceAction(payload));
    },
    filter: canOpenFindReplace,
  };
}

function createTableActions({ store }: AppContext, i18n: I18n): Action[] {
  const {
    doc: { tableIds },
    collections,
  } = store.state;
  const unnamed = i18n.t('common.unnamed');
  const keywords = i18n.t('common.table');

  return query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .map<Action>(table => ({
      icon: fieldIcon(FindField.tableName, 16),
      name: isEmpty(table.name.trim()) ? unnamed : table.name,
      keywords,
      tableId: table.id,
      perform: ({ store }) => {
        showErdTab(store);
        const {
          settings: { zoomLevel },
        } = store.state;
        // The table parks a zoomed START_X, START_Y in from the corner, the
        // landing point the DOM scene had, kept so a jump looks the same, or
        // just clear of an open Find and Replace panel.
        const { x, y } = getOriginToPlace(zoomLevel, table.ui, {
          x: Math.max(START_X * zoomLevel, coveredWidth(store.state)),
          y: START_Y * zoomLevel,
        });
        store.dispatch(
          scrollToAction({ originX: x, originY: y }),
          selectTableAloneAction$(table.id)
        );
      },
    }));
}

/** The five tabs in the toolbar's order. */
const TABS: ReadonlyArray<{
  canvasType: string;
  icon: IconName;
  labelKey: PlainMessageKey;
}> = [
  { canvasType: CanvasType.ERD, icon: 'workflow', labelKey: 'common.tab.erd' },
  {
    canvasType: CanvasType.visualization,
    icon: 'share-2',
    labelKey: 'common.tab.visualization',
  },
  {
    canvasType: CanvasType.schemaSQL,
    icon: 'database',
    labelKey: 'common.tab.schemaSql',
  },
  {
    canvasType: CanvasType.generatorCode,
    icon: 'code',
    labelKey: 'common.tab.codeGenerator',
  },
  {
    canvasType: CanvasType.settings,
    icon: 'settings',
    labelKey: 'common.tab.settings',
  },
];

/** The five tabs the Tab row opens, each but the one shown. */
export function createTabActions(i18n: I18n = sourceI18n): Action[] {
  return TABS.map<Action>(({ canvasType, icon, labelKey }) => ({
    icon: <Icon name={icon} size={16} />,
    ...named(i18n, labelKey),
    perform: ({ store }) => {
      store.dispatch(changeCanvasTypeAction({ value: canvasType }));
    },
    filter: ({ store }) => {
      return store.state.settings.canvasType !== canvasType;
    },
  }));
}
