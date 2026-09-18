/** @jsxHost konva */

// 1-19e: the drag image the browser hung under the pointer went with native
// drag and drop, so a column drag drew nothing where the pointer was. The
// ghost stands in for it on the presence layer, and only over no drop target.

import { createRef } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { COLUMN_HEIGHT } from '@/constants/layout';
import {
  changeViewportAction,
  focusColumnAction,
  focusTableEndAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { changeColumnNameAction } from '@/engine/modules/table-column/atom.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import type { Point, Table } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
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
    scene: <CanvasScene root={createRef<HTMLDivElement>($root)} />,
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

/** Presses one row and moves off it by a pixel, which starts the drag. */
async function pressRow(fixture: Fixture, index: number, $mod = false) {
  const { stage, table } = fixture;
  const point = clientOf(fixture, rowCentre(fixture, table, index));
  const row = stage.findOne(`#column-${table.columnIds[index]}`)!;

  fireScenePointer(row, 'mousedown', {
    button: 0,
    metaKey: $mod,
    ctrlKey: $mod,
    ...point,
  });
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

/** The offset from the ghost's corner a press at a row centre holds. */
function grabOf(fixture: Fixture, index: number, stackIndex = 0): Point {
  const { app, table } = fixture;
  const press = rowCentre(fixture, table, index);
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
    await pressRow(fixture, 1);

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

  it('stacks every dragged row and holds the pressed one where it was taken', async () => {
    const fixture = await setup();
    focus(fixture, 0);
    focus(fixture, 2, true);
    await pressRow(fixture, 2, true);
    await moveTo(fixture, { x: 500, y: 600 });

    const ghost = ghostOf(fixture.stage)!;
    const grab = grabOf(fixture, 2, 1);
    expect(ghost.find('.column-drag-ghost-row')).toHaveLength(2);
    expectNear(ghost.y(), 600 - grab.y);
  });

  it('keeps the pointer on the ghost after the row moves into a narrower table', async () => {
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
    const row = getColumnRect(store.state, table, 1);
    const press = { x: row.x + row.width - 10, y: row.y + row.height / 2 };
    const { clientX, clientY } = clientOf(fixture, press);
    const rowNode = stage.findOne(`#column-${table.columnIds[1]}`)!;
    fireScenePointer(rowNode, 'mousedown', { button: 0, clientX, clientY });
    movePointer(clientX + 1, clientY + 1);
    await settle();

    const narrowWidth = getTableRect(store.state, tableOf(narrowId)).width;
    expect(press.x - getTableRect(store.state, table).x).toBeGreaterThan(
      narrowWidth
    );

    await moveTo(fixture, { x: press.x, y: 300 });
    await moveTo(fixture, rowCentre(fixture, tableOf(narrowId), 0));
    expect(store.state.editor.draggableColumn?.tableId).toBe(narrowId);

    const bare = { x: 200, y: 800 };
    await moveTo(fixture, bare);

    const ghost = ghostOf(stage)!;
    const body = ghost.findOne('.column-drag-ghost-body')!;
    expect(ghost.isVisible()).toBe(true);
    expect(bare.x).toBeGreaterThanOrEqual(ghost.x());
    expect(bare.x).toBeLessThanOrEqual(ghost.x() + body.width());
    expect(bare.y).toBeGreaterThanOrEqual(ghost.y());
    expect(bare.y).toBeLessThanOrEqual(ghost.y() + body.height());
  });

  it('hides over a drop target, where the row itself is under the pointer', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressRow(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    await moveTo(fixture, rowCentre(fixture, fixture.table, 0));

    expect(ghostOf(fixture.stage)?.isVisible()).toBe(false);
  });

  it('is gone once the drag is released', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressRow(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    releasePointer();
    await settle();

    expect(ghostOf(fixture.stage)).toBeNull();
  });

  it('is gone once every table is told the column drag ended', async () => {
    const fixture = await setup();
    focus(fixture, 1);
    await pressRow(fixture, 1);
    await moveTo(fixture, { x: 500, y: 600 });

    fixture.app.emitter.emit(dragendColumnAllAction());
    await settle();

    expect(ghostOf(fixture.stage)).toBeNull();
  });
});
