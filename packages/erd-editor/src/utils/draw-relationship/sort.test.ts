import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { createEditor, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { getRoute } from '@/utils/draw-relationship';
import { relationshipSort } from '@/utils/draw-relationship/sort';

// A table with no columns and every show flag disabled is 134 x 30.
const TABLE_WIDTH = 134;
const TABLE_HEIGHT = 30;

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

function addTable(state: RootState, id: string, x: number, y: number) {
  const table = createTable({ id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addRelationship(
  state: RootState,
  id: string,
  startTableId: string,
  endTableId: string
): Relationship {
  const relationship = createRelationship({
    id,
    start: { tableId: startTableId },
    end: { tableId: endTableId },
  });
  state.collections.relationshipEntities[id] = relationship;
  state.doc.relationshipIds.push(id);
  return relationship;
}

describe('relationshipSort', () => {
  let state: RootState;

  beforeEach(() => {
    state = createState();
  });

  it('measures tables as 134 x 30 when nothing is shown', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, 0);
    const horizontal = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);

    // right edge of A, vertically centred
    expect(horizontal.start.x).toBe(TABLE_WIDTH);
    expect(horizontal.start.y).toBe(TABLE_HEIGHT / 2);

    const vertical = createState();
    addTable(vertical, 'A', 0, 0);
    addTable(vertical, 'B', 0, 300);
    const down = addRelationship(vertical, 'r', 'A', 'B');

    relationshipSort(vertical);

    // bottom edge of A, horizontally centred
    expect(down.start.x).toBe(TABLE_WIDTH / 2);
    expect(down.start.y).toBe(TABLE_HEIGHT);
  });

  it('anchors a horizontal relationship on the facing right/left edges', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, 0);
    const relationship = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 134,
      y: 15,
      direction: Direction.right,
    });
    expect(relationship.end).toMatchObject({
      x: 400,
      y: 15,
      direction: Direction.left,
    });
  });

  it('anchors a vertical relationship on the facing bottom/top edges', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 0, 300);
    const relationship = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 67,
      y: 30,
      direction: Direction.bottom,
    });
    expect(relationship.end).toMatchObject({
      x: 67,
      y: 300,
      direction: Direction.top,
    });
  });

  it('routes a self relationship around the top-right corner', () => {
    addTable(state, 'A', 10, 20);
    const relationship = addRelationship(state, 'r', 'A', 'A');

    relationshipSort(state);

    // rt = (10 + 134, 20)
    expect(relationship.start).toMatchObject({
      x: 124,
      y: 20,
      direction: Direction.top,
    });
    expect(relationship.end).toMatchObject({
      x: 144,
      y: 40,
      direction: Direction.right,
    });
  });

  it('spreads overlapping right-edge anchors along the y axis, ordered by target y', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, -100);
    addTable(state, 'C', 400, 200);
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    // Right side: height 30 less two 12px insets leaves 6, one gap under the
    // 120 cap, centred on y = 15. B is above A and C below it, so walking the
    // side downwards has to meet B first or the two lines cross.
    expect(ab.start).toMatchObject({
      x: 134,
      y: 12,
      direction: Direction.right,
    });
    expect(ab.end).toMatchObject({ x: 400, y: -85, direction: Direction.left });
    expect(ac.start).toMatchObject({
      x: 134,
      y: 18,
      direction: Direction.right,
    });
    expect(ac.end).toMatchObject({ x: 400, y: 215, direction: Direction.left });
    expect(ab.start.y).toBeLessThan(ac.start.y);
  });

  it('spreads overlapping bottom-edge anchors along the x axis', () => {
    // Far enough below A that its bottom edge, not a side, is nearest B and C.
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', -120, 600);
    addTable(state, 'C', 120, 600);
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    // Bottom side: width 134 less two 12px insets leaves a 110px gap, under the
    // 120px cap and so used in full. C is right of B and the bottom edge walks
    // right to left, so the anchor pointing at C is the right-hand one.
    expect(ab.start).toMatchObject({
      x: 12,
      y: 30,
      direction: Direction.bottom,
    });
    expect(ab.end).toMatchObject({ x: -53, y: 600, direction: Direction.top });
    expect(ac.start).toMatchObject({
      x: 122,
      y: 30,
      direction: Direction.bottom,
    });
    expect(ac.end).toMatchObject({ x: 187, y: 600, direction: Direction.top });
  });

  it('spreads overlapping anchors when the shared table is the relationship end', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', -120, 600);
    addTable(state, 'C', 120, 600);
    const ba = addRelationship(state, 'ba', 'B', 'A');
    const ca = addRelationship(state, 'ca', 'C', 'A');

    relationshipSort(state);

    expect(ba.start).toMatchObject({
      x: -53,
      y: 600,
      direction: Direction.top,
    });
    expect(ba.end).toMatchObject({
      x: 12,
      y: 30,
      direction: Direction.bottom,
    });
    expect(ca.start).toMatchObject({
      x: 187,
      y: 600,
      direction: Direction.top,
    });
    expect(ca.end).toMatchObject({
      x: 122,
      y: 30,
      direction: Direction.bottom,
    });
  });

  it('keeps a self relationship in the corner without crowding the sides it touches', () => {
    // Two rows make A 78px tall, so its right side keeps 40 to 66 past the
    // 28px the loop reserves; one row would keep 40 to 42, an empty table none.
    const a = addTable(state, 'A', 0, 0);
    a.columnIds = ['c0', 'c1'];
    addTable(state, 'B', 400, 0);
    addTable(state, 'C', 0, -300);
    const self = addRelationship(state, 'self', 'A', 'A');
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    // 15% of the shorter side is 11.7, below the 20px floor.
    expect(self.start).toMatchObject({
      x: 114,
      y: 0,
      direction: Direction.top,
    });
    expect(self.end).toMatchObject({
      x: 134,
      y: 20,
      direction: Direction.right,
    });

    // The loop takes no slot on either side, so it cannot tighten the spacing of
    // relationships that go nowhere near it. It does reserve the corner it sits
    // in, which is why ab and ac centre on what is left of their sides.
    expect(ab.start).toMatchObject({
      x: 134,
      y: 53,
      direction: Direction.right,
    });
    expect(ab.end).toMatchObject({ x: 400, y: 15, direction: Direction.left });
    expect(ac.start).toMatchObject({
      x: 53,
      y: 0,
      direction: Direction.top,
    });
    expect(ac.end).toMatchObject({
      x: 67,
      y: -270,
      direction: Direction.bottom,
    });
  });

  it('caps how far apart two anchors are spread on a tall table', () => {
    // 20 columns make A 510px tall. Dividing that edge by the anchor count puts
    // the two anchors 255px apart, splayed to opposite ends and converging
    // again; the cap holds them together as a group instead.
    const tall = addTable(state, 'A', 0, 0);
    tall.columnIds = Array.from({ length: 20 }, (_, index) => `c${index}`);
    addTable(state, 'B', 700, 150);
    addTable(state, 'C', 700, 400);
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    expect(ab.start.direction).toBe(Direction.right);
    expect(ac.start.direction).toBe(Direction.right);
    expect(Math.abs(ac.start.y - ab.start.y)).toBe(120);
  });

  it('places anchors independently of the order relationships are stored in', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, -100);
    addTable(state, 'C', 400, 200);
    addTable(state, 'D', 0, 400);
    addRelationship(state, 'ab', 'A', 'B');
    addRelationship(state, 'ac', 'A', 'C');
    addRelationship(state, 'ad', 'A', 'D');

    relationshipSort(state);
    const first = JSON.stringify(
      state.doc.relationshipIds
        .map(id => state.collections.relationshipEntities[id])
        .map(({ id, start, end }) => ({ id, start, end }))
    );

    state.doc.relationshipIds.reverse();
    relationshipSort(state);
    const second = JSON.stringify(
      [...state.doc.relationshipIds]
        .sort()
        .map(id => state.collections.relationshipEntities[id])
        .map(({ id, start, end }) => ({ id, start, end }))
    );

    const firstSorted = JSON.stringify(
      JSON.parse(first).sort((a: { id: string }, b: { id: string }) =>
        a.id < b.id ? -1 : 1
      )
    );
    expect(second).toBe(firstSorted);
  });

  it('ignores relationships whose tables are not part of the document', () => {
    addTable(state, 'A', 0, 0);
    const table = createTable({ id: 'B', ui: { x: 400, y: 0 } });
    state.collections.tableEntities.B = table;
    const relationship = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
    expect(relationship.end).toMatchObject({
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
  });

  it('ignores relationships whose table entity is missing from the collection', () => {
    addTable(state, 'A', 0, 0);
    state.doc.tableIds.push('ghost');
    const relationship = addRelationship(state, 'r', 'A', 'ghost');

    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
    expect(relationship.end).toMatchObject({
      x: 0,
      y: 0,
      direction: Direction.bottom,
    });
  });

  it('does nothing when there are no relationships', () => {
    addTable(state, 'A', 0, 0);

    expect(() => relationshipSort(state)).not.toThrow();
    expect(state.doc.relationshipIds).toHaveLength(0);
  });

  /** AC-67. The source argument defaults to the document. */
  it('sorts the document by default', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, 0);
    const relationship = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);
    const bare = {
      start: { ...relationship.start },
      end: { ...relationship.end },
      route: getRoute(relationship),
    };

    relationshipSort(state, 'document');

    expect({
      start: { ...relationship.start },
      end: { ...relationship.end },
      route: getRoute(relationship),
    }).toEqual(bare);
  });

  /** AC-61. A view standing elsewhere changes nothing the document sort writes. */
  it('leaves the document anchors where they are while a view stands elsewhere', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, 0);
    const relationship = addRelationship(state, 'r', 'A', 'B');
    const view = createSceneView(ViewKind.flow, ['A']);
    view.positions = { A: { x: 5_000, y: -3_000 }, B: { x: 5_600, y: -3_000 } };
    state.editor.views.flow = view;

    relationshipSort(state, 'flow');
    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 134,
      y: 15,
      direction: Direction.right,
    });
    expect(relationship.end).toMatchObject({
      x: 400,
      y: 15,
      direction: Direction.left,
    });
    expect(getRoute(relationship)?.[0].y).toBe(15);
  });
});
