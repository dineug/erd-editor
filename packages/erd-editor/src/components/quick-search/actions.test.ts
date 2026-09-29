import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import {
  Action,
  allScopeActions,
  createMatchActions,
  createScopeActions,
  MATCH_ACTION_LIMIT,
  rankPaletteActions,
  searchActions,
  TABLE_ACTION_LIMIT,
} from '@/components/quick-search/actions';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { START_X, START_Y } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import { ChangeActionTypes } from '@/engine/actions';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeZoomLevelAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { toScreenPoint } from '@/konva/scene/viewport';
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

const visibleNames = () =>
  names(scope().filter(action => action.filter?.(app) ?? true));

/** Every row the ERD canvas offers, which is the whole of what its scope holds. */
const ERD_TOOLBOX = [
  'Tab',
  'Database',
  'Import',
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

describe('allScopeActions', () => {
  it('exposes a single Tab action holding the five canvas tabs', () => {
    expect(names(allScopeActions)).toEqual(['Tab']);
    expect(names(allScopeActions[0].next ?? [])).toEqual([
      'Entity Relationship Diagram',
      'Visualization',
      'Schema SQL',
      'Generator Code',
      'Settings',
    ]);
  });

  it('gives every tab an icon but no keyword or shortcut', () => {
    for (const tab of allScopeActions[0].next ?? []) {
      expect(tab.icon).toBeTruthy();
      expect(tab.keywords).toBeUndefined();
      expect(tab.shortcut).toBeUndefined();
    }
  });

  it('hides only the tab matching the current canvas type', () => {
    const tabs = allScopeActions[0].next ?? [];
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
    expect(visible(CanvasType.generatorCode)).not.toContain('Generator Code');
    expect(visible(CanvasType.settings)).not.toContain('Settings');
  });

  it('switches the canvas type when a tab is performed', async () => {
    setCanvasType(CanvasType.ERD);
    const tabs = allScopeActions[0].next ?? [];

    for (const [name, expected] of [
      ['Visualization', CanvasType.visualization],
      ['Schema SQL', CanvasType.schemaSQL],
      ['Generator Code', CanvasType.generatorCode],
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
  it('always starts with the shared Tab action', () => {
    setCanvasType(CanvasType.settings);

    expect(scope()[0].name).toBe('Tab');
    expect(scope()[0]).toBe(allScopeActions[0]);
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

  it('keeps the tabs, Find and Replace and the table jumps in the visualization and settings canvases', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    for (const canvasType of [CanvasType.visualization, CanvasType.settings]) {
      setCanvasType(canvasType);
      expect(
        names(scope().filter(action => action.filter?.(app) ?? true))
      ).toEqual(['Tab', 'Find and Replace', 'users']);
    }
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

  it('carries no icon on table actions', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    expect(find(scope(), 'users').icon).toBeUndefined();
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
});

describe('createMatchActions', () => {
  beforeEach(() => {
    seedFindDocument(app);
  });

  it('lists the columns, comments and memos holding the keyword, one row a field', () => {
    const actions = createMatchActions(app, 'user');

    expect(actions.map(({ name, keywords }) => [name, keywords])).toEqual([
      ['user_id', 'orders.user_id · Column'],
      ['user id', 'users.id · Column comment'],
      ['Every user_id points at users.id', 'Memo'],
    ]);
    for (const action of actions) {
      expect(action.icon).toBeTruthy();
    }
  });

  it('leaves the table names to the fuzzy list, which already holds them', () => {
    expect(
      createMatchActions(app, 'orders').map(({ keywords }) => keywords)
    ).toEqual(['orders · Table comment']);
  });

  it('has nothing for an empty keyword', () => {
    expect(createMatchActions(app, '')).toEqual([]);
  });

  it('stands the reader on the column cell picked, from any tab', async () => {
    setCanvasType(CanvasType.generatorCode);
    const [column] = createMatchActions(app, 'user_id');

    column.perform?.(app);
    await flush();

    const { editor, settings } = app.store.state;
    expect(settings.canvasType).toBe(CanvasType.ERD);
    expect(editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
    });
  });

  it('stays bounded over a schema of hundreds of tables', () => {
    const actions: AnyAction[] = [];
    for (let table = 0; table < 400; table++) {
      const tableId = `t${table}`;
      actions.push(
        addTableAction({ id: tableId, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeTableCommentAction({ id: tableId, value: `table ${table}` })
      );
      for (let column = 0; column < 15; column++) {
        const id = `${tableId}c${column}`;
        actions.push(
          addColumnAction({ id, tableId }),
          changeColumnNameAction({ id, tableId, value: `name_${column}` }),
          changeColumnCommentAction({ id, tableId, value: 'the same comment' })
        );
      }
    }
    app.store.dispatchSync(actions);

    const started = performance.now();
    const rows = createMatchActions(app, 'e');
    const elapsed = performance.now() - started;

    expect(rows).toHaveLength(MATCH_ACTION_LIMIT + 1);
    // Every e the panel would find: one in each of 400 table comments and 6,000
    // column names, three in each of 6,000 column comments, sixteen in the seed.
    expect(rows.at(-1)?.name).toBe(
      'Show all 24416 matches in Find and Replace'
    );
    // Not a benchmark, only a guard against a search that grows past linear.
    expect(elapsed).toBeLessThan(5000);
  });

  it('hands the search over when asked to, however few fields hold it', () => {
    const actions = createMatchActions(app, 'user', true);

    expect(names(actions)).toEqual([
      'user_id',
      'user id',
      'Every user_id points at users.id',
      'Show all 5 matches in Find and Replace',
    ]);
  });

  it('stops at the limit and hands the whole list to Find and Replace', () => {
    for (let index = 0; index <= MATCH_ACTION_LIMIT; index++) {
      app.store.dispatchSync(
        addMemoAction({
          id: `memo-${index}`,
          ui: { x: 0, y: 0, zIndex: 1 },
        }),
        changeMemoValueAction({ id: `memo-${index}`, value: 'many user' })
      );
    }
    const opened: unknown[] = [];
    app.emitter.on({
      openFindReplace: action => {
        opened.push(action);
      },
    });

    const actions = createMatchActions(app, 'user');
    const last = actions.at(-1) as Action;

    expect(actions).toHaveLength(MATCH_ACTION_LIMIT + 1);
    // One in each memo added, and five in the seed: the panel's count.
    expect(last.name).toBe(
      `Show all ${MATCH_ACTION_LIMIT + 6} matches in Find and Replace`
    );

    last.perform?.(app);

    expect(opened).toEqual([openFindReplaceAction({ query: 'user' })]);
  });
});

/** Rows the palette lists for a field, which say where the field is. */
const isFieldRow = (action: Action) =>
  Boolean(action.keywords?.includes(' · '));

/** The rows the palette shows for a keyword typed or pasted in one go. */
const paletteSearch = (keyword: string) =>
  rankPaletteActions(
    app,
    searchActions(
      scope().filter(action => action.filter?.(app) ?? true),
      keyword
    ),
    keyword
  );

const TABLE_WORDS = [
  'user',
  'account',
  'order',
  'product',
  'invoice',
  'payment',
  'email',
  'login',
  'session',
  'address',
  'customer',
  'employee',
  'department',
  'category',
  'comment',
  'message',
  'notification',
  'audit',
  'shipment',
  'coupon',
];

const TABLE_ENDINGS = [
  's',
  '_logs',
  '_history',
  '_settings',
  '_items',
  '_events',
  '_tokens',
  '_roles',
  '_profiles',
  '_attempts',
  '_archive',
  '_links',
  '_stats',
  '_queue',
  '_versions',
  '_drafts',
  '_imports',
  '_exports',
  '_reports',
  '_snapshots',
];

/** 400 tables named the way a real schema names them, each with the columns one would have. */
function seedLargeSchema() {
  const actions: AnyAction[] = [];

  TABLE_WORDS.forEach(word => {
    TABLE_ENDINGS.forEach(ending => {
      const tableId = `${word}${ending}`;
      actions.push(
        addTableAction({ id: tableId, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeTableNameAction({ id: tableId, value: tableId })
      );
      ['id', `${word}_id`, 'created_at', 'updated_at', 'status'].forEach(
        (name, index) => {
          const id = `${tableId}.${index}`;
          actions.push(
            addColumnAction({ id, tableId }),
            changeColumnNameAction({ id, tableId, value: name })
          );
        }
      );
    });
  });
  const users = 'users';
  actions.push(
    addColumnAction({ id: 'users.email', tableId: users }),
    changeColumnNameAction({
      id: 'users.email',
      tableId: users,
      value: 'email',
    }),
    changeColumnCommentAction({
      id: 'users.email',
      tableId: users,
      value: 'where the login link goes',
    })
  );
  app.store.dispatchSync(actions);
}

describe('rankPaletteActions', () => {
  beforeEach(() => {
    setCanvasType(CanvasType.ERD);
  });

  it('puts the rows holding the keyword as typed first, then the fields, then looser hits', () => {
    seedFindDocument(app);

    const rows = paletteSearch('user');

    expect(names(rows).slice(0, 4)).toEqual([
      'users',
      'user_id',
      'user id',
      'Every user_id points at users.id',
    ]);
    for (const row of rows.slice(4)) {
      expect(row.name.toLowerCase()).not.toContain('user');
    }
  });

  it('keeps a command holding the keyword in its keywords ahead of the fields', () => {
    seedFindDocument(app);

    expect(names(paletteSearch('replace'))[0]).toBe('Find and Replace');
  });

  it('lists the fields right below the tables named with the keyword in a schema of 400 tables', () => {
    seedLargeSchema();
    expect(app.store.state.doc.tableIds).toHaveLength(400);

    const rows = paletteSearch('email');
    const firstField = rows.findIndex(isFieldRow);

    // The twenty tables named email, none of the looser hits the cap leaves out.
    expect(firstField).toBe(TABLE_ACTION_LIMIT);
    for (const row of rows.slice(0, firstField)) {
      expect(row.tableId).toBeDefined();
      expect(row.name).toContain('email');
    }
    expect(rows[firstField]).toMatchObject({
      name: 'email',
      keywords: 'users.email · Column',
    });
    expect(rows.filter(row => row.tableId)).toHaveLength(TABLE_ACTION_LIMIT);
    expect(names(rows).some(name => name.startsWith('Show all'))).toBe(false);
  });

  it('hands the tables the cap leaves out to Find and Replace', () => {
    for (let index = 0; index <= TABLE_ACTION_LIMIT; index++) {
      addTable(`item_${index}`);
    }

    const rows = paletteSearch('item');

    expect(rows.filter(row => row.tableId)).toHaveLength(TABLE_ACTION_LIMIT);
    // Below the rows holding the keyword, which no field does here.
    expect(rows[TABLE_ACTION_LIMIT].name).toBe(
      `Show all ${TABLE_ACTION_LIMIT + 1} matches in Find and Replace`
    );
  });

  it('keeps every table row a keyword in no table name lists to the cap, after the fields', () => {
    seedLargeSchema();

    for (const keyword of ['login', 'user_id', 'created_at']) {
      const rows = paletteSearch(keyword);
      const firstField = rows.findIndex(isFieldRow);
      const tableRows = rows.filter(row => row.tableId);

      expect(tableRows.length).toBeLessThanOrEqual(TABLE_ACTION_LIMIT);
      expect(firstField).toBeGreaterThan(-1);
      for (const row of rows.slice(0, firstField)) {
        expect(row.name.toLowerCase()).toContain(keyword);
      }
      expect(rows.length).toBeLessThanOrEqual(
        ERD_TOOLBOX.length + TABLE_ACTION_LIMIT + MATCH_ACTION_LIMIT + 1
      );
    }
  });
});
