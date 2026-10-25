/** @jsxHost konva */

// 1-19e: the drag image the browser hung under the pointer went with native
// drag and drop, so a column drag drew nothing where the pointer was. The
// ghost stands in for it on the presence layer, and only over no drop target.

import { createRef } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  fireScenePointer,
  flush,
  movePointer,
  provideI18n,
  pseudoMessages,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { editingLayers } from '@/components/erd/canvas/editingLayers';
import {
  COLUMN_DRAG_HANDLE_GAP,
  COLUMN_DRAG_HANDLE_WIDTH,
  COLUMN_HEIGHT,
} from '@/constants/layout';
import { NameViewMode } from '@/constants/schema';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import {
  changeViewportAction,
  focusColumnAction,
  focusTableEndAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { changeNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { createI18n } from '@/i18n/translate';
import type { Point, Table } from '@/internal-types';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import { dragendColumnAllAction } from '@/utils/emitter';

const VIEWPORT = 1000;

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type Fixture = { app: AppContext; stage: Stage; table: Table };

async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;
  store.dispatchSync(
    changeViewportAction({ width: VIEWPORT, height: VIEWPORT })
  );

  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  for (let index = 0; index < 3; index++) {
    store.dispatchSync(addColumnAction$(tableId));
  }
  const table = store.state.collections.tableEntities[tableId];
  table.columnIds.forEach((id, index) => {
    store.dispatchSync(
      changeColumnNameAction({ tableId, id, value: `column_${index}` })
    );
  });
  store.dispatchSync(
    moveToTableAction({ id: tableId, x: 100, y: 100 }),
    unselectAllAction(),
    focusTableEndAction()
  );

  const $root = document.createElement('div');
  const container = document.createElement('div');
  document.body.append($root, container);

  const rendered = renderScene({
    app,
    container,
    scene: (
      <CanvasScene
        root={createRef<HTMLDivElement>($root)}
        layers={editingLayers}
      />
    ),
    width: VIEWPORT,
    height: VIEWPORT,
    theme: createTestTheme(),
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
    $root.remove();
  });

  await settle();
  return { app, stage: rendered.stage, table };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

/** A canvas point as the client point a pointer event carries. */
function clientOf({ stage }: Fixture, point: Point) {
  const layer = stage.findOne('.scene')!;
  const { x, y } = layer.getAbsoluteTransform().point(point);
  const origin = stage.content.getBoundingClientRect();

  return { clientX: origin.x + x, clientY: origin.y + y };
}

/** The centre of one row, in canvas units. */
function rowCentre({ app }: Fixture, table: Table, index: number): Point {
  const rect = getColumnRect(app.store.state, table, index);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function focus(fixture: Fixture, index: number, $mod = false) {
  const { table } = fixture;
  fixture.app.store.dispatchSync(
    focusColumnAction({
      tableId: table.id,
      columnId: table.columnIds[index],
      focusType: FocusType.columnName,
      $mod,
      shiftKey: false,
    })
  );
}

/** The centre of the drag handle left of one row, in canvas units. */
function handleCentre({ app }: Fixture, table: Table, index: number): Point {
  const row = getColumnRect(app.store.state, table, index);
  const { x } = getTableRect(app.store.state, table);

  return {
    x: x - COLUMN_DRAG_HANDLE_GAP - COLUMN_DRAG_HANDLE_WIDTH / 2,
    y: row.y + row.height / 2,
  };
}

/** Presses the focused row's handle and moves off it by a pixel, which starts the drag. */
async function pressHandle(fixture: Fixture, index: number) {
  const { stage, table } = fixture;
  // The handle comes with the focus, which the scene draws a commit later.
  await settle();
  const point = clientOf(fixture, handleCentre(fixture, table, index));
  const handle = stage
    .findOne<Group>(`#column-${table.columnIds[index]}`)!
    .findOne('.column-drag-handle')!;

  fireScenePointer(handle, 'mousedown', { button: 0, ...point });
  movePointer(point.clientX + 1, point.clientY + 1);
  await settle();
}

async function moveTo(fixture: Fixture, point: Point) {
  const { clientX, clientY } = clientOf(fixture, point);
  movePointer(clientX, clientY);
  await settle();
}

/** A pointer event carries whole client pixels, so a press lands within one. */
const expectNear = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
};

const ghostOf = (stage: Stage) =>
  stage.findOne<Group>('.column-drag-ghost') ?? null;

/** The offset from the ghost's corner a press on a row's handle holds. */
function grabOf(fixture: Fixture, index: number, stackIndex = 0): Point {
  const { app, table } = fixture;
  const press = handleCentre(fixture, table, index);
  const row = getColumnRect(app.store.state, table, index);

  return {
    x: press.x - getTableRect(app.store.state, table).x,
    y: press.y - row.y + stackIndex * COLUMN_HEIGHT,
  };
}

describe('the ghost a column drag carries', () => {
  it('draws nothing while no column is dragged', async () => {
    const fixture = await setup();

    expect(ghostOf(fixture.stage)).toBeNull();
  });

  it('follows the pointer over bare canvas where it took the row, on a layer no hit reaches', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressHandle(fixture, 1);

    const grab = grabOf(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    const ghost = ghostOf(fixture.stage)!;
    expect(ghost.getLayer()?.name()).toBe('presence');
    expect(ghost.listening()).toBe(false);
    expect(ghost.isVisible()).toBe(true);
    expectNear(ghost.x(), 500 - grab.x);
    expectNear(ghost.y(), 600 - grab.y);
    expect(ghost.find<Text>('Text').map(text => text.text())).toContain(
      'column_1'
    );

    await moveTo(fixture, { x: 560, y: 640 });
    expectNear(ghost.x(), 560 - grab.x);
    expectNear(ghost.y(), 640 - grab.y);
  });

  it('names an empty row by its placeholders, in the language the element shows', async () => {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    teardowns.push(() => provider.destroy());
    const fixture = await setup();
    const { app, table } = fixture;
    app.store.dispatchSync(
      changeColumnNameAction({
        tableId: table.id,
        id: table.columnIds[1],
        value: '',
      })
    );
    Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));

    focus(fixture, 1);
    await pressHandle(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    const texts = ghostOf(fixture.stage)!
      .find<Text>('Text')
      .map(text => text.text());
    expect(texts.sort()).toEqual(['ko:column', 'ko:dataType']);
  });

  it('writes each dragged row in the names and the domain its row draws in the logical view', async () => {
    const fixture = await setup();
    const { app, table } = fixture;
    const { store } = app;
    const theme = createTestTheme();
    const named = table.columnIds[1];
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'money',
        values: { name: 'Money', dataType: 'DECIMAL(19,4)' },
      }),
      changeColumnLogicalNameAction({
        tableId: table.id,
        id: named,
        value: 'Member Name',
      }),
      changeColumnDataTypeAction({
        tableId: table.id,
        id: named,
        value: 'DECIMAL(19,4)',
      }),
      changeColumnDomainAction({
        tableId: table.id,
        id: named,
        value: 'money',
      }),
      changeNameViewModeAction({
        value: NameViewMode.logical,
        shared: false,
        editorId: store.state.editor.id,
      })
    );
    await settle();

    focus(fixture, 1);
    focus(fixture, 2, true);
    await pressHandle(fixture, 2);
    await moveTo(fixture, { x: 500, y: 600 });

    const rows = ghostOf(fixture.stage)!
      .find<Group>('.column-drag-ghost-row')
      .map(row =>
        row.find<Text>('Text').map(text => [text.text(), text.fill()])
      );
    expect(rows).toEqual([
      [
        ['Member Name', theme.active],
        ['Money', theme.active],
      ],
      [
        ['column_2', theme.placeholder],
        ['dataType', theme.placeholder],
      ],
    ]);
  });

  it('stacks every dragged row and holds the pressed one where it was taken', async () => {
    const fixture = await setup();
    focus(fixture, 0);
    focus(fixture, 2, true);
    await pressHandle(fixture, 2);
    await moveTo(fixture, { x: 500, y: 600 });

    const ghost = ghostOf(fixture.stage)!;
    const grab = grabOf(fixture, 2, 1);
    expect(ghost.find('.column-drag-ghost-row')).toHaveLength(2);
    expectNear(ghost.y(), 600 - grab.y);
  });

  it('hangs the rows right of the pointer, across from the handle they were taken by, into a narrower table too', async () => {
    const fixture = await setup();
    const { app, stage, table } = fixture;
    const { store } = app;
    store.dispatchSync(
      changeColumnNameAction({
        tableId: table.id,
        id: table.columnIds[0],
        value: 'a_column_name_long_enough_to_widen_its_table_well_past_another',
      }),
      addTableAction$()
    );
    const narrowId = store.state.doc.tableIds[1];
    store.dispatchSync(
      addColumnAction$(narrowId),
      moveToTableAction({ id: narrowId, x: 100, y: 400 }),
      unselectAllAction(),
      focusTableEndAction()
    );
    await settle();

    const tableOf = (id: string) => store.state.collections.tableEntities[id];
    focus(fixture, 1);
    await pressHandle(fixture, 1);
    const grab = grabOf(fixture, 1);
    expect(grab.x).toBeLessThan(0);

    await moveTo(fixture, { x: handleCentre(fixture, table, 1).x, y: 300 });
    await moveTo(fixture, rowCentre(fixture, tableOf(narrowId), 0));
    expect(store.state.editor.draggableColumn?.tableId).toBe(narrowId);

    const bare = { x: 200, y: 800 };
    await moveTo(fixture, bare);

    const ghost = ghostOf(stage)!;
    expect(ghost.isVisible()).toBe(true);
    expectNear(ghost.x(), bare.x - grab.x);
    expectNear(ghost.y(), bare.y - grab.y);
  });

  it('hides over a drop target, where the row itself is under the pointer', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressHandle(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    await moveTo(fixture, rowCentre(fixture, fixture.table, 0));

    expect(ghostOf(fixture.stage)?.isVisible()).toBe(false);
  });

  it('is gone once the drag is released', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressHandle(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    releasePointer();
    await settle();

    expect(ghostOf(fixture.stage)).toBeNull();
  });

  it('is gone once every table is told the column drag ended', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressHandle(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    fixture.app.emitter.emit(dragendColumnAllAction());
    await settle();

    expect(ghostOf(fixture.stage)).toBeNull();
  });
});
