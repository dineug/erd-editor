/** @jsxHost konva */

// A member table wears its group's color across the header, the name, the
// comment, their placeholders and the header icons in the black or white that
// reads best on it, and keeps its own color on the left edge.

import type { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { TRANSPARENT } from '@/components/erd/canvas/sceneTokens';
import Table from '@/components/erd/canvas/table/Table';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
} from '@/engine/modules/table-group/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

const TABLE_ID = 'table-1';
const GROUP_ID = 'group-1';
const THEME = createTestTheme();

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const settle = async () => {
  await flush();
  await whenDrawn();
};

/** A table in a group of the color given, hovered unless told otherwise so its buttons paint. */
async function mountMember(
  color: string,
  hovered = true
): Promise<{ app: AppContext; stage: Stage }> {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addTableGroupAction({
      id: GROUP_ID,
      color,
      ui: { x: 0, y: 0, width: 100, height: 100, zIndex: 1 },
    }),
    addTableAction({ id: TABLE_ID, ui: { x: 60, y: 80, zIndex: 2 } }),
    changeTableColorAction({ id: TABLE_ID, color: '#22c55e', prevColor: '' }),
    changeTableGroupAction({ id: TABLE_ID, value: GROUP_ID })
  );
  const table = app.store.state.collections.tableEntities[TABLE_ID];

  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <Table table={table} hovered={hovered} />
      </k-layer>
    ),
    width: 900,
    height: 700,
    theme: THEME,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await settle();
  return { app, stage: rendered.stage };
}

const named = <T extends KonvaNode = KonvaNode>(stage: Stage, name: string) =>
  stage.findOne<T>(`.${name}`) as T;

const cellText = (stage: Stage, cell: string) =>
  named<Group>(stage, cell).findOne<Text>('.cell-text') as Text;

const strokesOf = (stage: Stage, name: string) =>
  named<Group>(stage, name)
    .find('Path')
    .map(node => node.getAttr('stroke'));

/** What the header paints with, read off the nodes that draw it. */
const headerPaint = (stage: Stage) => ({
  band: named(stage, 'table-header-band').getAttr('fill'),
  icon: strokesOf(stage, 'table-header-icon')[0],
  name: cellText(stage, 'tableName').fill(),
  comment: cellText(stage, 'tableComment').fill(),
  add: strokesOf(stage, 'table-add-column')[0],
  remove: strokesOf(stage, 'table-remove')[0],
  edge: named(stage, 'table-header-color').getAttr('fill'),
});

const UNTINTED = {
  band: THEME.tableHeaderBackground,
  icon: THEME.foreground,
  name: THEME.placeholder,
  comment: THEME.placeholder,
  add: THEME.foreground,
  remove: THEME.foreground,
  edge: '#22c55e',
};

describe('a member table header', () => {
  it.each([
    ['#1e3a8a', '#ffffff'],
    ['#fef08a', '#000000'],
  ])(
    'wears %s with its text, placeholders and icons in %s, its own color on the edge',
    async (color, text) => {
      const { stage } = await mountMember(color);

      expect(headerPaint(stage)).toEqual({
        band: color,
        icon: text,
        name: text,
        comment: text,
        add: text,
        remove: text,
        edge: '#22c55e',
      });
    }
  );

  it('keeps the contrasting text on a name that is written', async () => {
    const { app, stage } = await mountMember('#1e3a8a');

    app.store.dispatchSync(
      changeTableNameAction({ id: TABLE_ID, value: 'users' })
    );
    await settle();

    expect(cellText(stage, 'tableName').text()).toBe('users');
    expect(cellText(stage, 'tableName').fill()).toBe('#ffffff');
  });

  it('reads the color as an opaque hex, an alpha or a function form included', async () => {
    const { stage } = await mountMember('rgb(30 58 138 / 40%)');

    expect(headerPaint(stage).band).toBe('#1e3a8a');
    expect(headerPaint(stage).name).toBe('#ffffff');
  });

  it('keeps the header it had for a group with no color, or one it cannot read', async () => {
    expect(headerPaint((await mountMember('')).stage)).toEqual(UNTINTED);
    expect(headerPaint((await mountMember('tomato')).stage)).toEqual(UNTINTED);
  });

  it('follows the group color as it changes and as it comes off', async () => {
    const { app, stage } = await mountMember('#1e3a8a');

    app.store.dispatchSync(
      changeTableGroupColorAction({
        id: GROUP_ID,
        color: '#fef08a',
        prevColor: '#1e3a8a',
      })
    );
    await settle();
    expect(headerPaint(stage).band).toBe('#fef08a');
    expect(headerPaint(stage).name).toBe('#000000');

    app.store.dispatchSync(
      changeTableGroupColorAction({
        id: GROUP_ID,
        color: '',
        prevColor: '#fef08a',
      })
    );
    await settle();
    expect(headerPaint(stage)).toEqual(UNTINTED);
  });

  it('drops the tint as the table leaves the group', async () => {
    const { app, stage } = await mountMember('#1e3a8a');

    app.store.dispatchSync(changeTableGroupAction({ id: TABLE_ID, value: '' }));
    await settle();

    expect(headerPaint(stage)).toEqual(UNTINTED);
  });

  it('drops the tint while groups are hidden, and wears it again once shown', async () => {
    const { app, stage } = await mountMember('#1e3a8a');

    app.store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );
    await settle();
    expect(headerPaint(stage)).toEqual(UNTINTED);

    app.store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: false })
    );
    await settle();
    expect(headerPaint(stage).band).toBe('#1e3a8a');
  });

  it('hides the buttons at rest on a tint as on any header', async () => {
    const { stage } = await mountMember('#1e3a8a', false);

    expect(strokesOf(stage, 'table-add-column')).toEqual([
      TRANSPARENT,
      TRANSPARENT,
    ]);
  });
});
