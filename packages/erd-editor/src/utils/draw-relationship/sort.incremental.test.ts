import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { createEditor, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { getAnchors, getRoute } from '@/utils/draw-relationship';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import { getSortCache } from '@/utils/draw-relationship/incremental';
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

type Sized = [id: string, x: number, y: number, columns: number];
type Step = { move: string; x: number; y: number } | { drop: string };

function sceneOf(tables: Sized[], pairs: Pair[]): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;

  for (const [id, x, y, count] of tables) {
    const columns = Array.from({ length: count }, (_, index) =>
      createColumn({ id: `${id}c${index}`, tableId: id, name: `c${index}` })
    );
    const columnIds = columns.map(column => column.id);
    state.collections.tableEntities[id] = createTable({
      id,
      name: id,
      columnIds,
      seqColumnIds: columnIds,
      ui: { x, y },
    });
    for (const column of columns) {
      state.collections.tableColumnEntities[column.id] = column;
    }
    state.doc.tableIds.push(id);
  }
  for (const [id, start, end] of pairs) {
    state.collections.relationshipEntities[id] = createRelationship({
      id,
      start: { tableId: start },
      end: { tableId: end },
    });
    state.doc.relationshipIds.push(id);
  }

  return state;
}

function take(state: RootState, step: Step) {
  if ('move' in step) {
    Object.assign(state.collections.tableEntities[step.move].ui, step);
    return;
  }
  state.doc.relationshipIds = state.doc.relationshipIds.filter(
    id => id !== step.drop
  );
  delete state.collections.relationshipEntities[step.drop];
}

/** The drawing after each step is sorted in turn, and a sort from scratch of the last layout. */
function stepsAgainstFresh(tables: Sized[], pairs: Pair[], steps: Step[]) {
  const incremental = sceneOf(tables, pairs);
  relationshipSort(incremental);
  for (const step of steps) {
    take(incremental, step);
    relationshipSort(incremental);
  }

  const fresh = sceneOf(tables, pairs);
  for (const step of steps) take(fresh, step);
  relationshipSort(fresh);

  return { incremental: drawingOf(incremental), fresh: drawingOf(fresh) };
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

  it('draws a table moved into the lanes a route turns at as a sort from scratch', () => {
    // D comes to stand across the band the route from A up to B turns in,
    // far from the route itself, and gives it a nearer lane to turn at.
    const layout = (d: { x: number; y: number }) => {
      const state: RootState = {
        ...schemaV3Parser({}),
        editor: createEditor(),
        lww: {},
      };
      state.settings.show = 0;
      for (const [id, x, y] of [
        ['A', 550, 400],
        ['B', 400, 50],
        ['C', 450, 250],
        ['D', d.x, d.y],
        ['E', 0, 150],
      ] as const) {
        state.collections.tableEntities[id] = createTable({ id, ui: { x, y } });
        state.doc.tableIds.push(id);
      }
      state.collections.relationshipEntities.r = createRelationship({
        id: 'r',
        start: { tableId: 'A' },
        end: { tableId: 'B' },
      });
      state.doc.relationshipIds.push('r');
      return state;
    };
    const incremental = layout({ x: 50, y: 300 });
    relationshipSort(incremental);

    incremental.collections.tableEntities.D.ui.x = 200;
    incremental.collections.tableEntities.D.ui.y = 200;
    relationshipSort(incremental);
    const fresh = layout({ x: 200, y: 200 });
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
  });

  it('draws a table whose lane changes the lanes a route tries as a sort from scratch', () => {
    // t1 comes nowhere near r9's candidates, yet its lane took a place in the
    // list r9 turns at, which only the lanes r9 can turn at may take now.
    const { incremental, fresh } = stepsAgainstFresh(
      [
        ['t1', 574, 168, 4],
        ['t2', 109.5, 240, 6],
        ['t6', 351, 325, 2],
        ['t7', 285.5, 169.5, 0],
        ['t9', 147.5, 489, 4],
        ['t10', 174, 387, 0],
      ],
      [['r9', 't9', 't7']],
      [{ move: 't1', x: 310.5, y: 95 }]
    );

    expect(incremental).toEqual(fresh);
  });

  it('draws a group whose lanes lie a gap apart as a sort from scratch', () => {
    // The channel joined two segments more than a gap apart through r8's, far
    // along the axis, and the pair kept the lanes it was given after r8 left.
    const { incremental, fresh } = stepsAgainstFresh(
      [
        ['t0', 94.5, 79, 5],
        ['t1', 186.5, 149, 4],
        ['t2', 368.5, 257, 1],
        ['t3', 137, 429.5, 6],
        ['t5', 585, 46.5, 3],
        ['t7', 109, 344, 3],
        ['t9', 638, 75.5, 2],
        ['t10', 530, 466, 5],
      ],
      [
        ['r2', 't5', 't10'],
        ['r8', 't10', 't5'],
        ['r11', 't10', 't5'],
        ['r13', 't3', 't9'],
        ['r14', 't9', 't3'],
        ['r15', 't7', 't0'],
      ],
      [{ drop: 'r8' }]
    );

    expect(incremental).toEqual(fresh);
  });

  it('draws a group joined through a segment of another as a sort from scratch', () => {
    // r7 runs over neither r14 nor r18, yet the three were laid out together,
    // joined through r10's run; once r28 left and r7 moved, the pair kept the
    // lanes the three had been given.
    const { incremental, fresh } = stepsAgainstFresh(
      [
        ['t0', 1054, 753, 4],
        ['t1', 483.5, 642.5, 5],
        ['t2', 617.5, 512, 3],
        ['t3', 764, 581.5, 1],
        ['t6', 219, 421.5, 4],
        ['t7', 878.5, 761, 6],
        ['t8', 1252, 585.5, 4],
        ['t12', 1027, 475, 6],
        ['t14', 1200.5, 257.5, 4],
        ['t16', 641.5, 484.5, 1],
        ['t19', 136.5, 239, 6],
        ['t22', 767.5, 369, 3],
        ['t23', 804.5, 177.5, 4],
      ],
      [
        ['r7', 't8', 't14'],
        ['r10', 't19', 't8'],
        ['r14', 't19', 't0'],
        ['r18', 't6', 't12'],
        ['r28', 't14', 't8'],
        ['r29', 't2', 't6'],
      ],
      [{ drop: 'r28' }]
    );

    expect(incremental).toEqual(fresh);
  });

  it('draws a group laid out again on its router lane as a sort from scratch', () => {
    // A group laid out again went back to the lane the router gave it, which
    // nothing marked, and a group it had pushed aside replayed that lane.
    const { incremental, fresh } = stepsAgainstFresh(
      [
        ['t0', 121, 305, 6],
        ['t2', 350.5, 197, 2],
        ['t3', 228, 429.5, 0],
        ['t4', 704, 301.5, 5],
        ['t6', 764, 655, 3],
        ['t7', 134, 309.5, 6],
        ['t8', 343, 142, 4],
        ['t11', 947, 371.5, 2],
        ['t12', 952.5, 408.5, 6],
        ['t13', 496.5, 14, 1],
        ['t14', 918, 397, 1],
        ['t15', 725.5, 99.5, 5],
      ],
      [
        ['r0', 't12', 't4'],
        ['r6', 't11', 't7'],
        ['r7', 't11', 't7'],
        ['r17', 't2', 't6'],
        ['r18', 't11', 't8'],
        ['r20', 't3', 't12'],
        ['r23', 't0', 't14'],
        ['r24', 't11', 't7'],
        ['r25', 't6', 't13'],
        ['r29', 't6', 't7'],
      ],
      [{ move: 't3', x: 176.5, y: 428.5 }, { drop: 'r0' }]
    );

    expect(incremental).toEqual(fresh);
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

  it('keeps one route cache per source, the document by default', () => {
    const state = createScene();

    expect(getSortCache(state)).toBe(getSortCache(state, 'document'));
    expect(getSortCache(state, 'flow')).not.toBe(getSortCache(state));
    expect(getSortCache(state, 'flow')).toBe(getSortCache(state, 'flow'));
  });

  /** AC-56. A view sorting between the steps of a drag reads and writes a cache of its own. */
  it('draws a moved table as a sort from scratch while a view sorts between the steps', () => {
    const incremental = createScene();
    const view = createSceneView(ViewKind.flow, ['A']);
    view.positions = {
      A: { x: 5_000, y: -3_000 },
      B: { x: 5_600, y: -3_000 },
      C: { x: 5_600, y: -2_600 },
      D: { x: 5_000, y: -2_600 },
      E: { x: 5_300, y: -2_800 },
    };
    incremental.editor.views.flow = view;
    relationshipSort(incremental);
    relationshipSort(incremental, 'flow');

    for (let step = 1; step <= 12; step++) {
      const table = incremental.collections.tableEntities.A;
      table.ui.x = step * 9;
      table.ui.y = step * 5;
      relationshipSort(incremental);
      view.positions.A = { x: 5_000 + step * 3, y: -3_000 - step * 2 };
      relationshipSort(incremental, 'flow');
    }

    const fresh = createScene({ x: 12 * 9, y: 12 * 5 });
    relationshipSort(fresh);

    expect(drawingOf(incremental)).toEqual(drawingOf(fresh));
    // The view followed its own moves: A's right edge, twelve steps of three on.
    const { width } = tableToObjectPoint(
      incremental,
      incremental.collections.tableEntities.A,
      'flow'
    );
    expect(
      getAnchors(incremental.collections.relationshipEntities.ab, 'flow').start
    ).toMatchObject({ tableId: 'A', x: 5_000 + 36 + width });
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
