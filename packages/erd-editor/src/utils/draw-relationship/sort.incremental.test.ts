import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { getRoute } from '@/utils/draw-relationship';
import { relationshipSort } from '@/utils/draw-relationship/sort';

type Placement = [id: string, x: number, y: number];
type Pair = [id: string, start: string, end: string];

const TABLES: Placement[] = [
  ['A', 0, 0],
  ['B', 420, 0],
  ['C', 420, 300],
  ['D', 0, 300],
  ['E', 220, 150],
  ['F', 840, 150],
  ['G', 840, 460],
];

const PAIRS: Pair[] = [
  ['ab', 'A', 'B'],
  ['ac', 'A', 'C'],
  ['ad', 'A', 'D'],
  ['bc', 'B', 'C'],
  ['bf', 'B', 'F'],
  ['cf', 'C', 'F'],
  ['df', 'D', 'F'],
  ['eg', 'E', 'G'],
  ['fg', 'F', 'G'],
  ['ae', 'A', 'E'],
  ['ee', 'E', 'E'],
];

function createScene(moveA?: { x: number; y: number }): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;

  for (const [id, x, y] of TABLES) {
    const ui = id === 'A' && moveA ? moveA : { x, y };
    state.collections.tableEntities[id] = createTable({ id, ui });
    state.doc.tableIds.push(id);
  }
  for (const [id, start, end] of PAIRS) {
    state.collections.relationshipEntities[id] = createRelationship({
      id,
      start: { tableId: start },
      end: { tableId: end },
    });
    state.doc.relationshipIds.push(id);
  }

  return state;
}

function drawingOf(state: RootState) {
  return state.doc.relationshipIds.map(id => {
    const relationship = state.collections.relationshipEntities[id];
    return {
      id,
      start: { ...relationship.start },
      end: { ...relationship.end },
      route: getRoute(relationship)?.map(({ x, y }) => ({ x, y })),
    };
  });
}

describe('relationshipSort incremental reuse', () => {
  it('draws a moved table exactly as a sort of that layout from scratch', () => {
    const incremental = createScene();
    relationshipSort(incremental);

    for (let step = 1; step <= 12; step++) {
      const table = incremental.collections.tableEntities.A;
      table.ui.x = step * 9;
      table.ui.y = step * 5;
      relationshipSort(incremental);
    }

    const fresh = createScene({ x: 12 * 9, y: 12 * 5 });
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });

  it('draws a removed relationship exactly as a sort without it', () => {
    const incremental = createScene();
    relationshipSort(incremental);

    incremental.doc.relationshipIds = incremental.doc.relationshipIds.filter(
      id => id !== 'bc'
    );
    delete incremental.collections.relationshipEntities.bc;
    incremental.collections.tableEntities.A.ui.x = 40;
    relationshipSort(incremental);

    const fresh = createScene({ x: 40, y: 0 });
    fresh.doc.relationshipIds = fresh.doc.relationshipIds.filter(
      id => id !== 'bc'
    );
    delete fresh.collections.relationshipEntities.bc;
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });

  it('draws a removed table exactly as a sort without it', () => {
    const dropE = (state: RootState) => {
      state.doc.tableIds = state.doc.tableIds.filter(id => id !== 'E');
      delete state.collections.tableEntities.E;
      for (const id of ['ae', 'eg', 'ee']) {
        state.doc.relationshipIds = state.doc.relationshipIds.filter(
          other => other !== id
        );
        delete state.collections.relationshipEntities[id];
      }
    };

    const incremental = createScene();
    relationshipSort(incremental);
    dropE(incremental);
    relationshipSort(incremental);

    const fresh = createScene();
    dropE(fresh);
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });
});
