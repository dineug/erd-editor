/** @jsxHost konva */

import type { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  pseudoMessages,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  beginEntityDrag,
  endEntityDrag,
} from '@/components/erd/canvas/entityDrag';
import {
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  TABLE_GROUP_FILL_OPACITY,
} from '@/components/erd/canvas/sceneTokens';
import TableGroup from '@/components/erd/canvas/table-group/TableGroup';
import {
  TABLE_GROUP_PADDING,
  TABLE_GROUP_TITLE_HEIGHT,
} from '@/constants/layout';
import {
  selectAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addTableAction,
  changeTableGroupAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import { Tag } from '@/engine/tag';
import type { I18n } from '@/i18n/translate';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { toSharedColor } from '@/utils/sharedColor';

const GROUP_ID = 'group-1';

/** The rect the group stores, which the box is while no member reaches past it. */
const STORED = { x: 40, y: 60, width: 300, height: 200 };

const THEME: Theme = createTestTheme();

type Mounted = { app: AppContext; stage: Stage };

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function mountGroup({
  app = createTestAppContext(),
  color,
  i18n,
}: { app?: AppContext; color?: string; i18n?: I18n } = {}): Promise<Mounted> {
  app.store.dispatchSync(
    addTableGroupAction({ id: GROUP_ID, color, ui: { ...STORED, zIndex: 1 } })
  );
  const group = app.store.state.collections.tableGroupEntities[GROUP_ID];

  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <TableGroup group={group} />
      </k-layer>
    ),
    width: 1200,
    height: 900,
    theme: THEME,
    i18n,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await settle();
  return { app, stage: rendered.stage };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const nodeNamed = <T extends KonvaNode = KonvaNode>(
  stage: Stage,
  name: string
) => stage.findOne<T>(`.${name}`) as T;

const nameOf = (stage: Stage) => nodeNamed<Text>(stage, 'table-group-name');

/** Puts a table at the point given in the group, the way a drop or a command does. */
function addMember(app: AppContext, id: string, x: number, y: number) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x, y, zIndex: 2 } }),
    changeTableGroupAction({ id, value: GROUP_ID })
  );
  return app.store.state.collections.tableEntities[id];
}

describe('the table group scene', () => {
  it('roots the group at its box, the title bar and the body alone taking the pointer', async () => {
    const { stage } = await mountGroup();
    const root = nodeNamed<Group>(stage, 'table-group');

    expect(root.attrs).toMatchObject({
      id: `table-group-${GROUP_ID}`,
      kind: 'table-group',
      x: STORED.x,
      y: STORED.y,
      selected: false,
    });
    expect(root.listening()).toBe(true);
    expect(
      [
        'table-group-body',
        'table-group-title',
        'table-group-title-bar',
        'table-group-name',
        'table-group-border',
        'table-group-shared-select',
      ].map(name => [name, nodeNamed(stage, name).listening()])
    ).toEqual([
      ['table-group-body', true],
      ['table-group-title', true],
      ['table-group-title-bar', true],
      ['table-group-name', false],
      ['table-group-border', false],
      ['table-group-shared-select', false],
    ]);
    expect(nodeNamed(stage, 'table-group-body').attrs.kind).toBe(
      'table-group-body'
    );
    expect(nodeNamed(stage, 'table-group-title').attrs.kind).toBe(
      'table-group-title'
    );
    expect(root.getChildren().map(node => node.name())).toEqual([
      'table-group-body',
      'table-group-title',
      'table-group-border',
      'table-group-shared-select',
    ]);
    expect(
      nodeNamed<Group>(stage, 'table-group-title')
        .getChildren()
        .map(node => node.name())
    ).toEqual(['table-group-title-bar', 'table-group-name']);
  });

  it('splits the box into a title bar along its top and the body under it', async () => {
    const { stage } = await mountGroup();

    expect(nodeNamed(stage, 'table-group-title-bar').attrs).toMatchObject({
      width: STORED.width,
      height: TABLE_GROUP_TITLE_HEIGHT,
    });
    expect(nodeNamed(stage, 'table-group-body').attrs).toMatchObject({
      y: TABLE_GROUP_TITLE_HEIGHT,
      width: STORED.width,
      height: STORED.height - TABLE_GROUP_TITLE_HEIGHT,
      opacity: TABLE_GROUP_FILL_OPACITY,
    });
    expect(nodeNamed(stage, 'table-group-border').attrs).toMatchObject({
      x: 0.5,
      y: 0.5,
      width: STORED.width - 1,
      height: STORED.height - 1,
      strokeWidth: 1,
    });
  });

  it('reaches around a member past the stored rect, the title bar clear above it', async () => {
    const app = createTestAppContext();
    const table = addMember(app, 'member', 500, 30);
    const { stage } = await mountGroup({ app });
    const rect = getTableRect(app.store.state, table);
    const root = nodeNamed<Group>(stage, 'table-group');

    expect(root.y()).toBe(30 - TABLE_GROUP_PADDING - TABLE_GROUP_TITLE_HEIGHT);
    expect(root.x()).toBe(STORED.x);
    expect(nodeNamed(stage, 'table-group-title-bar').height()).toBe(
      TABLE_GROUP_TITLE_HEIGHT
    );
    expect(root.y() + TABLE_GROUP_TITLE_HEIGHT + TABLE_GROUP_PADDING).toBe(
      rect.y
    );
    expect(nodeNamed(stage, 'table-group-border').width() + 1).toBe(
      rect.x + rect.width + TABLE_GROUP_PADDING - STORED.x
    );
  });

  it('stretches over a member, and leaves out the ones a drag holds', async () => {
    const app = createTestAppContext();
    addMember(app, 'member', 900, 500);
    const { stage } = await mountGroup({ app });
    const border = () => nodeNamed(stage, 'table-group-border');
    const stretched = border().width();

    expect(stretched).toBeGreaterThan(STORED.width);

    app.store.dispatchSync(selectAction({ member: SelectType.table }));
    beginEntityDrag(app.store.state);
    await settle();
    expect(border().width()).toBe(STORED.width - 1);

    endEntityDrag(app.store.state);
    await settle();
    expect(border().width()).toBe(stretched);
  });

  it('keeps every member in the box while the group itself is dragged', async () => {
    const app = createTestAppContext();
    addMember(app, 'member', 900, 500);
    const { stage } = await mountGroup({ app });
    const stretched = nodeNamed(stage, 'table-group-border').width();

    app.store.dispatchSync(
      selectAction({
        [GROUP_ID]: SelectType.tableGroup,
        member: SelectType.table,
      })
    );
    beginEntityDrag(app.store.state);
    await settle();

    expect(nodeNamed(stage, 'table-group-border').width()).toBe(stretched);
    endEntityDrag(app.store.state);
  });

  it('paints a group with no color in the table header colors', async () => {
    const { stage } = await mountGroup();

    expect(nodeNamed(stage, 'table-group-title-bar').getAttr('fill')).toBe(
      THEME.tableHeaderBackground
    );
    expect(nodeNamed(stage, 'table-group-body').getAttr('fill')).toBe(
      THEME.foreground
    );
    expect(nodeNamed(stage, 'table-group-border').getAttr('stroke')).toBe(
      THEME.tableBorder
    );
  });

  it('paints the bar, the body and the line in the group color, as an opaque hex', async () => {
    const { stage } = await mountGroup({ color: '#1E3A8A80' });

    expect(nodeNamed(stage, 'table-group-title-bar').getAttr('fill')).toBe(
      '#1e3a8a'
    );
    expect(nodeNamed(stage, 'table-group-body').getAttr('fill')).toBe(
      '#1e3a8a'
    );
    expect(nodeNamed(stage, 'table-group-border').getAttr('stroke')).toBe(
      '#1e3a8a'
    );
  });

  it('takes the neutral colors for a color it cannot read', async () => {
    const { stage } = await mountGroup({ color: 'tomato' });

    expect(nodeNamed(stage, 'table-group-title-bar').getAttr('fill')).toBe(
      THEME.tableHeaderBackground
    );
    expect(nameOf(stage).getAttr('fill')).toBe(THEME.placeholder);
  });

  it('writes the name in the title bar, ellipsized past its width', async () => {
    const app = createTestAppContext();
    const { stage } = await mountGroup({ app });

    app.store.dispatchSync(
      changeTableGroupNameAction({ id: GROUP_ID, value: 'billing' })
    );
    await settle();

    expect(nameOf(stage).attrs).toMatchObject({
      text: 'billing',
      fill: THEME.active,
      x: 8,
      width: STORED.width - 16,
      height: TABLE_GROUP_TITLE_HEIGHT,
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      fontStyle: 'bold',
      verticalAlign: 'middle',
      wrap: 'none',
      ellipsis: true,
    });
  });

  it('writes an unnamed group as the unnamed placeholder in the reader language', async () => {
    const { stage } = await mountGroup({
      i18n: createTestI18n('ko-KR', pseudoMessages('ko')),
    });

    expect(nameOf(stage).text()).toBe('ko:unnamed');
    expect(nameOf(stage).getAttr('fill')).toBe(THEME.placeholder);
  });

  it.each([
    ['#fef08a', '#000000'],
    ['#1e3a8a', '#ffffff'],
  ])('writes the name on %s in %s, named or not', async (color, text) => {
    const app = createTestAppContext();
    const { stage } = await mountGroup({ app, color });

    expect(nameOf(stage).getAttr('fill')).toBe(text);

    app.store.dispatchSync(
      changeTableGroupNameAction({ id: GROUP_ID, value: 'billing' })
    );
    await settle();
    expect(nameOf(stage).getAttr('fill')).toBe(text);
  });

  it('repaints as the color changes and as it is taken off', async () => {
    const app = createTestAppContext();
    const { stage } = await mountGroup({ app });
    const bar = nodeNamed(stage, 'table-group-title-bar');

    app.store.dispatchSync(
      changeTableGroupColorAction({
        id: GROUP_ID,
        color: '#000000',
        prevColor: '',
      })
    );
    await settle();
    expect(bar.getAttr('fill')).toBe('#000000');
    expect(nameOf(stage).getAttr('fill')).toBe('#ffffff');

    app.store.dispatchSync(
      changeTableGroupColorAction({
        id: GROUP_ID,
        color: '',
        prevColor: '#000000',
      })
    );
    await settle();
    expect(bar.getAttr('fill')).toBe(THEME.tableHeaderBackground);
  });

  it('outlines a selected group in the selection color, as a memo is', async () => {
    const app = createTestAppContext();
    const { stage } = await mountGroup({ app, color: '#ef4444' });

    app.store.dispatchSync(selectAction({ [GROUP_ID]: SelectType.tableGroup }));
    await settle();

    expect(nodeNamed(stage, 'table-group').getAttr('selected')).toBe(true);
    expect(nodeNamed(stage, 'table-group-border').getAttr('stroke')).toBe(
      THEME.memoSelect
    );
    expect(nodeNamed(stage, 'table-group-title-bar').getAttr('fill')).toBe(
      '#ef4444'
    );
  });

  it('rings the box in a peer color only while a peer has it selected', async () => {
    const app = createTestAppContext();
    const { stage } = await mountGroup({ app });
    const ring = nodeNamed(stage, 'table-group-shared-select');

    expect(ring.attrs).toMatchObject({
      x: -RING_WIDTH / 2,
      y: -RING_WIDTH / 2,
      width: STORED.width + RING_WIDTH,
      height: STORED.height + RING_WIDTH,
      stroke: '',
    });

    app.store.dispatchSync({
      ...sharedSelectionTrackerAction({ selectedIds: [GROUP_ID] }),
      tags: Tag.shared,
      meta: { editorId: 'remote-1' },
    });
    await settle();

    expect(ring.getAttr('stroke')).toBe(toSharedColor('remote-1'));
    expect(nodeNamed(stage, 'table-group').getAttr('sharedSelect')).toBe(
      toSharedColor('remote-1')
    );
  });
});
