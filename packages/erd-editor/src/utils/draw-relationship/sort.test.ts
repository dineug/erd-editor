import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { relationshipSort } from '@/utils/draw-relationship/sort';

// A table with no columns and every `show` flag disabled is 118 x 56.
const TABLE_WIDTH = 118;
const TABLE_HEIGHT = 56;

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

  it('measures tables as 118 x 56 when nothing is shown', () => {
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
      x: 118,
      y: 28,
      direction: Direction.right,
    });
    expect(relationship.end).toMatchObject({
      x: 400,
      y: 28,
      direction: Direction.left,
    });
  });

  it('anchors a vertical relationship on the facing bottom/top edges', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 0, 300);
    const relationship = addRelationship(state, 'r', 'A', 'B');

    relationshipSort(state);

    expect(relationship.start).toMatchObject({
      x: 59,
      y: 56,
      direction: Direction.bottom,
    });
    expect(relationship.end).toMatchObject({
      x: 59,
      y: 300,
      direction: Direction.top,
    });
  });

  it('routes a self relationship around the top-right corner', () => {
    addTable(state, 'A', 10, 20);
    const relationship = addRelationship(state, 'r', 'A', 'A');

    relationshipSort(state);

    // rt = (10 + 118, 20)
    expect(relationship.start).toMatchObject({
      x: 108,
      y: 20,
      direction: Direction.top,
    });
    expect(relationship.end).toMatchObject({
      x: 128,
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

    // height 56 / 2 anchors -> margin 28, padding 14 -> y = 14, 42
    expect(ab.start).toMatchObject({
      x: 118,
      y: 14,
      direction: Direction.right,
    });
    expect(ab.end).toMatchObject({ x: 400, y: -72, direction: Direction.left });
    expect(ac.start).toMatchObject({
      x: 118,
      y: 42,
      direction: Direction.right,
    });
    expect(ac.end).toMatchObject({ x: 400, y: 228, direction: Direction.left });
  });

  it('spreads overlapping bottom-edge anchors along the x axis', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 0, 300);
    addTable(state, 'C', 0, 600);
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    // width 118 / 2 anchors -> margin 59, padding 29.5 -> x = 29.5, 88.5
    expect(ab.start).toMatchObject({
      x: 29.5,
      y: 56,
      direction: Direction.bottom,
    });
    expect(ab.end).toMatchObject({ x: 59, y: 300, direction: Direction.top });
    expect(ac.start).toMatchObject({
      x: 88.5,
      y: 56,
      direction: Direction.bottom,
    });
    expect(ac.end).toMatchObject({ x: 59, y: 600, direction: Direction.top });
  });

  it('spreads overlapping anchors when the shared table is the relationship end', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 0, 300);
    addTable(state, 'C', 0, 600);
    const ba = addRelationship(state, 'ba', 'B', 'A');
    const ca = addRelationship(state, 'ca', 'C', 'A');

    relationshipSort(state);

    expect(ba.start).toMatchObject({ x: 59, y: 300, direction: Direction.top });
    expect(ba.end).toMatchObject({
      x: 29.5,
      y: 56,
      direction: Direction.bottom,
    });
    expect(ca.start).toMatchObject({ x: 59, y: 600, direction: Direction.top });
    expect(ca.end).toMatchObject({
      x: 88.5,
      y: 56,
      direction: Direction.bottom,
    });
  });

  it('includes a self relationship in both the top and the right edge distribution', () => {
    addTable(state, 'A', 0, 0);
    addTable(state, 'B', 400, 0);
    addTable(state, 'C', 0, -300);
    const self = addRelationship(state, 'self', 'A', 'A');
    const ab = addRelationship(state, 'ab', 'A', 'B');
    const ac = addRelationship(state, 'ac', 'A', 'C');

    relationshipSort(state);

    expect(self.start).toMatchObject({
      x: 88.5,
      y: 0,
      direction: Direction.top,
    });
    expect(self.end).toMatchObject({
      x: 118,
      y: 14,
      direction: Direction.right,
    });
    expect(ab.start).toMatchObject({
      x: 118,
      y: 42,
      direction: Direction.right,
    });
    expect(ab.end).toMatchObject({ x: 400, y: 28, direction: Direction.left });
    expect(ac.start).toMatchObject({
      x: 29.5,
      y: 0,
      direction: Direction.top,
    });
    expect(ac.end).toMatchObject({
      x: 59,
      y: -244,
      direction: Direction.bottom,
    });
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
});
