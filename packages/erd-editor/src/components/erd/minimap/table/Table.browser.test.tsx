/** @jsxHost konva */

// P3-31: the minimap's table box. The geometry is the canvas table's own, and
// the numbers below are the ones the dom minimap laid out with, restated
// against a rect whose stroke centres on its edge instead of sitting outside.

import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import Table from '@/components/erd/minimap/table/Table';
import { TABLE_BORDER } from '@/constants/layout';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import type { Table as TableType } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

const THEME: Theme = createTestTheme();

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const createTable = (
  ui: Partial<TableType['ui']> = {},
  columnIds: string[] = []
): TableType => ({
  id: 'table-1',
  name: 'users',
  comment: '',
  columnIds,
  seqColumnIds: [...columnIds],
  ui: {
    x: 11,
    y: 22,
    zIndex: 5,
    widthName: 60,
    widthComment: 60,
    color: '',
    ...ui,
  },
  meta: { updateAt: 0, createAt: 0 },
});

async function mountTable(
  table: TableType = createTable(),
  app: AppContext = createTestAppContext()
): Promise<Stage> {
  const container = document.createElement('div');
  document.body.append(container);

  const scene = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <Table table={table} />
      </k-layer>
    ),
    width: 400,
    height: 400,
    theme: THEME,
  });

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    scene.destroy();
    container.remove();
  });

  return scene.stage;
}

const boxOf = (stage: Stage) => stage.findOne('.minimap-table') as KonvaNode;

describe('the minimap table box', () => {
  it('draws one rect that locates by name and the table it carries', async () => {
    const stage = await mountTable();
    const box = boxOf(stage);

    expect(box.getClassName()).toBe('Rect');
    expect(box.getAttr('kind')).toBe('minimap-table');
    expect(box.getAttr('tableId')).toBe('table-1');
    expect(Object.hasOwn(box.attrs, 'id')).toBe(false);
    expect(box.getParent()?.getChildren()).toHaveLength(1);
  });

  it('places the box at the table position, inset by half its stroke', async () => {
    const stage = await mountTable();
    const box = boxOf(stage);

    expect(box.x()).toBe(11 + TABLE_BORDER / 2);
    expect(box.y()).toBe(22 + TABLE_BORDER / 2);
  });

  it('sizes a column-less table from the default column widths', async () => {
    const stage = await mountTable();
    const box = boxOf(stage);

    // border + padding + default column widths + padding + border, less the
    // stroke the rect centres on its own edge
    expect(box.width()).toBe(365 - TABLE_BORDER);
    // border + padding + header + 0 columns + padding + border
    expect(box.height()).toBe(56 - TABLE_BORDER);
  });

  it('grows the height by one column row per column id', async () => {
    const stage = await mountTable(createTable({}, ['c1', 'c2', 'c3']));

    expect(boxOf(stage).height()).toBe(56 + 3 * 24 - TABLE_BORDER);
  });

  it('narrows the box when the store hides the comment columns', async () => {
    const app = createTestAppContext();
    const stage = await mountTable(createTable(), app);
    const box = boxOf(stage);

    expect(box.width()).toBe(365 - TABLE_BORDER);

    app.store.dispatchSync(
      changeShowAction({ show: Show.columnComment, value: false })
    );
    app.store.dispatchSync(
      changeShowAction({ show: Show.columnDataType, value: false })
    );
    await flush();

    expect(boxOf(stage).width()).toBe(229 - TABLE_BORDER);
  });

  it('widens the box to fit the widest column registered in the store', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addColumnAction({ tableId: 'table-1', id: 'column-1' })
    );

    const column = app.store.state.collections.tableColumnEntities['column-1'];
    column.ui.widthName = 400;

    const stage = await mountTable(createTable({}, ['column-1']), app);

    // key/delete 32 + name 408 + comment 68 + dataType 68 + default 68
    // + notNull 43 = 687, plus 1 border + 8 padding on both sides
    expect(boxOf(stage).width()).toBe(705 - TABLE_BORDER);
  });

  it('paints the table background and border from the theme', async () => {
    const stage = await mountTable();
    const box = boxOf(stage);

    expect(box.getAttr('fill')).toBe(THEME.tableBackground);
    expect(box.getAttr('stroke')).toBe(THEME.tableBorder);
    expect(box.getAttr('strokeWidth')).toBe(TABLE_BORDER);
  });
});
