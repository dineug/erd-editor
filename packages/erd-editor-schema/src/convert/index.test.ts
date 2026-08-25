import { describe, expect, it } from 'vite-plus/test';

import { v2ToV3, v3ToV2 } from '@/convert';
import { type ERDEditorSchemaV2, schemaV2Parser } from '@/v2';
import {
  type ERDEditorSchemaV3,
  SchemaV3Constants,
  schemaV3Parser,
} from '@/v3';

function createSchemaV2(): ERDEditorSchemaV2 {
  return schemaV2Parser({
    canvas: {
      width: 3000,
      height: 4000,
      scrollTop: -100,
      scrollLeft: -200,
      zoomLevel: 0.6,
      databaseName: 'round-trip',
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
              comment: 'fk',
              dataType: 'int',
              default: '',
              option: {
                autoIncrement: false,
                primaryKey: true,
                unique: false,
                notNull: true,
              },
              ui: { pk: false, fk: false, pfk: true },
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
            tableId: 'table1',
            columnIds: ['col2'],
            x: 3,
            y: 4,
            direction: 'top',
          },
        },
      ],
    },
  });
}

describe('convert barrel', () => {
  it('exposes both converters', () => {
    expect(typeof v2ToV3).toBe('function');
    expect(typeof v3ToV2).toBe('function');
  });

  describe('v2 -> v3 -> v2 round trip', () => {
    const source = createSchemaV2();
    const result = v3ToV2(v2ToV3(source));

    it('preserves the canvas settings that exist in both schemas', () => {
      expect(result.canvas.width).toBe(source.canvas.width);
      expect(result.canvas.height).toBe(source.canvas.height);
      expect(result.canvas.scrollTop).toBe(source.canvas.scrollTop);
      expect(result.canvas.scrollLeft).toBe(source.canvas.scrollLeft);
      expect(result.canvas.zoomLevel).toBe(source.canvas.zoomLevel);
      expect(result.canvas.databaseName).toBe(source.canvas.databaseName);
      expect(result.canvas.database).toBe(source.canvas.database);
      expect(result.canvas.language).toBe(source.canvas.language);
      expect(result.canvas.tableCase).toBe(source.canvas.tableCase);
      expect(result.canvas.columnCase).toBe(source.canvas.columnCase);
      expect(result.canvas.bracketType).toBe(source.canvas.bracketType);
      expect(result.canvas.show).toEqual(source.canvas.show);
      expect(result.canvas.setting).toEqual(source.canvas.setting);
    });

    it('preserves tables, columns and their ui flags', () => {
      expect(result.table.tables).toEqual(
        source.table.tables.map(({ visible, ...table }) => {
          expect(visible).toBe(true);
          return table;
        })
      );
    });

    it('preserves indexes and index column order types', () => {
      expect(result.table.indexes).toEqual(source.table.indexes);
    });

    it('preserves memos', () => {
      expect(result.memo.memos).toEqual(source.memo.memos);
    });

    it('loses the v2-only relationship fields but keeps the geometry', () => {
      expect(result.relationship.relationships).toHaveLength(1);
      expect(result.relationship.relationships[0]).toEqual({
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
          tableId: 'table1',
          columnIds: ['col2'],
          x: 3,
          y: 4,
          direction: 'top',
        },
      });
      expect(source.relationship.relationships[0].constraintName).toBe('');
      expect(source.relationship.relationships[0].visible).toBe(true);
    });

    it('drops the "C#" language because v3 stores it as csharp', () => {
      const schemaV2 = createSchemaV2();
      schemaV2.canvas.language = 'C#';

      expect(v3ToV2(v2ToV3(schemaV2)).canvas.language).toBe('GraphQL');
    });
  });

  describe('v3 -> v2 -> v3 round trip', () => {
    function createSchemaV3(): ERDEditorSchemaV3 {
      return v2ToV3(createSchemaV2());
    }

    it('preserves settings that exist in both schemas', () => {
      const source = createSchemaV3();
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.width).toBe(source.settings.width);
      expect(result.settings.height).toBe(source.settings.height);
      expect(result.settings.show).toBe(source.settings.show);
      expect(result.settings.database).toBe(source.settings.database);
      expect(result.settings.language).toBe(source.settings.language);
      expect(result.settings.columnOrder).toEqual(source.settings.columnOrder);
    });

    it('loses the Databricks database because v2 has no such vendor', () => {
      const source = createSchemaV3();
      source.settings.database = SchemaV3Constants.Database.Databricks;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.database).not.toBe(source.settings.database);
      expect(result.settings.database).toBe(SchemaV3Constants.Database.MySQL);
    });

    it('loses the Snowflake database because v2 has no such vendor', () => {
      const source = createSchemaV3();
      source.settings.database = SchemaV3Constants.Database.Snowflake;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.database).not.toBe(source.settings.database);
      expect(result.settings.database).toBe(SchemaV3Constants.Database.MySQL);
    });

    it('loses the Go language because v2 has no such language', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.Go;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('loses the SQLAlchemy language because v2 has no such name', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.SQLAlchemy;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('loses the TypeORM language because v2 has no such name', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.TypeORM;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('loses the Sequelize language because v2 has no such name', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.Sequelize;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('loses the Drizzle language because v2 has no such name', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.Drizzle;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('loses the DBML language because v2 has no such name', () => {
      const source = createSchemaV3();
      source.settings.language = SchemaV3Constants.Language.DBML;
      const result = v2ToV3(v3ToV2(source));

      expect(result.settings.language).not.toBe(source.settings.language);
      expect(result.settings.language).toBe(SchemaV3Constants.Language.GraphQL);
    });

    it('preserves the document ids of tables, memos and relationships', () => {
      const source = createSchemaV3();
      const result = v2ToV3(v3ToV2(source));

      expect(result.doc.tableIds).toEqual(source.doc.tableIds);
      expect(result.doc.memoIds).toEqual(source.doc.memoIds);
      expect(result.doc.relationshipIds).toEqual(source.doc.relationshipIds);
      expect(result.doc.indexIds).toEqual(source.doc.indexIds);
    });

    it('regenerates index column ids while keeping their content', () => {
      const source = createSchemaV3();
      const result = v2ToV3(v3ToV2(source));

      const sourceColumns =
        source.collections.indexEntities.index1.indexColumnIds.map(
          id => source.collections.indexColumnEntities[id]
        );
      const resultColumns =
        result.collections.indexEntities.index1.indexColumnIds.map(
          id => result.collections.indexColumnEntities[id]
        );

      expect(resultColumns.map(({ columnId }) => columnId)).toEqual(
        sourceColumns.map(({ columnId }) => columnId)
      );
      expect(resultColumns.map(({ orderType }) => orderType)).toEqual(
        sourceColumns.map(({ orderType }) => orderType)
      );
      expect(
        result.collections.indexEntities.index1.indexColumnIds
      ).not.toEqual(source.collections.indexEntities.index1.indexColumnIds);
    });

    it('keeps column options and ui keys intact', () => {
      const source = createSchemaV3();
      const result = v2ToV3(v3ToV2(source));

      for (const id of Object.keys(source.collections.tableColumnEntities)) {
        expect(result.collections.tableColumnEntities[id].options).toBe(
          source.collections.tableColumnEntities[id].options
        );
        expect(result.collections.tableColumnEntities[id].ui.keys).toBe(
          source.collections.tableColumnEntities[id].ui.keys
        );
      }
    });
  });

  it('round trips empty documents', () => {
    const emptyV2 = schemaV2Parser({});
    const emptyV3 = schemaV3Parser({});

    expect(v3ToV2(v2ToV3(emptyV2)).table.tables).toEqual([]);
    expect(v2ToV3(v3ToV2(emptyV3)).doc.tableIds).toEqual([]);
  });
});
