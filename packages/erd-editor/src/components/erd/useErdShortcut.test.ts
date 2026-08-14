import { query } from '@dineug/erd-editor-schema';
import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useErdShortcut } from '@/components/erd/useErdShortcut';
import { Open } from '@/constants/open';
import { ColumnOption, RelationshipType } from '@/constants/schema';
import { History } from '@/engine/history';
import {
  changeOpenMapAction,
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { bHas } from '@/utils/bit';
import { copyAction, pasteAction } from '@/utils/emitter';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const ShortcutHost: FC = (props, ctx) => {
  useErdShortcut(ctx);
  return () => html`<div class="shortcut-host"></div>`;
};

let mounted: Mounted | null = null;

async function setup(app: AppContext = createTestAppContext()) {
  mounted = await mountAndFlush(html`<${ShortcutHost} />`, app);
  return mounted.app;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

const shortcut = (app: AppContext, type: string) =>
  app.shortcut$.next({
    type: type as KeyBindingName,
    event: new KeyboardEvent('keydown'),
  });

const seedTable = (app: AppContext) => {
  app.store.dispatchSync(addTableAction$());
  return app.store.state.doc.tableIds[app.store.state.doc.tableIds.length - 1];
};

const seedColumn = (app: AppContext, tableId: string) => {
  app.store.dispatchSync(addColumnAction$(tableId));
  const table = query(app.store.state.collections)
    .collection('tableEntities')
    .selectById(tableId)!;
  return table.columnIds[table.columnIds.length - 1];
};

const getTable = (app: AppContext, tableId: string) =>
  query(app.store.state.collections)
    .collection('tableEntities')
    .selectById(tableId);

const getColumn = (app: AppContext, columnId: string) =>
  query(app.store.state.collections)
    .collection('tableColumnEntities')
    .selectById(columnId);

function createClipboardEvent(data: Record<string, string> = {}) {
  const setData = vi.fn();
  const clearData = vi.fn();
  const preventDefault = vi.fn();
  const getData = vi.fn((type: string) => data[type] ?? '');

  const event = {
    preventDefault,
    clipboardData: { setData, clearData, getData },
  } as unknown as ClipboardEvent;

  return { event, setData, clearData, preventDefault, getData };
}

describe('useErdShortcut - creation shortcuts', () => {
  it('adds a table', async () => {
    const app = await setup();

    shortcut(app, KeyBindingName.addTable);
    await flush();

    expect(app.store.state.doc.tableIds).toHaveLength(1);
  });

  it('adds a memo', async () => {
    const app = await setup();

    shortcut(app, KeyBindingName.addMemo);
    await flush();

    expect(app.store.state.doc.memoIds).toHaveLength(1);
  });

  it('adds a column to every selected table', async () => {
    const app = await setup();
    const tableId = seedTable(app);

    shortcut(app, KeyBindingName.addColumn);
    await flush();

    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
  });

  it('selects every table and memo', async () => {
    const app = await setup();
    const tableId = seedTable(app);

    shortcut(app, KeyBindingName.addMemo);
    await flush();
    shortcut(app, KeyBindingName.selectAllTable);
    await flush();

    const { selectedMap } = app.store.state.editor;
    expect(Object.keys(selectedMap)).toHaveLength(2);
    expect(selectedMap[tableId]).toBe('table');
  });

  it('does nothing while the focused table is being edited', async () => {
    const app = await setup();
    seedTable(app);
    app.store.state.editor.focusTable!.edit = true;

    shortcut(app, KeyBindingName.addTable);
    await flush();

    expect(app.store.state.doc.tableIds).toHaveLength(1);
  });
});

describe('useErdShortcut - relationship shortcuts', () => {
  it.each([
    [KeyBindingName.relationshipZeroOne, RelationshipType.ZeroOne],
    [KeyBindingName.relationshipZeroN, RelationshipType.ZeroN],
    [KeyBindingName.relationshipOneOnly, RelationshipType.OneOnly],
    [KeyBindingName.relationshipOneN, RelationshipType.OneN],
  ])('starts drawing %s', async (type, relationshipType) => {
    const app = await setup();

    shortcut(app, type);
    await flush();

    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      relationshipType
    );
  });

  it('toggles drawing off when the same relationship shortcut repeats', async () => {
    const app = await setup();

    shortcut(app, KeyBindingName.relationshipOneN);
    await flush();
    shortcut(app, KeyBindingName.relationshipOneN);
    await flush();

    expect(app.store.state.editor.drawRelationship).toBeNull();
  });
});

describe('useErdShortcut - removal and stop', () => {
  it('removes the selected tables and asks the host for focus', async () => {
    const app = await setup();
    const listener = vi.fn();
    document.body.addEventListener(focusEvent.type, listener);
    seedTable(app);

    shortcut(app, KeyBindingName.removeTable);
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(app.store.state.doc.tableIds).toHaveLength(0);
    document.body.removeEventListener(focusEvent.type, listener);
  });

  it('stops the draw mode, clears the selection and force-focuses the host', async () => {
    const app = await setup();
    const listener = vi.fn();
    document.body.addEventListener(forceFocusEvent.type, listener);
    seedTable(app);
    shortcut(app, KeyBindingName.relationshipZeroN);
    await flush();

    shortcut(app, KeyBindingName.stop);
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(app.store.state.editor.drawRelationship).toBeNull();
    expect(app.store.state.editor.selectedMap).toEqual({});
    expect(app.store.state.editor.focusTable).toBeNull();
    document.body.removeEventListener(forceFocusEvent.type, listener);
  });
});

describe('useErdShortcut - table properties', () => {
  it('opens the table properties panel for the first selected table', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const listener = vi.fn();
    app.emitter.on({ openTableProperties: listener });

    shortcut(app, KeyBindingName.tableProperties);
    await flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].payload).toEqual({ tableId });
    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
  });

  it('does nothing when no table is selected', async () => {
    const app = await setup();
    const listener = vi.fn();
    app.emitter.on({ openTableProperties: listener });

    shortcut(app, KeyBindingName.tableProperties);
    await flush();

    expect(listener).not.toHaveBeenCalled();
    expect(
      app.store.state.editor.openMap[Open.tableProperties]
    ).toBeUndefined();
  });
});

describe('useErdShortcut - zoom', () => {
  it('zooms in', async () => {
    const app = await setup();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));

    shortcut(app, KeyBindingName.zoomIn);
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.84);
  });

  it('zooms out', async () => {
    const app = await setup();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));

    shortcut(app, KeyBindingName.zoomOut);
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.76);
  });
});

describe('useErdShortcut - column shortcuts', () => {
  it('selects every column of the focused table', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    seedColumn(app, tableId);

    shortcut(app, KeyBindingName.selectAllColumn);
    await flush();

    expect(app.store.state.editor.focusTable?.selectColumnIds).toHaveLength(2);
  });

  it('removes the selected columns', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    const columnId = seedColumn(app, tableId);

    expect(app.store.state.editor.focusTable?.selectColumnIds).toEqual([
      columnId,
    ]);

    shortcut(app, KeyBindingName.removeColumn);
    await flush();

    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
  });

  it('keeps the columns when nothing is selected inside the table', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.state.editor.focusTable!.selectColumnIds = [];

    shortcut(app, KeyBindingName.removeColumn);
    await flush();

    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
  });

  it('toggles the primary key of the focused column', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const columnId = seedColumn(app, tableId);

    shortcut(app, KeyBindingName.primaryKey);
    await flush();

    expect(
      bHas(getColumn(app, columnId)!.options, ColumnOption.primaryKey)
    ).toBe(true);
  });

  it('ignores the primary key shortcut when no column is focused', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const columnId = seedColumn(app, tableId);
    app.store.state.editor.focusTable!.columnId = null;

    shortcut(app, KeyBindingName.primaryKey);
    await flush();

    expect(
      bHas(getColumn(app, columnId)!.options, ColumnOption.primaryKey)
    ).toBe(false);
  });
});

describe('useErdShortcut - edit shortcut', () => {
  it('enters edit mode for a table focus type', async () => {
    const app = await setup();
    seedTable(app);

    shortcut(app, KeyBindingName.edit);
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(true);
  });

  it('leaves edit mode when it is already editing', async () => {
    const app = await setup();
    seedTable(app);
    shortcut(app, KeyBindingName.edit);
    await flush();

    shortcut(app, KeyBindingName.edit);
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(false);
  });

  it('toggles the column value instead of editing for toggle focus types', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const columnId = seedColumn(app, tableId);
    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId,
        focusType: FocusType.columnNotNull,
        $mod: false,
        shiftKey: false,
      })
    );

    shortcut(app, KeyBindingName.edit);
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(false);
    expect(bHas(getColumn(app, columnId)!.options, ColumnOption.notNull)).toBe(
      true
    );
  });

  it('does nothing without a focused table', async () => {
    const app = await setup();

    shortcut(app, KeyBindingName.edit);
    await flush();

    expect(app.store.state.editor.focusTable).toBeNull();
  });
});

describe('useErdShortcut - high level table', () => {
  it('skips the column shortcuts when the zoom level renders a high level table', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    shortcut(app, KeyBindingName.edit);
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(false);
  });

  it('still runs the canvas level shortcuts', async () => {
    const app = await setup();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    shortcut(app, KeyBindingName.addMemo);
    await flush();

    expect(app.store.state.doc.memoIds).toHaveLength(1);
  });
});

describe('useErdShortcut - undo / redo', () => {
  function createFakeHistory() {
    const undo = vi.fn();
    const redo = vi.fn();
    const history = {
      cursor: -1,
      size: 0,
      hasUndo: () => false,
      hasRedo: () => false,
      undo,
      redo,
      push: vi.fn(),
      clear: vi.fn(),
      setLimit: vi.fn(),
      clone: () => history,
    } as unknown as History;

    return { history, undo, redo };
  }

  it('delegates undo to the store history', async () => {
    const { history, undo } = createFakeHistory();
    const app = await setup(
      createTestAppContext({ getHistory: () => history })
    );

    shortcut(app, KeyBindingName.undo);
    await flush();

    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('delegates redo to the store history', async () => {
    const { history, redo } = createFakeHistory();
    const app = await setup(
      createTestAppContext({ getHistory: () => history })
    );

    shortcut(app, KeyBindingName.redo);
    await flush();

    expect(redo).toHaveBeenCalledTimes(1);
  });
});

describe('useErdShortcut - keydown handling', () => {
  it('moves the focus with the arrow keys', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const columnId = seedColumn(app, tableId);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );

    app.keydown$.next(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();

    expect(app.store.state.editor.focusTable?.columnId).toBe(columnId);
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnName
    );
  });

  it('ignores non move keys', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );

    app.keydown$.next(new KeyboardEvent('keydown', { key: 'KeyA' }));
    await flush();

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableName
    );
  });

  it('does nothing when the zoom level renders a high level table', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    app.keydown$.next(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableName
    );
  });

  it('does nothing without a focused table', async () => {
    const app = await setup();

    app.keydown$.next(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();

    expect(app.store.state.editor.focusTable).toBeNull();
  });

  it('moves and then enters edit mode on Tab', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    app.keydown$.next(event);
    await flush();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(true);
  });

  it('does not enter edit mode on Tab when the focus lands on a toggle column type', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const columnId = seedColumn(app, tableId);
    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId,
        focusType: FocusType.columnDataType,
        $mod: false,
        shiftKey: false,
      })
    );

    app.keydown$.next(new KeyboardEvent('keydown', { key: 'Tab' }));
    await flush();
    await new Promise(resolve => setTimeout(resolve, 10));
    await flush();

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnNotNull
    );
    expect(app.store.state.editor.focusTable?.edit).toBe(false);
  });
});

describe('useErdShortcut - clipboard', () => {
  it('writes the selected columns to the clipboard on copy', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    const { event, setData, clearData, preventDefault } =
      createClipboardEvent();

    app.emitter.emit(copyAction({ event }));
    await flush();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(clearData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledTimes(2);
    expect(setData.mock.calls[0][0]).toBe('text/plain');
    expect(setData.mock.calls[1][0]).toBe('text/html');
    expect(setData.mock.calls[1][1]).toContain('<table>');
  });

  it('ignores copy when no column is selected', async () => {
    const app = await setup();
    seedTable(app);
    const { event, setData } = createClipboardEvent();

    app.emitter.emit(copyAction({ event }));
    await flush();

    expect(setData).not.toHaveBeenCalled();
  });

  it('pastes plain text rows as new columns of the selected tables', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const { event, preventDefault } = createClipboardEvent({
      'text/plain': 'nickname',
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    const columnIds = getTable(app, tableId)?.columnIds ?? [];
    expect(columnIds).toHaveLength(1);
    expect(getColumn(app, columnIds[0])?.name).toBe('nickname');
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('prefers the html flavour when both are present', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const { event } = createClipboardEvent({
      'text/html':
        '<table><tbody><tr><td data-type="columnName">from_html</td></tr></tbody></table>',
      'text/plain': 'from_text',
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    const columnIds = getTable(app, tableId)?.columnIds ?? [];
    expect(columnIds).toHaveLength(1);
    expect(getColumn(app, columnIds[0])?.name).toBe('from_html');
  });

  it('ignores paste when no table is selected', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    app.store.state.editor.selectedMap = {};
    const { event, preventDefault } = createClipboardEvent({
      'text/plain': 'nope',
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(getTable(app, tableId)?.columnIds ?? []).toHaveLength(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores paste with an empty clipboard', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const { event, preventDefault } = createClipboardEvent();

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(getTable(app, tableId)?.columnIds ?? []).toHaveLength(0);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores paste while the focused table is being edited', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    app.store.state.editor.focusTable!.edit = true;
    const { event } = createClipboardEvent({ 'text/plain': 'nope' });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(getTable(app, tableId)?.columnIds ?? []).toHaveLength(0);
  });
});

describe('useErdShortcut - gating and teardown', () => {
  it('is gated by erdShortcutPerformCheck while an overlay is open', async () => {
    const app = await setup();
    app.store.dispatchSync(changeOpenMapAction({ [Open.search]: true }));

    shortcut(app, KeyBindingName.addTable);
    app.keydown$.next(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();

    expect(app.store.state.doc.tableIds).toHaveLength(0);
  });

  it('unsubscribes on unmount', async () => {
    const app = await setup();

    mounted?.unmount();
    mounted = null;

    shortcut(app, KeyBindingName.addTable);
    await flush();

    expect(app.store.state.doc.tableIds).toHaveLength(0);
  });
});
