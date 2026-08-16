import { describe, expect, it } from 'vite-plus/test';

import { v3ToV2 } from '@/convert/v3ToV2';
import { SchemaV2Constants } from '@/v2';
import {
  type ERDEditorSchemaV3,
  SchemaV3Constants,
  schemaV3Parser,
} from '@/v3';

const {
  BracketType,
  ColumnOption,
  ColumnType,
  ColumnUIKey,
  Database,
  Direction,
  Language,
  NameCase,
  OrderType,
  RelationshipType,
  Show,
  StartRelationshipType,
} = SchemaV3Constants;

function createSchemaV3(): ERDEditorSchemaV3 {
  return schemaV3Parser({
    settings: {
      width: 3000,
      height: 4000,
      scrollTop: -100,
      scrollLeft: -200,
      zoomLevel: 0.4,
      databaseName: 'sample-db',
      canvasType: 'settings',
      show: Show.tableComment | Show.columnDataType | Show.relationship,
      database: Database.Oracle,
      language: Language.Kotlin,
      tableNameCase: NameCase.snakeCase,
      columnNameCase: NameCase.none,
      bracketType: BracketType.doubleQuote,
      relationshipDataTypeSync: false,
      relationshipOptimization: true,
      columnOrder: [
        ColumnType.columnComment,
        ColumnType.columnDefault,
        ColumnType.columnAutoIncrement,
        ColumnType.columnUnique,
        ColumnType.columnNotNull,
        ColumnType.columnDataType,
        ColumnType.columnName,
      ],
    },
    doc: {
      tableIds: ['t1', 't2', 'missing-table'],
      indexIds: ['i1', 'missing-index'],
      memoIds: ['m1', 'm2', 'missing-memo'],
      relationshipIds: ['r1', 'r2', 'missing-relationship'],
    },
    collections: {
      tableEntities: {
        t1: {
          id: 't1',
          name: 'users',
          comment: 'user table',
          columnIds: ['c1', 'c2', 'c3', 'c4', 'missing-column'],
          seqColumnIds: ['c1', 'c2', 'c3', 'c4'],
          ui: {
            x: 20,
            y: 10,
            zIndex: 5,
            widthName: 100,
            widthComment: 110,
            color: '#ff0000',
          },
        },
        t2: {
          id: 't2',
          name: 'teams',
          comment: '',
          columnIds: [],
          seqColumnIds: [],
          ui: { x: 400, y: 300, zIndex: 6 },
        },
        t3: {
          id: 't3',
          name: 'not-in-doc',
          comment: '',
          columnIds: [],
          seqColumnIds: [],
          ui: {},
        },
      },
      tableColumnEntities: {
        c1: {
          id: 'c1',
          tableId: 't1',
          name: 'id',
          comment: 'primary',
          dataType: 'int',
          default: '0',
          options:
            ColumnOption.autoIncrement |
            ColumnOption.primaryKey |
            ColumnOption.notNull,
          ui: {
            keys: ColumnUIKey.primaryKey,
            widthName: 70,
            widthComment: 80,
            widthDataType: 90,
            widthDefault: 100,
          },
        },
        c2: {
          id: 'c2',
          tableId: 't1',
          name: 'team_id',
          comment: '',
          dataType: 'int',
          default: '',
          options: ColumnOption.unique,
          ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
        },
        c3: {
          id: 'c3',
          tableId: 't1',
          name: 'group_id',
          comment: '',
          dataType: 'int',
          default: '',
          options: 0,
          ui: { keys: ColumnUIKey.foreignKey },
        },
        c4: {
          id: 'c4',
          tableId: 't1',
          name: 'nickname',
          comment: '',
          dataType: 'varchar',
          default: '',
          options: 0,
          ui: { keys: 0 },
        },
      },
      indexEntities: {
        i1: {
          id: 'i1',
          name: 'idx_users',
          tableId: 't1',
          unique: true,
          indexColumnIds: ['ic1', 'ic2', 'missing-index-column'],
          seqIndexColumnIds: ['ic1', 'ic2'],
        },
      },
      indexColumnEntities: {
        ic1: {
          id: 'ic1',
          indexId: 'i1',
          columnId: 'c1',
          orderType: OrderType.ASC,
        },
        ic2: {
          id: 'ic2',
          indexId: 'i1',
          columnId: 'c2',
          orderType: OrderType.DESC,
        },
      },
      memoEntities: {
        m1: {
          id: 'm1',
          value: 'hello',
          ui: {
            x: 22,
            y: 11,
            width: 300,
            height: 400,
            zIndex: 7,
            color: '#00ff00',
          },
        },
        m2: {
          id: 'm2',
          value: 'plain',
          ui: { x: 1, y: 2, width: 3, height: 4, zIndex: 8 },
        },
      },
      relationshipEntities: {
        r1: {
          id: 'r1',
          identification: true,
          relationshipType: RelationshipType.OneN,
          startRelationshipType: StartRelationshipType.ring,
          start: {
            tableId: 't1',
            columnIds: ['c1'],
            x: 1,
            y: 2,
            direction: Direction.left,
          },
          end: {
            tableId: 't2',
            columnIds: ['c2', 'c3'],
            x: 3,
            y: 4,
            direction: Direction.top,
          },
        },
        r2: {
          id: 'r2',
          identification: false,
          relationshipType: RelationshipType.ZeroOne,
          startRelationshipType: StartRelationshipType.dash,
          start: {
            tableId: 't2',
            columnIds: [],
            x: 5,
            y: 6,
            direction: Direction.right,
          },
          end: {
            tableId: 't1',
            columnIds: [],
            x: 7,
            y: 8,
            direction: Direction.bottom,
          },
        },
      },
    },
  });
}

describe('v3ToV2', () => {
  describe('canvas settings', () => {
    it('copies scalars and forces the ERD canvas type', () => {
      const { canvas } = v3ToV2(createSchemaV3());

      expect(canvas.width).toBe(3000);
      expect(canvas.height).toBe(4000);
      expect(canvas.scrollTop).toBe(-100);
      expect(canvas.scrollLeft).toBe(-200);
      expect(canvas.zoomLevel).toBe(0.4);
      expect(canvas.databaseName).toBe('sample-db');
      expect(canvas.canvasType).toBe(SchemaV2Constants.CanvasType.ERD);
      expect(canvas.setting.relationshipDataTypeSync).toBe(false);
      expect(canvas.setting.relationshipOptimization).toBe(true);
    });

    it('unpacks the show bit flag into booleans', () => {
      const { canvas } = v3ToV2(createSchemaV3());

      expect(canvas.show).toEqual({
        tableComment: true,
        columnComment: false,
        columnDataType: true,
        columnDefault: false,
        columnAutoIncrement: false,
        columnPrimaryKey: false,
        columnUnique: false,
        columnNotNull: false,
        relationship: true,
      });
    });

    it('unpacks every show bit when all are set', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.show = Object.values(Show).reduce(
        (acc, bit) => acc | bit,
        0
      );

      const { canvas } = v3ToV2(schemaV3);

      expect(Object.values(canvas.show).every(Boolean)).toBe(true);
    });

    it('maps bit enums back onto v2 string enums', () => {
      const { canvas } = v3ToV2(createSchemaV3());

      expect(canvas.database).toBe('Oracle');
      expect(canvas.language).toBe('Kotlin');
      expect(canvas.tableCase).toBe('snakeCase');
      expect(canvas.columnCase).toBe('none');
      expect(canvas.bracketType).toBe('doubleQuote');
    });

    it('keeps v2 defaults when no bit matches', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.database = 0;
      schemaV3.settings.language = 0;
      schemaV3.settings.tableNameCase = 0;
      schemaV3.settings.columnNameCase = 0;
      schemaV3.settings.bracketType = 0;

      const { canvas } = v3ToV2(schemaV3);

      expect(canvas.database).toBe('MySQL');
      expect(canvas.language).toBe('GraphQL');
      expect(canvas.tableCase).toBe('pascalCase');
      expect(canvas.columnCase).toBe('camelCase');
      expect(canvas.bracketType).toBe('none');
    });

    it('drops the csharp language because "csharp" is not a v2 language name', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.language = Language.csharp;

      expect(v3ToV2(schemaV3).canvas.language).toBe('GraphQL');
    });

    it('picks the lowest matching bit when several are set', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.database = Database.MSSQL | Database.SQLite;

      expect(v3ToV2(schemaV3).canvas.database).toBe('MSSQL');
    });

    it('translates a complete columnOrder', () => {
      const { canvas } = v3ToV2(createSchemaV3());

      expect(canvas.setting.columnOrder).toEqual([
        'columnComment',
        'columnDefault',
        'columnAutoIncrement',
        'columnUnique',
        'columnNotNull',
        'columnDataType',
        'columnName',
      ]);
    });

    it('keeps the default columnOrder when the v3 order is incomplete', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.columnOrder = [
        ColumnType.columnName,
        ColumnType.columnDataType,
      ];

      expect(v3ToV2(schemaV3).canvas.setting.columnOrder).toEqual([
        'columnName',
        'columnDataType',
        'columnNotNull',
        'columnUnique',
        'columnAutoIncrement',
        'columnDefault',
        'columnComment',
      ]);
    });

    it('keeps the default columnOrder when a bit has no v2 counterpart', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.settings.columnOrder = [
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        0b10000000,
      ];

      expect(v3ToV2(schemaV3).canvas.setting.columnOrder).toContain(
        'columnComment'
      );
      expect(v3ToV2(schemaV3).canvas.setting.columnOrder).toHaveLength(7);
    });
  });

  describe('tables', () => {
    it('only materialises ids listed in doc and skips missing entities', () => {
      const { table } = v3ToV2(createSchemaV3());

      expect(table.tables.map(({ id }) => id)).toEqual(['t1', 't2']);
    });

    it('maps table ui coordinates from y/x to top/left', () => {
      const [t1, t2] = v3ToV2(createSchemaV3()).table.tables;

      expect(t1.name).toBe('users');
      expect(t1.comment).toBe('user table');
      expect(t1.ui).toEqual({
        active: false,
        top: 10,
        left: 20,
        zIndex: 5,
        widthName: 100,
        widthComment: 110,
        color: '#ff0000',
      });
      expect(t2.ui.color).toBe('');
    });

    it('unpacks column options into booleans', () => {
      const [t1] = v3ToV2(createSchemaV3()).table.tables;
      const [c1, c2, , c4] = t1.columns;

      expect(c1.option).toEqual({
        autoIncrement: true,
        primaryKey: true,
        unique: false,
        notNull: true,
      });
      expect(c2.option).toEqual({
        autoIncrement: false,
        primaryKey: false,
        unique: true,
        notNull: false,
      });
      expect(c4.option).toEqual({
        autoIncrement: false,
        primaryKey: false,
        unique: false,
        notNull: false,
      });
    });

    it('derives mutually exclusive pk / fk / pfk flags from the ui keys', () => {
      const [t1] = v3ToV2(createSchemaV3()).table.tables;
      const [c1, c2, c3, c4] = t1.columns;

      expect(c1.ui).toMatchObject({ pk: true, fk: false, pfk: false });
      expect(c2.ui).toMatchObject({ pk: false, fk: false, pfk: true });
      expect(c3.ui).toMatchObject({ pk: false, fk: true, pfk: false });
      expect(c4.ui).toMatchObject({ pk: false, fk: false, pfk: false });
    });

    it('copies column scalars and widths', () => {
      const [c1] = v3ToV2(createSchemaV3()).table.tables[0].columns;

      expect(c1).toMatchObject({
        id: 'c1',
        name: 'id',
        comment: 'primary',
        dataType: 'int',
        default: '0',
      });
      expect(c1.ui).toMatchObject({
        active: false,
        widthName: 70,
        widthComment: 80,
        widthDataType: 90,
        widthDefault: 100,
      });
    });

    it('skips column ids that have no entity', () => {
      const [t1] = v3ToV2(createSchemaV3()).table.tables;

      expect(t1.columns.map(({ id }) => id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    });
  });

  describe('indexes', () => {
    it('maps index columns and their order type', () => {
      const { table } = v3ToV2(createSchemaV3());

      expect(table.indexes).toHaveLength(1);
      expect(table.indexes[0]).toEqual({
        id: 'i1',
        name: 'idx_users',
        tableId: 't1',
        unique: true,
        columns: [
          { id: 'c1', orderType: 'ASC' },
          { id: 'c2', orderType: 'DESC' },
        ],
      });
    });

    it('treats an order type without the ASC bit as DESC', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.collections.indexColumnEntities.ic1.orderType = 0;

      const { table } = v3ToV2(schemaV3);

      expect(table.indexes[0].columns[0].orderType).toBe('DESC');
    });
  });

  describe('memos', () => {
    it('maps memo ui coordinates from y/x to top/left', () => {
      const { memo } = v3ToV2(createSchemaV3());

      expect(memo.memos).toEqual([
        {
          id: 'm1',
          value: 'hello',
          ui: {
            active: false,
            top: 11,
            left: 22,
            width: 300,
            height: 400,
            zIndex: 7,
            color: '#00ff00',
          },
        },
        {
          id: 'm2',
          value: 'plain',
          ui: {
            active: false,
            top: 2,
            left: 1,
            width: 3,
            height: 4,
            zIndex: 8,
            color: '',
          },
        },
      ]);
    });
  });

  describe('relationships', () => {
    it('maps relationship type, start type and directions', () => {
      const [r1, r2] = v3ToV2(createSchemaV3()).relationship.relationships;

      expect(r1).toEqual({
        id: 'r1',
        identification: true,
        relationshipType: 'OneN',
        startRelationshipType: 'Ring',
        start: {
          tableId: 't1',
          columnIds: ['c1'],
          x: 1,
          y: 2,
          direction: 'left',
        },
        end: {
          tableId: 't2',
          columnIds: ['c2', 'c3'],
          x: 3,
          y: 4,
          direction: 'top',
        },
      });

      expect(r2.relationshipType).toBe('ZeroOne');
      expect(r2.startRelationshipType).toBe('Dash');
      expect(r2.start.direction).toBe('right');
      expect(r2.end.direction).toBe('bottom');
    });

    it('falls back to ZeroN and bottom for unmapped bit values', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.collections.relationshipEntities.r1.relationshipType = 0b1;
      schemaV3.collections.relationshipEntities.r1.start.direction = 0;
      schemaV3.collections.relationshipEntities.r1.end.direction = 0;

      const [r1] = v3ToV2(schemaV3).relationship.relationships;

      expect(r1.relationshipType).toBe('ZeroN');
      expect(r1.start.direction).toBe('bottom');
      expect(r1.end.direction).toBe('bottom');
    });

    it('maps ZeroN and OneOnly relationship types', () => {
      const schemaV3 = createSchemaV3();
      schemaV3.collections.relationshipEntities.r1.relationshipType =
        RelationshipType.ZeroN;
      schemaV3.collections.relationshipEntities.r2.relationshipType =
        RelationshipType.OneOnly;

      const [r1, r2] = v3ToV2(schemaV3).relationship.relationships;

      expect(r1.relationshipType).toBe('ZeroN');
      expect(r2.relationshipType).toBe('OneOnly');
    });
  });

  it('produces an empty v2 document from an empty v3 document', () => {
    const result = v3ToV2(schemaV3Parser({}));

    expect(result.table.tables).toEqual([]);
    expect(result.table.indexes).toEqual([]);
    expect(result.memo.memos).toEqual([]);
    expect(result.relationship.relationships).toEqual([]);
    expect(result.canvas.show).toEqual({
      tableComment: true,
      columnComment: true,
      columnDataType: true,
      columnDefault: true,
      columnAutoIncrement: false,
      columnPrimaryKey: true,
      columnUnique: false,
      columnNotNull: true,
      relationship: true,
    });
  });
});
