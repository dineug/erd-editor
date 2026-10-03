/** @jsxHost konva */

// The ON DELETE / ON UPDATE label of a connector, drawn by the group after every
// route so a crossing connector runs under its rim: its text, where it stands
// at each end, the bit that hides it, the zoom that drops it and its hover.

import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { type AppContext } from '@/components/appContext';
import { ACTION_LABEL_FONT_SIZE } from '@/components/erd/canvas/relationship-group/relationship/RelationshipActionLabel';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import {
  Direction,
  ReferentialAction,
  RelationshipType,
  Show,
  StartRelationshipType,
} from '@/constants/schema';
import { hoverRelationshipMapAction } from '@/engine/modules/editor/atom.actions';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { Point, Relationship } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { LINE_SIZE } from '@/utils/draw-relationship';

const THEME = createTestTheme();

const END: Point = { x: 400, y: 260 };

const makeRelationship = (
  value: Parameters<typeof createRelationship>[0] = {}
): Relationship =>
  createRelationship({
    id: 'r1',
    relationshipType: RelationshipType.ZeroN,
    startRelationshipType: StartRelationshipType.dash,
    onDelete: ReferentialAction.cascade,
    onUpdate: ReferentialAction.restrict,
    start: {
      tableId: 't1',
      columnIds: ['c1'],
      x: 100,
      y: 200,
      direction: Direction.right,
    },
    end: {
      tableId: 't2',
      columnIds: ['c2'],
      ...END,
      direction: Direction.left,
    },
    ...value,
  });

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

async function mountGroup(
  relationships: Relationship[],
  zoomLevel = 1
): Promise<{ app: AppContext; stage: Stage }> {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createTestAppContext();
  app.store.state.settings.zoomLevel = zoomLevel;
  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <RelationshipGroup relationships={relationships} />
      </k-layer>
    ),
    width: 800,
    height: 600,
    theme: THEME,
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

const labelsOf = (stage: Stage) =>
  stage.find<KonvaNode>('.relationship-action-label');

const labelOf = (stage: Stage) => labelsOf(stage)[0] as Container | undefined;

const textOf = (label: Container | KonvaNode | undefined) =>
  (label as Container | undefined)?.findOne('.relationship-action-text');

const textsOf = (stage: Stage) =>
  labelsOf(stage).map(label => textOf(label)?.getAttr('text'));

type LabelBox = { left: number; top: number; right: number; bottom: number };

const boxOf = (label: Container): LabelBox => {
  const box = label.findOne('.relationship-action-box')!;
  return {
    left: label.x(),
    top: label.y(),
    right: label.x() + box.width(),
    bottom: label.y() + box.height(),
  };
};

describe('the referential action label', () => {
  it('writes the actions set in the route colour on a box of the canvas colour, deaf to the pointer', async () => {
    const { stage } = await mountGroup([makeRelationship()]);
    const label = labelOf(stage)!;
    const box = label.findOne('.relationship-action-box')!;
    const text = textOf(label)!;

    expect(label.getAttr('listening')).toBe(false);
    expect(box.getAttr('fill')).toBe(THEME.canvasBackground);
    expect(text.getAttr('text')).toBe('D:C U:R');
    expect(text.getAttr('fill')).toBe(THEME.keyFK);
    expect(text.getAttr('fontSize')).toBe(ACTION_LABEL_FONT_SIZE);
    // The box holds the text, whose advance it reckons from the code face.
    expect(box.width()).toBeGreaterThanOrEqual(
      text.x() + (text as any).getTextWidth()
    );
    expect(box.height()).toBeGreaterThan(text.y() + ACTION_LABEL_FONT_SIZE);
  });

  it('paints an identifying connector label in the primary foreign key colour', async () => {
    const { stage } = await mountGroup([
      makeRelationship({ identification: true }),
    ]);

    expect(textOf(labelOf(stage))?.getAttr('fill')).toBe(THEME.keyPFK);
  });

  it('draws every label after every route, so no connector paints over one', async () => {
    const { stage } = await mountGroup([
      makeRelationship(),
      makeRelationship({ id: 'r2', onUpdate: ReferentialAction.none }),
    ]);
    const children = (
      stage.findOne('.relationship-group') as Container
    ).getChildren();
    const lastRoute = children
      .map(node => node.hasName('relationship'))
      .lastIndexOf(true);
    const firstLabel = children.findIndex(node =>
      node.hasName('relationship-action-label')
    );

    expect(textsOf(stage)).toEqual(['D:C U:R', 'D:C']);
    expect(firstLabel).toBeGreaterThan(lastRoute);
  });

  it('shows nothing for a connector that sets neither action', async () => {
    const { stage } = await mountGroup([
      makeRelationship({
        onDelete: ReferentialAction.none,
        onUpdate: ReferentialAction.none,
      }),
    ]);

    expect(labelOf(stage)).toBeUndefined();
  });

  it.each([
    [
      'left',
      Direction.left,
      (box: LabelBox) => box.right <= END.x && box.bottom <= END.y - LINE_SIZE,
    ],
    [
      'right',
      Direction.right,
      (box: LabelBox) => box.left >= END.x && box.bottom <= END.y - LINE_SIZE,
    ],
    [
      'top',
      Direction.top,
      (box: LabelBox) => box.left >= END.x + LINE_SIZE && box.bottom <= END.y,
    ],
    [
      'bottom',
      Direction.bottom,
      (box: LabelBox) => box.left >= END.x + LINE_SIZE && box.top >= END.y,
    ],
  ])(
    'stands clear of the markers at a child end leaving %s',
    async (_, direction, clear) => {
      const { stage } = await mountGroup([
        makeRelationship({
          end: { tableId: 't2', columnIds: ['c2'], ...END, direction },
        }),
      ]);

      expect(clear(boxOf(labelOf(stage)!))).toBe(true);
    }
  );

  it('hides under the hide bit and shows again once it clears', async () => {
    const { app, stage } = await mountGroup([makeRelationship()]);

    app.store.dispatchSync(
      changeShowAction({ show: Show.hideReferentialAction, value: true })
    );
    await settle();
    expect(labelOf(stage)).toBeUndefined();

    app.store.dispatchSync(
      changeShowAction({ show: Show.hideReferentialAction, value: false })
    );
    await settle();
    expect(textOf(labelOf(stage))?.getAttr('text')).toBe('D:C U:R');
  });

  it('draws none at a zoom that draws a table by its name alone', async () => {
    const overview = await mountGroup([makeRelationship()], 0.5);
    const close = await mountGroup([makeRelationship()], 1);

    expect(labelOf(overview.stage)).toBeUndefined();
    expect(textOf(labelOf(close.stage))?.getAttr('text')).toBe('D:C U:R');
  });

  it('lights with its connector under the pointer, and with the hover map', async () => {
    const { app, stage } = await mountGroup([
      makeRelationship(),
      makeRelationship({ id: 'r2' }),
    ]);
    const [first, second] = labelsOf(stage).map(label => textOf(label)!);

    stage.findOne('.r1')!.fire('mouseenter');
    await settle();
    expect(first.getAttr('fill')).toBe(THEME.relationshipHover);
    expect(second.getAttr('fill')).toBe(THEME.keyFK);

    stage.findOne('.r1')!.fire('mouseleave');
    await settle();
    expect(first.getAttr('fill')).toBe(THEME.keyFK);

    app.store.dispatchSync(
      hoverRelationshipMapAction({ relationshipIds: ['r2'] })
    );
    await settle();
    expect(second.getAttr('fill')).toBe(THEME.relationshipHover);
  });
});
