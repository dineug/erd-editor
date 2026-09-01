/** ColumnOption bits — see v3/schema/tableColumn.entity.ts. */
export const ColumnOption = {
  autoIncrement: 1,
  primaryKey: 2,
  unique: 4,
  notNull: 8,
} as const;

/** ColumnUIKey bits — the key badge rendered on a column row. */
export const ColumnUIKey = {
  primaryKey: 1,
  foreignKey: 2,
} as const;

/** RelationshipType bits — the four drawable relationship kinds. */
export const RelationshipType = {
  ZeroOne: 2,
  ZeroN: 4,
  OneOnly: 8,
  OneN: 16,
} as const;

/** Show bits — which parts of a table row are rendered. */
export const Show = {
  tableComment: 1,
  columnComment: 2,
  columnDataType: 4,
  columnDefault: 8,
  columnAutoIncrement: 16,
  columnPrimaryKey: 32,
  columnUnique: 64,
  columnNotNull: 128,
  relationship: 256,
} as const;

/** The editor's own default for settings.show. */
export const DEFAULT_SHOW =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnPrimaryKey |
  Show.columnNotNull |
  Show.relationship;

/** settings.columnOrder default — name, dataType, notNull, default, comment… */
export const DEFAULT_COLUMN_ORDER = [1, 2, 4, 8, 16, 32, 64];

export const CANVAS_SIZE = 2000;
export const CANVAS_ZOOM_MIN = 0.1;
export const CANVAS_ZOOM_MAX = 1.5;

export type ColumnSeed = {
  id: string;
  name?: string;
  dataType?: string;
  comment?: string;
  default?: string;
  /** Bitmask of ColumnOption. */
  options?: number;
  /** Bitmask of ColumnUIKey. */
  keys?: number;
};

export type TableSeed = {
  id: string;
  name?: string;
  comment?: string;
  x?: number;
  y?: number;
  zIndex?: number;
  color?: string;
  columns?: ColumnSeed[];
};

export type SchemaSeed = {
  tables?: TableSeed[];
  zoomLevel?: number;
  scrollTop?: number;
  scrollLeft?: number;
  show?: number;
  databaseName?: string;
};

export type ErdDocument = {
  version: string;
  settings: {
    width: number;
    height: number;
    scrollTop: number;
    scrollLeft: number;
    zoomLevel: number;
    show: number;
    database: number;
    databaseName: string;
    canvasType: string;
    language: number;
    tableNameCase: number;
    columnNameCase: number;
    bracketType: number;
    relationshipDataTypeSync: boolean;
    relationshipOptimization: boolean;
    columnOrder: number[];
    maxWidthComment: number;
    ignoreSaveSettings: number;
  };
  doc: {
    tableIds: string[];
    relationshipIds: string[];
    indexIds: string[];
    memoIds: string[];
  };
  collections: {
    tableEntities: Record<string, TableEntity>;
    tableColumnEntities: Record<string, ColumnEntity>;
    relationshipEntities: Record<string, RelationshipEntity>;
    indexEntities: Record<string, unknown>;
    indexColumnEntities: Record<string, unknown>;
    memoEntities: Record<string, MemoEntity>;
  };
  lww?: Record<string, unknown>;
};

export type TableEntity = {
  id: string;
  name: string;
  comment: string;
  columnIds: string[];
  seqColumnIds: string[];
  ui: {
    x: number;
    y: number;
    zIndex: number;
    widthName: number;
    widthComment: number;
    color: string;
  };
  meta: { updateAt: number; createAt: number };
};

export type ColumnEntity = {
  id: string;
  tableId: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  options: number;
  ui: {
    keys: number;
    widthName: number;
    widthComment: number;
    widthDataType: number;
    widthDefault: number;
  };
  meta: { updateAt: number; createAt: number };
};

export type RelationshipEntity = {
  id: string;
  identification: boolean;
  relationshipType: number;
  startRelationshipType: number;
  start: {
    tableId: string;
    columnIds: string[];
    x: number;
    y: number;
    direction: number;
  };
  end: {
    tableId: string;
    columnIds: string[];
    x: number;
    y: number;
    direction: number;
  };
  meta: { updateAt: number; createAt: number };
};

export type MemoEntity = {
  id: string;
  value: string;
  ui: {
    x: number;
    y: number;
    zIndex: number;
    width: number;
    height: number;
    color: string;
  };
  meta: { updateAt: number; createAt: number };
};

/**
 * Timestamps are frozen so two runs of the same seed are byte-identical; the
 * editor only compares them relatively.
 */
const META = { updateAt: 0, createAt: 0 };

export function createSchema(seed: SchemaSeed = {}): ErdDocument {
  const tables = seed.tables ?? [];
  const tableEntities: Record<string, TableEntity> = {};
  const tableColumnEntities: Record<string, ColumnEntity> = {};

  tables.forEach((table, index) => {
    const columns = table.columns ?? [];

    tableEntities[table.id] = {
      id: table.id,
      name: table.name ?? '',
      comment: table.comment ?? '',
      columnIds: columns.map(column => column.id),
      seqColumnIds: columns.map(column => column.id),
      ui: {
        x: table.x ?? 200,
        y: table.y ?? 200,
        zIndex: table.zIndex ?? index + 2,
        widthName: 60,
        widthComment: 60,
        color: table.color ?? '',
      },
      meta: { ...META },
    };

    columns.forEach(column => {
      tableColumnEntities[column.id] = {
        id: column.id,
        tableId: table.id,
        name: column.name ?? '',
        comment: column.comment ?? '',
        dataType: column.dataType ?? '',
        default: column.default ?? '',
        options: column.options ?? 0,
        ui: {
          keys: column.keys ?? 0,
          widthName: 60,
          widthComment: 60,
          widthDataType: 60,
          widthDefault: 60,
        },
        meta: { ...META },
      };
    });
  });

  return {
    version: '3.0.0',
    settings: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      scrollTop: seed.scrollTop ?? 0,
      scrollLeft: seed.scrollLeft ?? 0,
      zoomLevel: seed.zoomLevel ?? 1,
      show: seed.show ?? DEFAULT_SHOW,
      database: 4,
      databaseName: seed.databaseName ?? 'e2e',
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
      tableIds: tables.map(table => table.id),
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    },
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities: {},
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {},
    },
  };
}

/**
 * Two well-separated tables, the default stage for interaction specs. Positioned
 * so both sit inside the viewport with the canvas unscrolled, and so the gap
 * between them is wide enough for a marquee drag to start on empty canvas.
 */
export const twoTables = () =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 160,
        y: 160,
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 760,
        y: 420,
        columns: [
          {
            id: 'posts_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
          { id: 'posts_title', name: 'title', dataType: 'varchar(255)' },
        ],
      },
    ],
  });

/** A single table, for specs that only need one focus target. */
export const oneTable = () =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 200,
        y: 200,
        columns: [
          { id: 'users_id', name: 'id', dataType: 'int' },
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
    ],
  });
