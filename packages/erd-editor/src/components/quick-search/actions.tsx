import { query, toJson } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import Fues from 'fuse.js';

import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as tablePlacementMenus } from '@/components/erd/erd-context-menu/menus/tablePlacementMenus';
import { goToErdTarget, showErdTab } from '@/components/erd/goToErdTarget';
import { fieldIcon } from '@/components/find-replace/fieldIcon';
import { toErdTarget } from '@/components/find-replace/matchTarget';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import Icon from '@/components/primitives/icon/Icon';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { START_X, START_Y } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
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
import {
  addTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import { RootState } from '@/engine/state';
import { getOriginToPlace } from '@/konva/scene/viewport';
import {
  openAutomaticTablePlacementAction,
  openFindReplaceAction,
} from '@/utils/emitter';
import { exportJSON, exportSchemaSQL } from '@/utils/file/exportFile';
import {
  importAML,
  importDBML,
  importGraphQL,
  importJSON,
  importSchemaSQL,
} from '@/utils/file/importFile';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindFieldLabel,
  FindFieldList,
  FindMatch,
  findMatches,
  locationOf,
  snippetOf,
  walkFields,
} from '@/utils/find-replace';
import { createSchemaSQL } from '@/utils/schema-sql';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import {
  HangulQuery,
  hangulQueryOf,
  HangulTier,
  hangulTier,
  matchText,
} from './hangul';

export type Action = {
  icon?: DOMTemplateLiterals | null;
  name: string;
  keywords?: string;
  shortcut?: string;
  /** The table a row jumps to, whose keyword names the kind of row, not the table. */
  tableId?: string;
  /** What choosing the row types into the input, which stays open, instead of running a command. */
  insert?: string;
  filter?: (app: AppContext) => boolean;
  perform?: (app: AppContext) => void;
  next?: Action[];
};

/** The texts of a row a search reads: its name, and the keywords of a row that is no table. */
const textsOf = ({ name, keywords, tableId }: Action): string[] =>
  tableId || !keywords ? [name] : [name, keywords];

/** Whether a row holds the keyword as typed, in any case, in a text a search reads: what Find and Replace would find. */
export const holdsAsTyped = (action: Action, keyword: string): boolean => {
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

export function searchActions(actions: Action[], keyword: string): Action[] {
  const fuse = new Fues(actions, {
    keys: [
      'name',
      // A table row's Table would fuzz to most keywords and list every table.
      {
        name: 'keywords',
        getFn: action => (action.tableId ? [] : (action.keywords ?? [])),
      },
    ],
  });
  const found = fuse.search(keyword).map(result => result.item);
  const query = hangulQueryOf(keyword);

  return query ? rankHangulActions(actions, found, query) : found;
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

/** How many tables the palette lists for one keyword, the closest first. */
export const TABLE_ACTION_LIMIT = 20;

/**
 * The palette's top level rows for a keyword: the commands and tables holding
 * it, Hangul letters too, the fields holding it, then the looser fuzzy hits,
 * tables capped, so neither a large document nor a loose hit buries a field.
 */
export function rankPaletteActions(
  app: AppContext,
  found: Action[],
  keyword: string
): Action[] {
  const holds = keywordHolder(keyword);

  const ranked = [...found.filter(holds), ...found.filter(row => !holds(row))];
  const tables = ranked.filter(row => row.tableId);
  const shown = new Set(tables.slice(0, TABLE_ACTION_LIMIT));
  const rows = ranked.filter(row => !row.tableId || shown.has(row));
  const loose = rows.findIndex(row => !holds(row));
  const split = loose === -1 ? rows.length : loose;
  // A table holding the keyword as typed that the cap left out is one Find
  // and Replace lists; one holding it by its Hangul letters alone is not.
  const more = tables
    .slice(TABLE_ACTION_LIMIT)
    .some(row => holdsAsTyped(row, keyword));

  return [
    ...rows.slice(0, split),
    ...createMatchActions(app, keyword, more),
    ...rows.slice(split),
  ];
}

export function createScopeActions(app: AppContext): Action[] {
  const { store, keyBindingMap } = app;
  const { settings } = store.state;

  return [
    ...allScopeActions,
    {
      icon: <Icon name="database" size={16} />,
      name: 'Database',
      next: databaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.database ? (
            <Icon name="check" size={16} />
          ) : null,
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
          store.state.settings.canvasType === CanvasType.schemaSQL
        );
      },
    },
    {
      icon: <Icon name="file-input" size={16} />,
      name: 'Import',
      next: [
        {
          icon: <Icon name="braces" size={16} />,
          name: 'json',
          perform: app => {
            importJSON(app);
          },
        },
        {
          icon: <Icon name="database" size={16} />,
          name: 'Schema SQL',
          perform: app => {
            importSchemaSQL(app);
          },
        },
        {
          icon: <Icon name="code" size={16} />,
          name: 'GraphQL',
          keywords: 'graphql sdl gql schema',
          perform: app => {
            importGraphQL(app);
          },
        },
        {
          icon: <Icon name="code" size={16} />,
          name: 'DBML',
          keywords: 'dbml dbdiagram dbdocs schema',
          perform: app => {
            importDBML(app);
          },
        },
        {
          icon: <Icon name="code" size={16} />,
          name: 'AML',
          keywords: 'aml azimutt markup language schema',
          perform: app => {
            importAML(app);
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="file-output" size={16} />,
      name: 'Export',
      next: [
        {
          icon: <Icon name="braces" size={16} />,
          name: 'json',
          perform: ({ store }) => {
            exportJSON(toJson(store.state), store.state.settings.databaseName);
          },
        },
        {
          icon: <Icon name="database" size={16} />,
          name: 'Schema SQL',
          perform: ({ store }) => {
            exportSchemaSQL(
              createSchemaSQL(store.state),
              store.state.settings.databaseName
            );
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="table" size={16} />,
      name: 'New Table',
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
      name: 'New Memo',
      shortcut: keyBindingMap.addMemo[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addMemoAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    ...drawRelationshipMenus.map<Action>(menu => ({
      icon: <Icon name={menu.iconName} size={16} />,
      name: menu.name,
      keywords: 'Relationship',
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
      name: 'Auto Layout',
      next: tablePlacementMenus.map<Action>(menu => ({
        icon: <Icon name={menu.iconName} size={16} />,
        name: menu.name,
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
      name: 'Bracket',
      next: bracketMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.bracketType ? (
            <Icon name="check" size={16} />
          ) : null,
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeBracketTypeAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.schemaSQL;
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      name: 'Language',
      next: languageMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.language ? (
            <Icon name="check" size={16} />
          ) : null,
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
      name: 'Table Name Case',
      next: tableNameCaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.tableNameCase ? (
            <Icon name="check" size={16} />
          ) : null,
        name: menu.name,
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
      name: 'Column Name Case',
      next: columnNameCaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.columnNameCase ? (
            <Icon name="check" size={16} />
          ) : null,
        name: menu.name,
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
      icon: <Icon name="replace" size={16} />,
      name: 'Find and Replace',
      keywords: 'find replace rename',
      shortcut: keyBindingMap.findReplace[0]?.shortcut,
      perform: ({ emitter }) => {
        emitter.emit(openFindReplaceAction());
      },
    },
    ...createTableActions(app),
  ];
}

/** How many columns, comments and memos the palette lists for one keyword. */
export const MATCH_ACTION_LIMIT = 50;

/** The kinds of field the mixed list reads: every one but the table names, which its fuzzy rows hold. */
const MATCH_FIELDS: ReadonlyArray<FindField> = FindFieldList.filter(
  field => field !== FindField.tableName
);

/**
 * The columns, comments and memos holding the keyword, in any case or by its
 * Hangul letters, one row a field, up to a limit past which, or when more is
 * set, a last row hands the search over. No fuzz: long prose fuzzes into noise.
 */
export function createMatchActions(
  app: AppContext,
  keyword: string,
  more = false
): Action[] {
  const { state } = app.store;
  const { matcher } = createMatcher(keyword, DEFAULT_FIND_OPTIONS);
  if (!matcher) return [];

  const hangul = hangulQueryOf(keyword);
  const found: Array<{ match: FindMatch; literal: boolean }> = [];
  for (const field of walkFields(state, MATCH_FIELDS)) {
    const hit = matchText(field.text, matcher, hangul);
    if (!hit) continue;
    const match = { ...field, start: hit.start, end: hit.end };
    found.push({ match, literal: hit.literal });
  }

  const actions = found
    .slice(0, MATCH_ACTION_LIMIT)
    .map(({ match }) => createMatchAction(state, match));

  // The panel matches as typed alone, so the row hands over only a search
  // that leaves out a field the panel finds, and names the panel's count.
  const hidden = found.slice(MATCH_ACTION_LIMIT).some(hit => hit.literal);
  if (more || hidden) {
    const count = findMatches(state, matcher).length;
    actions.push(createShowAllAction(count, { query: keyword }));
  }

  return actions;
}

/** The row for one field a search found, saying where it is, which stands the reader on it when chosen. */
export function createMatchAction(state: RootState, match: FindMatch): Action {
  const location = locationOf(state, match);
  const kind = FindFieldLabel[match.field];

  return {
    icon: fieldIcon(match.field, 16),
    name: snippetOf(match, 16, 64).text || 'unnamed',
    keywords: location ? `${location} · ${kind}` : kind,
    perform: ({ store }) => {
      goToErdTarget(store, toErdTarget(match));
    },
  };
}

/** The row handing a search to Find and Replace, named with the count the panel opens on. */
export function createShowAllAction(
  count: number,
  payload: { query: string; fields?: FindField[] }
): Action {
  return {
    icon: <Icon name="search" size={16} />,
    name: `Show all ${count} matches in Find and Replace`,
    perform: ({ emitter }) => {
      emitter.emit(openFindReplaceAction(payload));
    },
  };
}

function createTableActions({ store }: AppContext): Action[] {
  const {
    doc: { tableIds },
    collections,
  } = store.state;

  return query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .map<Action>(table => ({
      name: isEmpty(table.name.trim()) ? 'unnamed' : table.name,
      keywords: 'Table',
      tableId: table.id,
      perform: ({ store }) => {
        showErdTab(store);
        const {
          settings: { zoomLevel },
        } = store.state;
        // The table parks a zoomed START_X, START_Y in from the corner: the
        // landing point the DOM scene had, kept so a jump looks the same.
        const { x, y } = getOriginToPlace(zoomLevel, table.ui, {
          x: START_X * zoomLevel,
          y: START_Y * zoomLevel,
        });
        store.dispatch(
          scrollToAction({ originX: x, originY: y }),
          selectTableAction$(table.id, false)
        );
      },
    }));
}

export const allScopeActions: Action[] = [
  {
    name: 'Tab',
    next: [
      {
        icon: <Icon name="workflow" size={16} />,
        name: 'Entity Relationship Diagram',
        perform: ({ store }) => {
          store.dispatch(changeCanvasTypeAction({ value: CanvasType.ERD }));
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.ERD;
        },
      },
      {
        icon: <Icon name="share-2" size={16} />,
        name: 'Visualization',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.visualization })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.visualization;
        },
      },
      {
        icon: <Icon name="database" size={16} />,
        name: 'Schema SQL',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.schemaSQL })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.schemaSQL;
        },
      },
      {
        icon: <Icon name="code" size={16} />,
        name: 'Generator Code',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.generatorCode })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.generatorCode;
        },
      },
      {
        icon: <Icon name="settings" size={16} />,
        name: 'Settings',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.settings })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.settings;
        },
      },
    ],
  },
];
