import { describe, expect, it } from 'vite-plus/test';

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
  HighlightTheme,
  HighlightThemeList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
} from '@/v2/schema/canvasEntity';
import { ERDEditorSchemaV2, SchemaV2Constants } from '@/v2/schema/index';
import {
  Direction,
  DirectionList,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v2/schema/relationshipEntity';
import { OrderType, OrderTypeList } from '@/v2/schema/tableEntity';
import { SchemaV3Constants } from '@/v3/schema/index';

describe('v2/schema/index', () => {
  describe('SchemaV2Constants', () => {
    it('re-exports exactly the documented constant keys', () => {
      expect(Object.keys(SchemaV2Constants).sort()).toEqual(
        [
          'BracketType',
          'BracketTypeList',
          'CANVAS_SIZE_MAX',
          'CANVAS_SIZE_MIN',
          'CANVAS_ZOOM_MAX',
          'CANVAS_ZOOM_MIN',
          'CanvasType',
          'CanvasTypeList',
          'ColumnType',
          'ColumnTypeList',
          'Database',
          'DatabaseList',
          'Direction',
          'DirectionList',
          'HighlightTheme',
          'HighlightThemeList',
          'Language',
          'LanguageList',
          'NameCase',
          'NameCaseList',
          'OrderType',
          'OrderTypeList',
          'RelationshipType',
          'RelationshipTypeList',
          'StartRelationshipType',
          'StartRelationshipTypeList',
        ].sort()
      );
    });

    it('re-exports the canvas constants by identity', () => {
      expect(SchemaV2Constants.BracketType).toBe(BracketType);
      expect(SchemaV2Constants.BracketTypeList).toBe(BracketTypeList);
      expect(SchemaV2Constants.CanvasType).toBe(CanvasType);
      expect(SchemaV2Constants.CanvasTypeList).toBe(CanvasTypeList);
      expect(SchemaV2Constants.ColumnType).toBe(ColumnType);
      expect(SchemaV2Constants.ColumnTypeList).toBe(ColumnTypeList);
      expect(SchemaV2Constants.Database).toBe(Database);
      expect(SchemaV2Constants.DatabaseList).toBe(DatabaseList);
      expect(SchemaV2Constants.HighlightTheme).toBe(HighlightTheme);
      expect(SchemaV2Constants.HighlightThemeList).toBe(HighlightThemeList);
      expect(SchemaV2Constants.Language).toBe(Language);
      expect(SchemaV2Constants.LanguageList).toBe(LanguageList);
      expect(SchemaV2Constants.NameCase).toBe(NameCase);
      expect(SchemaV2Constants.NameCaseList).toBe(NameCaseList);
    });

    it('re-exports the relationship and table constants by identity', () => {
      expect(SchemaV2Constants.RelationshipType).toBe(RelationshipType);
      expect(SchemaV2Constants.RelationshipTypeList).toBe(RelationshipTypeList);
      expect(SchemaV2Constants.StartRelationshipType).toBe(
        StartRelationshipType
      );
      expect(SchemaV2Constants.StartRelationshipTypeList).toBe(
        StartRelationshipTypeList
      );
      expect(SchemaV2Constants.Direction).toBe(Direction);
      expect(SchemaV2Constants.DirectionList).toBe(DirectionList);
      expect(SchemaV2Constants.OrderType).toBe(OrderType);
      expect(SchemaV2Constants.OrderTypeList).toBe(OrderTypeList);
    });

    it('re-exports the canvas boundary numbers', () => {
      expect(SchemaV2Constants.CANVAS_SIZE_MAX).toBe(CANVAS_SIZE_MAX);
      expect(SchemaV2Constants.CANVAS_SIZE_MIN).toBe(CANVAS_SIZE_MIN);
      expect(SchemaV2Constants.CANVAS_ZOOM_MAX).toBe(CANVAS_ZOOM_MAX);
      expect(SchemaV2Constants.CANVAS_ZOOM_MIN).toBe(CANVAS_ZOOM_MIN);
      expect(SchemaV2Constants.CANVAS_SIZE_MAX).toBe(20000);
      expect(SchemaV2Constants.CANVAS_ZOOM_MIN).toBe(0.1);
      expect(SchemaV2Constants.CANVAS_ZOOM_MAX).toBe(1);
    });

    /**
     * The legacy read path keeps its own ceiling. Raising the v3 one to 1.5 is
     * what the editor writes; a .vuerd document parsed here never carried a zoom
     * above 1, so widening this one would only invent values no v2 file has.
     */
    it('holds its zoom ceiling at 1 while v3 opens to 1.5', () => {
      expect(SchemaV2Constants.CANVAS_ZOOM_MAX).toBe(1);
      expect(SchemaV3Constants.CANVAS_ZOOM_MAX).toBe(1.5);
      expect(SchemaV2Constants.CANVAS_ZOOM_MAX).not.toBe(
        SchemaV3Constants.CANVAS_ZOOM_MAX
      );
      expect(SchemaV2Constants.CANVAS_ZOOM_MIN).toBe(
        SchemaV3Constants.CANVAS_ZOOM_MIN
      );
    });

    it('does not re-export the memo entity (type-only module)', () => {
      expect(SchemaV2Constants).not.toHaveProperty('MemoEntity');
      expect(SchemaV2Constants).not.toHaveProperty('Memo');
    });
  });

  describe('ERDEditorSchemaV2 shape', () => {
    it('composes canvas, table, memo and relationship entities', () => {
      const schema: ERDEditorSchemaV2 = {
        canvas: {
          version: '2.2.3',
          width: SchemaV2Constants.CANVAS_SIZE_MIN,
          height: SchemaV2Constants.CANVAS_SIZE_MIN,
          scrollTop: 0,
          scrollLeft: 0,
          zoomLevel: SchemaV2Constants.CANVAS_ZOOM_MAX,
          show: {
            tableComment: true,
            columnComment: true,
            columnDataType: true,
            columnDefault: true,
            columnAutoIncrement: false,
            columnPrimaryKey: true,
            columnUnique: false,
            columnNotNull: true,
            relationship: true,
          },
          database: SchemaV2Constants.Database.MySQL,
          databaseName: '',
          canvasType: SchemaV2Constants.CanvasType.ERD,
          language: SchemaV2Constants.Language.Java,
          tableCase: SchemaV2Constants.NameCase.pascalCase,
          columnCase: SchemaV2Constants.NameCase.camelCase,
          highlightTheme: SchemaV2Constants.HighlightTheme.VS2015,
          bracketType: SchemaV2Constants.BracketType.none,
          setting: {
            relationshipDataTypeSync: true,
            relationshipOptimization: false,
            columnOrder: Object.values(SchemaV2Constants.ColumnType),
          },
          pluginSerializationMap: {},
        },
        table: { tables: [], indexes: [] },
        memo: { memos: [] },
        relationship: { relationships: [] },
      };

      expect(Object.keys(schema).sort()).toEqual([
        'canvas',
        'memo',
        'relationship',
        'table',
      ]);
      expect(schema.canvas.database).toBe('MySQL');
      expect(schema.canvas.setting.columnOrder).toHaveLength(
        SchemaV2Constants.ColumnTypeList.length
      );
      expect(schema.table.tables).toEqual([]);
      expect(schema.memo.memos).toEqual([]);
      expect(schema.relationship.relationships).toEqual([]);
    });
  });
});
