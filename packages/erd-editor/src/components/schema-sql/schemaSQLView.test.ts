import { watch } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  chooseAllTables,
  chooseNoGroup,
  chooseTableGroup,
  chosenTableIds,
  isEveryTableChosen,
  isNoTableChosen,
  resolvePanel,
  resolveTableChoice,
  schemaSQLViewOf,
  showSchemaSQLExport,
  syncTableChoice,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { CanvasType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  removeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';

const apps: AppContext[] = [];

function createApp(width = 1280): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width, height: 800 }));
  apps.push(app);
  return app;
}

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

describe('schemaSQLViewOf', () => {
  it('starts on if not exists, create and use, every table, an unset panel and no focus asked', () => {
    expect({ ...schemaSQLViewOf(createApp()) }).toEqual({
      statements: 'ifNotExists',
      header: 'createAndUse',
      tables: { groups: {}, noGroup: true },
      panel: 'unset',
      focusSave: false,
    });
  });

  it('keeps one view per editor, never shared with another', () => {
    const app = createApp();
    const other = createApp();

    expect(schemaSQLViewOf(app)).toBe(schemaSQLViewOf(app));
    expect(schemaSQLViewOf({ store: app.store })).toBe(schemaSQLViewOf(app));
    expect(schemaSQLViewOf(other)).not.toBe(schemaSQLViewOf(app));

    schemaSQLViewOf(app).statements = 'recreate';
    expect(schemaSQLViewOf(other).statements).toBe('ifNotExists');
  });

  it('tells a watcher which choice changed, and dispatches nothing', async () => {
    const app = createApp();
    const view = schemaSQLViewOf(app);
    const changed: Array<string | number | symbol> = [];
    const dispatched = vi.fn();
    const stopWatching = watch(view).subscribe(name => changed.push(name));
    const unsubscribe = app.store.subscribe(dispatched);

    view.header = 'use';
    await flush();

    expect(changed).toEqual(['header']);
    expect(dispatched).not.toHaveBeenCalled();
    stopWatching();
    unsubscribe();
  });
});

describe('resolvePanel', () => {
  it('knows nothing of an editor not measured yet, and leaves the panel unset', () => {
    const view = schemaSQLViewOf(createApp());

    expect(resolvePanel(view, 0)).toBe('unknown');
    expect(view.panel).toBe('unset');
  });

  it('folds the panel under 640 px and opens it from 640 px, keeping the first answer', () => {
    const narrow = schemaSQLViewOf(createApp());
    const wide = schemaSQLViewOf(createApp());

    expect(resolvePanel(narrow, 639)).toBe('closed');
    expect(narrow.panel).toBe('closed');
    expect(resolvePanel(narrow, 1280)).toBe('closed');

    expect(resolvePanel(wide, 640)).toBe('open');
    expect(wide.panel).toBe('open');
    expect(resolvePanel(wide, 300)).toBe('open');
  });
});

describe('toggleSchemaSQLPanel', () => {
  it('folds an open panel and opens a folded one', () => {
    const app = createApp();
    const view = schemaSQLViewOf(app);

    toggleSchemaSQLPanel(app);
    expect(view.panel).toBe('closed');

    toggleSchemaSQLPanel(app);
    expect(view.panel).toBe('open');
  });

  it('turns an unset panel the other way from where the width would put it', () => {
    const narrow = createApp(600);
    toggleSchemaSQLPanel(narrow);
    expect(schemaSQLViewOf(narrow).panel).toBe('open');

    const unmeasured = createApp(0);
    toggleSchemaSQLPanel(unmeasured);
    expect(schemaSQLViewOf(unmeasured).panel).toBe('open');
  });
});

describe('showSchemaSQLExport', () => {
  it('opens the Schema SQL tab with its panel out and Save file asked for', async () => {
    const app = createApp(600);
    const view = schemaSQLViewOf(app);
    view.panel = 'closed';

    showSchemaSQLExport(app);
    await flush();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    expect(view.panel).toBe('open');
    expect(view.focusSave).toBe(true);
  });

  it('dispatches no tab change on the tab already shown', async () => {
    const app = createApp();
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    const dispatched = vi.fn();
    const unsubscribe = app.store.subscribe(dispatched);

    showSchemaSQLExport(app);
    await flush();

    expect(dispatched).not.toHaveBeenCalled();
    expect(schemaSQLViewOf(app).focusSave).toBe(true);
    unsubscribe();
  });
});

const GROUP_UI = { x: 0, y: 0, width: 200, height: 200, zIndex: 1 };

/** Tables t1 and t2 in group ga, t3 in gb, t4 in none, in that document order. */
function createGroupedApp(): AppContext {
  const app = createApp();
  app.store.dispatchSync(
    addTableGroupAction({ id: 'ga', ui: GROUP_UI }),
    addTableGroupAction({ id: 'gb', ui: GROUP_UI }),
    ...['t1', 't2', 't3', 't4'].map(id =>
      addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } })
    ),
    changeTableGroupAction({ id: 't1', value: 'ga' }),
    changeTableGroupAction({ id: 't2', value: 'ga' }),
    changeTableGroupAction({ id: 't3', value: 'gb' })
  );
  return app;
}

describe('resolveTableChoice', () => {
  it('checks every box again while the document lists no group', () => {
    expect(
      resolveTableChoice({ groups: { ga: false }, noGroup: false }, [])
    ).toEqual({ groups: {}, noGroup: true });
  });

  it('starts a group it has not met checked while every box was, unchecked otherwise', () => {
    expect(
      resolveTableChoice({ groups: { ga: true }, noGroup: true }, ['ga', 'gb'])
    ).toEqual({ groups: { ga: true, gb: true }, noGroup: true });
    expect(
      resolveTableChoice({ groups: { ga: true }, noGroup: false }, ['ga', 'gb'])
    ).toEqual({ groups: { ga: true, gb: false }, noGroup: false });
    expect(
      resolveTableChoice({ groups: { ga: false }, noGroup: true }, ['ga', 'gb'])
    ).toEqual({ groups: { ga: false, gb: false }, noGroup: true });
  });

  it('drops a group no longer listed and follows the document order', () => {
    const choice = resolveTableChoice(
      { groups: { gb: false, gone: false, ga: true }, noGroup: true },
      ['ga', 'gb']
    );

    expect(choice).toEqual({ groups: { ga: true, gb: false }, noGroup: true });
    expect(Object.keys(choice.groups)).toEqual(['ga', 'gb']);
  });

  it('never reads a name the prototype holds as a choice', () => {
    expect(
      resolveTableChoice({ groups: {}, noGroup: false }, ['constructor'])
    ).toEqual({ groups: { constructor: false }, noGroup: false });
  });
});

describe('isEveryTableChosen and isNoTableChosen', () => {
  it('reads every box checked only with the tables in no group too', () => {
    expect(isEveryTableChosen({ groups: {}, noGroup: true })).toBe(true);
    expect(isEveryTableChosen({ groups: { ga: true }, noGroup: true })).toBe(
      true
    );
    expect(isEveryTableChosen({ groups: { ga: true }, noGroup: false })).toBe(
      false
    );
    expect(isEveryTableChosen({ groups: { ga: false }, noGroup: true })).toBe(
      false
    );
  });

  it('reads no box checked only while the document has a group', () => {
    const none = { groups: { ga: false }, noGroup: false };

    expect(isNoTableChosen(none, ['ga'])).toBe(true);
    expect(isNoTableChosen(none, [])).toBe(false);
    expect(
      isNoTableChosen({ groups: { ga: true }, noGroup: false }, ['ga'])
    ).toBe(false);
    expect(
      isNoTableChosen({ groups: { ga: false }, noGroup: true }, ['ga'])
    ).toBe(false);
  });
});

describe('the table choice', () => {
  it('replaces the choice whole, so a watcher hears one change for every box', async () => {
    const view = schemaSQLViewOf(createApp());
    const changed: Array<string | number | symbol> = [];
    const stopWatching = watch(view).subscribe(name => changed.push(name));

    chooseAllTables(view, ['ga', 'gb'], false);
    await flush();

    expect(view.tables).toEqual({
      groups: { ga: false, gb: false },
      noGroup: false,
    });
    expect(changed).toEqual(['tables']);

    chooseAllTables(view, ['ga', 'gb'], true);
    expect(view.tables).toEqual({
      groups: { ga: true, gb: true },
      noGroup: true,
    });
    stopWatching();
  });

  it('checks one group or the tables in none, every other box as it reads', () => {
    const view = schemaSQLViewOf(createApp());

    chooseTableGroup(view, ['ga', 'gb'], 'ga', false);
    expect(view.tables).toEqual({
      groups: { ga: false, gb: true },
      noGroup: true,
    });

    chooseNoGroup(view, ['ga', 'gb', 'gc'], false);
    expect(view.tables).toEqual({
      groups: { ga: false, gb: true, gc: false },
      noGroup: false,
    });

    chooseTableGroup(view, ['ga', 'gb', 'gc'], 'ga', true);
    expect(view.tables).toEqual({
      groups: { ga: true, gb: true, gc: false },
      noGroup: false,
    });
  });

  it('matches the groups as they change, writing only a choice that moved', async () => {
    const view = schemaSQLViewOf(createApp());
    const changed: Array<string | number | symbol> = [];
    const stopWatching = watch(view).subscribe(name => changed.push(name));

    syncTableChoice(view, []);
    await flush();
    expect(changed).toEqual([]);

    syncTableChoice(view, ['ga']);
    expect(view.tables).toEqual({ groups: { ga: true }, noGroup: true });
    chooseTableGroup(view, ['ga'], 'ga', false);
    syncTableChoice(view, ['ga', 'gb']);
    expect(view.tables).toEqual({
      groups: { ga: false, gb: false },
      noGroup: true,
    });
    await flush();
    changed.length = 0;

    syncTableChoice(view, ['ga', 'gb']);
    await flush();
    expect(changed).toEqual([]);

    syncTableChoice(view, ['gb']);
    expect(view.tables).toEqual({ groups: { gb: false }, noGroup: true });
    syncTableChoice(view, []);
    expect(view.tables).toEqual({ groups: {}, noGroup: true });
    stopWatching();
  });
});

describe('chosenTableIds', () => {
  it('writes the whole document while every box is checked', () => {
    const app = createGroupedApp();

    expect(
      chosenTableIds(app.store.state, schemaSQLViewOf(app).tables)
    ).toBeUndefined();
  });

  it('names the tables of the checked groups and, with No group, those in none, in document order', () => {
    const { state } = createGroupedApp().store;

    expect(
      chosenTableIds(state, { groups: { ga: false, gb: true }, noGroup: true })
    ).toEqual(['t3', 't4']);
    expect(
      chosenTableIds(state, { groups: { ga: true, gb: false }, noGroup: false })
    ).toEqual(['t1', 't2']);
    expect(
      chosenTableIds(state, {
        groups: { ga: false, gb: false },
        noGroup: false,
      })
    ).toEqual([]);
  });

  it('starts a group not met yet as every box was, and reads a removed group as none', () => {
    const app = createGroupedApp();
    const { state } = app.store;

    expect(
      chosenTableIds(state, { groups: { ga: true }, noGroup: false })
    ).toEqual(['t1', 't2']);

    app.store.dispatchSync(removeTableGroupAction({ id: 'ga' }));
    expect(
      chosenTableIds(state, { groups: { ga: true, gb: false }, noGroup: true })
    ).toEqual(['t1', 't2', 't4']);
  });

  it('writes the whole document once the last group goes, whatever was unchecked', () => {
    const app = createGroupedApp();
    app.store.dispatchSync(
      removeTableGroupAction({ id: 'ga' }),
      removeTableGroupAction({ id: 'gb' })
    );

    expect(
      chosenTableIds(app.store.state, {
        groups: { ga: false, gb: false },
        noGroup: false,
      })
    ).toBeUndefined();
  });
});
