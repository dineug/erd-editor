import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

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
  createScopeActions,
  searchActions,
} from '@/components/quick-search/actions';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
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
    { name: 'Automatic Table Placement' },
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
    const visible = names(
      scope().filter(action => action.filter?.(app) ?? true)
    );

    expect(visible).toEqual([
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
      'Automatic Table Placement',
    ]);
  });

  it('keeps only Database and Bracket in the schema SQL canvas', () => {
    setCanvasType(CanvasType.schemaSQL);
    const visible = names(
      scope().filter(action => action.filter?.(app) ?? true)
    );

    expect(visible).toEqual(['Tab', 'Database', 'Bracket']);
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
    ]);
  });

  it('keeps only the Tab action in the visualization and settings canvases', () => {
    for (const canvasType of [CanvasType.visualization, CanvasType.settings]) {
      setCanvasType(canvasType);
      expect(
        names(scope().filter(action => action.filter?.(app) ?? true))
      ).toEqual(['Tab']);
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

    expect(names(entries)).toEqual(['json', 'Schema SQL', 'GraphQL']);

    find(entries, 'json').perform?.(app);
    find(entries, 'Schema SQL').perform?.(app);
    find(entries, 'GraphQL').perform?.(app);

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
  });

  it('finds the GraphQL import entry by its sdl keywords', () => {
    const entries = find(scope(), 'Import').next ?? [];

    expect(names(searchActions(entries, 'sdl'))).toContain('GraphQL');
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

  it('opens the automatic table placement dialog', async () => {
    find(scope(), 'Automatic Table Placement').perform?.(app);
    await flush();

    expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
      true
    );
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

  it('emits no table actions outside the ERD canvas', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');
    setCanvasType(CanvasType.schemaSQL);

    expect(scope().filter(action => action.keywords === 'Table')).toEqual([]);
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
    expect(app.store.state.settings.scrollLeft).toBeLessThanOrEqual(0);
    expect(app.store.state.settings.scrollTop).toBeLessThanOrEqual(0);
  });

  it('carries no icon on table actions', () => {
    setCanvasType(CanvasType.ERD);
    addTable('users');

    expect(find(scope(), 'users').icon).toBeUndefined();
  });
});
