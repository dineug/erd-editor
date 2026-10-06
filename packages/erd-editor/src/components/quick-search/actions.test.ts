import { AnyAction } from '@dineug/r-html';
import Fuse from 'fuse.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { IME_CHOSEONG, IME_SAYONG } from '@/__test-utils__/hangulSeed';
import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestAppContext,
  flush,
  mountAndFlush,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import {
  Action,
  createPreferenceActions,
  createScopeActions,
  createShowAllAction,
  createTabActions,
  keywordHolder,
  named,
  PalettePreferences,
  SEARCH_THRESHOLD,
  searchActions,
} from '@/components/quick-search/actions';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { START_X, START_Y } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { ChangeActionTypes } from '@/engine/actions';
import {
  changeOpenMapAction,
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import {
  SelectType,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeZoomLevelAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { type LocaleOption, LOCALES } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { sourceI18n } from '@/i18n/source';
import { createI18n, type MessageKey, type Messages } from '@/i18n/translate';
import { toScreenPoint } from '@/konva/scene/viewport';
import { Appearance } from '@/themes/radix-ui-theme';
import { openFindReplaceAction } from '@/utils/emitter';
import { setExportFileCallback } from '@/utils/file/exportFile';
import { setImportFileCallback } from '@/utils/file/importFile';

type ExportCall = { blob: Blob; fileName: string };

let app: AppContext;

const setCanvasType = (value: string) => {
  app.store.dispatchSync(changeCanvasTypeAction({ value }));
};

const scope = () => createScopeActions(app);

const find = (actions: Action[], name: string): Action => {
  const action = actions.find(item => item.name === name);
  if (!action) throw new Error(`action not found: ${name}`);
  return action;
};

const names = (actions: Action[]) => actions.map(action => action.name);

const pairs = (actions: Action[]) =>
  actions.map(({ name, keywords }) => [name, keywords]);

/** The registered icon a row draws, mounted on its own. */
const iconOf = async ({ icon }: Action) => {
  if (!icon) return null;
  const mounted = await mountAndFlush(icon, app);
  const name = iconNameOf(mounted.container);
  mounted.unmount();
  return name;
};

const visibleNames = () =>
  names(scope().filter(action => action.filter?.(app) ?? true));

/** Every row the ERD canvas offers, which is the whole of what its scope holds. */
const ERD_TOOLBOX = [
  'Tab',
  'Database',
  'Import',
  'Import and Add',
  'Export',
  'New Table',
  'New Memo',
  'Zero One',
  'Zero N',
  'One Only',
  'One N',
  'Auto Layout',
  'Find and Replace',
];

const recordActions = () => {
  const dispatched: AnyAction[] = [];
  const unsubscribe = app.store.subscribe(list => {
    dispatched.push(...list);
  });
  return {
    dispatched,
    types: () => dispatched.map(action => action.type),
    unsubscribe,
  };
};

/** Adds a table and gives it a name, returning its id. */
const addTable = (name: string, x = 0, y = 0) => {
  app.store.dispatchSync(addTableAction$());
  const id = app.store.state.doc.tableIds.at(-1) as string;
  app.store.dispatchSync(
    changeTableNameAction({ id, value: name }),
    moveTableAction({ ids: [id], movementX: x, movementY: y })
  );
  return id;
};

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  setImportFileCallback(null);
  setExportFileCallback(null);
  app.store.destroy();
});

describe('searchActions', () => {
  const catalog: Action[] = [
    { name: 'New Table' },
    { name: 'New Memo' },
    { name: 'Auto Layout' },
    { name: 'customers', keywords: 'Table' },
  ];

  it('ranks an exact name match first', () => {
    const result = searchActions(catalog, 'New Memo');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('New Memo');
  });

  it('matches case-insensitively', () => {
    expect(names(searchActions(catalog, 'new memo'))).toContain('New Memo');
  });

  it('matches on the keywords field as well as the name', () => {
    const result = searchActions(
      [{ name: 'zzzz', keywords: 'Relationship' }],
      'Relationship'
    );

    expect(names(result)).toEqual(['zzzz']);
  });

  it('returns an empty list when nothing is close enough', () => {
    expect(searchActions(catalog, 'qqqqqqqqqq')).toEqual([]);
  });

  it('returns the matched items themselves, not fuse result wrappers', () => {
    const result = searchActions(catalog, 'customers');

    expect(result[0]).toBe(catalog[3]);
  });

  it('leaves the Table keyword of a table row out, which would fuzz to most words', () => {
    const tables: Action[] = [
      { name: 'users', keywords: 'Table', tableId: 'users' },
      { name: 'orders', keywords: 'Table', tableId: 'orders' },
    ];

    expect(searchActions(tables, 'email')).toEqual([]);
    expect(searchActions(tables, 'Table')).toEqual([]);
    expect(names(searchActions(tables, 'users'))[0]).toBe('users');
    // The same keyword on a row that is no table is still searched.
    expect(
      searchActions([{ name: 'zzzz', keywords: 'Table' }], 'Table')
    ).toHaveLength(1);
  });

  it('never returns more items than it was given', () => {
    expect(searchActions(catalog, 'Table').length).toBeLessThanOrEqual(
      catalog.length
    );
  });
});

describe('searchActions / threshold', () => {
  /** The commands the ERD tab hands Fuse for a keyword with no prefix. */
  const commands = () => {
    setCanvasType(CanvasType.ERD);
    return scope().filter(
      action => !action.tableId && (action.filter?.(app) ?? true)
    );
  };
  const found = (keyword: string) => names(searchActions(commands(), keyword));

  it('fuzzes at 0.4, stricter than the 0.6 fuse.js takes by default', () => {
    expect(SEARCH_THRESHOLD).toBe(0.4);
  });

  it('lists under # the tables holding the keyword, no longer orders for us', () => {
    for (const name of ['orders', 'users', 'customers', 'posts', 'roles']) {
      addTable(name);
    }
    const tables = scope().filter(action => action.tableId);

    const hits = names(searchActions(tables, 'us'));

    expect(hits).toContain('users');
    expect(hits).toContain('customers');
    for (const loose of ['orders', 'posts', 'roles']) {
      expect(hits).not.toContain(loose);
    }
  });

  it('lists New Memo alone for memo, none of the commands it only loosely matched', () => {
    expect(found('memo')).toEqual(['New Memo']);
    expect(found('auto')).toEqual(['Auto Layout']);
    expect(found('replace')).toEqual(['Find and Replace']);
  });

  it('keeps what a word or a near typo is meant for', () => {
    expect(found('new')).toEqual(
      expect.arrayContaining(['New Table', 'New Memo'])
    );
    for (const [typed, command] of [
      ['tabel', 'New Table'],
      ['new tabel', 'New Table'],
      ['memp', 'New Memo'],
      ['imprt', 'Import'],
      ['exprt', 'Export'],
      ['databse', 'Database'],
      ['layot', 'Auto Layout'],
      ['replce', 'Find and Replace'],
      ['relashionship', 'Zero One'],
    ]) {
      expect(found(typed)).toContain(command);
    }
  });

  it('finds no command for the table names 0.6 fuzzed to unrelated ones', () => {
    for (const keyword of ['users', 'posts', 'roles', 'accounts', 'notes']) {
      expect(found(keyword)).toEqual([]);
    }
  });

  it('lets go of a typo no closer than an unrelated command', () => {
    expect(found('talbe')).not.toContain('New Table');
    expect(found('mmeo')).toEqual([]);
  });

  it('keeps a row holding the keyword past index 40, where Fuse lets it go, after its hits', () => {
    const long = 'application_user_notification_preferences_history';
    const tables: Action[] = [
      { name: long, tableId: 'long' },
      { name: 'orders', tableId: 'orders' },
      { name: 'history_log', tableId: 'log' },
    ];
    const fuse = new Fuse(tables, { keys: ['name'], threshold: 0.4 });

    expect(fuse.search('history').map(({ item }) => item.name)).toEqual([
      'history_log',
    ]);
    expect(names(searchActions(tables, 'history'))).toEqual([
      'history_log',
      long,
    ]);
    expect(names(searchActions(tables, '_HISTORY'))).toContain(long);
    // A command's keywords are held the same way.
    const command: Action = {
      name: 'zzzz',
      keywords: `${'x'.repeat(48)} dagre`,
    };
    expect(searchActions([command], 'dagre')).toEqual([command]);
  });
});

describe('createTabActions', () => {
  it('holds the five canvas tabs, named as the toolbar names them', () => {
    expect(names(createTabActions())).toEqual([
      'Entity Relationship Diagram',
      'Visualization',
      'Schema SQL',
      'Code Generator',
      'Settings',
    ]);
  });

  it('gives every tab an icon but no keyword or shortcut', () => {
    for (const tab of createTabActions()) {
      expect(tab.icon).toBeTruthy();
      expect(tab.keywords).toBeUndefined();
      expect(tab.shortcut).toBeUndefined();
    }
  });

  it('hides only the tab matching the current canvas type', () => {
    const tabs = createTabActions();
    const visible = (canvasType: string) => {
      setCanvasType(canvasType);
      return tabs.filter(tab => tab.filter?.(app)).map(tab => tab.name);
    };

    expect(visible(CanvasType.ERD)).not.toContain(
      'Entity Relationship Diagram'
    );
    expect(visible(CanvasType.ERD)).toHaveLength(4);
    expect(visible(CanvasType.visualization)).not.toContain('Visualization');
    expect(visible(CanvasType.schemaSQL)).not.toContain('Schema SQL');
    expect(visible(CanvasType.generatorCode)).not.toContain('Code Generator');
    expect(visible(CanvasType.settings)).not.toContain('Settings');
  });

  it('switches the canvas type when a tab is performed', async () => {
    setCanvasType(CanvasType.ERD);
    const tabs = createTabActions();

    for (const [name, expected] of [
      ['Visualization', CanvasType.visualization],
      ['Schema SQL', CanvasType.schemaSQL],
      ['Code Generator', CanvasType.generatorCode],
      ['Settings', CanvasType.settings],
      ['Entity Relationship Diagram', CanvasType.ERD],
    ] as const) {
      find(tabs, name).perform?.(app);
      await flush();
      expect(app.store.state.settings.canvasType).toBe(expected);
    }
  });
});

describe('createScopeActions', () => {
  it('always starts with the Tab action, which opens the tabs', () => {
    setCanvasType(CanvasType.settings);
    const [tab] = scope();

    expect(tab.name).toBe('Tab');
    expect(tab.icon).toBeUndefined();
    expect(names(tab.next ?? [])).toEqual(names(createTabActions()));
  });

  it('lists the full ERD toolbox in the ERD canvas', () => {
    setCanvasType(CanvasType.ERD);

    expect(visibleNames()).toEqual(ERD_TOOLBOX);
  });

  it('keeps only Database and Bracket in the schema SQL canvas', () => {
    setCanvasType(CanvasType.schemaSQL);
    const visible = names(
      scope().filter(action => action.filter?.(app) ?? true)
    );

    expect(visible).toEqual(['Tab', 'Database', 'Bracket', 'Find and Replace']);
  });

  it('keeps only the code generator options in the generator code canvas', () => {
    setCanvasType(CanvasType.generatorCode);
    const visible = names(
      scope().filter(action => action.filter?.(app) ?? true)
    );

    expect(visible).toEqual([
      'Tab',
      'Language',
      'Table Name Case',
      'Column Name Case',
      'Find and Replace',
    ]);
  });

  it('keeps the tabs, Find and Replace and the table jumps # lists in the visualization and settings canvases', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    for (const canvasType of [CanvasType.visualization, CanvasType.settings]) {
      setCanvasType(canvasType);
      expect(
        names(scope().filter(action => action.filter?.(app) ?? true))
      ).toEqual(['Tab', 'Find and Replace', 'users']);
    }
  });

  it('draws New Table with the table icon every other table row carries', async () => {
    setCanvasType(CanvasType.ERD);

    expect(await iconOf(find(scope(), 'New Table'))).toBe('table-2');
  });

  it('takes the New Table and New Memo shortcuts from the key binding map', () => {
    setCanvasType(CanvasType.ERD);
    const actions = scope();

    expect(find(actions, 'New Table').shortcut).toBe(
      app.keyBindingMap.addTable[0].shortcut
    );
    expect(find(actions, 'New Memo').shortcut).toBe(
      app.keyBindingMap.addMemo[0].shortcut
    );
  });

  it('falls back to an undefined shortcut when the binding was cleared', () => {
    setCanvasType(CanvasType.ERD);
    app.keyBindingMap.addTable = [];

    expect(find(scope(), 'New Table').shortcut).toBeUndefined();
  });
});

describe('createScopeActions / Database', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.ERD);
  });

  it('offers one entry per supported database', () => {
    const database = find(scope(), 'Database');

    expect(names(database.next ?? [])).toEqual(names(databaseMenus as any));
    expect(database.icon).toBeTruthy();
  });

  it('checks exactly the currently selected database', () => {
    const checked = (find(scope(), 'Database').next ?? []).filter(
      item => item.icon
    );
    const current = databaseMenus.find(
      menu => menu.value === app.store.state.settings.database
    );

    expect(names(checked)).toEqual([current?.name]);
  });

  it('changes the database when an entry is performed', async () => {
    const target = databaseMenus.find(
      menu => menu.value !== app.store.state.settings.database
    );
    const entry = find(find(scope(), 'Database').next ?? [], target!.name);

    entry.perform?.(app);
    await flush();

    expect(app.store.state.settings.database).toBe(target!.value);
  });

  it('is visible in the ERD and schema SQL canvases only', () => {
    const database = find(scope(), 'Database');

    setCanvasType(CanvasType.ERD);
    expect(database.filter?.(app)).toBe(true);
    setCanvasType(CanvasType.schemaSQL);
    expect(database.filter?.(app)).toBe(true);
    setCanvasType(CanvasType.generatorCode);
    expect(database.filter?.(app)).toBe(false);
  });
});

describe('createScopeActions / Import and Export', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.ERD);
  });

  it('routes every import entry through the import file callback', () => {
    const onImport = vi.fn();
    setImportFileCallback(onImport);
    const entries = find(scope(), 'Import').next ?? [];

    expect(names(entries)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);

    find(entries, 'json').perform?.(app);
    find(entries, 'Schema SQL').perform?.(app);
    find(entries, 'GraphQL').perform?.(app);
    find(entries, 'DBML').perform?.(app);
    find(entries, 'AML').perform?.(app);

    expect(onImport).toHaveBeenNthCalledWith(1, {
      type: 'json',
      op: 'set',
      accept: '.json',
    });
    expect(onImport).toHaveBeenNthCalledWith(2, {
      type: 'sql',
      op: 'set',
      accept: '.sql',
    });
    expect(onImport).toHaveBeenNthCalledWith(3, {
      type: 'graphql',
      op: 'set',
      accept: '.graphql,.gql,.graphqls',
    });
    expect(onImport).toHaveBeenNthCalledWith(4, {
      type: 'dbml',
      op: 'set',
      accept: '.dbml',
    });
    expect(onImport).toHaveBeenNthCalledWith(5, {
      type: 'aml',
      op: 'set',
      accept: '.aml',
    });
  });

  it('routes every Import and Add entry through the callback as an append', () => {
    const onImport = vi.fn();
    setImportFileCallback(onImport);
    const entries = find(scope(), 'Import and Add').next ?? [];

    expect(names(entries)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);
    entries.forEach(entry => entry.perform?.(app));

    expect(onImport.mock.calls.map(([options]) => options)).toEqual([
      { type: 'json', op: 'set', accept: '.json', mode: 'append' },
      { type: 'sql', op: 'set', accept: '.sql', mode: 'append' },
      {
        type: 'graphql',
        op: 'set',
        accept: '.graphql,.gql,.graphqls',
        mode: 'append',
      },
      { type: 'dbml', op: 'set', accept: '.dbml', mode: 'append' },
      { type: 'aml', op: 'set', accept: '.aml', mode: 'append' },
    ]);
  });

  it('offers Import and Add on the ERD tab alone, as Import', () => {
    const importAndAdd = find(scope(), 'Import and Add');

    expect(importAndAdd.filter?.(app)).toBe(true);
    setCanvasType(CanvasType.schemaSQL);
    expect(importAndAdd.filter?.(app)).toBe(false);
  });

  it('offers no Import and Add in a readonly editor, Import still offered', () => {
    app.store.destroy();
    app = createTestAppContext({ getReadonly: () => true });

    expect(find(scope(), 'Import and Add').filter?.(app)).toBe(false);
    expect(find(scope(), 'Import').filter?.(app)).toBe(true);
  });

  it('finds the GraphQL import entry by its sdl keywords', () => {
    const entries = find(scope(), 'Import').next ?? [];

    expect(names(searchActions(entries, 'sdl'))).toContain('GraphQL');
  });

  it('finds the DBML import entry by its dbdiagram keywords', () => {
    const entries = find(scope(), 'Import').next ?? [];

    expect(names(searchActions(entries, 'dbdiagram'))).toContain('DBML');
  });

  it('finds the AML import entry by its azimutt keywords', () => {
    const entries = find(scope(), 'Import').next ?? [];

    expect(names(searchActions(entries, 'azimutt'))).toContain('AML');
  });

  it('exports the document as json named after the database', async () => {
    const calls: ExportCall[] = [];
    setExportFileCallback((blob, options) =>
      calls.push({ blob, fileName: options.fileName })
    );
    addTable('users');

    find(find(scope(), 'Export').next ?? [], 'json').perform?.(app);

    expect(calls).toHaveLength(1);
    expect(calls[0].fileName).toMatch(/\.erd\.json$/);
    const parsed = JSON.parse(await calls[0].blob.text());
    expect(parsed.settings).toBeTruthy();
    expect(parsed.doc.tableIds).toHaveLength(1);
  });

  it('exports the generated schema sql', async () => {
    const calls: ExportCall[] = [];
    setExportFileCallback((blob, options) =>
      calls.push({ blob, fileName: options.fileName })
    );
    addTable('users');

    find(find(scope(), 'Export').next ?? [], 'Schema SQL').perform?.(app);

    expect(calls).toHaveLength(1);
    expect(calls[0].fileName).toMatch(/\.sql$/);
    expect(await calls[0].blob.text()).toContain('users');
  });

  it('lists Image last under Export, which opens the export image dialog', () => {
    const calls: ExportCall[] = [];
    setExportFileCallback((blob, options) =>
      calls.push({ blob, fileName: options.fileName })
    );
    const opened = vi.fn();
    const off = app.emitter.on({ openExportImage: opened });
    const entries = find(scope(), 'Export').next ?? [];

    expect(names(entries)).toEqual(['json', 'Schema SQL', 'Image']);

    find(entries, 'Image').perform?.(app);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
    off();
  });

  it('finds the Image export entry by its png keyword', () => {
    const entries = find(scope(), 'Export').next ?? [];

    expect(names(searchActions(entries, 'png'))).toContain('Image');
  });

  it('finds the Image export entry by its svg and vector keywords', () => {
    const entries = find(scope(), 'Export').next ?? [];

    expect(names(searchActions(entries, 'svg'))).toContain('Image');
    expect(names(searchActions(entries, 'vector'))).toContain('Image');
  });

  it('hides Import and Export outside the ERD canvas', () => {
    const actions = scope();
    const importAction = find(actions, 'Import');
    const exportAction = find(actions, 'Export');

    expect(importAction.filter?.(app)).toBe(true);
    expect(exportAction.filter?.(app)).toBe(true);

    setCanvasType(CanvasType.schemaSQL);
    expect(importAction.filter?.(app)).toBe(false);
    expect(exportAction.filter?.(app)).toBe(false);
  });
});

describe('createScopeActions / ERD commands', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.ERD);
  });

  it('adds a table when New Table is performed', async () => {
    find(scope(), 'New Table').perform?.(app);
    await flush();

    expect(app.store.state.doc.tableIds).toHaveLength(1);
  });

  it('adds a memo when New Memo is performed', async () => {
    find(scope(), 'New Memo').perform?.(app);
    await flush();

    expect(app.store.state.doc.memoIds).toHaveLength(1);
  });

  it('offers one automatic table placement action per placement', () => {
    expect(
      find(scope(), 'Auto Layout').next?.map(action => action.name)
    ).toEqual(['Force', 'Flow', 'Tree - vertical', 'Tree - horizontal']);
  });

  it('opens the automatic table placement dialog on the placement picked', async () => {
    const placements: string[] = [];
    app.emitter.on({
      openAutomaticTablePlacement: ({ payload: { placement } }) => {
        placements.push(placement);
      },
    });

    find(find(scope(), 'Auto Layout').next ?? [], 'Flow').perform?.(app);
    await flush();

    expect(placements).toEqual([TablePlacement.flow]);
  });

  it('exposes every draw-relationship menu with the Relationship keyword', () => {
    const actions = scope();

    for (const menu of drawRelationshipMenus) {
      const action = find(actions, menu.name);
      expect(action.keywords).toBe('Relationship');
      expect(action.shortcut).toBe(
        app.keyBindingMap[menu.keyBindingName][0].shortcut
      );
      expect(action.icon).toBeTruthy();
    }
  });

  it('starts drawing the relationship type that was performed', async () => {
    const menu = drawRelationshipMenus[1];

    find(scope(), menu.name).perform?.(app);
    await flush();

    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      menu.relationshipType
    );
  });
});

describe('createScopeActions / Bracket', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.schemaSQL);
  });

  it('offers one entry per bracket type and checks the active one', () => {
    const bracket = find(scope(), 'Bracket');
    const checked = (bracket.next ?? []).filter(item => item.icon);

    expect(names(bracket.next ?? [])).toEqual(names(bracketMenus as any));
    expect(names(checked)).toEqual([
      bracketMenus.find(
        menu => menu.value === app.store.state.settings.bracketType
      )?.name,
    ]);
  });

  it('changes the bracket type when an entry is performed', async () => {
    const target = bracketMenus.find(
      menu => menu.value !== app.store.state.settings.bracketType
    );

    find(find(scope(), 'Bracket').next ?? [], target!.name).perform?.(app);
    await flush();

    expect(app.store.state.settings.bracketType).toBe(target!.value);
  });
});

describe('createScopeActions / generator code options', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.generatorCode);
  });

  it('changes the language when an entry is performed', async () => {
    const target = languageMenus.find(
      menu => menu.value !== app.store.state.settings.language
    );
    const language = find(scope(), 'Language');

    expect(names(language.next ?? [])).toEqual(names(languageMenus as any));
    find(language.next ?? [], target!.name).perform?.(app);
    await flush();

    expect(app.store.state.settings.language).toBe(target!.value);
  });

  it('changes the table name case when an entry is performed', async () => {
    const target = tableNameCaseMenus.find(
      menu => menu.value !== app.store.state.settings.tableNameCase
    );
    const action = find(scope(), 'Table Name Case');

    expect(names(action.next ?? [])).toEqual(names(tableNameCaseMenus as any));
    find(action.next ?? [], target!.name).perform?.(app);
    await flush();

    expect(app.store.state.settings.tableNameCase).toBe(target!.value);
  });

  it('changes the column name case when an entry is performed', async () => {
    const target = columnNameCaseMenus.find(
      menu => menu.value !== app.store.state.settings.columnNameCase
    );
    const action = find(scope(), 'Column Name Case');

    expect(names(action.next ?? [])).toEqual(names(columnNameCaseMenus as any));
    find(action.next ?? [], target!.name).perform?.(app);
    await flush();

    expect(app.store.state.settings.columnNameCase).toBe(target!.value);
  });

  it('checks the currently selected entry of each name-case menu', () => {
    const checkedNames = (action: Action) =>
      names((action.next ?? []).filter(item => item.icon));

    expect(checkedNames(find(scope(), 'Language'))).toHaveLength(1);
    expect(checkedNames(find(scope(), 'Table Name Case'))).toHaveLength(1);
    expect(checkedNames(find(scope(), 'Column Name Case'))).toHaveLength(1);
  });
});

describe('createScopeActions / table actions', () => {
  it('appends one action per table sorted by name ascending', () => {
    setCanvasType(CanvasType.ERD);
    addTable('zebra');
    addTable('apple');
    addTable('Mango');

    const tableActions = scope().filter(action => action.keywords === 'Table');

    expect(names(tableActions)).toEqual(['apple', 'Mango', 'zebra']);
  });

  it('labels a blank table name as unnamed', () => {
    setCanvasType(CanvasType.ERD);
    addTable('   ');

    const tableActions = scope().filter(action => action.keywords === 'Table');

    expect(names(tableActions)).toEqual(['unnamed']);
  });

  it('keeps the table jumps outside the ERD canvas, taking that tab alone first', async () => {
    setCanvasType(CanvasType.ERD);
    const id = addTable('users', 600, 400);
    setCanvasType(CanvasType.schemaSQL);
    const batches: string[][] = [];
    const unsubscribe = app.store.subscribe(list => {
      batches.push(list.map(action => action.type));
    });

    find(scope(), 'users').perform?.(app);
    await flush();
    unsubscribe();

    const jump = batches.find(batch => batch.includes('settings.scrollTo'));
    expect(batches[0]).toEqual(['settings.changeCanvasType']);
    expect(jump).toBeDefined();
    expect(jump).not.toContain('settings.changeCanvasType');
    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(app.store.state.editor.selectedMap[id]).toBeTruthy();
  });

  it('scrolls to and selects the table when performed', async () => {
    setCanvasType(CanvasType.ERD);
    const id = addTable('users', 600, 400);
    const recorder = recordActions();

    find(scope(), 'users').perform?.(app);
    await flush();
    recorder.unsubscribe();

    expect(recorder.types()).toContain('settings.scrollTo');
    expect(app.store.state.editor.selectedMap[id]).toBeTruthy();
    expect(app.store.state.editor.focusTable?.tableId).toBe(id);
    expect(app.store.state.settings.originX).toBeLessThanOrEqual(0);
    expect(app.store.state.settings.originY).toBeLessThanOrEqual(0);
  });

  /**
   * The landing point the DOM scene had: the table parks START_X, START_Y in
   * from the corner, scaled by the zoom, so at 0.5 it sits 100 px in and at 1.5
   * it sits 300 px in, from a position whose origins the default screen allows.
   */
  it.each([0.5, 1, 1.5])(
    'parks the table a zoomed START_X, START_Y in from the corner at zoom %s',
    async zoomLevel => {
      setCanvasType(CanvasType.ERD);
      const id = addTable('users', 100, 200);
      app.store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));

      find(scope(), 'users').perform?.(app);
      await flush();

      const table = app.store.state.collections.tableEntities[id];
      const screen = toScreenPoint(app.store.state.settings, table.ui);
      expect(table.ui).toMatchObject({ x: 300, y: 300 });
      expect(screen.x).toBeCloseTo(START_X * zoomLevel, 4);
      expect(screen.y).toBeCloseTo(START_Y * zoomLevel, 4);
    }
  );

  it('neither starts nor finishes a relationship being drawn, however many tables it jumps to', async () => {
    setCanvasType(CanvasType.ERD);
    const users = addTable('users', 100, 200);
    const orders = addTable('orders', 600, 200);
    app.store.dispatchSync(
      addColumnAction({ id: 'users_id', tableId: users }),
      changeColumnPrimaryKeyAction({
        id: 'users_id',
        tableId: users,
        value: true,
      }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    const columnIds =
      app.store.state.collections.tableEntities[orders].columnIds;

    find(scope(), 'users').perform?.(app);
    await flush();
    find(scope(), 'orders').perform?.(app);
    await flush();

    const { doc, collections, editor } = app.store.state;
    expect(doc.relationshipIds).toEqual([]);
    expect(collections.tableEntities[orders].columnIds).toEqual(columnIds);
    expect(editor.drawRelationship).toMatchObject({ start: null });
    expect(editor.selectedMap).toEqual({ [orders]: SelectType.table });
  });

  /** The panel is 380 px wide, 16 px in from the left, and a jump keeps 16 px from it. */
  it.each([
    ['ERD', CanvasType.ERD],
    ['Schema SQL', CanvasType.schemaSQL],
  ])(
    'parks the table clear of an open Find and Replace panel, jumping from the %s tab',
    async (_, canvasType) => {
      setCanvasType(CanvasType.ERD);
      const id = addTable('users', 100, 200);
      app.store.dispatchSync(
        changeViewportAction({ width: 1440, height: 900 }),
        changeOpenMapAction({ [Open.findReplace]: true })
      );
      setCanvasType(canvasType);

      find(scope(), 'users').perform?.(app);
      await flush();

      const table = app.store.state.collections.tableEntities[id];
      const screen = toScreenPoint(app.store.state.settings, table.ui);
      expect(screen.x).toBeCloseTo(16 + 380 + 16, 4);
      expect(screen.y).toBeCloseTo(START_Y, 4);
    }
  );

  it('parks the table in the strip a narrow canvas leaves beside the panel', async () => {
    setCanvasType(CanvasType.ERD);
    const id = addTable('users', 100, 200);
    app.store.dispatchSync(
      changeViewportAction({ width: 600, height: 400 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );

    find(scope(), 'users').perform?.(app);
    await flush();

    const table = app.store.state.collections.tableEntities[id];
    const screen = toScreenPoint(app.store.state.settings, table.ui);
    expect(screen.x).toBeCloseTo(16 + 380 + 16, 4);
    expect(screen.y).toBeCloseTo(START_Y, 4);
  });

  it('keeps its landing point beside a panel that leaves less than 160 px of the canvas clear', async () => {
    setCanvasType(CanvasType.ERD);
    const id = addTable('users', 100, 200);
    app.store.dispatchSync(
      changeViewportAction({ width: 16 + 380 + 16 + 159, height: 400 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );

    find(scope(), 'users').perform?.(app);
    await flush();

    const table = app.store.state.collections.tableEntities[id];
    const screen = toScreenPoint(app.store.state.settings, table.ui);
    expect(screen.x).toBeCloseTo(START_X, 4);
  });

  it('carries the table icon on table actions, drawn as the rows of a field found are', async () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    expect(await iconOf(find(scope(), 'users'))).toBe('table-2');
  });
});

describe('createScopeActions / no focus actions', () => {
  /** Stands the reader in a Flow, which is where the Focus rows used to be offered from. */
  const enterFlow = () => {
    setCanvasType(CanvasType.visualization);
    app.store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      viewOpenAction({ kind: ViewKind.flow })
    );
  };

  /** AC-52. The rows are gone from every tab and both visualization modes. */
  it('offers no Focus action from any canvas type or visualization mode', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    // The toolbox and the one row the table itself is, which is the jump to it:
    // a second row minted per table would stand in this list whatever keyword
    // it carried, where the filter below only catches the one that was taken out.
    expect(visibleNames()).toEqual([...ERD_TOOLBOX, 'users']);

    for (const canvasType of [
      CanvasType.ERD,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.visualization,
    ]) {
      setCanvasType(canvasType);
      expect(scope().filter(action => action.keywords === 'Focus')).toEqual([]);
    }

    for (const value of [VisualizationMode.graph, VisualizationMode.flow]) {
      setCanvasType(CanvasType.visualization);
      app.store.dispatchSync(changeVisualizationModeAction({ value }));
      expect(scope().filter(action => action.keywords === 'Focus')).toEqual([]);
    }
  });

  it('offers from a Flow the jump to the ERD for each table, and no Focus row', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');
    enterFlow();

    const visible = scope().filter(action => action.filter?.(app) ?? true);
    expect(names(visible)).toEqual(['Tab', 'Find and Replace', 'users']);
    expect(find(visible, 'users').keywords).toBe('Table');
  });
});

describe('createScopeActions / Find and Replace', () => {
  it('draws the text-search icon the toolbar button and the context menu draw', async () => {
    expect(await iconOf(find(scope(), 'Find and Replace'))).toBe('text-search');
  });

  it('shows the find and replace chord and asks the panel to open', () => {
    const opened: unknown[] = [];
    app.emitter.on({
      openFindReplace: action => {
        opened.push(action);
      },
    });
    const action = find(scope(), 'Find and Replace');

    expect(action.shortcut).toBe(app.keyBindingMap.findReplace[0].shortcut);
    expect(searchActions([action], 'replace')).toEqual([action]);

    action.perform?.(app);

    expect(opened).toEqual([openFindReplaceAction()]);
  });

  it('names its chord on every tab, and asks the panel to open from each', () => {
    const opened: unknown[] = [];
    app.emitter.on({
      openFindReplace: action => {
        opened.push(action);
      },
    });

    for (const canvasType of [
      CanvasType.visualization,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.settings,
    ]) {
      setCanvasType(canvasType);
      const action = find(scope(), 'Find and Replace');

      expect(action.shortcut).toBe('$mod+KeyF');
      action.perform?.(app);
    }

    expect(opened).toHaveLength(4);
  });

  it.each([Open.automaticTablePlacement, Open.diffViewer, Open.timeTravel])(
    'leaves the row out under %s, which takes the canvas over and keeps the panel shut',
    key => {
      expect(visibleNames()).toContain('Find and Replace');

      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));

      expect(visibleNames()).not.toContain('Find and Replace');
    }
  );
});

describe('searchActions / Hangul', () => {
  const rows = (...list: string[]): Action[] => list.map(name => ({ name }));

  it('leaves a keyword without Hangul to Fuse, its rows and their order, where it drops no holder', () => {
    const catalog: Action[] = [
      ...rows('사용자', 'user사용자', 'users', 'New Memo'),
      { name: 'orders', keywords: 'Table', tableId: 'orders' },
    ];
    const fuse = new Fuse(catalog, {
      keys: [
        'name',
        {
          name: 'keywords',
          getFn: action => (action.tableId ? [] : (action.keywords ?? [])),
        },
      ],
      threshold: SEARCH_THRESHOLD,
    });

    for (const keyword of ['user', 'memo', 'ord', 'qqqq']) {
      expect(searchActions(catalog, keyword)).toEqual(
        fuse.search(keyword).map(result => result.item)
      );
    }
  });

  it('keeps 사용자 at every step a Korean IME hands over, where Fuse drops it', () => {
    const catalog = rows('사용자', '상품', '주문 내역', 'Auto Layout');

    expect(names(searchActions(catalog, 'ㅅ'))).toEqual(['사용자', '상품']);
    for (const step of [...IME_SAYONG, ...IME_CHOSEONG]) {
      expect(names(searchActions(catalog, step))).toContain('사용자');
    }
    expect(names(searchActions(catalog, '사요'))).toEqual(['사용자']);
    expect(names(searchActions(catalog, 'ㅈㅁ'))).toEqual(['주문 내역']);
  });

  it('ranks the rows holding it whole, then from their start, then inside, then what Fuse alone finds', () => {
    const catalog = rows('주문 사용자 목록', '사용쟈', '사용자 설정', '사용자');

    // 사용쟈 fuzzes to the keyword but does not spell it.
    expect(names(searchActions(catalog, '사용자'))).toEqual([
      '사용자',
      '사용자 설정',
      '주문 사용자 목록',
      '사용쟈',
    ]);
  });

  it('breaks a tie by the level order where Fuse finds none of the rows, the same each time', () => {
    const catalog = rows('사용자', '상인', '소원', '주문');

    const first = names(searchActions(catalog, 'ㅅㅇ'));

    expect(first).toEqual(['상인', '소원', '사용자']);
    expect(names(searchActions(catalog, 'ㅅㅇ'))).toEqual(first);
  });

  it('reads the keywords of a command, never the Table of a table row', () => {
    expect(
      names(searchActions([{ name: 'zzzz', keywords: '관계 그리기' }], 'ㄱㄱ'))
    ).toEqual(['zzzz']);
    expect(
      searchActions(
        [{ name: 'orders', keywords: '테이블', tableId: 'orders' }],
        'ㅌㅇㅂ'
      )
    ).toEqual([]);
  });
});

/** English but for the texts given, as a dictionary written for another language reads. */
const translated = (texts: Partial<Record<MessageKey, string>>) =>
  ({ ...en, ...texts }) as Messages;

/** A Korean reader's palette: no command it names holds its English. */
const korean = createI18n(
  'ko-KR',
  translated({
    'palette.tab': '탭',
    'common.newTable': '새 테이블',
    'common.newMemo': '새 메모',
    'common.findAndReplace': '찾기 및 바꾸기',
    'palette.keywords.findReplace': '찾기 바꾸기 이름',
    'palette.keywords.graphql': 'graphql sdl gql 스키마',
    'common.table': '테이블',
    'common.unnamed': '이름 없음',
    'common.system': '시스템',
    'common.theme': '테마',
    'common.displayLanguage': '표시 언어',
  })
);

const preferences = (given: PalettePreferences) =>
  createScopeActions(app, sourceI18n, given);

const submenu = (actions: Action[], name: string) =>
  find(actions, name).next ?? [];

/** The names of a submenu's rows that draw the check. */
const checked = async (actions: Action[]) => {
  const marked: string[] = [];
  for (const action of actions) {
    if ((await iconOf(action)) === 'check') marked.push(action.name);
  }
  return marked;
};

describe('named', () => {
  it('names a row in English with no alias', () => {
    expect(named(sourceI18n, 'common.newTable')).toEqual({
      name: 'New Table',
    });
    expect(
      named(sourceI18n, 'common.findAndReplace', 'palette.keywords.findReplace')
    ).toEqual({ name: 'Find and Replace', keywords: 'find replace rename' });
    expect(named(sourceI18n, { name: 'GraphQL' })).toEqual({
      name: 'GraphQL',
    });
  });

  it('keeps as the alias the English of each text a translation changes, the name and the keywords alike', () => {
    expect(named(korean, 'common.newTable')).toEqual({
      name: '새 테이블',
      alias: ['New Table'],
    });
    expect(
      named(korean, 'common.findAndReplace', 'palette.keywords.findReplace')
    ).toEqual({
      name: '찾기 및 바꾸기',
      keywords: '찾기 바꾸기 이름',
      alias: ['Find and Replace', 'find replace rename'],
    });
    expect(
      named(korean, { name: 'GraphQL' }, 'palette.keywords.graphql')
    ).toEqual({
      name: 'GraphQL',
      keywords: 'graphql sdl gql 스키마',
      alias: ['graphql sdl gql schema'],
    });
    // A text the dictionary leaves as English needs no alias.
    expect(named(korean, 'common.import')).toEqual({ name: 'Import' });
  });

  it('reads a shared menu by its key, or by its name where it has none', () => {
    const pseudo = createI18n('de-DE', pseudoMessages('de'));
    const singleQuote = bracketMenus[0];
    const none = bracketMenus[bracketMenus.length - 1];

    expect(named(pseudo, singleQuote)).toEqual({ name: 'SingleQuote' });
    expect(named(pseudo, none)).toEqual({ name: 'de:None', alias: ['None'] });
  });
});

describe('createScopeActions / translated', () => {
  const pseudo = createI18n('de-DE', pseudoMessages('de'));

  it('reads every command of every tab through the dictionary, its English kept as the alias', () => {
    for (const canvasType of [
      CanvasType.ERD,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
    ]) {
      setCanvasType(canvasType);
      const commands = createScopeActions(app, pseudo, {
        appearance: Appearance.dark,
        locale: 'en',
      }).filter(action => action.filter?.(app) ?? true);

      for (const { name, keywords, alias } of commands) {
        expect(name).toMatch(/^de:/);
        expect(keywords ?? 'de:').toMatch(/^de:/);
        expect(alias).toEqual(
          [name, keywords]
            .filter(Boolean)
            .map(text => (text as string).slice(3))
        );
      }
    }
  });

  it('knows each row opening a submenu by its own message key, the same in any language', () => {
    const preferences = { appearance: Appearance.dark, locale: 'en' } as const;
    const ids = (i18n: typeof pseudo) =>
      createScopeActions(app, i18n, preferences)
        .filter(action => action.next)
        .map(action => action.id);

    const translated = ids(pseudo);

    expect(translated).toHaveLength(12);
    expect(translated.every(Boolean)).toBe(true);
    expect(new Set(translated).size).toBe(translated.length);
    expect(ids(sourceI18n)).toEqual(translated);
    expect(translated.slice(-2)).toEqual([
      'common.theme',
      'common.displayLanguage',
    ]);
  });

  it('reads the rows of each submenu through the dictionary, vendors, formats and cases as written', () => {
    setCanvasType(CanvasType.ERD);
    const actions = createScopeActions(app, pseudo);

    expect(names(submenu(actions, 'de:Tab'))).toEqual([
      'de:Entity Relationship Diagram',
      'de:Visualization',
      'de:Schema SQL',
      'de:Code Generator',
      'de:Settings',
    ]);
    expect(names(submenu(actions, 'de:Import'))).toEqual([
      'json',
      'de:Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);
    expect(pairs(submenu(actions, 'de:Export'))).toEqual([
      ['json', undefined],
      ['de:Schema SQL', undefined],
      ['de:Image', 'de:image png svg vector picture clipboard'],
    ]);
    expect(names(submenu(actions, 'de:Auto Layout'))).toEqual([
      'de:Force',
      'de:Flow',
      'de:Tree - vertical',
      'de:Tree - horizontal',
    ]);
    expect(names(submenu(actions, 'de:Bracket')).at(-1)).toBe('de:None');
    expect(names(submenu(actions, 'de:Table Name Case')).at(-1)).toBe(
      'de:None'
    );
    expect(names(submenu(actions, 'de:Column Name Case')).at(-1)).toBe(
      'de:None'
    );
    expect(names(submenu(actions, 'de:Database'))).toEqual(
      databaseMenus.map(menu => menu.name)
    );
    expect(names(submenu(actions, 'de:Language'))).toEqual(
      languageMenus.map(menu => menu.name)
    );
    expect(pairs(submenu(actions, 'de:Import')).slice(2)).toEqual([
      ['GraphQL', 'de:graphql sdl gql schema'],
      ['DBML', 'de:dbml dbdiagram dbdocs schema'],
      ['AML', 'de:aml azimutt markup language schema'],
    ]);
  });

  it('names the kind of a table row, and a table with no name, in the language given', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');
    addTable('   ');

    const tables = createScopeActions(app, pseudo).filter(
      action => action.tableId
    );

    expect(pairs(tables)).toEqual([
      ['de:unnamed', 'de:Table'],
      ['users', 'de:Table'],
    ]);
    expect(tables.every(action => action.alias === undefined)).toBe(true);
  });

  it('finds a translated command by the English it never shows, and by its own words', () => {
    setCanvasType(CanvasType.ERD);
    const commands = createScopeActions(app, korean).filter(
      action => !action.tableId && (action.filter?.(app) ?? true)
    );

    expect(names(searchActions(commands, 'new table'))[0]).toBe('새 테이블');
    expect(names(searchActions(commands, 'rename'))).toEqual([
      '찾기 및 바꾸기',
    ]);
    expect(names(searchActions(commands, '새 메모'))[0]).toBe('새 메모');
    expect(keywordHolder('Find and')(find(commands, '찾기 및 바꾸기'))).toBe(
      true
    );
  });

  it('scores each English text apart, so a typo English finds finds the translated command too', () => {
    setCanvasType(CanvasType.ERD);
    const inEnglish = createScopeActions(app).filter(
      action => !action.tableId && (action.filter?.(app) ?? true)
    );
    const inKorean = createScopeActions(app, korean).filter(
      action => !action.tableId && (action.filter?.(app) ?? true)
    );

    expect(names(searchActions(inEnglish, 'renme'))).toContain(
      'Find and Replace'
    );
    expect(names(searchActions(inKorean, 'renme'))).toContain('찾기 및 바꾸기');
  });

  it('holds a keyword in a translated command only where English holds it, never across its name and keywords', () => {
    setCanvasType(CanvasType.ERD);
    const english = find(createScopeActions(app), 'Find and Replace');
    const translated = find(createScopeActions(app, korean), '찾기 및 바꾸기');

    expect(keywordHolder('replace find')(english)).toBe(false);
    expect(keywordHolder('replace find')(translated)).toBe(false);
    expect(keywordHolder('replace rename')(translated)).toBe(true);
  });

  it('ranks a translated command by the initials of its Hangul syllables', () => {
    setCanvasType(CanvasType.ERD);
    const commands = createScopeActions(app, korean).filter(
      action => !action.tableId && (action.filter?.(app) ?? true)
    );

    expect(names(searchActions(commands, 'ㅅㅌㅇㅂ'))[0]).toBe('새 테이블');
    expect(names(searchActions(commands, 'ㅊㄱ'))[0]).toBe('찾기 및 바꾸기');
  });

  it('never finds a table row by an alias, as it never finds one by its kind', () => {
    const table: Action = {
      name: 'users',
      tableId: 'users',
      alias: ['orders'],
    };

    expect(searchActions([table], 'orders')).toEqual([]);
    expect(keywordHolder('orders')(table)).toBe(false);
    expect(keywordHolder('users')(table)).toBe(true);
  });
});

describe('createPreferenceActions', () => {
  it('offers neither Theme nor Display Language while no picker is given', () => {
    setCanvasType(CanvasType.ERD);

    expect(names(scope())).not.toContain('Theme');
    expect(names(scope())).not.toContain('Display Language');
    expect(createPreferenceActions(sourceI18n, {})).toEqual([]);
  });

  it('offers each only while its picker is given, after the commands on every tab', () => {
    const visibleOf = (given: PalettePreferences) =>
      names(preferences(given).filter(action => action.filter?.(app) ?? true));

    setCanvasType(CanvasType.ERD);
    expect(visibleOf({ appearance: Appearance.light })).toEqual([
      ...ERD_TOOLBOX,
      'Theme',
    ]);
    expect(visibleOf({ locale: 'system' })).toEqual([
      ...ERD_TOOLBOX,
      'Display Language',
    ]);

    for (const canvasType of [
      CanvasType.visualization,
      CanvasType.schemaSQL,
      CanvasType.generatorCode,
      CanvasType.settings,
    ]) {
      setCanvasType(canvasType);
      expect(
        visibleOf({ appearance: 'system', locale: 'ko-KR' }).slice(-2)
      ).toEqual(['Theme', 'Display Language']);
    }
  });

  it('draws Theme as the toolbar draws it, and Display Language as the language button does', async () => {
    const actions = preferences({ appearance: 'system', locale: 'system' });

    expect(await iconOf(find(actions, 'Theme'))).toBe('contrast');
    expect(await iconOf(find(actions, 'Display Language'))).toBe('languages');
  });

  it('lists System, Light and Dark under Theme, checking the appearance in force', async () => {
    for (const [appearance, expected] of [
      ['system', 'System'],
      [Appearance.light, 'Light'],
      [Appearance.dark, 'Dark'],
    ] as const) {
      const rows = submenu(preferences({ appearance }), 'Theme');

      expect(names(rows)).toEqual(['System', 'Light', 'Dark']);
      expect(await checked(rows)).toEqual([expected]);
    }
  });

  it('sets the appearance alone from a Theme row, leaving the colors to the element', () => {
    const picked: unknown[] = [];
    app.emitter.on({
      setThemeOptions: ({ payload }) => {
        picked.push(payload);
      },
    });
    const rows = submenu(preferences({ appearance: 'system' }), 'Theme');

    for (const row of rows) row.perform?.(app);

    expect(picked).toEqual([
      { appearance: 'system' },
      { appearance: Appearance.light },
      { appearance: Appearance.dark },
    ]);
  });

  it('lists System and then every language by its own name under Display Language', () => {
    const rows = submenu(preferences({ locale: 'en' }), 'Display Language');

    expect(rows).toHaveLength(26);
    expect(names(rows)).toEqual([
      'System',
      ...LOCALES.map(locale => locale.label),
    ]);
    expect(rows.slice(1).map(row => row.alias)).toEqual(
      LOCALES.map(({ english, code }) => [english, code])
    );
    expect(rows[0].alias).toBeUndefined();
  });

  it('checks the language option in force, System included', async () => {
    for (const [locale, expected] of [
      ['system', 'System'],
      ['en', 'English'],
      ['ko-KR', '한국어'],
      ['ar-SA', 'العربية'],
    ] as const) {
      const rows = submenu(preferences({ locale }), 'Display Language');
      expect(await checked(rows)).toEqual([expected]);
    }
  });

  it('asks the element for the language picked, System included', () => {
    const picked: LocaleOption[] = [];
    app.emitter.on({
      setLocaleOption: ({ payload }) => {
        picked.push(payload.locale);
      },
    });
    const rows = submenu(preferences({ locale: 'en' }), 'Display Language');

    find(rows, 'System').perform?.(app);
    find(rows, '한국어').perform?.(app);
    find(rows, 'English').perform?.(app);

    expect(picked).toEqual(['system', 'ko-KR', 'en']);
  });

  it('finds a language by its English name or its code, kor reaching 한국어', () => {
    const rows = submenu(preferences({ locale: 'en' }), 'Display Language');

    expect(names(searchActions(rows, 'kor'))[0]).toBe('한국어');
    expect(names(searchActions(rows, 'japanese'))[0]).toBe('日本語');
    expect(names(searchActions(rows, 'zh-TW'))[0]).toBe('繁體中文');
    expect(names(searchActions(rows, 'Deutsch'))[0]).toBe('Deutsch');
  });

  it('ranks a language by the initials of its Hangul syllables', () => {
    const rows = submenu(preferences({ locale: 'en' }), 'Display Language');

    expect(names(searchActions(rows, 'ㅎㄱㅇ'))[0]).toBe('한국어');
    expect(names(searchActions(rows, '한국'))[0]).toBe('한국어');
  });

  it('names Theme, Display Language and System in the language given', () => {
    const rows = createPreferenceActions(korean, {
      appearance: 'system',
      locale: 'system',
    });
    const languages = submenu(rows, '표시 언어');

    expect(names(rows)).toEqual(['테마', '표시 언어']);
    expect(names(submenu(rows, '테마'))).toEqual(['시스템', 'Light', 'Dark']);
    expect(languages[0]).toMatchObject({ name: '시스템', alias: ['System'] });
    expect(names(searchActions(languages, 'system'))[0]).toBe('시스템');
  });
});

describe('createShowAllAction', () => {
  const payload = { query: 'users', fields: [] };

  it('names the count the panel opens on, one match and many as English has always read them', () => {
    expect(createShowAllAction(1, payload).name).toBe(
      'Show 1 match in Find and Replace'
    );
    expect(createShowAllAction(3, payload).name).toBe(
      'Show all 3 matches in Find and Replace'
    );
    expect(createShowAllAction(0, payload).name).toBe(
      'Show all 0 matches in Find and Replace'
    );
  });

  it('names the count in the language given, by its own plural rules', () => {
    const pseudo = createI18n('ru-RU', pseudoMessages('ru'));

    expect(createShowAllAction(21, payload, pseudo).name).toBe(
      'ru:Show 21 match in Find and Replace'
    );
    expect(createShowAllAction(5, payload, pseudo).name).toBe(
      'ru:Show all 5 matches in Find and Replace'
    );
  });
});
