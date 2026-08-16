import { describe, expect, it } from 'vite-plus/test';

import { ERDEditorSchemaV3, SchemaV3Constants } from '@/v3/schema';
import { OrderType, OrderTypeList } from '@/v3/schema/indexColumn.entity';
import {
  Direction,
  DirectionList,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v3/schema/relationship.entity';
import {
  BracketType,
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
  CanvasTypeList,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  SaveSettingType,
  Show,
} from '@/v3/schema/settings';
import { ColumnOption, ColumnUIKey } from '@/v3/schema/tableColumn.entity';

describe('v3/schema/index', () => {
  describe('SchemaV3Constants', () => {
    it('re-exports exactly the documented constant keys', () => {
      expect(Object.keys(SchemaV3Constants).sort()).toEqual(
        [
          'BracketType',
          'BracketTypeList',
          'CANVAS_SIZE_MAX',
          'CANVAS_SIZE_MIN',
          'CANVAS_ZOOM_MAX',
          'CANVAS_ZOOM_MIN',
          'CanvasType',
          'CanvasTypeList',
          'ColumnOption',
          'ColumnType',
          'ColumnTypeList',
          'ColumnUIKey',
          'Database',
          'DatabaseList',
          'Direction',
          'DirectionList',
          'Language',
          'LanguageList',
          'NameCase',
          'NameCaseList',
          'OrderType',
          'OrderTypeList',
          'RelationshipType',
          'RelationshipTypeList',
          'SaveSettingType',
          'Show',
          'StartRelationshipType',
          'StartRelationshipTypeList',
        ].sort()
      );
    });

    it('keeps referential identity with the source constants', () => {
      expect(SchemaV3Constants.CanvasType).toBe(CanvasType);
      expect(SchemaV3Constants.CanvasTypeList).toBe(CanvasTypeList);
      expect(SchemaV3Constants.Show).toBe(Show);
      expect(SchemaV3Constants.ColumnType).toBe(ColumnType);
      expect(SchemaV3Constants.ColumnTypeList).toBe(ColumnTypeList);
      expect(SchemaV3Constants.Database).toBe(Database);
      expect(SchemaV3Constants.DatabaseList).toBe(DatabaseList);
      expect(SchemaV3Constants.Language).toBe(Language);
      expect(SchemaV3Constants.LanguageList).toBe(LanguageList);
      expect(SchemaV3Constants.NameCase).toBe(NameCase);
      expect(SchemaV3Constants.NameCaseList).toBe(NameCaseList);
      expect(SchemaV3Constants.BracketType).toBe(BracketType);
      expect(SchemaV3Constants.BracketTypeList).toBe(BracketTypeList);
      expect(SchemaV3Constants.RelationshipType).toBe(RelationshipType);
      expect(SchemaV3Constants.RelationshipTypeList).toBe(RelationshipTypeList);
      expect(SchemaV3Constants.StartRelationshipType).toBe(
        StartRelationshipType
      );
      expect(SchemaV3Constants.StartRelationshipTypeList).toBe(
        StartRelationshipTypeList
      );
      expect(SchemaV3Constants.Direction).toBe(Direction);
      expect(SchemaV3Constants.DirectionList).toBe(DirectionList);
      expect(SchemaV3Constants.ColumnOption).toBe(ColumnOption);
      expect(SchemaV3Constants.ColumnUIKey).toBe(ColumnUIKey);
      expect(SchemaV3Constants.OrderType).toBe(OrderType);
      expect(SchemaV3Constants.OrderTypeList).toBe(OrderTypeList);
      expect(SchemaV3Constants.SaveSettingType).toBe(SaveSettingType);
    });

    it('carries the canvas boundary scalars by value', () => {
      expect(SchemaV3Constants.CANVAS_SIZE_MAX).toBe(CANVAS_SIZE_MAX);
      expect(SchemaV3Constants.CANVAS_SIZE_MIN).toBe(CANVAS_SIZE_MIN);
      expect(SchemaV3Constants.CANVAS_ZOOM_MAX).toBe(CANVAS_ZOOM_MAX);
      expect(SchemaV3Constants.CANVAS_ZOOM_MIN).toBe(CANVAS_ZOOM_MIN);
    });

    it('does not leak the v3 doc or entity type helpers as runtime values', () => {
      expect(SchemaV3Constants).not.toHaveProperty('Doc');
      expect(SchemaV3Constants).not.toHaveProperty('Table');
      expect(SchemaV3Constants).not.toHaveProperty('Memo');
      expect(Object.keys(SchemaV3Constants)).toHaveLength(28);
    });
  });

  describe('ERDEditorSchemaV3', () => {
    it('describes the persisted document envelope', () => {
      const schema: ERDEditorSchemaV3 = {
        $schema:
          'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json',
        version: '3.0.0',
        settings: {
          width: CANVAS_SIZE_MAX,
          height: CANVAS_SIZE_MAX,
          scrollTop: 0,
          scrollLeft: 0,
          zoomLevel: CANVAS_ZOOM_MIN,
          show: Show.tableComment,
          database: Database.PostgreSQL,
          databaseName: '',
          canvasType: CanvasType.ERD,
          language: Language.Java,
          tableNameCase: NameCase.pascalCase,
          columnNameCase: NameCase.camelCase,
          bracketType: BracketType.doubleQuote,
          relationshipDataTypeSync: true,
          relationshipOptimization: false,
          columnOrder: [...ColumnTypeList],
          maxWidthComment: -1,
          ignoreSaveSettings: 0,
        },
        doc: {
          tableIds: ['table-1'],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: {
            'table-1': {
              id: 'table-1',
              name: 'actor',
              comment: '',
              columnIds: [],
              seqColumnIds: [],
              ui: {
                x: 0,
                y: 0,
                zIndex: 2,
                widthName: 60,
                widthComment: 60,
                color: '',
              },
              meta: { updateAt: 0, createAt: 0 },
            },
          },
          tableColumnEntities: {},
          relationshipEntities: {},
          indexEntities: {},
          indexColumnEntities: {},
          memoEntities: {},
        },
      };

      expect(schema.version).toBe('3.0.0');
      expect(schema.$schema).toMatch(/json-schema\/schema\.json$/);
      expect(Object.keys(schema.collections).sort()).toEqual([
        'indexColumnEntities',
        'indexEntities',
        'memoEntities',
        'relationshipEntities',
        'tableColumnEntities',
        'tableEntities',
      ]);
      expect(
        schema.doc.tableIds.every(id => id in schema.collections.tableEntities)
      ).toBe(true);
      expect(schema.collections.tableEntities['table-1'].name).toBe('actor');
    });
  });
});
