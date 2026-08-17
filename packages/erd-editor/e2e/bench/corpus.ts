import {
  ColumnOption,
  ColumnUIKey,
  DEFAULT_COLUMN_ORDER,
  DEFAULT_SHOW,
  type ErdDocument,
  RelationshipType,
  type ColumnEntity,
  type RelationshipEntity,
  type TableEntity,
} from '../support/schema';

/**
 * Deterministic corpora for the routing benchmark.
 *
 * These are generated rather than imported from `data/*.sql` on purpose: the
 * generator is the only way to hold table count, relationship count and column
 * count independently while keeping two runs byte-identical. `data/` is still
 * the manual eyeball check — see `e2e/bench/README.md`.
 */

/** Every corpus uses one canvas size so SVG area never confounds a comparison. */
export const BENCH_CANVAS = 4000;

const META = { updateAt: 0, createAt: 0 };

/** mulberry32 — small, fast, and identical across Node and the browser. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CorpusOptions = {
  name: string;
  /** Number of tables laid out on a jittered grid. */
  tables: number;
  /** Total relationships, including the spanning tree that connects the graph. */
  relationships: number;
  /** Non-key columns per table, before foreign keys are added. */
  columnsPerTable?: number;
  /** How many relationships to force onto a single hub table. */
  hubDegree?: number;
  /** Self relationships, which take their own code path in `relationshipSort`. */
  selfRelationships?: number;
  seed?: number;
};

export type Corpus = {
  name: string;
  tables: number;
  relationships: number;
  columns: number;
  document: ErdDocument;
  /** Ids worth dragging: the hub, a leaf, and the densest region's centre. */
  hubTableId: string;
  leafTableId: string;
};

const DATA_TYPES = [
  'int',
  'bigint',
  'varchar(255)',
  'text',
  'timestamp',
  'boolean',
  'decimal(10,2)',
];

export function createCorpus(options: CorpusOptions): Corpus {
  const {
    name,
    tables: tableCount,
    relationships: relationshipCount,
    columnsPerTable = 5,
    hubDegree = 6,
    selfRelationships = 1,
    seed = 20260817,
  } = options;

  const random = prng(seed);
  const tableEntities: Record<string, TableEntity> = {};
  const tableColumnEntities: Record<string, ColumnEntity> = {};
  const relationshipEntities: Record<string, RelationshipEntity> = {};

  const tableIds: string[] = [];
  const relationshipIds: string[] = [];

  // ── tables on a jittered grid ──────────────────────────────────────────────
  // Jitter keeps the layout off a perfect lattice, where every side-pair
  // distance would tie and the greedy side choice would be unrealistically
  // stable. It stays well under the cell size so tables never overlap.
  const columns = Math.ceil(Math.sqrt(tableCount));
  const CELL_X = 420;
  const CELL_Y = 340;
  const JITTER = 45;
  const ORIGIN = 80;

  for (let index = 0; index < tableCount; index++) {
    const id = `t${index}`;
    const col = index % columns;
    const row = Math.floor(index / columns);

    tableIds.push(id);
    tableEntities[id] = {
      id,
      name: `table_${index}`,
      comment: '',
      columnIds: [],
      seqColumnIds: [],
      ui: {
        x: Math.round(ORIGIN + col * CELL_X + (random() - 0.5) * 2 * JITTER),
        y: Math.round(ORIGIN + row * CELL_Y + (random() - 0.5) * 2 * JITTER),
        zIndex: index + 2,
        widthName: 60,
        widthComment: 60,
        color: '',
      },
      meta: { ...META },
    };

    const pkId = `${id}_id`;
    tableColumnEntities[pkId] = column(pkId, id, 'id', 'int', {
      options: ColumnOption.primaryKey | ColumnOption.notNull,
      keys: ColumnUIKey.primaryKey,
    });
    tableEntities[id].columnIds.push(pkId);

    for (let c = 0; c < columnsPerTable; c++) {
      const columnId = `${id}_c${c}`;
      tableColumnEntities[columnId] = column(
        columnId,
        id,
        `field_${c}`,
        DATA_TYPES[Math.floor(random() * DATA_TYPES.length)]
      );
      tableEntities[id].columnIds.push(columnId);
    }
  }

  // ── relationship graph ────────────────────────────────────────────────────
  // A spanning tree first so nothing is orphaned, then a forced hub, then
  // random extra edges. Duplicates are allowed only where they model a real
  // schema: two tables genuinely can carry more than one foreign key.
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();

  const addPair = (a: string, b: string, allowDuplicate = false) => {
    if (a === b) return false;
    const key = `${a}->${b}`;
    if (!allowDuplicate && seen.has(key)) return false;
    seen.add(key);
    pairs.push([a, b]);
    return true;
  };

  for (let index = 1; index < tableCount; index++) {
    // Link to a nearby earlier table so the graph stays spatially local, the
    // way a real schema clusters, instead of spraying edges across the canvas.
    const window = Math.min(index, columns + 1);
    const parent = index - 1 - Math.floor(random() * window);
    addPair(tableIds[Math.max(0, parent)], tableIds[index]);
  }

  const hubIndex = Math.floor(tableCount / 2);
  const hubTableId = tableIds[hubIndex];
  for (let n = 0; pairs.length < relationshipCount && n < hubDegree * 4; n++) {
    const other = tableIds[Math.floor(random() * tableCount)];
    addPair(hubTableId, other);
    if (countDegree(pairs, hubTableId) >= hubDegree) break;
  }

  let guard = relationshipCount * 20;
  while (pairs.length < relationshipCount - selfRelationships && guard-- > 0) {
    const a = tableIds[Math.floor(random() * tableCount)];
    const b = tableIds[Math.floor(random() * tableCount)];
    addPair(a, b);
  }

  for (const [start, end] of pairs) {
    relationshipIds.push(
      pushRelationship(
        relationshipEntities,
        tableEntities,
        tableColumnEntities,
        start,
        end,
        relationshipIds.length,
        random
      )
    );
  }

  for (let n = 0; n < selfRelationships; n++) {
    const target = tableIds[Math.min(tableCount - 1, 2 + n * 3)];
    relationshipIds.push(
      pushRelationship(
        relationshipEntities,
        tableEntities,
        tableColumnEntities,
        target,
        target,
        relationshipIds.length,
        random
      )
    );
  }

  for (const id of tableIds) {
    tableEntities[id].seqColumnIds = [...tableEntities[id].columnIds];
  }

  const leafTableId = tableIds[tableIds.length - 1];

  return {
    name,
    tables: tableCount,
    relationships: relationshipIds.length,
    columns: Object.keys(tableColumnEntities).length,
    hubTableId,
    leafTableId,
    document: {
      version: '3.0.0',
      settings: {
        width: BENCH_CANVAS,
        height: BENCH_CANVAS,
        scrollTop: 0,
        scrollLeft: 0,
        zoomLevel: 1,
        show: DEFAULT_SHOW,
        database: 4,
        databaseName: 'bench',
        canvasType: 'ERD',
        language: 1,
        tableNameCase: 4,
        columnNameCase: 2,
        bracketType: 1,
        relationshipDataTypeSync: true,
        relationshipOptimization: false,
        columnOrder: [...DEFAULT_COLUMN_ORDER],
        maxWidthComment: -1,
        ignoreSaveSettings: 0,
      },
      doc: {
        tableIds,
        relationshipIds,
        indexIds: [],
        memoIds: [],
      },
      collections: {
        tableEntities,
        tableColumnEntities,
        relationshipEntities,
        indexEntities: {},
        indexColumnEntities: {},
        memoEntities: {},
      },
    },
  };
}

function column(
  id: string,
  tableId: string,
  name: string,
  dataType: string,
  extra: { options?: number; keys?: number } = {}
): ColumnEntity {
  return {
    id,
    tableId,
    name,
    comment: '',
    dataType,
    default: '',
    options: extra.options ?? 0,
    ui: {
      keys: extra.keys ?? 0,
      widthName: 60,
      widthComment: 60,
      widthDataType: 60,
      widthDefault: 60,
    },
    meta: { ...META },
  };
}

function countDegree(pairs: Array<[string, string]>, id: string) {
  let degree = 0;
  for (const [a, b] of pairs) {
    if (a === id || b === id) degree++;
  }
  return degree;
}

/**
 * Adds the relationship plus the foreign key column it hangs off, so the
 * document is one the editor's own hooks would accept — `identification` and
 * `startRelationshipType` are both derived from the end column's options.
 */
function pushRelationship(
  relationshipEntities: Record<string, RelationshipEntity>,
  tableEntities: Record<string, TableEntity>,
  tableColumnEntities: Record<string, ColumnEntity>,
  startTableId: string,
  endTableId: string,
  index: number,
  random: () => number
): string {
  const id = `r${index}`;
  const fkId = `${endTableId}_fk${index}`;

  tableColumnEntities[fkId] = column(
    fkId,
    endTableId,
    `${startTableId}_id`,
    'int',
    {
      options: random() < 0.5 ? ColumnOption.notNull : 0,
      keys: ColumnUIKey.foreignKey,
    }
  );
  tableEntities[endTableId].columnIds.push(fkId);

  const types = [
    RelationshipType.ZeroN,
    RelationshipType.OneN,
    RelationshipType.ZeroOne,
    RelationshipType.OneOnly,
  ];

  relationshipEntities[id] = {
    id,
    identification: false,
    relationshipType: types[Math.floor(random() * types.length)],
    startRelationshipType: 2,
    // Geometry is seeded at the origin on purpose. `relationshipSort` runs on
    // `initialLoadJson`, so whatever is here is overwritten before first paint —
    // seeding real coordinates would hide a regression that stops it running.
    start: {
      tableId: startTableId,
      columnIds: [`${startTableId}_id`],
      x: 0,
      y: 0,
      direction: 8,
    },
    end: {
      tableId: endTableId,
      columnIds: [fkId],
      x: 0,
      y: 0,
      direction: 8,
    },
    meta: { ...META },
  };

  return id;
}

/**
 * The three scales the benchmark reports on, sized against `data/`:
 * sakila (16 tables), OKKY (39), Magento2-sales (54).
 */
export const CORPORA: CorpusOptions[] = [
  { name: 'small', tables: 16, relationships: 24, hubDegree: 4 },
  { name: 'medium', tables: 40, relationships: 62, hubDegree: 6 },
  { name: 'large', tables: 56, relationships: 120, hubDegree: 9 },
];
