import { query } from '@dineug/erd-editor-schema';
import { AnyAction, FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

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
import { tableCopyToHtml, tableCopyToText } from '@/utils/table-clipboard/copy';
import {
  CLIPBOARD_HTML_TRUNCATED_ATTR,
  CLIPBOARD_MIME,
  CLIPBOARD_VERSION,
  ClipboardPayload,
  createPayload,
  PayloadKind,
} from '@/utils/table-clipboard/payload';

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

function createClipboardEvent(
  data: Record<string, string> = {},
  target: EventTarget | null = null
) {
  const setData = vi.fn();
  const clearData = vi.fn();
  const preventDefault = vi.fn();
  const getData = vi.fn((type: string) => data[type] ?? '');

  const event = {
    preventDefault,
    target,
    clipboardData: { setData, clearData, getData },
  } as unknown as ClipboardEvent;

  return { event, setData, clearData, preventDefault, getData };
}

const setDataTypes = (setData: ReturnType<typeof vi.fn>) =>
  setData.mock.calls.map(([type]) => type);

const readPayload = (setData: ReturnType<typeof vi.fn>): ClipboardPayload =>
  JSON.parse(
    setData.mock.calls.find(([type]) => type === CLIPBOARD_MIME)![1] as string
  );

const copyToClipboard = async (app: AppContext) => {
  const { event, setData } = createClipboardEvent();
  app.emitter.emit(copyAction({ event }));
  await flush();
  return setData.mock.calls.find(([type]) => type === CLIPBOARD_MIME)![1];
};

const newestTable = (app: AppContext) => {
  const { tableIds } = app.store.state.doc;
  return getTable(app, tableIds[tableIds.length - 1])!;
};

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
  // AC-1 / AC-4: three flavours go out, and the two the rest of the world reads
  // are byte-for-byte what the editor has written since 3.3.1 — the column
  // payload rides the custom MIME alone so the html is never wrapped.
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
    expect(setData).toHaveBeenCalledTimes(3);
    expect(setDataTypes(setData)).toEqual([
      'text/plain',
      'text/html',
      CLIPBOARD_MIME,
    ]);
    expect(setData.mock.calls[0][1]).toBe(tableCopyToText(app.store.state));
    expect(setData.mock.calls[1][1]).toBe(tableCopyToHtml(app.store.state));
    expect(setData.mock.calls[1][1]).toContain('<table>');
    expect(readPayload(setData).kind).toBe(PayloadKind.columns);
  });

  // AC-1 / AC-3 / AC-19. `seedTable` selects the table it creates, so "no
  // column is selected" is an entity copy, not a no-op — and a table with no
  // columns leaves the human-visible grid empty.
  it('copies the selected table when no column is selected', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const { event, setData, preventDefault } = createClipboardEvent();

    app.emitter.emit(copyAction({ event }));
    await flush();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledTimes(3);
    expect(setDataTypes(setData)).toEqual([
      'text/plain',
      'text/html',
      CLIPBOARD_MIME,
    ]);

    const payload = readPayload(setData);
    expect(payload.kind).toBe(PayloadKind.tables);
    expect(payload.tables).toHaveLength(1);
    expect(payload.tables[0].sourceId).toBe(tableId);

    expect(setData.mock.calls[0][1]).toBe('');
    expect(setData.mock.calls[1][1]).not.toContain('<table>');
  });

  // AC-5
  it('ignores copy when nothing is selected', async () => {
    const app = await setup();
    seedTable(app);
    app.store.state.editor.selectedMap = {};
    const { event, setData, clearData, preventDefault } =
      createClipboardEvent();

    app.emitter.emit(copyAction({ event }));
    await flush();

    expect(setData).not.toHaveBeenCalled();
    expect(clearData).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  // AC-32: a memo keeps itself selected while its textarea has focus, so the
  // guard has to read the event target rather than the selection.
  it.each([
    ['textarea', document.createElement('textarea')],
    ['input', document.createElement('input')],
    [
      'contenteditable',
      (() => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', '');
        return el;
      })(),
    ],
  ])('ignores copy while the target is inside a %s', async (_, target) => {
    const app = await setup();
    seedTable(app);
    const { event, setData, preventDefault } = createClipboardEvent({}, target);

    app.emitter.emit(copyAction({ event }));
    await flush();

    expect(setData).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  // AC-6: the payload's `kind` decides the mode, so a table being selected does
  // not turn an entity paste into a column merge.
  it('creates new entities from a kind:"tables" payload while a table is selected', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );

    const json = await copyToClipboard(app);
    const { event, preventDefault } = createClipboardEvent({
      [CLIPBOARD_MIME]: json,
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(app.store.state.doc.tableIds).toHaveLength(2);
    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
    expect(newestTable(app).columnIds).toHaveLength(1);
  });

  // AC-7: issue #408 — the original is still selected right after a copy, and
  // it must not be fed its own columns back.
  it('does not append a table its own columns when pasting straight after copying it', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);
    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );

    const json = await copyToClipboard(app);
    expect(app.store.state.editor.selectedMap[tableId]).toBe('table');

    const { event } = createClipboardEvent({ [CLIPBOARD_MIME]: json });
    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
  });

  // AC-29 (a) and (c)
  it('cascades repeated pastes of the same payload', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const origin = { ...getTable(app, tableId)!.ui };
    const editorKeys = Object.keys(app.store.state.editor);

    const json = await copyToClipboard(app);

    // Each copy is removed again before the next paste. Leaving them on the
    // canvas makes this assertion vacuous: with the round multiplication taken
    // out entirely, every paste would target `origin + 50` and the collision
    // escape would walk it to +100 and +150 on its own, reproducing the whole
    // sequence. Removing the copy leaves the counter as the only thing that can
    // produce these coordinates.
    for (const round of [1, 2, 3]) {
      const { event } = createClipboardEvent({ [CLIPBOARD_MIME]: json });
      app.emitter.emit(pasteAction({ event }));
      await flush();

      const { ui } = newestTable(app);
      expect(ui.x).toBe(origin.x + 50 * round);
      expect(ui.y).toBe(origin.y + 50 * round);

      shortcut(app, KeyBindingName.removeTable);
      await flush();
    }

    expect(getTable(app, tableId)!.ui.x).toBe(origin.x);
    expect(Object.keys(app.store.state.editor)).toEqual(editorKeys);
  });

  // AC-29 (b) / AC-10: the counter is keyed by the payload's `copyId`, not by a
  // local copy event — a payload from another tab has to reset it too.
  it('restarts the cascade when a payload with a different copyId arrives', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    const origin = { ...getTable(app, tableId)!.ui };
    const json = await copyToClipboard(app);

    // Each copy is removed again so the coordinates below can only come from
    // the round counter, never from the collision escape.
    for (const round of [1, 2]) {
      const { event } = createClipboardEvent({ [CLIPBOARD_MIME]: json });
      app.emitter.emit(pasteAction({ event }));
      await flush();

      expect(newestTable(app).ui.x).toBe(origin.x + 50 * round);

      shortcut(app, KeyBindingName.removeTable);
      await flush();
    }

    const foreign = JSON.stringify({
      ...(JSON.parse(json) as ClipboardPayload),
      copyId: 'copied-somewhere-else',
    });
    const { event } = createClipboardEvent({ [CLIPBOARD_MIME]: foreign });
    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(newestTable(app).ui.x).toBe(origin.x + 50);
  });

  // AC-27 (a): ours, and from a release this one cannot read.
  it('hard stops on a payload newer than this reader', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);

    // The seeds above leave `editor.changeHasHistory` in flight; let it land so
    // the collector only ever sees what the paste itself dispatches.
    await flush();

    const before = {
      doc: JSON.stringify(app.store.state.doc),
      collections: JSON.stringify(app.store.state.collections),
    };
    const dispatched: AnyAction[] = [];
    app.store.subscribe(actions => dispatched.push(...actions));

    const payload = {
      ...createPayload({ kind: PayloadKind.tables }),
      version: CLIPBOARD_VERSION + 1,
    };
    const { event, preventDefault } = createClipboardEvent({
      [CLIPBOARD_MIME]: JSON.stringify(payload),
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(dispatched).toHaveLength(0);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
    expect(JSON.stringify(app.store.state.doc)).toBe(before.doc);
    expect(JSON.stringify(app.store.state.collections)).toBe(
      before.collections
    );
  });

  // AC-27 (b): the writer dropped the hidden JSON for size and left the flag in
  // its place. The `<table>` below it is ours and would parse cleanly, which is
  // exactly why the ladder must not descend to it.
  it('hard stops on a truncated payload rather than parsing the html it wrote', async () => {
    const app = await setup();
    const tableId = seedTable(app);
    seedColumn(app, tableId);

    // The seeds above leave `editor.changeHasHistory` in flight; let it land so
    // the collector only ever sees what the paste itself dispatches.
    await flush();

    const before = {
      doc: JSON.stringify(app.store.state.doc),
      collections: JSON.stringify(app.store.state.collections),
    };
    const dispatched: AnyAction[] = [];
    app.store.subscribe(actions => dispatched.push(...actions));

    const { event, preventDefault } = createClipboardEvent({
      'text/html': `<span ${CLIPBOARD_HTML_TRUNCATED_ATTR}="1"><table><tbody><tr><td data-type="columnName">leaked</td></tr></tbody></table></span>`,
    });

    app.emitter.emit(pasteAction({ event }));
    await flush();

    expect(dispatched).toHaveLength(0);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(getTable(app, tableId)?.columnIds).toHaveLength(1);
    expect(JSON.stringify(app.store.state.doc)).toBe(before.doc);
    expect(JSON.stringify(app.store.state.collections)).toBe(
      before.collections
    );
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

  // the copy twin above has read the target since AC-32; paste did not, so text
  // pasted into a memo or the Schema SQL overlay also landed on the diagram.
  it.each([
    ['textarea', () => document.createElement('textarea')],
    ['input', () => document.createElement('input')],
    [
      'contenteditable',
      () => {
        const el = document.createElement('div');
        el.setAttribute('contenteditable', '');
        return el;
      },
    ],
  ])('ignores paste while the target is inside a %s', async (_, create) => {
    const app = await setup();
    const tableId = seedTable(app);
    const { event, preventDefault } = createClipboardEvent(
      { 'text/plain': 'nickname' },
      create()
    );

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
