/** @jsxHost konva */

import { type DOMTemplateLiterals } from '@dineug/r-html';
import { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  fireSceneTouch,
  flush,
  movePointer,
  moveTouch,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import {
  HIGH_LEVEL_FONT_SIZES,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import { TABLE_BORDER } from '@/constants/layout';
import {
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { Tag } from '@/engine/tag';
import type { Table as TableEntity } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

type Fixture = {
  app: AppContext;
  table: TableEntity;
  theme: Theme;
  stage: Stage;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function setup(
  columns = 0,
  props: { visible?: boolean } = {}
): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  const table = store.state.collections.tableEntities[tableId];

  for (let i = 0; i < columns; i++) {
    store.dispatchSync(addColumnAction$(tableId));
  }

  const container = document.createElement('div');
  document.body.append(container);
  const theme = createTestTheme();

  const scene: DOMTemplateLiterals = (
    <k-layer name="scene">
      <HighLevelTable table={table} visible={props.visible} />
    </k-layer>
  );

  const rendered = renderScene({
    app,
    container,
    scene,
    width: 900,
    height: 700,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return { app, table, theme, stage: rendered.stage };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const rootOf = (stage: Stage) =>
  stage.findOne<Group>('.high-level-table') as Group;

const named = <T extends KonvaNode>(root: Group, name: string) =>
  root.findOne<T>(`.${name}`) as T;

const ringOf = (stage: Stage) => rootOf(stage).findOne<Rect>('.table-ring');

const trackFocus = (app: AppContext, tableId: string | null) => {
  app.store.dispatchSync({
    ...sharedFocusTrackerAction({
      focus: tableId
        ? { tableId, columnId: null, focusType: FocusType.tableName }
        : null,
    }),
    tags: Tag.shared,
    meta: { editorId: 'remote-1' },
  });
};

const trackSelection = (app: AppContext, selectedIds: string[]) => {
  app.store.dispatchSync({
    ...sharedSelectionTrackerAction({ selectedIds }),
    tags: Tag.shared,
    meta: { editorId: 'remote-2' },
  });
};

describe('the simplified table a zoomed out canvas swaps in', () => {
  it('answers to both the table name and its own, and keeps the table id', async () => {
    const { stage, table } = await setup(2);
    const root = rootOf(stage);

    expect(root.id()).toBe(`table-${table.id}`);
    expect(root.hasName('table')).toBe(true);
    expect(root.hasName('high-level-table')).toBe(true);
    expect(root.getAttr('kind')).toBe('table');
  });

  it('draws no column rows, which is the whole of the simplification', async () => {
    const { stage } = await setup(3);

    expect(rootOf(stage).find('.column-row')).toEqual([]);
  });

  it('keeps the body box and the colour bar the full table draws', async () => {
    const { app, stage, table, theme } = await setup(2);
    const rect = getTableRect(app.store.state, table);
    const root = rootOf(stage);
    const body = named<Rect>(root, 'table-body');

    expect(root.x()).toBe(rect.x);
    expect(body.width()).toBe(rect.width - TABLE_BORDER);
    expect(body.fill()).toBe(theme.tableBackground);
    expect(named<Rect>(root, 'table-header-color').fill()).toBe(table.ui.color);
  });

  it('switches the border to the select colour once selected', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(selectTableAction$(table.id, false));
    await settle();

    expect(named<Rect>(rootOf(stage), 'table-body').stroke()).toBe(
      theme.tableSelect
    );
  });

  it('marks the group selected, which the border colour alone never says', async () => {
    const { app, stage, table } = await setup();

    // What the dom scene spelt as data-selected, and the one handle a caller
    // above the scene has on a selection once the zoom swaps this table in.
    expect(rootOf(stage).getAttr('selected')).toBe(true);

    app.store.dispatchSync(unselectAllAction());
    await settle();
    expect(rootOf(stage).getAttr('selected')).toBe(false);

    app.store.dispatchSync(selectTableAction$(table.id, false));
    await settle();
    expect(rootOf(stage).getAttr('selected')).toBe(true);
  });
});

describe('the name a simplified table shows', () => {
  it('stands in for an unnamed table in the placeholder colour', async () => {
    const { stage, theme } = await setup();
    const name = named<Text>(rootOf(stage), 'high-level-table-name');

    expect(name.text()).toBe('unnamed');
    expect(name.fill()).toBe(theme.placeholder);
    expect(name.align()).toBe('center');
    expect(name.verticalAlign()).toBe('middle');
  });

  it('shows the table name in the active colour once it has one', async () => {
    const { app, stage, table, theme } = await setup();

    app.store.dispatchSync(
      changeTableNameAction({ id: table.id, value: 'users' })
    );
    await settle();

    const name = named<Text>(rootOf(stage), 'high-level-table-name');

    expect(name.text()).toBe('users');
    expect(name.fill()).toBe(theme.active);
  });

  it('fills the table box inside its border and padding', async () => {
    const { app, stage, table } = await setup(2);
    const rect = getTableRect(app.store.state, table);
    const name = named<Text>(rootOf(stage), 'high-level-table-name');

    expect(name.x()).toBe(TABLE_BORDER);
    expect(name.y()).toBe(TABLE_INSET);
    expect(name.width()).toBe(rect.width - TABLE_BORDER * 2);
    expect(name.height()).toBe(rect.height - TABLE_INSET * 2);
  });

  it('climbs the typography scale as the zoom falls', async () => {
    const { app, stage } = await setup();
    const sizeAt = async (zoomLevel: number) => {
      app.store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
      await settle();
      return named<Text>(rootOf(stage), 'high-level-table-name').fontSize();
    };

    expect(await sizeAt(0.69)).toBe(HIGH_LEVEL_FONT_SIZES[0]);
    expect(await sizeAt(0.55)).toBe(HIGH_LEVEL_FONT_SIZES[1]);
    expect(await sizeAt(0.45)).toBe(HIGH_LEVEL_FONT_SIZES[2]);
    expect(await sizeAt(0.35)).toBe(HIGH_LEVEL_FONT_SIZES[3]);
    expect(await sizeAt(0.25)).toBe(HIGH_LEVEL_FONT_SIZES[4]);
  });
});

describe('what a peer marks on a simplified table', () => {
  it('outlines the root while a remote editor focuses the table', async () => {
    const { app, stage, table } = await setup();

    expect(ringOf(stage)).toBeUndefined();

    trackFocus(app, table.id);
    await settle();

    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
  });

  it('leaves the root unmarked while no peer has selected it', async () => {
    const { stage } = await setup();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('marks the root in the peer color once a peer selects the table', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, [table.id]);
    await settle();

    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
  });

  it('leaves the root unmarked while the peer selects another entity', async () => {
    const { app, stage } = await setup();

    trackSelection(app, ['some-other-entity']);
    await settle();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('marks the root when the peer selection holds several ids', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, ['some-other-entity', table.id]);
    await settle();

    expect((ringOf(stage) as Rect).stroke()).toBeTruthy();
  });

  it('clears the marker when the peer selection empties', async () => {
    const { app, stage, table } = await setup();

    trackSelection(app, [table.id]);
    await settle();
    expect(ringOf(stage)).toBeTruthy();

    trackSelection(app, []);
    await settle();

    expect(ringOf(stage)).toBeUndefined();
  });

  it('carries both peer colours as attrs of its own', async () => {
    const { app, stage, table } = await setup();
    const root = rootOf(stage);

    expect(root.getAttr('sharedFocus')).toBeFalsy();
    expect(root.getAttr('sharedSelect')).toBeFalsy();

    trackFocus(app, table.id);
    trackSelection(app, [table.id]);
    await settle();

    expect(root.getAttr('sharedFocus')).toBeTruthy();
    expect(root.getAttr('sharedSelect')).toBeTruthy();
  });

  it('never writes a peer selection into the local selection map', async () => {
    const { app, table } = await setup();
    const before = { ...app.store.state.editor.selectedMap };

    trackSelection(app, [table.id, 'some-other-entity']);
    await settle();

    expect(app.store.state.editor.selectedMap).toEqual(before);
  });
});

describe('what a simplified table pointer start owns', () => {
  it('emits an openColorPicker action with the pointer position and current color', async () => {
    const { app, stage, table } = await setup();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });

    fireScenePointer(named(rootOf(stage), 'table-header-color'), 'click', {
      clientX: 90,
      clientY: 35,
    });

    expect(openColorPicker).toHaveBeenCalledWith({
      type: 'openColorPicker',
      payload: { x: 90, y: 35, color: table.ui.color },
    });
  });

  it('selects the table on mousedown and drags it with the pointer', async () => {
    const { app, stage, table } = await setup();
    const startX = table.ui.x;
    const startY = table.ui.y;

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      clientX: 100,
      clientY: 100,
    });
    movePointer(160, 130);
    await settle();

    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
    expect(table.ui.x).toBe(startX + 60);
    expect(table.ui.y).toBe(startY + 30);
  });

  it('drags from a touch start as well as a pointer one', async () => {
    const { stage, table } = await setup();
    const startX = table.ui.x;

    fireSceneTouch(named(rootOf(stage), 'table-body'), 'touchstart', 10, 10);
    moveTouch(45, 10);
    await settle();

    expect(table.ui.x).toBe(startX + 35);
  });

  it('does not drag when the mousedown lands on the color bar', async () => {
    const { app, stage, table } = await setup();
    const startX = table.ui.x;

    fireScenePointer(named(rootOf(stage), 'table-header-color'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(80, 0);
    await settle();

    expect(table.ui.x).toBe(startX);
    expect(app.store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('adds to the selection instead of replacing it when the mod key is held', async () => {
    const { app, stage, table } = await setup();
    const { store } = app;

    store.dispatchSync(addTableAction$());
    const otherId = store.state.doc.tableIds.find(
      id => id !== table.id
    ) as string;
    store.dispatchSync(selectTableAction$(otherId, false));

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      ctrlKey: true,
      metaKey: true,
    });
    await settle();

    expect(store.state.editor.selectedMap[otherId]).toBe(SelectType.table);
    expect(store.state.editor.selectedMap[table.id]).toBe(SelectType.table);
  });

  it('hands an Alt+drag to the duplicate ghost instead of moving the table', async () => {
    const { app, stage, table } = await setup();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    const startX = table.ui.x;

    fireScenePointer(named(rootOf(stage), 'table-body'), 'mousedown', {
      altKey: true,
    });
    movePointer(120, 0);
    await settle();

    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect(table.ui.x).toBe(startX);
  });
});
