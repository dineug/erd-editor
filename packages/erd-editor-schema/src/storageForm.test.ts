import { describe, expect, it } from 'vite-plus/test';

import { parser, toJson } from '@/parser';
import { toDocument, toDocumentJson } from '@/storageForm';
import { createSchema, SchemaV3Constants } from '@/v3';
import { createDomain } from '@/v3/parser/domain.entity';
import { createTable } from '@/v3/parser/table.entity';

const V3_SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';

const {
  BracketType,
  CanvasType,
  Language,
  LockSettingType,
  NameCase,
  NameViewMode,
} = SchemaV3Constants;

const meta = { updateAt: 1_760_000_000_000, createAt: 1_750_000_000_000 };

const tableUI = (x: number, y: number) => ({
  x,
  y,
  zIndex: 7,
  widthName: 88,
  widthComment: 120,
  color: '',
});

const columnUI = (keys: number) => ({
  keys,
  widthName: 70,
  widthComment: 60,
  widthDataType: 65,
  widthDefault: 60,
});

const point = (tableId: string, columnIds: string[]) => ({
  tableId,
  columnIds,
  x: 412.5,
  y: 96,
  direction: 2,
});

/**
 * A file as an earlier release saved it: a removed table, column, relationship,
 * index, memo and group left as tombstones, a stub a peer action created, every
 * entity stamped with meta, and every field an editor derives or keeps locally.
 */
const LEGACY = {
  $schema: V3_SCHEMA_URL,
  version: '3.0.0',
  settings: {
    width: 4000,
    height: 3000,
    scrollTop: -120,
    scrollLeft: -340,
    originX: -40,
    originY: 90,
    zoomLevel: 0.8,
    show: 431,
    database: 16,
    databaseName: 'shop',
    canvasType: CanvasType.ERD,
    language: Language.TypeScript,
    tableNameCase: NameCase.pascalCase,
    columnNameCase: NameCase.camelCase,
    bracketType: BracketType.none,
    relationshipDataTypeSync: true,
    relationshipOptimization: false,
    columnOrder: [1, 2, 4, 8, 16, 32, 64],
    maxWidthComment: -1,
    ignoreSaveSettings: 3,
    lockSettings: 0,
  },
  doc: {
    tableIds: ['tb', 'ta', 'ta', 'ghost'],
    relationshipIds: ['r1', 'r2', 'r3'],
    indexIds: ['ib', 'ia'],
    memoIds: ['m1'],
    tableGroupIds: ['g1'],
  },
  collections: {
    tableEntities: {
      ta: {
        id: 'ta',
        name: 'member',
        comment: '',
        columnIds: ['cd', 'cb', 'unknown'],
        seqColumnIds: ['cb', 'cd', 'cz'],
        groupId: 'g1',
        ui: tableUI(10.125, 20),
        meta,
      },
      tb: {
        id: 'tb',
        name: 'order',
        comment: 'placed orders',
        columnIds: ['ca', 'cc'],
        seqColumnIds: ['ca', 'cc', 'cy'],
        groupId: 'g2',
        ui: tableUI(400, -60.5),
        meta,
      },
      tc: {
        id: 'tc',
        name: 'removed',
        comment: '',
        columnIds: ['ce'],
        seqColumnIds: ['ce'],
        groupId: 'g1',
        ui: tableUI(0, 0),
        meta,
      },
    },
    tableColumnEntities: {
      cb: {
        id: 'cb',
        tableId: 'ta',
        name: 'id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 11,
        ui: columnUI(1),
        meta,
      },
      cd: {
        id: 'cd',
        tableId: 'ta',
        name: 'name',
        comment: 'display name',
        dataType: 'VARCHAR(64)',
        default: "''",
        options: 8,
        ui: columnUI(0),
        meta,
      },
      cz: {
        id: 'cz',
        tableId: 'ta',
        name: 'removed_column',
        comment: '',
        dataType: 'TEXT',
        default: '',
        options: 0,
        ui: columnUI(0),
        meta,
      },
      ca: {
        id: 'ca',
        tableId: 'tb',
        name: 'id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 10,
        ui: columnUI(1),
        meta,
      },
      cc: {
        id: 'cc',
        tableId: 'tb',
        name: 'member_id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 8,
        ui: columnUI(2),
        meta,
      },
      cy: {
        id: 'cy',
        tableId: 'tb',
        name: 'removed_column',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 0,
        ui: columnUI(0),
        meta,
      },
      ce: {
        id: 'ce',
        tableId: 'tc',
        name: 'id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 0,
        ui: columnUI(0),
        meta,
      },
      stub: { id: 'stub', ui: columnUI(0), meta },
    },
    relationshipEntities: {
      r1: {
        id: 'r1',
        identification: false,
        relationshipType: 16,
        startRelationshipType: 2,
        onDelete: 4,
        onUpdate: 1,
        start: point('ta', ['cb']),
        end: point('tb', ['cc', 'cy']),
        meta,
      },
      r2: {
        id: 'r2',
        identification: true,
        relationshipType: 8,
        startRelationshipType: 1,
        onDelete: 1,
        onUpdate: 1,
        start: point('ta', ['cb']),
        end: point('tc', ['ce']),
        meta,
      },
      r3: {
        id: 'r3',
        identification: false,
        relationshipType: 4,
        startRelationshipType: 2,
        onDelete: 1,
        onUpdate: 1,
        start: point('ghost', []),
        end: point('ta', []),
        meta,
      },
      r4: {
        id: 'r4',
        identification: false,
        relationshipType: 4,
        startRelationshipType: 2,
        onDelete: 1,
        onUpdate: 1,
        start: point('ta', []),
        end: point('tb', []),
        meta,
      },
    },
    indexEntities: {
      ib: {
        id: 'ib',
        name: 'ix_order_member',
        tableId: 'tb',
        indexColumnIds: ['iy', 'ix', 'iz', 'missing'],
        seqIndexColumnIds: ['ix', 'iy', 'iz'],
        unique: false,
        meta,
      },
      ia: {
        id: 'ia',
        name: 'ix_removed',
        tableId: 'tc',
        indexColumnIds: ['iw'],
        seqIndexColumnIds: ['iw'],
        unique: true,
        meta,
      },
      ic: {
        id: 'ic',
        name: 'ix_unlisted',
        tableId: 'ta',
        indexColumnIds: [],
        seqIndexColumnIds: [],
        unique: false,
        meta,
      },
    },
    indexColumnEntities: {
      ix: { id: 'ix', indexId: 'ib', columnId: 'cc', orderType: 2, meta },
      iy: { id: 'iy', indexId: 'ib', columnId: 'ca', orderType: 1, meta },
      iz: { id: 'iz', indexId: 'ib', columnId: 'cy', orderType: 1, meta },
      iw: { id: 'iw', indexId: 'ia', columnId: 'ce', orderType: 1, meta },
    },
    memoEntities: {
      m1: {
        id: 'm1',
        value: 'billing notes',
        ui: { x: -80, y: 300, zIndex: 9, width: 116, height: 100, color: '' },
        meta,
      },
      m2: {
        id: 'm2',
        value: 'removed',
        ui: { x: 0, y: 0, zIndex: 3, width: 116, height: 100, color: '' },
        meta,
      },
    },
    tableGroupEntities: {
      g1: {
        id: 'g1',
        name: 'members',
        color: '#0090ff',
        ui: { x: -20, y: -40, width: 640, height: 360, zIndex: 4 },
        meta,
      },
      g2: {
        id: 'g2',
        name: 'removed',
        color: '',
        ui: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
        meta,
      },
    },
  },
};

/** What the storage form of LEGACY is, its keys in the order written. */
const EXPECTED = {
  $schema: V3_SCHEMA_URL,
  version: '3.0.0',
  settings: {
    originX: -40,
    originY: 90,
    zoomLevel: 0.8,
    show: 431,
    database: 16,
    databaseName: 'shop',
    canvasType: CanvasType.ERD,
    language: Language.TypeScript,
    tableNameCase: NameCase.pascalCase,
    columnNameCase: NameCase.camelCase,
    bracketType: BracketType.none,
    relationshipDataTypeSync: true,
    columnOrder: [1, 2, 4, 8, 16, 32, 64],
    maxWidthComment: -1,
    lockSettings: 0,
  },
  doc: {
    tableIds: ['tb', 'ta'],
    relationshipIds: ['r1'],
    indexIds: ['ib'],
    memoIds: ['m1'],
    tableGroupIds: ['g1'],
  },
  collections: {
    tableEntities: {
      ta: {
        id: 'ta',
        name: 'member',
        comment: '',
        columnIds: ['cd', 'cb'],
        groupId: 'g1',
        ui: { x: 10.125, y: 20, color: '' },
      },
      tb: {
        id: 'tb',
        name: 'order',
        comment: 'placed orders',
        columnIds: ['ca', 'cc'],
        ui: { x: 400, y: -60.5, color: '' },
      },
    },
    tableColumnEntities: {
      cb: {
        id: 'cb',
        tableId: 'ta',
        name: 'id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 11,
      },
      cd: {
        id: 'cd',
        tableId: 'ta',
        name: 'name',
        comment: 'display name',
        dataType: 'VARCHAR(64)',
        default: "''",
        options: 8,
      },
      ca: {
        id: 'ca',
        tableId: 'tb',
        name: 'id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 10,
      },
      cc: {
        id: 'cc',
        tableId: 'tb',
        name: 'member_id',
        comment: '',
        dataType: 'INT',
        default: '',
        options: 8,
      },
    },
    relationshipEntities: {
      r1: {
        id: 'r1',
        relationshipType: 16,
        onDelete: 4,
        onUpdate: 1,
        start: { tableId: 'ta', columnIds: ['cb'] },
        end: { tableId: 'tb', columnIds: ['cc', 'cy'] },
      },
    },
    indexEntities: {
      ib: {
        id: 'ib',
        name: 'ix_order_member',
        tableId: 'tb',
        indexColumnIds: ['iy', 'ix'],
        unique: false,
      },
    },
    indexColumnEntities: {
      ix: { id: 'ix', indexId: 'ib', columnId: 'cc', orderType: 2 },
      iy: { id: 'iy', indexId: 'ib', columnId: 'ca', orderType: 1 },
    },
    memoEntities: {
      m1: {
        id: 'm1',
        value: 'billing notes',
        ui: { x: -80, y: 300, width: 116, height: 100, color: '' },
      },
    },
    tableGroupEntities: {
      g1: {
        id: 'g1',
        name: 'members',
        color: '#0090ff',
        ui: { x: -20, y: -40, width: 640, height: 360 },
      },
    },
  },
};

const legacy = () => parser(JSON.stringify(LEGACY));

describe('toDocumentJson', () => {
  it('writes a legacy file as its storage form, byte for byte', () => {
    expect(toDocumentJson(legacy())).toBe(
      `${JSON.stringify(EXPECTED, null, 2)}\n`
    );
  });

  it('writes none of the fields an editor derives or keeps for one instance', () => {
    const json = toDocumentJson(legacy());

    for (const field of [
      'meta',
      'seqColumnIds',
      'seqIndexColumnIds',
      'zIndex',
      'widthName',
      'widthComment',
      'widthDataType',
      'widthDefault',
      'keys',
      'identification',
      'startRelationshipType',
      'direction',
      'ignoreSaveSettings',
      'relationshipOptimization',
      'scrollTop',
      'scrollLeft',
      'lockedValues',
    ]) {
      expect(json).not.toContain(`"${field}"`);
    }
    expect(JSON.parse(json).settings).not.toHaveProperty('width');
    expect(JSON.parse(json).settings).not.toHaveProperty('height');
  });

  it('pretty prints with two spaces and ends with one newline', () => {
    const json = toDocumentJson(createSchema());

    expect(json).toContain('\n  "version": "3.0.0"');
    expect(json.endsWith('}\n')).toBe(true);
    expect(json.endsWith('\n\n')).toBe(false);
  });

  it('writes the same bytes for its own output parsed back', () => {
    for (const schema of [createSchema(), legacy()]) {
      const json = toDocumentJson(schema);

      expect(toDocumentJson(parser(json))).toBe(json);
    }
  });

  it('parses back with each sequence it leaves out at the list beside it', () => {
    const reopened = parser(toDocumentJson(legacy()));

    expect(reopened.collections.tableEntities.ta.seqColumnIds).toEqual([
      'cd',
      'cb',
    ]);
    expect(reopened.collections.indexEntities.ib.seqIndexColumnIds).toEqual([
      'iy',
      'ix',
    ]);
  });

  it('never mutates the document it is handed', () => {
    const schema = legacy();
    const before = structuredClone(schema);

    toDocumentJson(schema);

    expect(schema).toEqual(before);
  });

  it('writes a document no parser built, its own output say, as it stands', () => {
    const raw = JSON.parse(toDocumentJson(legacy()));
    const ungrouped = JSON.parse(toDocumentJson(createSchema()));
    delete raw.$schema;

    expect(toDocumentJson(raw)).toBe(toDocumentJson(legacy()));
    expect(toDocumentJson(ungrouped)).toBe(toDocumentJson(createSchema()));
  });

  it('writes only the storage fields of raw JSON handed to it as it is', () => {
    const json = JSON.parse(toDocumentJson(LEGACY as any));

    expect(json).toEqual(EXPECTED);
  });
});

describe('the live entities toDocument keeps', () => {
  it('keeps each listed table with an entity once, in the order listed', () => {
    const { doc, collections } = toDocument(legacy());

    expect(doc.tableIds).toEqual(['tb', 'ta']);
    expect(Object.keys(collections.tableEntities)).toEqual(['ta', 'tb']);
  });

  it('keeps the columns a kept table lists, dropping its removed ones', () => {
    const { collections } = toDocument(legacy());

    expect(collections.tableEntities.ta.columnIds).toEqual(['cd', 'cb']);
    expect(Object.keys(collections.tableColumnEntities)).toEqual([
      'cb',
      'cd',
      'ca',
      'cc',
    ]);
  });

  it('drops a relationship whose start or end table is not kept', () => {
    const { doc, collections } = toDocument(legacy());

    expect(doc.relationshipIds).toEqual(['r1']);
    expect(Object.keys(collections.relationshipEntities)).toEqual(['r1']);
  });

  it('writes the column ids of a relationship as it holds them', () => {
    const { collections } = toDocument(legacy());

    expect(collections.relationshipEntities.r1.end.columnIds).toEqual([
      'cc',
      'cy',
    ]);
  });

  it('drops an index whose table is not kept', () => {
    const { doc, collections } = toDocument(legacy());

    expect(doc.indexIds).toEqual(['ib']);
    expect(Object.keys(collections.indexEntities)).toEqual(['ib']);
  });

  it('drops an index column whose column its table no longer lists', () => {
    const { collections } = toDocument(legacy());

    expect(collections.indexEntities.ib.indexColumnIds).toEqual(['iy', 'ix']);
    expect(Object.keys(collections.indexColumnEntities)).toEqual(['ix', 'iy']);
  });

  it('keeps an index whose columns are all gone as an index with none', () => {
    const schema = legacy();
    schema.collections.tableEntities.tb.columnIds = ['cc'];

    const { collections } = toDocument(schema);

    expect(collections.indexEntities.ib.indexColumnIds).toEqual(['ix']);

    schema.collections.tableEntities.tb.columnIds = [];

    expect(toDocument(schema).collections.indexEntities.ib).toEqual({
      id: 'ib',
      name: 'ix_order_member',
      tableId: 'tb',
      indexColumnIds: [],
      unique: false,
    });
    expect(toDocument(schema).collections.indexColumnEntities).toEqual({});
  });

  it('keeps the listed memos and table groups alone', () => {
    const { doc, collections } = toDocument(legacy());

    expect(doc.memoIds).toEqual(['m1']);
    expect(Object.keys(collections.memoEntities)).toEqual(['m1']);
    expect(doc.tableGroupIds).toEqual(['g1']);
    expect(Object.keys(collections.tableGroupEntities ?? {})).toEqual(['g1']);
  });

  it('writes a groupId only while it names a kept group', () => {
    const { collections } = toDocument(legacy());

    expect(collections.tableEntities.ta.groupId).toBe('g1');
    expect(collections.tableEntities.tb).not.toHaveProperty('groupId');
  });

  it('writes no group key once the last group is removed', () => {
    const schema = legacy();
    schema.doc.tableGroupIds = [];

    const json = JSON.parse(toDocumentJson(schema));

    expect(Object.keys(json.doc)).toEqual([
      'tableIds',
      'relationshipIds',
      'indexIds',
      'memoIds',
    ]);
    expect(json.collections).not.toHaveProperty('tableGroupEntities');
    expect(json.collections.tableEntities.ta).not.toHaveProperty('groupId');
  });

  it('writes an empty document with every collection and no group key', () => {
    expect(toDocument(createSchema())).toMatchObject({
      doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
      collections: {
        tableEntities: {},
        tableColumnEntities: {},
        relationshipEntities: {},
        indexEntities: {},
        indexColumnEntities: {},
        memoEntities: {},
      },
    });
    expect(toDocument(createSchema()).doc).not.toHaveProperty('tableGroupIds');
  });
});

describe('the order toDocumentJson writes', () => {
  it('writes the top level, the doc and the collections in a fixed order', () => {
    const json = JSON.parse(toDocumentJson(legacy()));

    expect(Object.keys(json)).toEqual([
      '$schema',
      'version',
      'settings',
      'doc',
      'collections',
    ]);
    expect(Object.keys(json.doc)).toEqual([
      'tableIds',
      'relationshipIds',
      'indexIds',
      'memoIds',
      'tableGroupIds',
    ]);
    expect(Object.keys(json.collections)).toEqual([
      'tableEntities',
      'tableColumnEntities',
      'relationshipEntities',
      'indexEntities',
      'indexColumnEntities',
      'memoEntities',
      'tableGroupEntities',
    ]);
  });

  it('writes the fields of every entity in schema order', () => {
    const { collections } = JSON.parse(toDocumentJson(legacy()));

    expect(Object.keys(collections.tableEntities.ta)).toEqual([
      'id',
      'name',
      'comment',
      'columnIds',
      'groupId',
      'ui',
    ]);
    expect(Object.keys(collections.tableEntities.ta.ui)).toEqual([
      'x',
      'y',
      'color',
    ]);
    expect(Object.keys(collections.tableColumnEntities.cb)).toEqual([
      'id',
      'tableId',
      'name',
      'comment',
      'dataType',
      'default',
      'options',
    ]);
    expect(Object.keys(collections.relationshipEntities.r1)).toEqual([
      'id',
      'relationshipType',
      'onDelete',
      'onUpdate',
      'start',
      'end',
    ]);
    expect(Object.keys(collections.relationshipEntities.r1.start)).toEqual([
      'tableId',
      'columnIds',
    ]);
    expect(Object.keys(collections.indexEntities.ib)).toEqual([
      'id',
      'name',
      'tableId',
      'indexColumnIds',
      'unique',
    ]);
    expect(Object.keys(collections.indexColumnEntities.ix)).toEqual([
      'id',
      'indexId',
      'columnId',
      'orderType',
    ]);
    expect(Object.keys(collections.memoEntities.m1.ui)).toEqual([
      'x',
      'y',
      'width',
      'height',
      'color',
    ]);
    expect(Object.keys(collections.tableGroupEntities.g1)).toEqual([
      'id',
      'name',
      'color',
      'ui',
    ]);
    expect(Object.keys(collections.tableGroupEntities.g1.ui)).toEqual([
      'x',
      'y',
      'width',
      'height',
    ]);
  });

  it('writes the newer table and column fields in schema order beside a kept group', () => {
    const schema = legacy();
    Object.assign(schema.collections.tableEntities.ta, {
      logicalName: 'Member',
      nameDerived: true,
    });
    Object.assign(schema.collections.tableColumnEntities.cb, {
      logicalName: 'Member Number',
      domainId: 'd1',
    });
    schema.collections.domainEntities = {
      d1: { ...createDomain(), id: 'd1', name: 'Number' },
    };
    schema.doc.domainIds = ['d1'];

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(Object.keys(collections.tableEntities.ta)).toEqual([
      'id',
      'name',
      'logicalName',
      'comment',
      'columnIds',
      'groupId',
      'nameDerived',
      'ui',
    ]);
    expect(Object.keys(collections.tableColumnEntities.cb)).toEqual([
      'id',
      'tableId',
      'name',
      'comment',
      'dataType',
      'default',
      'options',
      'logicalName',
      'domainId',
    ]);
  });

  it('sorts columns by table first and index columns by index first', () => {
    const schema = legacy();
    schema.collections.indexColumnEntities.ix.indexId = 'ic';

    const { collections } = toDocument(schema);

    expect(Object.keys(collections.tableColumnEntities)).toEqual([
      'cb',
      'cd',
      'ca',
      'cc',
    ]);
    expect(Object.keys(collections.indexColumnEntities)).toEqual(['iy', 'ix']);
  });

  it('writes the same bytes whatever order the entities arrived in', () => {
    const schema = legacy();
    const reversed = legacy();
    for (const key of Object.keys(reversed.collections) as Array<
      keyof typeof reversed.collections
    >) {
      const entries = Object.entries(reversed.collections[key]).reverse();
      Object.assign(reversed.collections, {
        [key]: Object.fromEntries(entries),
      });
    }

    expect(toDocumentJson(reversed)).toBe(toDocumentJson(schema));
  });

  it('lists ids that read as array indexes first, in numeric order, as any object does', () => {
    const schema = createSchema();
    schema.doc.tableIds = ['b', '10', 'a', '9'];
    for (const id of schema.doc.tableIds) {
      schema.collections.tableEntities[id] = { ...createTable(), id };
    }

    const json = toDocumentJson(schema);

    expect(Object.keys(JSON.parse(json).collections.tableEntities)).toEqual([
      '9',
      '10',
      'a',
      'b',
    ]);
    expect(JSON.parse(json).doc.tableIds).toEqual(['b', '10', 'a', '9']);
    expect(toDocumentJson(parser(json))).toBe(json);
  });

  it('writes numbers as the document holds them', () => {
    const schema = legacy();
    schema.collections.tableEntities.ta.ui.x = 10.123456789;
    schema.collections.memoEntities.m1.ui.y = -0.1 + 0.3;

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(collections.tableEntities.ta.ui.x).toBe(10.123456789);
    expect(collections.memoEntities.m1.ui.y).toBe(-0.1 + 0.3);
  });
});

describe('the settings toDocumentJson writes', () => {
  const LIVE = {
    originX: 12,
    originY: -34,
    zoomLevel: 0.5,
    canvasType: CanvasType.schemaSQL,
    language: Language.Kotlin,
    tableNameCase: NameCase.snakeCase,
    columnNameCase: NameCase.snakeCase,
    bracketType: BracketType.backtick,
  };

  it('writes the settings toJson writes, through the same normalization', () => {
    for (const lockSettings of [0, 1, 63]) {
      const schema = parser(
        JSON.stringify({ version: '3.0.0', settings: { lockSettings } })
      );
      Object.assign(schema.settings, LIVE);
      schema.settings.ddlScripts = { before: 'CREATE SCHEMA app;', after: '' };

      expect(toDocument(schema).settings).toEqual(
        JSON.parse(toJson(schema)).settings
      );
    }
  });

  it('writes each locked setting at its lock and no locked values', () => {
    const schema = createSchema();
    Object.assign(schema.settings, LIVE);

    const { settings } = JSON.parse(toDocumentJson(schema));

    expect(settings).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      canvasType: CanvasType.ERD,
      language: Language.GraphQL,
    });
    expect(settings).not.toHaveProperty('lockedValues');
  });

  it('writes the settings in the order a new document creates them', () => {
    const schema = createSchema();
    schema.settings.ddlScripts = { before: '', after: 'SELECT 1;' };
    const order = [
      'originX',
      'originY',
      'zoomLevel',
      'show',
      'database',
      'databaseName',
      'canvasType',
      'language',
      'tableNameCase',
      'columnNameCase',
      'bracketType',
      'relationshipDataTypeSync',
      'columnOrder',
      'maxWidthComment',
      'lockSettings',
    ];

    expect(
      Object.keys(JSON.parse(toDocumentJson(createSchema())).settings)
    ).toEqual(order);
    expect(Object.keys(JSON.parse(toDocumentJson(schema)).settings)).toEqual([
      ...order,
      'ddlScripts',
    ]);
  });

  it('writes the scripts only while one of them holds text', () => {
    const schema = createSchema();
    schema.settings.ddlScripts = { before: '', after: '' };

    expect(JSON.parse(toDocumentJson(schema)).settings).not.toHaveProperty(
      'ddlScripts'
    );

    schema.settings.ddlScripts = { before: '', after: 'SELECT 1;' };

    expect(JSON.parse(toDocumentJson(schema)).settings.ddlScripts).toEqual({
      before: '',
      after: 'SELECT 1;',
    });
  });

  it('writes the name view mode last, only while its lock is off and it is not physical', () => {
    const schema = createSchema();
    schema.settings.ddlScripts = { before: 'SELECT 1;', after: '' };
    schema.settings.nameViewMode = NameViewMode.logical;
    const keys = () => Object.keys(JSON.parse(toDocumentJson(schema)).settings);

    expect(keys()).not.toContain('nameViewMode');

    schema.settings.lockSettings |= LockSettingType.unlockNameViewMode;
    const unlocked = toDocumentJson(schema);

    expect(keys().slice(-3)).toEqual([
      'lockSettings',
      'ddlScripts',
      'nameViewMode',
    ]);
    expect(JSON.parse(unlocked).settings.nameViewMode).toBe(
      NameViewMode.logical
    );
    expect(toDocumentJson(parser(unlocked))).toBe(unlocked);
    expect(toDocument(schema).settings).toEqual(
      JSON.parse(toJson(schema)).settings
    );

    schema.settings.nameViewMode = NameViewMode.physical;

    expect(keys()).not.toContain('nameViewMode');
  });

  it('writes a locked name view mode at its lock, the physical names left out', () => {
    const schema = parser(
      JSON.stringify({
        version: '3.0.0',
        settings: { lockSettings: 63, nameViewMode: NameViewMode.both },
      })
    );
    schema.settings.nameViewMode = NameViewMode.physical;

    expect(JSON.parse(toDocumentJson(schema)).settings.nameViewMode).toBe(
      NameViewMode.both
    );

    schema.settings.lockedValues.nameViewMode = NameViewMode.physical;
    schema.settings.nameViewMode = NameViewMode.logical;

    expect(JSON.parse(toDocumentJson(schema)).settings).not.toHaveProperty(
      'nameViewMode'
    );
  });
});

const WORD_FIELDS = [
  'id',
  'name',
  'abbreviation',
  'englishName',
  'description',
  'synonyms',
  'forbiddenWords',
];
const TERM_FIELDS = [
  'id',
  'name',
  'physicalName',
  'domainId',
  'description',
  'synonyms',
];
const DOMAIN_FIELDS = ['id', 'name', 'category', 'dataType', 'description'];

/**
 * A document with a logical name on a table and a column, a domain link, and a
 * dictionary of each kind, each holding a removed entry; the column notes and
 * the second term link a removed domain.
 */
const DICTIONARY = {
  version: '3.0.0',
  doc: {
    tableIds: ['t1'],
    wordIds: ['w2', 'w1'],
    termIds: ['tm1', 'tm2'],
    domainIds: ['d1'],
  },
  collections: {
    tableEntities: {
      t1: {
        id: 't1',
        name: 'member',
        logicalName: '회원',
        columnIds: ['c1', 'c2'],
        nameDerived: true,
      },
    },
    tableColumnEntities: {
      c1: {
        id: 'c1',
        tableId: 't1',
        name: 'MBR_NO',
        dataType: 'NUMERIC(10)',
        options: 18,
        logicalName: '회원 번호',
        domainId: 'd1',
      },
      c2: {
        id: 'c2',
        tableId: 't1',
        name: 'note',
        dataType: 'TEXT',
        domainId: 'd9',
      },
    },
    wordEntities: {
      fields: WORD_FIELDS,
      rows: [
        ['w1', '회원', 'MBR', 'member'],
        ['w2', '번호', 'NO', '', '', 'NUM'],
        ['w3', 'removed', 'RMV'],
      ],
    },
    termEntities: {
      fields: TERM_FIELDS,
      rows: [
        ['tm1', '회원 번호', 'MBR_NO', 'd1'],
        ['tm2', '가입 일시', '', 'd9', 'joined at'],
        ['tm3', 'removed'],
      ],
    },
    domainEntities: {
      fields: DOMAIN_FIELDS,
      rows: [
        ['d1', '번호N10', '번호', 'NUMERIC(10)'],
        ['d9', 'removed', '', 'TEXT'],
      ],
    },
  },
};

const lines = (...rows: string[]) => `${rows.join('\n')}\n`;

/** The storage form of DICTIONARY, written out as the file holds it. */
const DICTIONARY_JSON = lines(
  '{',
  `  "$schema": "${V3_SCHEMA_URL}",`,
  '  "version": "3.0.0",',
  '  "settings": {',
  '    "originX": 0,',
  '    "originY": 0,',
  '    "zoomLevel": 1,',
  '    "show": 431,',
  '    "database": 4,',
  '    "databaseName": "",',
  '    "canvasType": "ERD",',
  '    "language": 1,',
  '    "tableNameCase": 4,',
  '    "columnNameCase": 2,',
  '    "bracketType": 1,',
  '    "relationshipDataTypeSync": true,',
  '    "columnOrder": [',
  '      1,',
  '      2,',
  '      4,',
  '      8,',
  '      16,',
  '      32,',
  '      64',
  '    ],',
  '    "maxWidthComment": -1,',
  '    "lockSettings": 63',
  '  },',
  '  "doc": {',
  '    "tableIds": [',
  '      "t1"',
  '    ],',
  '    "relationshipIds": [],',
  '    "indexIds": [],',
  '    "memoIds": []',
  '  },',
  '  "collections": {',
  '    "tableEntities": {',
  '      "t1": {',
  '        "id": "t1",',
  '        "name": "member",',
  '        "logicalName": "회원",',
  '        "comment": "",',
  '        "columnIds": [',
  '          "c1",',
  '          "c2"',
  '        ],',
  '        "nameDerived": true,',
  '        "ui": {',
  '          "x": 200,',
  '          "y": 100,',
  '          "color": ""',
  '        }',
  '      }',
  '    },',
  '    "tableColumnEntities": {',
  '      "c1": {',
  '        "id": "c1",',
  '        "tableId": "t1",',
  '        "name": "MBR_NO",',
  '        "comment": "",',
  '        "dataType": "NUMERIC(10)",',
  '        "default": "",',
  '        "options": 18,',
  '        "logicalName": "회원 번호",',
  '        "domainId": "d1"',
  '      },',
  '      "c2": {',
  '        "id": "c2",',
  '        "tableId": "t1",',
  '        "name": "note",',
  '        "comment": "",',
  '        "dataType": "TEXT",',
  '        "default": "",',
  '        "options": 0',
  '      }',
  '    },',
  '    "relationshipEntities": {},',
  '    "indexEntities": {},',
  '    "indexColumnEntities": {},',
  '    "memoEntities": {},',
  '    "wordEntities": {',
  '      "fields": [',
  '        "id",',
  '        "name",',
  '        "abbreviation",',
  '        "englishName",',
  '        "description",',
  '        "synonyms",',
  '        "forbiddenWords"',
  '      ],',
  '      "rows": [',
  '        ["w2","번호","NO","","","NUM"],',
  '        ["w1","회원","MBR","member"]',
  '      ]',
  '    },',
  '    "termEntities": {',
  '      "fields": [',
  '        "id",',
  '        "name",',
  '        "physicalName",',
  '        "domainId",',
  '        "description",',
  '        "synonyms"',
  '      ],',
  '      "rows": [',
  '        ["tm1","회원 번호","MBR_NO","d1"],',
  '        ["tm2","가입 일시","","","joined at"]',
  '      ]',
  '    },',
  '    "domainEntities": {',
  '      "fields": [',
  '        "id",',
  '        "name",',
  '        "category",',
  '        "dataType",',
  '        "description"',
  '      ],',
  '      "rows": [',
  '        ["d1","번호N10","번호","NUMERIC(10)"]',
  '      ]',
  '    }',
  '  }',
  '}'
);

const dictionary = () => parser(JSON.stringify(DICTIONARY));

describe('the dictionaries and new fields toDocumentJson writes', () => {
  it('writes the dictionaries as a header and one row a line, byte for byte', () => {
    expect(toDocumentJson(dictionary())).toBe(DICTIONARY_JSON);
  });

  it('writes the same bytes for its own output parsed back', () => {
    expect(toDocumentJson(parser(DICTIONARY_JSON))).toBe(DICTIONARY_JSON);
  });

  it('reads the rows back in their order with every value they held', () => {
    const { doc, collections } = parser(DICTIONARY_JSON);

    expect(doc.wordIds).toEqual(['w2', 'w1']);
    expect(doc.termIds).toEqual(['tm1', 'tm2']);
    expect(doc.domainIds).toEqual(['d1']);
    expect(collections.wordEntities).toEqual({
      w1: {
        id: 'w1',
        name: '회원',
        abbreviation: 'MBR',
        englishName: 'member',
        description: '',
        synonyms: '',
        forbiddenWords: '',
      },
      w2: {
        id: 'w2',
        name: '번호',
        abbreviation: 'NO',
        englishName: '',
        description: '',
        synonyms: 'NUM',
        forbiddenWords: '',
      },
    });
    expect(collections.termEntities.tm2).toEqual({
      id: 'tm2',
      name: '가입 일시',
      physicalName: '',
      domainId: '',
      description: 'joined at',
      synonyms: '',
    });
    expect(collections.domainEntities.d1.dataType).toBe('NUMERIC(10)');
  });

  it('writes no dictionary order in the doc', () => {
    const { doc } = JSON.parse(toDocumentJson(dictionary()));

    expect(Object.keys(doc)).toEqual([
      'tableIds',
      'relationshipIds',
      'indexIds',
      'memoIds',
    ]);
  });

  it('writes the dictionaries after every other collection, words, terms, then domains', () => {
    const { collections } = JSON.parse(toDocumentJson(dictionary()));

    expect(Object.keys(collections)).toEqual([
      'tableEntities',
      'tableColumnEntities',
      'relationshipEntities',
      'indexEntities',
      'indexColumnEntities',
      'memoEntities',
      'wordEntities',
      'termEntities',
      'domainEntities',
    ]);
  });

  it('writes a dictionary only while it holds a live entry', () => {
    const schema = dictionary();
    schema.doc.wordIds = [];
    schema.doc.domainIds = ['gone'];

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(collections).not.toHaveProperty('wordEntities');
    expect(collections).not.toHaveProperty('domainEntities');
    expect(collections.termEntities.rows).toHaveLength(2);
  });

  it('leaves a link to a removed domain out and keeps the data type it gave', () => {
    const schema = dictionary();

    expect(schema.collections.tableColumnEntities.c2.domainId).toBe('d9');

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(collections.tableColumnEntities.c2).not.toHaveProperty('domainId');
    expect(collections.tableColumnEntities.c2.dataType).toBe('TEXT');
    expect(collections.termEntities.rows[1]).toEqual([
      'tm2',
      '가입 일시',
      '',
      '',
      'joined at',
    ]);
  });

  it('writes no logical name, domain or derived flag while they hold none', () => {
    const schema = dictionary();
    Object.assign(schema.collections.tableEntities.t1, {
      logicalName: '',
      nameDerived: false,
    });
    Object.assign(schema.collections.tableColumnEntities.c1, {
      logicalName: '',
      domainId: '',
    });

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(Object.keys(collections.tableEntities.t1)).toEqual([
      'id',
      'name',
      'comment',
      'columnIds',
      'ui',
    ]);
    expect(Object.keys(collections.tableColumnEntities.c1)).toEqual([
      'id',
      'tableId',
      'name',
      'comment',
      'dataType',
      'default',
      'options',
    ]);
  });

  it('keeps the derived name bit in the options a column saves', () => {
    const schema = dictionary();
    schema.collections.tableColumnEntities.c1.options = 16;

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(collections.tableColumnEntities.c1.options).toBe(16);
    expect(
      parser(toDocumentJson(schema)).collections.tableColumnEntities.c1.options
    ).toBe(16);
  });

  it('writes a value holding the text of a placeholder as any other string', () => {
    const schema = dictionary();
    schema.collections.wordEntities.w1.description = '"rows": []';
    schema.collections.tableEntities.t1.comment = '\n      "rows": []';

    const json = toDocumentJson(schema);
    const reopened = parser(json);

    expect(reopened.collections.wordEntities.w1.description).toBe('"rows": []');
    expect(reopened.collections.tableEntities.t1.comment).toBe(
      '\n      "rows": []'
    );
    expect(toDocumentJson(reopened)).toBe(json);
  });

  it('writes any text a dictionary holds as it is and reads it back', () => {
    const schema = dictionary();
    const text = 'Größe 会員 😀 "quoted", comma \\ slash\ttab\nline';
    schema.collections.wordEntities.w1.name = text;
    schema.collections.domainEntities.d1.description = text;

    const json = toDocumentJson(schema);
    const reopened = parser(json);

    expect(json).toContain('Größe 会員 😀');
    expect(reopened.collections.wordEntities.w1.name).toBe(text);
    expect(reopened.collections.domainEntities.d1.description).toBe(text);
    expect(
      json.split('\n').filter(line => line.includes('Größe'))
    ).toHaveLength(2);
  });

  it('keeps an empty value in the middle of a row', () => {
    const schema = dictionary();
    schema.collections.domainEntities.d1.category = '';
    schema.collections.domainEntities.d1.description = 'a number';

    const { collections } = JSON.parse(toDocumentJson(schema));

    expect(collections.domainEntities.rows).toEqual([
      ['d1', '번호N10', '', 'NUMERIC(10)', 'a number'],
    ]);
  });
});

describe('the column order toDocumentJson writes', () => {
  const { ColumnType } = SchemaV3Constants;
  const orderOf = (columnOrder: number[]) => {
    const schema = createSchema();
    schema.settings.columnOrder = columnOrder;
    return JSON.parse(toDocumentJson(schema)).settings.columnOrder;
  };

  it('writes seven entries while the logical name and the domain stand where a parse puts them', () => {
    expect(orderOf(createSchema().settings.columnOrder)).toEqual([
      1, 2, 4, 8, 16, 32, 64,
    ]);
    expect(
      orderOf([
        ColumnType.columnComment,
        ColumnType.columnDataType,
        ColumnType.columnDomain,
        ColumnType.columnLogicalName,
        ColumnType.columnName,
        ColumnType.columnDefault,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
      ])
    ).toEqual([64, 2, 1, 32, 4, 8, 16]);
  });

  it.each([
    ['the logical name after the name', [1, 128, 2, 256, 4, 8, 16, 32, 64]],
    ['the domain before the data type', [128, 1, 256, 2, 4, 8, 16, 32, 64]],
    ['the domain last', [128, 1, 2, 4, 8, 16, 32, 64, 256]],
  ])('writes all nine with %s', (_, columnOrder) => {
    expect(orderOf(columnOrder)).toEqual(columnOrder);
    expect(
      parser(JSON.stringify({ version: '3.0.0', settings: { columnOrder } }))
        .settings.columnOrder
    ).toEqual(columnOrder);
  });

  it('leaves out the order of raw JSON that holds none', () => {
    const raw = JSON.parse(toDocumentJson(createSchema()));
    delete raw.settings.columnOrder;

    expect(JSON.parse(toDocumentJson(raw)).settings).not.toHaveProperty(
      'columnOrder'
    );
  });

  it('writes the default order of raw JSON in seven entries and a moved one as it stands', () => {
    const rawOrder = (columnOrder: number[]) => {
      const raw = JSON.parse(toDocumentJson(createSchema()));
      raw.settings.columnOrder = columnOrder;
      return JSON.parse(toDocumentJson(raw)).settings.columnOrder;
    };

    expect(rawOrder([128, 1, 2, 256, 4, 8, 16, 32, 64])).toEqual([
      1, 2, 4, 8, 16, 32, 64,
    ]);
    expect(rawOrder([1, 128, 2, 256, 4, 8, 16, 32, 64])).toEqual([
      1, 128, 2, 256, 4, 8, 16, 32, 64,
    ]);
  });
});
