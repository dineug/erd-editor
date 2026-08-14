import { describe, expect, it } from 'vitest';

import { v2ToV3 } from '@/convert/v2ToV3';
import { type ERDEditorSchemaV2, schemaV2Parser } from '@/v2';
import { SchemaV3Constants } from '@/v3';

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

function createSchemaV2(): ERDEditorSchemaV2 {
  return schemaV2Parser({
    canvas: {
      width: 3000,
      height: 4000,
      scrollTop: -100,
      scrollLeft: -200,
      zoomLevel: 0.7,
      databaseName: 'sample-db',
      canvasType: 'ERD',
      database: 'PostgreSQL',
      language: 'Java',
      tableCase: 'snakeCase',
      columnCase: 'none',
      bracketType: 'backtick',
      show: {
        tableComment: true,
        columnComment: false,
        columnDataType: true,
        columnDefault: false,
        columnAutoIncrement: true,
        columnPrimaryKey: false,
        columnUnique: true,
        columnNotNull: false,
        relationship: true,
      },
      setting: {
        relationshipDataTypeSync: false,
        relationshipOptimization: true,
        columnOrder: [
          'columnComment',
          'columnDefault',
          'columnAutoIncrement',
          'columnUnique',
          'columnNotNull',
          'columnDataType',
          'columnName',
        ],
      },
    },
    table: {
      tables: [
        {
          id: 'table1',
          name: 'users',
          comment: 'user table',
          columns: [
            {
              id: 'col1',
              name: 'id',
              comment: 'primary',
              dataType: 'int',
              default: '0',
              option: {
                autoIncrement: true,
                primaryKey: true,
                unique: false,
                notNull: true,
              },
              ui: {
                pk: true,
                fk: false,
                pfk: false,
                widthName: 70,
                widthComment: 80,
                widthDataType: 90,
                widthDefault: 100,
              },
            },
            {
              id: 'col2',
              name: 'team_id',
              comment: '',
              dataType: 'int',
              default: '',
              option: {
                autoIncrement: false,
                primaryKey: true,
                unique: true,
                notNull: false,
              },
              ui: { pk: true, fk: true, pfk: true },
            },
            {
              id: 'col3',
              name: 'group_id',
              comment: '',
              dataType: 'int',
              default: '',
              option: {
                autoIncrement: false,
                primaryKey: false,
                unique: false,
                notNull: false,
              },
              ui: { pk: false, fk: true, pfk: false },
            },
            {
              id: 'col4',
              name: 'nickname',
              comment: '',
              dataType: 'varchar',
              default: '',
              option: {
                autoIncrement: false,
                primaryKey: false,
                unique: false,
                notNull: false,
              },
              ui: { pk: false, fk: false, pfk: false },
            },
          ],
          ui: {
            top: 10,
            left: 20,
            zIndex: 5,
            widthName: 100,
            widthComment: 110,
            color: '#ff0000',
          },
        },
        {
          id: 'table2',
          name: 'teams',
          comment: '',
          columns: [],
          ui: { top: 300, left: 400, zIndex: 6 },
        },
        {
          id: '',
          name: 'ignored',
          comment: '',
          columns: [],
          ui: {},
        },
      ],
      indexes: [
        {
          id: 'index1',
          name: 'idx_users',
          tableId: 'table1',
          unique: true,
          columns: [
            { id: 'col1', orderType: 'ASC' },
            { id: 'col2', orderType: 'DESC' },
          ],
        },
        {
          id: '',
          name: 'ignored',
          tableId: 'table1',
          unique: false,
          columns: [],
        },
      ],
    },
    memo: {
      memos: [
        {
          id: 'memo1',
          value: 'hello',
          ui: {
            top: 11,
            left: 22,
            width: 300,
            height: 400,
            zIndex: 7,
            color: '#00ff00',
          },
        },
        {
          id: 'memo2',
          value: 'no color',
          ui: { top: 1, left: 2, width: 3, height: 4, zIndex: 8 },
        },
        { id: '', value: 'ignored', ui: {} },
      ],
    },
    relationship: {
      relationships: [
        {
          id: 'rel1',
          identification: true,
          relationshipType: 'OneN',
          startRelationshipType: 'Ring',
          start: {
            tableId: 'table1',
            columnIds: ['col1'],
            x: 1,
            y: 2,
            direction: 'left',
          },
          end: {
            tableId: 'table2',
            columnIds: ['col2', 'col3'],
            x: 3,
            y: 4,
            direction: 'top',
          },
        },
        {
          id: 'rel2',
          identification: false,
          relationshipType: 'ZeroOne',
          startRelationshipType: 'Dash',
          start: {
            tableId: 'table2',
            columnIds: [],
            x: 5,
            y: 6,
            direction: 'right',
          },
          end: {
            tableId: 'table1',
            columnIds: [],
            x: 7,
            y: 8,
            direction: 'bottom',
          },
        },
        {
          id: '',
          identification: false,
          relationshipType: 'ZeroN',
          start: {},
          end: {},
        },
      ],
    },
  });
}

describe('v2ToV3', () => {
  it('produces a well-formed v3 envelope', () => {
    const result = v2ToV3(createSchemaV2());

    expect(result.version).toBe('3.0.0');
    expect(result.$schema).toBe(
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json'
    );
    expect(Object.keys(result.collections).sort()).toEqual([
      'indexColumnEntities',
      'indexEntities',
      'memoEntities',
      'relationshipEntities',
      'tableColumnEntities',
      'tableEntities',
    ]);
  });

  describe('settings', () => {
    it('copies scalar canvas values and forces the ERD canvas type', () => {
      const { settings } = v2ToV3(createSchemaV2());

      expect(settings.width).toBe(3000);
      expect(settings.height).toBe(4000);
      expect(settings.scrollTop).toBe(-100);
      expect(settings.scrollLeft).toBe(-200);
      expect(settings.zoomLevel).toBe(0.7);
      expect(settings.databaseName).toBe('sample-db');
      expect(settings.canvasType).toBe(SchemaV3Constants.CanvasType.ERD);
      expect(settings.relationshipDataTypeSync).toBe(false);
      expect(settings.relationshipOptimization).toBe(true);
    });

    it('packs the boolean show map into a bit flag', () => {
      const { settings } = v2ToV3(createSchemaV2());

      expect(settings.show).toBe(
        Show.tableComment |
          Show.columnDataType |
          Show.columnAutoIncrement |
          Show.columnUnique |
          Show.relationship
      );
    });

    it('ignores show keys that have no v3 bit', () => {
      const schemaV2 = createSchemaV2();
      (schemaV2.canvas.show as any).unknownFlag = true;

      const { settings } = v2ToV3(schemaV2);

      expect(settings.show).toBe(
        Show.tableComment |
          Show.columnDataType |
          Show.columnAutoIncrement |
          Show.columnUnique |
          Show.relationship
      );
    });

    it('maps every show flag off to 0', () => {
      const schemaV2 = createSchemaV2();
      for (const key of Object.keys(schemaV2.canvas.show)) {
        (schemaV2.canvas.show as any)[key] = false;
      }

      expect(v2ToV3(schemaV2).settings.show).toBe(0);
    });

    it('maps enum-ish string values onto v3 bit values', () => {
      const { settings } = v2ToV3(createSchemaV2());

      expect(settings.database).toBe(Database.PostgreSQL);
      expect(settings.language).toBe(Language.Java);
      expect(settings.tableNameCase).toBe(NameCase.snakeCase);
      expect(settings.columnNameCase).toBe(NameCase.none);
      expect(settings.bracketType).toBe(BracketType.backtick);
    });

    it('maps the "C#" language to the csharp bit', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.canvas.language = 'C#';

      expect(v2ToV3(schemaV2).settings.language).toBe(Language.csharp);
    });

    it('falls back to defaults for unknown enum strings', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.canvas.database = 'Unknown' as any;
      schemaV2.canvas.language = 'Rust' as any;
      schemaV2.canvas.tableCase = 'kebabCase' as any;
      schemaV2.canvas.columnCase = 'kebabCase' as any;
      schemaV2.canvas.bracketType = 'curly' as any;

      const { settings } = v2ToV3(schemaV2);

      expect(settings.database).toBe(Database.MySQL);
      expect(settings.language).toBe(Language.GraphQL);
      expect(settings.tableNameCase).toBe(NameCase.pascalCase);
      expect(settings.columnNameCase).toBe(NameCase.camelCase);
      expect(settings.bracketType).toBe(BracketType.none);
    });

    it('translates a complete columnOrder', () => {
      const { settings } = v2ToV3(createSchemaV2());

      expect(settings.columnOrder).toEqual([
        ColumnType.columnComment,
        ColumnType.columnDefault,
        ColumnType.columnAutoIncrement,
        ColumnType.columnUnique,
        ColumnType.columnNotNull,
        ColumnType.columnDataType,
        ColumnType.columnName,
      ]);
    });

    it('keeps the default columnOrder when the v2 order is incomplete', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.canvas.setting.columnOrder = ['columnName'] as any;

      expect(v2ToV3(schemaV2).settings.columnOrder).toEqual([
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        ColumnType.columnComment,
      ]);
    });
  });

  describe('tables', () => {
    it('drops entries without an id and keeps doc order', () => {
      const { doc, collections } = v2ToV3(createSchemaV2());

      expect(doc.tableIds).toEqual(['table1', 'table2']);
      expect(Object.keys(collections.tableEntities).sort()).toEqual([
        'table1',
        'table2',
      ]);
    });

    it('maps table ui coordinates from top/left to y/x', () => {
      const table = v2ToV3(createSchemaV2()).collections.tableEntities.table1;

      expect(table.name).toBe('users');
      expect(table.comment).toBe('user table');
      expect(table.columnIds).toEqual(['col1', 'col2', 'col3', 'col4']);
      expect(table.seqColumnIds).toEqual(['col1', 'col2', 'col3', 'col4']);
      expect(table.seqColumnIds).not.toBe(table.columnIds);
      expect(table.ui).toMatchObject({
        y: 10,
        x: 20,
        zIndex: 5,
        widthName: 100,
        widthComment: 110,
        color: '#ff0000',
      });
    });

    it('defaults a missing table color to an empty string', () => {
      const table = v2ToV3(createSchemaV2()).collections.tableEntities.table2;

      expect(table.ui.color).toBe('');
    });

    it('packs column options into a bit flag', () => {
      const { tableColumnEntities } = v2ToV3(createSchemaV2()).collections;

      expect(tableColumnEntities.col1.options).toBe(
        ColumnOption.autoIncrement |
          ColumnOption.primaryKey |
          ColumnOption.notNull
      );
      expect(tableColumnEntities.col2.options).toBe(
        ColumnOption.primaryKey | ColumnOption.unique
      );
      expect(tableColumnEntities.col4.options).toBe(0);
    });

    it('resolves pfk before pk and fk when mapping ui keys', () => {
      const { tableColumnEntities } = v2ToV3(createSchemaV2()).collections;

      expect(tableColumnEntities.col1.ui.keys).toBe(ColumnUIKey.primaryKey);
      expect(tableColumnEntities.col2.ui.keys).toBe(
        ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
      );
      expect(tableColumnEntities.col3.ui.keys).toBe(ColumnUIKey.foreignKey);
      expect(tableColumnEntities.col4.ui.keys).toBe(0);
    });

    it('copies column scalars and widths', () => {
      const column =
        v2ToV3(createSchemaV2()).collections.tableColumnEntities.col1;

      expect(column).toMatchObject({
        id: 'col1',
        tableId: 'table1',
        name: 'id',
        comment: 'primary',
        dataType: 'int',
        default: '0',
      });
      expect(column.ui).toMatchObject({
        widthName: 70,
        widthComment: 80,
        widthDataType: 90,
        widthDefault: 100,
      });
    });
  });

  describe('indexes', () => {
    it('drops indexes without an id', () => {
      const { doc } = v2ToV3(createSchemaV2());

      expect(doc.indexIds).toEqual(['index1']);
    });

    it('creates index column entities with generated ids', () => {
      const { collections } = v2ToV3(createSchemaV2());
      const index = collections.indexEntities.index1;

      expect(index).toMatchObject({
        id: 'index1',
        name: 'idx_users',
        tableId: 'table1',
        unique: true,
      });
      expect(index.indexColumnIds).toHaveLength(2);
      expect(index.seqIndexColumnIds).toEqual(index.indexColumnIds);

      const [first, second] = index.indexColumnIds.map(
        id => collections.indexColumnEntities[id]
      );

      expect(first).toMatchObject({
        indexId: 'index1',
        columnId: 'col1',
        orderType: OrderType.ASC,
      });
      expect(second).toMatchObject({
        indexId: 'index1',
        columnId: 'col2',
        orderType: OrderType.DESC,
      });
    });

    it('falls back to ASC for an unknown order type', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.table.indexes[0].columns[1].orderType = 'RANDOM' as any;

      const { collections } = v2ToV3(schemaV2);
      const index = collections.indexEntities.index1;
      const second = collections.indexColumnEntities[index.indexColumnIds[1]];

      expect(second.orderType).toBe(OrderType.ASC);
    });
  });

  describe('memos', () => {
    it('drops memos without an id and maps ui coordinates', () => {
      const { doc, collections } = v2ToV3(createSchemaV2());

      expect(doc.memoIds).toEqual(['memo1', 'memo2']);
      expect(collections.memoEntities.memo1).toMatchObject({
        id: 'memo1',
        value: 'hello',
      });
      expect(collections.memoEntities.memo1.ui).toMatchObject({
        y: 11,
        x: 22,
        width: 300,
        height: 400,
        zIndex: 7,
        color: '#00ff00',
      });
    });

    it('defaults a missing memo color to an empty string', () => {
      const { collections } = v2ToV3(createSchemaV2());

      expect(collections.memoEntities.memo2.ui.color).toBe('');
    });
  });

  describe('relationships', () => {
    it('drops relationships without an id', () => {
      const { doc } = v2ToV3(createSchemaV2());

      expect(doc.relationshipIds).toEqual(['rel1', 'rel2']);
    });

    it('maps relationship type, start type and directions', () => {
      const { collections } = v2ToV3(createSchemaV2());
      const rel1 = collections.relationshipEntities.rel1;
      const rel2 = collections.relationshipEntities.rel2;

      expect(rel1.identification).toBe(true);
      expect(rel1.relationshipType).toBe(RelationshipType.OneN);
      expect(rel1.startRelationshipType).toBe(StartRelationshipType.ring);
      expect(rel1.start).toMatchObject({
        tableId: 'table1',
        columnIds: ['col1'],
        x: 1,
        y: 2,
        direction: Direction.left,
      });
      expect(rel1.end).toMatchObject({
        tableId: 'table2',
        columnIds: ['col2', 'col3'],
        x: 3,
        y: 4,
        direction: Direction.top,
      });

      expect(rel2.identification).toBe(false);
      expect(rel2.relationshipType).toBe(RelationshipType.ZeroOne);
      expect(rel2.startRelationshipType).toBe(StartRelationshipType.dash);
      expect(rel2.start.direction).toBe(Direction.right);
      expect(rel2.end.direction).toBe(Direction.bottom);
    });

    it('treats any non-Ring start relationship type as dash', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.relationship.relationships[0].startRelationshipType =
        undefined as any;

      const { collections } = v2ToV3(schemaV2);

      expect(collections.relationshipEntities.rel1.startRelationshipType).toBe(
        StartRelationshipType.dash
      );
    });

    it('falls back to ZeroN and bottom for unmapped legacy values', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.relationship.relationships[0].relationshipType = 'One' as any;
      schemaV2.relationship.relationships[0].start.direction =
        'diagonal' as any;
      schemaV2.relationship.relationships[0].end.direction = 'diagonal' as any;

      const rel1 = v2ToV3(schemaV2).collections.relationshipEntities.rel1;

      expect(rel1.relationshipType).toBe(RelationshipType.ZeroN);
      expect(rel1.start.direction).toBe(Direction.bottom);
      expect(rel1.end.direction).toBe(Direction.bottom);
    });
  });

  it('produces an empty v3 document from an empty v2 document', () => {
    const result = v2ToV3(schemaV2Parser({}));

    expect(result.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect(result.collections.tableEntities).toEqual({});
    expect(result.collections.tableColumnEntities).toEqual({});
    expect(result.collections.indexEntities).toEqual({});
    expect(result.collections.indexColumnEntities).toEqual({});
    expect(result.collections.memoEntities).toEqual({});
    expect(result.collections.relationshipEntities).toEqual({});
    expect(result.settings.show).toBe(
      Show.tableComment |
        Show.columnComment |
        Show.columnDataType |
        Show.columnDefault |
        Show.columnPrimaryKey |
        Show.columnNotNull |
        Show.relationship
    );
  });
});
