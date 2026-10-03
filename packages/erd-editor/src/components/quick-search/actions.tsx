import { query, toJson } from '@dineug/erd-editor-schema';
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
import { fieldIcon } from '@/components/find-replace/fieldIcon';
import { toErdTarget } from '@/components/find-replace/matchTarget';
import {
  coveredWidth,
  isTakenOver,
} from '@/components/find-replace/panelLayout';
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
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { RootState } from '@/engine/state';
import { getOriginToPlace } from '@/konva/scene/viewport';
import {
  FindReplaceQuery,
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
  describeMatch,
  FindField,
  FindMatch,
  snippetOf,
} from '@/utils/find-replace';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { createSchemaSQL } from '@/utils/schema-sql';
import { orderByNameASC } from '@/utils/schema-sql/utils';

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
  filter?: (app: AppContext) => boolean;
  perform?: (app: AppContext) => void;
  next?: Action[];
};

/** The texts of a row a search reads: its name, and the keywords of a row that is no table. */
const textsOf = ({ name, keywords, tableId }: Action): string[] =>
  tableId || !keywords ? [name] : [name, keywords];

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

/** The palette's top level: the commands of every tab, then a jump to each table, which only the # prefix lists. */
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
      icon: <Icon name="table-2" size={16} />,
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
      icon: <Icon name="text-search" size={16} />,
      name: 'Find and Replace',
      keywords: 'find replace rename',
      shortcut: keyBindingMap.findReplace[0]?.shortcut,
      perform: ({ emitter }) => {
        emitter.emit(openFindReplaceAction());
      },
      filter: canOpenFindReplace,
    },
    ...createTableActions(app),
  ];
}

/** The row for one field a search found, saying where it is, which stands the reader on it when chosen. */
export function createMatchAction(state: RootState, match: FindMatch): Action {
  return {
    icon: fieldIcon(match.field, 16),
    name: snippetOf(match, 16, 64).text || 'unnamed',
    keywords: describeMatch(state, match),
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
  payload: FindReplaceQuery
): Action {
  return {
    icon: <Icon name="search" size={16} />,
    name:
      count === 1
        ? 'Show 1 match in Find and Replace'
        : `Show all ${count} matches in Find and Replace`,
    perform: ({ emitter }) => {
      emitter.emit(openFindReplaceAction(payload));
    },
    filter: canOpenFindReplace,
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
      icon: fieldIcon(FindField.tableName, 16),
      name: isEmpty(table.name.trim()) ? 'unnamed' : table.name,
      keywords: 'Table',
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
