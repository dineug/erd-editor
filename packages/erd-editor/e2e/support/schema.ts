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

/** OrderType values — the direction one index column is sorted in. */
export const OrderType = {
  ASC: 1,
  DESC: 2,
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

export type MemoSeed = {
  id: string;
  value?: string;
  x?: number;
  y?: number;
  zIndex?: number;
  width?: number;
  height?: number;
  color?: string;
};

export type RelationshipSeed = {
  id: string;
  /** A value of RelationshipType. */
  relationshipType?: number;
  identification?: boolean;
  startTableId: string;
  startColumnIds: string[];
  endTableId: string;
  endColumnIds: string[];
};

export type IndexColumnSeed = {
  id: string;
  columnId: string;
  /** A value of OrderType; ASC when the seed leaves it out. */
  orderType?: number;
};

/**
 * One index of one table. Its columns are nested because an index column has
 * no identity outside its index, and the seed writes them in the order the
 * generators read, which is indexColumnIds.
 */
export type IndexSeed = {
  id: string;
  tableId: string;
  name?: string;
  unique?: boolean;
  columns?: IndexColumnSeed[];
};

export type SchemaSeed = {
  tables?: TableSeed[];
  memos?: MemoSeed[];
  relationships?: RelationshipSeed[];
  indexes?: IndexSeed[];
  zoomLevel?: number;
  scrollTop?: number;
  scrollLeft?: number;
  originX?: number;
  originY?: number;
  width?: number;
  height?: number;
  show?: number;
  databaseName?: string;
};

/** The size a fresh memo is given, which is its own minimum plus a little. */
export const MEMO_SIZE = 127;

export type ErdDocument = {
  version: string;
  settings: {
    width: number;
    height: number;
    scrollTop: number;
    scrollLeft: number;
    originX?: number;
    originY?: number;
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
    indexEntities: Record<string, IndexEntity>;
    indexColumnEntities: Record<string, IndexColumnEntity>;
    memoEntities: Record<string, MemoEntity>;
  };
  lww?: Record<string, unknown>;
};

/**
 * Settings as a document read back from the editor carries them. A seed may
 * leave the origin out and be migrated on parse; what the store hands back has
 * always been through that parse, so both fields are there.
 */
export type LiveSettings = ErdDocument['settings'] &
  Required<Pick<ErdDocument['settings'], 'originX' | 'originY'>>;

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

export type IndexEntity = {
  id: string;
  name: string;
  tableId: string;
  indexColumnIds: string[];
  seqIndexColumnIds: string[];
  unique: boolean;
  meta: { updateAt: number; createAt: number };
};

export type IndexColumnEntity = {
  id: string;
  indexId: string;
  columnId: string;
  orderType: number;
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

/**
 * The live view, written only when the seed asks for one. A seed that names
 * neither origin is a legacy document on purpose: the parser migrates its
 * scrollLeft/scrollTop into the origin the shipped editor showed for them.
 */
function seededOrigin(seed: SchemaSeed) {
  return seed.originX === undefined && seed.originY === undefined
    ? {}
    : { originX: seed.originX ?? 0, originY: seed.originY ?? 0 };
}

export function createSchema(seed: SchemaSeed = {}): ErdDocument {
  const tables = seed.tables ?? [];
  const memos = seed.memos ?? [];
  const relationships = seed.relationships ?? [];
  const indexes = seed.indexes ?? [];
  const tableEntities: Record<string, TableEntity> = {};
  const tableColumnEntities: Record<string, ColumnEntity> = {};
  const memoEntities: Record<string, MemoEntity> = {};
  const relationshipEntities: Record<string, RelationshipEntity> = {};
  const indexEntities: Record<string, IndexEntity> = {};
  const indexColumnEntities: Record<string, IndexColumnEntity> = {};

  memos.forEach((memo, index) => {
    memoEntities[memo.id] = {
      id: memo.id,
      value: memo.value ?? '',
      ui: {
        x: memo.x ?? 200,
        y: memo.y ?? 200,
        zIndex: memo.zIndex ?? index + 2,
        width: memo.width ?? MEMO_SIZE,
        height: memo.height ?? MEMO_SIZE,
        color: memo.color ?? '',
      },
      meta: { ...META },
    };
  });

  relationships.forEach(relationship => {
    relationshipEntities[relationship.id] = {
      id: relationship.id,
      identification: relationship.identification ?? false,
      relationshipType: relationship.relationshipType ?? RelationshipType.ZeroN,
      startRelationshipType: 2,
      start: {
        tableId: relationship.startTableId,
        columnIds: [...relationship.startColumnIds],
        x: 0,
        y: 0,
        direction: 1,
      },
      end: {
        tableId: relationship.endTableId,
        columnIds: [...relationship.endColumnIds],
        x: 0,
        y: 0,
        direction: 1,
      },
      meta: { ...META },
    };
  });

  indexes.forEach(index => {
    const indexColumns = index.columns ?? [];

    indexEntities[index.id] = {
      id: index.id,
      name: index.name ?? '',
      tableId: index.tableId,
      indexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
      seqIndexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
      unique: index.unique ?? false,
      meta: { ...META },
    };

    indexColumns.forEach(indexColumn => {
      indexColumnEntities[indexColumn.id] = {
        id: indexColumn.id,
        indexId: index.id,
        columnId: indexColumn.columnId,
        orderType: indexColumn.orderType ?? OrderType.ASC,
        meta: { ...META },
      };
    });
  });

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
      width: seed.width ?? CANVAS_SIZE,
      height: seed.height ?? CANVAS_SIZE,
      scrollTop: seed.scrollTop ?? 0,
      scrollLeft: seed.scrollLeft ?? 0,
      ...seededOrigin(seed),
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
      relationshipIds: relationships.map(relationship => relationship.id),
      indexIds: indexes.map(index => index.id),
      memoIds: memos.map(memo => memo.id),
    },
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities,
      indexEntities,
      indexColumnEntities,
      memoEntities,
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

/**
 * Two tables joined by one relationship, each carrying an index of its own —
 * the graph a whole-table duplicate has to carry over. The end column holds the
 * foreign key bit a real document does; a copy gets its own from a hook.
 */
export const relatedTables = () =>
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
          { id: 'users_email', name: 'email', dataType: 'varchar(255)' },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 700,
        y: 420,
        columns: [
          {
            id: 'posts_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
          {
            id: 'posts_user_id',
            name: 'user_id',
            dataType: 'int',
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    relationships: [
      {
        id: 'users_posts',
        relationshipType: RelationshipType.OneN,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
      },
    ],
    indexes: [
      {
        id: 'users_email_index',
        tableId: 'users',
        name: 'users_email_index',
        unique: true,
        columns: [
          {
            id: 'users_email_index_email',
            columnId: 'users_email',
            orderType: OrderType.DESC,
          },
        ],
      },
      {
        id: 'posts_author_index',
        tableId: 'posts',
        name: 'posts_author_index',
        columns: [
          { id: 'posts_author_index_user_id', columnId: 'posts_user_id' },
          {
            id: 'posts_author_index_id',
            columnId: 'posts_id',
            orderType: OrderType.DESC,
          },
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
