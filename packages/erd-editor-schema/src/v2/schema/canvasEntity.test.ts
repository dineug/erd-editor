import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasEntity,
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
  Setting,
  Show,
} from '@/v2/schema/canvasEntity';

describe('v2/schema/canvasEntity', () => {
  describe('ColumnType', () => {
    it('maps every key to an identical string value', () => {
      expect(ColumnType).toEqual({
        columnUnique: 'columnUnique',
        columnAutoIncrement: 'columnAutoIncrement',
        columnName: 'columnName',
        columnDataType: 'columnDataType',
        columnNotNull: 'columnNotNull',
        columnDefault: 'columnDefault',
        columnComment: 'columnComment',
      });
    });

    it('exposes ColumnTypeList in declaration order', () => {
      expect(ColumnTypeList).toEqual([
        'columnUnique',
        'columnAutoIncrement',
        'columnName',
        'columnDataType',
        'columnNotNull',
        'columnDefault',
        'columnComment',
      ]);
    });

    it('keeps list length in sync with the map', () => {
      expect(ColumnTypeList).toHaveLength(Object.keys(ColumnType).length);
    });
  });

  describe('CanvasType', () => {
    it('contains the ERD canvas plus the four builtin plugin canvases', () => {
      expect(CanvasType).toEqual({
        ERD: 'ERD',
        '@vuerd/builtin-sql-ddl': '@vuerd/builtin-sql-ddl',
        '@vuerd/builtin-grid': '@vuerd/builtin-grid',
        '@vuerd/builtin-generator-code': '@vuerd/builtin-generator-code',
        '@vuerd/builtin-visualization': '@vuerd/builtin-visualization',
      });
    });

    it('exposes CanvasTypeList in declaration order', () => {
      expect(CanvasTypeList).toEqual([
        'ERD',
        '@vuerd/builtin-sql-ddl',
        '@vuerd/builtin-grid',
        '@vuerd/builtin-generator-code',
        '@vuerd/builtin-visualization',
      ]);
    });

    it('does not include unknown canvas identifiers', () => {
      expect(CanvasTypeList.includes('@vuerd/builtin-unknown')).toBe(false);
    });
  });

  describe('Database', () => {
    it('lists the six supported vendors alphabetically', () => {
      expect(DatabaseList).toEqual([
        'MariaDB',
        'MSSQL',
        'MySQL',
        'Oracle',
        'PostgreSQL',
        'SQLite',
      ]);
    });

    it('is an identity map', () => {
      for (const [key, value] of Object.entries(Database)) {
        expect(value).toBe(key);
      }
    });
  });

  describe('Language', () => {
    it('exposes LanguageList in declaration order', () => {
      expect(LanguageList).toEqual([
        'GraphQL',
        'C#',
        'Java',
        'Kotlin',
        'TypeScript',
        'JPA',
        'Scala',
      ]);
    });

    it('keeps the non-identifier key "C#" addressable', () => {
      expect(Language['C#']).toBe('C#');
    });
  });

  describe('NameCase', () => {
    it('exposes the four casing strategies', () => {
      expect(NameCase).toEqual({
        none: 'none',
        camelCase: 'camelCase',
        pascalCase: 'pascalCase',
        snakeCase: 'snakeCase',
      });
      expect(NameCaseList).toEqual([
        'none',
        'camelCase',
        'pascalCase',
        'snakeCase',
      ]);
    });

    it('uses "none" as the neutral casing value', () => {
      expect(NameCaseList[0]).toBe(NameCase.none);
    });
  });

  describe('HighlightTheme', () => {
    it('exposes HighlightThemeList in declaration order', () => {
      expect(HighlightThemeList).toEqual([
        'AtomOneDark',
        'AtomOneLight',
        'MonokaiSublime',
        'GithubGist',
        'VS2015',
      ]);
    });

    it('is an identity map', () => {
      for (const [key, value] of Object.entries(HighlightTheme)) {
        expect(value).toBe(key);
      }
    });
  });

  describe('BracketType', () => {
    it('exposes BracketTypeList in declaration order', () => {
      expect(BracketTypeList).toEqual([
        'none',
        'doubleQuote',
        'singleQuote',
        'backtick',
      ]);
    });

    it('maps bracket kinds to their own names', () => {
      expect(BracketType.doubleQuote).toBe('doubleQuote');
      expect(BracketType.backtick).toBe('backtick');
    });
  });

  describe('canvas boundary constants', () => {
    it('defines the zoom range as 0.1 .. 1', () => {
      expect(CANVAS_ZOOM_MIN).toBe(0.1);
      expect(CANVAS_ZOOM_MAX).toBe(1);
      expect(CANVAS_ZOOM_MIN).toBeLessThan(CANVAS_ZOOM_MAX);
    });

    it('defines the size range as 2000 .. 20000', () => {
      expect(CANVAS_SIZE_MIN).toBe(2000);
      expect(CANVAS_SIZE_MAX).toBe(20000);
      expect(CANVAS_SIZE_MIN).toBeLessThan(CANVAS_SIZE_MAX);
    });

    it('clamps values against the declared boundaries', () => {
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

      expect(clamp(0.05, CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX)).toBe(
        CANVAS_ZOOM_MIN
      );
      expect(clamp(5, CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX)).toBe(CANVAS_ZOOM_MAX);
      expect(clamp(0.5, CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX)).toBe(0.5);
      expect(clamp(1, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX)).toBe(CANVAS_SIZE_MIN);
      expect(clamp(999_999, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX)).toBe(
        CANVAS_SIZE_MAX
      );
    });
  });

  describe('CanvasEntity shape', () => {
    it('accepts a fully populated canvas built from the exported constants', () => {
      const show: Show = {
        tableComment: true,
        columnComment: false,
        columnDataType: true,
        columnDefault: false,
        columnAutoIncrement: false,
        columnPrimaryKey: true,
        columnUnique: false,
        columnNotNull: true,
        relationship: true,
      };
      const setting: Setting = {
        relationshipDataTypeSync: true,
        relationshipOptimization: false,
        columnOrder: [
          ColumnType.columnName,
          ColumnType.columnDataType,
          ColumnType.columnNotNull,
        ],
      };
      const canvas: CanvasEntity = {
        version: '2.2.3',
        width: CANVAS_SIZE_MIN,
        height: CANVAS_SIZE_MAX,
        scrollTop: 0,
        scrollLeft: -10,
        zoomLevel: CANVAS_ZOOM_MAX,
        show,
        database: Database.PostgreSQL,
        databaseName: 'sakila',
        canvasType: CanvasType.ERD,
        language: Language.TypeScript,
        tableCase: NameCase.pascalCase,
        columnCase: NameCase.camelCase,
        highlightTheme: HighlightTheme.MonokaiSublime,
        bracketType: BracketType.backtick,
        setting,
        pluginSerializationMap: { '@dineug/plugin': '{}' },
      };

      expect(
        canvas.setting.columnOrder.every(v => ColumnTypeList.includes(v))
      ).toBe(true);
      expect(DatabaseList).toContain(canvas.database);
      expect(CanvasTypeList).toContain(canvas.canvasType);
      expect(canvas.pluginSerializationMap['@dineug/plugin']).toBe('{}');
    });
  });
});
