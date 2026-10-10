/** @jsxHost konva */

import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  beginEntityDrag,
  endEntityDrag,
} from '@/components/erd/canvas/entityDrag';
import { MINIMAP_MARK_MIN } from '@/components/erd/minimap/minimapGeometry';
import TableGroup from '@/components/erd/minimap/table-group/TableGroup';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addTableAction,
  changeTableGroupAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { getTableGroupMembers, getTableGroupRect } from '@/utils/tableGroup';

const GROUP_ID = 'group-1';
const THEME = createTestTheme();

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function mountGroup(
  color: string,
  app: AppContext = createTestAppContext(),
  ratio = 1
): Promise<Stage> {
  app.store.dispatchSync(
    addTableGroupAction({
      id: GROUP_ID,
      color,
      ui: { x: 30, y: 40, width: 500, height: 300, zIndex: 1 },
    })
  );
  const group = app.store.state.collections.tableGroupEntities[GROUP_ID];
  const container = document.createElement('div');
  document.body.append(container);

  const scene = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <TableGroup
          group={group}
          members={getTableGroupMembers(app.store.state).get(GROUP_ID) ?? []}
          ratio={ratio}
        />
      </k-layer>
    ),
    width: 800,
    height: 600,
    theme: THEME,
  });

  teardowns.push(() => {
    scene.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();
  return scene.stage;
}

const boxOf = (stage: Stage) =>
  stage.findOne('.minimap-table-group') as KonvaNode;

describe('the minimap table group box', () => {
  it('draws one rect over the group box, named by the group it carries', async () => {
    const box = boxOf(await mountGroup('#3b82f6'));

    expect(box.getClassName()).toBe('Rect');
    expect(box.getAttr('kind')).toBe('minimap-table-group');
    expect(box.hasName(GROUP_ID)).toBe(true);
    expect(Object.hasOwn(box.attrs, 'id')).toBe(false);
    expect(box.attrs).toMatchObject({ x: 30, y: 40, width: 500, height: 300 });
  });

  it('fills it in the group color at an alpha a few pixels still show', async () => {
    const box = boxOf(await mountGroup('#3B82F6'));

    expect(box.getAttr('fill')).toBe('#3b82f6');
    expect(box.getAttr('opacity')).toBe(0.4);
  });

  it('fills a group with no color, or one it cannot read, in the neutral color', async () => {
    expect(boxOf(await mountGroup('')).getAttr('fill')).toBe(THEME.foreground);
    expect(boxOf(await mountGroup('tomato')).getAttr('fill')).toBe(
      THEME.foreground
    );
  });

  it('reaches over its members, as the canvas box does', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 900, y: 700, zIndex: 2 } }),
      changeTableGroupAction({ id: 't1', value: GROUP_ID })
    );
    const box = boxOf(await mountGroup('#3b82f6', app));
    const rect = getTableGroupRect(
      app.store.state,
      app.store.state.collections.tableGroupEntities[GROUP_ID]
    );

    expect(rect.width).toBeGreaterThan(500);
    expect(box.attrs).toMatchObject(rect);
  });

  it('holds the box it showed as a drag began, as the canvas box does', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 900, y: 700, zIndex: 2 } }),
      changeTableGroupAction({ id: 't1', value: GROUP_ID })
    );
    const stage = await mountGroup('#3b82f6', app);
    const held = { ...boxOf(stage).attrs };

    app.store.dispatchSync(selectAction({ t1: SelectType.table }));
    beginEntityDrag(app.store.state);
    app.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 600, movementY: 400 })
    );
    await flush();
    await whenDrawn();

    expect(boxOf(stage).attrs).toMatchObject({
      x: held.x,
      y: held.y,
      width: held.width,
      height: held.height,
    });

    endEntityDrag(app.store.state);
    await flush();
    await whenDrawn();

    expect(boxOf(stage).width()).toBeGreaterThan(held.width);
  });

  it('draws no smaller than a mark at a ratio that folds the group away', async () => {
    const ratio = 0.001;
    const box = boxOf(
      await mountGroup('#3b82f6', createTestAppContext(), ratio)
    );

    expect(box.width()).toBeCloseTo(MINIMAP_MARK_MIN / ratio, 9);
    expect(box.height()).toBeCloseTo(MINIMAP_MARK_MIN / ratio, 9);
  });
});
