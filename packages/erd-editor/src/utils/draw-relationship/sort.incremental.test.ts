import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
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
/**
 * The bench corpus's own layout arithmetic, so the scene below is the shape the
 * routing bench reports on rather than one merely of the same size.
 */
const GRID = { cellX: 420, cellY: 340, jitter: 45, origin: 80 };

/** Columns and name width, which give the boxes the corpus's proportions. */
const CORPUS_COLUMNS = 7;
const CORPUS_WIDTH_NAME = 260;

/** mulberry32, the generator corpus.ts lays its jitter and its edges out with. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Layout = {
  tables: Placement[];
  pairs: Pair[];
  hubTableId: string;
  /** A table with neighbours on all four sides, for a drag that has to weave. */
  innerTableId: string;
};

/**
 * A jittered grid of tables joined by a spanning tree, a forced hub and random
 * extra edges, plus one self relationship. Every draw comes off one seeded
 * generator, so the layout is the same on every run and on every machine.
 */
function createLayout(
  tableCount: number,
  relationshipCount: number,
  hubDegree: number,
  seed: number
): Layout {
  const random = prng(seed);
  const columns = Math.ceil(Math.sqrt(tableCount));
  const tables: Placement[] = [];

  for (let index = 0; index < tableCount; index++) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    tables.push([
      `t${index}`,
      Math.round(
        GRID.origin + col * GRID.cellX + (random() - 0.5) * 2 * GRID.jitter
      ),
      Math.round(
        GRID.origin + row * GRID.cellY + (random() - 0.5) * 2 * GRID.jitter
      ),
    ]);
  }

  const ids = tables.map(([id]) => id);
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();

  const addPair = (a: string, b: string) => {
    if (a === b) return;
    const key = `${a}->${b}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };

  for (let index = 1; index < tableCount; index++) {
    const window = Math.min(index, columns + 1);
    const parent = index - 1 - Math.floor(random() * window);
    addPair(ids[Math.max(0, parent)], ids[index]);
  }

  const hubTableId = ids[Math.floor(tableCount / 2)];
  const degreeOf = (id: string) =>
    edges.filter(([a, b]) => a === id || b === id).length;

  for (let n = 0; edges.length < relationshipCount && n < hubDegree * 4; n++) {
    addPair(hubTableId, ids[Math.floor(random() * tableCount)]);
    if (degreeOf(hubTableId) >= hubDegree) break;
  }

  let guard = relationshipCount * 20;
  while (edges.length < relationshipCount - 1 && guard-- > 0) {
    addPair(
      ids[Math.floor(random() * tableCount)],
      ids[Math.floor(random() * tableCount)]
    );
  }

  const pairs: Pair[] = edges.map(([start, end], index) => [
    `r${index}`,
    start,
    end,
  ]);
  pairs.push([`r${pairs.length}`, ids[2], ids[2]]);

  const middleRow = Math.floor(Math.floor((tableCount - 1) / columns) / 2);
  const innerIndex = middleRow * columns + Math.floor(columns / 2);

  return { tables, pairs, hubTableId, innerTableId: ids[innerIndex] };
}

/** The medium corpus's scale: 40 tables, 62 relationships, a hub of degree 6. */
const CORPUS = createLayout(40, 62, 6, 20260817);

function createCorpusScene(
  moved: Record<string, { x: number; y: number }> = {}
): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;

  for (const [id, x, y] of CORPUS.tables) {
    const columnIds = Array.from(
      { length: CORPUS_COLUMNS },
      (_, index) => `${id}_c${index}`
    );

    for (const columnId of columnIds) {
      state.collections.tableColumnEntities[columnId] = createColumn({
        id: columnId,
        tableId: id,
      });
    }
    state.collections.tableEntities[id] = createTable({
      id,
      ui: { ...(moved[id] ?? { x, y }), widthName: CORPUS_WIDTH_NAME },
      columnIds,
      seqColumnIds: columnIds,
    });
    state.doc.tableIds.push(id);
  }

  for (const [id, start, end] of CORPUS.pairs) {
    state.collections.relationshipEntities[id] = createRelationship({
      id,
      start: { tableId: start },
      end: { tableId: end },
    });
    state.doc.relationshipIds.push(id);
  }

  return state;
}

type Walk = {
  tableId: string;
  steps: number;
  stepX: number;
  stepY: number;
  /** The step the drag turns round on, so it walks back over its own ground. */
  reverseAt: number;
};

/**
 * The bench's drag: one sort per move, turned round partway through. Returns
 * where the table landed, which is the layout the sort from scratch is built at.
 */
function walk(
  state: RootState,
  { tableId, steps, stepX, stepY, reverseAt }: Walk
) {
  const table = state.collections.tableEntities[tableId];

  for (let step = 1; step <= steps; step++) {
    const direction = step > reverseAt ? -1 : 1;
    table.ui.x += stepX * direction;
    table.ui.y += stepY * direction;
    relationshipSort(state);
  }

  return { [tableId]: { x: table.ui.x, y: table.ui.y } };
}

/** Where a table starts, so a walk can be shown to have gone somewhere. */
function placementOf(tableId: string) {
  const [, x, y] = CORPUS.tables.find(([id]) => id === tableId) as Placement;
  return { x, y };
}

describe('relationshipSort incremental reuse at corpus scale', () => {
  it('draws 120 drag steps of the hub as a sort of that layout from scratch', () => {
    const incremental = createCorpusScene();
    relationshipSort(incremental);
    const landed = walk(incremental, {
      tableId: CORPUS.hubTableId,
      steps: 120,
      stepX: 2,
      stepY: 1,
      reverseAt: 70,
    });

    const fresh = createCorpusScene(landed);
    relationshipSort(fresh);

    expect(landed[CORPUS.hubTableId]).not.toEqual(
      placementOf(CORPUS.hubTableId)
    );
    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });

  it('draws a table dragged through its neighbours as a sort from scratch', () => {
    const incremental = createCorpusScene();
    relationshipSort(incremental);
    const landed = walk(incremental, {
      tableId: CORPUS.innerTableId,
      steps: 120,
      stepX: 6,
      stepY: 4,
      reverseAt: 90,
    });

    const fresh = createCorpusScene(landed);
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });

  it('draws a drag over a removed table and relationship as a sort without them', () => {
    const dropped = CORPUS.tables[7][0];
    const strip = (state: RootState) => {
      const gone = state.doc.relationshipIds.filter(id => {
        const { start, end } = state.collections.relationshipEntities[id];
        return (
          id === 'r5' || start.tableId === dropped || end.tableId === dropped
        );
      });

      state.doc.tableIds = state.doc.tableIds.filter(id => id !== dropped);
      delete state.collections.tableEntities[dropped];
      state.doc.relationshipIds = state.doc.relationshipIds.filter(
        id => !gone.includes(id)
      );
      for (const id of gone) delete state.collections.relationshipEntities[id];
    };

    const incremental = createCorpusScene();
    relationshipSort(incremental);
    const first = walk(incremental, {
      tableId: CORPUS.innerTableId,
      steps: 20,
      stepX: 4,
      stepY: 3,
      reverseAt: 20,
    });
    strip(incremental);
    const landed = walk(incremental, {
      tableId: CORPUS.hubTableId,
      steps: 100,
      stepX: -5,
      stepY: -3,
      reverseAt: 70,
    });

    const fresh = createCorpusScene({ ...first, ...landed });
    strip(fresh);
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });
});
