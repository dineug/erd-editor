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
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  SaveSettingType,
  Settings,
  Show,
} from '@/v3/schema/settings';

const isPowerOfTwo = (value: number) =>
  value > 0 && (value & (value - 1)) === 0;

describe('v3/schema/settings', () => {
  describe('CanvasType', () => {
    it('maps every canvas key to its string identifier', () => {
      expect(CanvasType).toEqual({
        ERD: 'ERD',
        visualization: '@dineug/erd-editor/builtin-visualization',
        schemaSQL: '@dineug/erd-editor/builtin-schema-sql',
        generatorCode: '@dineug/erd-editor/builtin-generator-code',
        settings: 'settings',
      });
    });

    it('exposes the values in declaration order as CanvasTypeList', () => {
      expect(CanvasTypeList).toEqual([
        'ERD',
        '@dineug/erd-editor/builtin-visualization',
        '@dineug/erd-editor/builtin-schema-sql',
        '@dineug/erd-editor/builtin-generator-code',
        'settings',
      ]);
      expect(CanvasTypeList).toHaveLength(Object.keys(CanvasType).length);
      expect(new Set(CanvasTypeList).size).toBe(CanvasTypeList.length);
    });

    it('prefixes the three builtin plugin canvases with the package scope', () => {
      const builtins = CanvasTypeList.filter(value =>
        value.startsWith('@dineug/erd-editor/builtin-')
      );

      expect(builtins).toHaveLength(3);
      expect(builtins).not.toContain(CanvasType.ERD);
      expect(builtins).not.toContain(CanvasType.settings);
    });
  });

  describe('Show', () => {
    it('assigns a distinct single-bit flag to each show option', () => {
      expect(Show).toEqual({
        tableComment: 1,
        columnComment: 2,
        columnDataType: 4,
        columnDefault: 8,
        columnAutoIncrement: 16,
        columnPrimaryKey: 32,
        columnUnique: 64,
        columnNotNull: 128,
        relationship: 256,
      });
      expect(Object.values(Show).every(isPowerOfTwo)).toBe(true);
    });

    it('combines into a mask where each flag can be tested independently', () => {
      const mask = Show.tableComment | Show.columnUnique | Show.relationship;

      expect(mask).toBe(1 + 64 + 256);
      expect(Boolean(mask & Show.columnUnique)).toBe(true);
      expect(Boolean(mask & Show.columnComment)).toBe(false);
      expect(mask & ~Show.relationship).toBe(65);
    });

    it('sums all flags to a contiguous 9-bit mask', () => {
      const all = Object.values(Show).reduce((acc, flag) => acc | flag, 0);

      expect(all).toBe(0b111111111);
      expect(all).toBe(2 ** Object.keys(Show).length - 1);
    });
  });

  describe('ColumnType', () => {
    it('assigns 7 distinct single-bit flags', () => {
      expect(ColumnType).toEqual({
        columnName: 1,
        columnDataType: 2,
        columnNotNull: 4,
        columnUnique: 8,
        columnAutoIncrement: 16,
        columnDefault: 32,
        columnComment: 64,
      });
      expect(Object.values(ColumnType).every(isPowerOfTwo)).toBe(true);
    });

    it('lists the values in declaration order', () => {
      expect(ColumnTypeList).toEqual([1, 2, 4, 8, 16, 32, 64]);
      expect(ColumnTypeList).toHaveLength(7);
    });
  });

  describe('Database', () => {
    it('assigns one flag per supported vendor', () => {
      expect(Database).toEqual({
        MariaDB: 1,
        MSSQL: 2,
        MySQL: 4,
        Oracle: 8,
        PostgreSQL: 16,
        SQLite: 32,
        Databricks: 64,
        Snowflake: 128,
      });
      expect(DatabaseList).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    });

    it('resolves a flag back to its vendor name', () => {
      const nameOf = (flag: number) =>
        Object.keys(Database).find(
          key => Database[key as keyof typeof Database] === flag
        );

      expect(nameOf(Database.PostgreSQL)).toBe('PostgreSQL');
      expect(nameOf(Database.SQLite)).toBe('SQLite');
      expect(nameOf(Database.Databricks)).toBe('Databricks');
      expect(nameOf(Database.Snowflake)).toBe('Snowflake');
      expect(nameOf(256)).toBeUndefined();
    });
  });

  describe('Language', () => {
    it('assigns one flag per generator language', () => {
      expect(Language).toEqual({
        GraphQL: 1,
        csharp: 2,
        Java: 4,
        Kotlin: 8,
        TypeScript: 16,
        JPA: 32,
        Scala: 64,
        Go: 128,
        SQLAlchemy: 256,
        TypeORM: 512,
        Sequelize: 1024,
        Drizzle: 2048,
      });
      expect(LanguageList).toEqual([
        1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048,
      ]);
      expect(Object.values(Language).every(isPowerOfTwo)).toBe(true);
    });
  });

  describe('NameCase', () => {
    it('exposes the four naming conventions', () => {
      expect(NameCase).toEqual({
        none: 1,
        camelCase: 2,
        pascalCase: 4,
        snakeCase: 8,
      });
      expect(NameCaseList).toEqual([1, 2, 4, 8]);
    });
  });

  describe('BracketType', () => {
    it('exposes the four quoting styles', () => {
      expect(BracketType).toEqual({
        none: 1,
        doubleQuote: 2,
        singleQuote: 4,
        backtick: 8,
      });
      expect(BracketTypeList).toEqual([1, 2, 4, 8]);
    });

    it('does not overlap NameCase semantically but shares the numeric range', () => {
      expect(BracketTypeList).toEqual(NameCaseList);
      expect(BracketType.backtick).toBe(NameCase.snakeCase);
    });
  });

  describe('SaveSettingType', () => {
    it('exposes only scroll and zoomLevel flags', () => {
      expect(SaveSettingType).toEqual({ scroll: 1, zoomLevel: 2 });
      expect(Object.keys(SaveSettingType)).toHaveLength(2);
    });

    it('supports ignoring a subset of settings through bit masking', () => {
      const ignore = SaveSettingType.scroll;

      expect(Boolean(ignore & SaveSettingType.scroll)).toBe(true);
      expect(Boolean(ignore & SaveSettingType.zoomLevel)).toBe(false);
    });
  });

  describe('canvas boundaries', () => {
    it('constrains zoom between 0.1 and 1', () => {
      expect(CANVAS_ZOOM_MIN).toBe(0.1);
      expect(CANVAS_ZOOM_MAX).toBe(1);
      expect(CANVAS_ZOOM_MIN).toBeLessThan(CANVAS_ZOOM_MAX);
    });

    it('constrains canvas size between 2000 and 20000', () => {
      expect(CANVAS_SIZE_MIN).toBe(2000);
      expect(CANVAS_SIZE_MAX).toBe(20000);
      expect(CANVAS_SIZE_MAX).toBe(CANVAS_SIZE_MIN * 10);
    });
  });

  it('describes a settings object built out of the exported constants', () => {
    const settings: Settings = {
      width: CANVAS_SIZE_MAX,
      height: CANVAS_SIZE_MAX,
      scrollTop: 0,
      scrollLeft: 0,
      zoomLevel: CANVAS_ZOOM_MAX,
      show: Show.tableComment | Show.relationship,
      database: Database.MySQL,
      databaseName: 'sakila',
      canvasType: CanvasType.ERD,
      language: Language.TypeScript,
      tableNameCase: NameCase.pascalCase,
      columnNameCase: NameCase.camelCase,
      bracketType: BracketType.backtick,
      relationshipDataTypeSync: true,
      relationshipOptimization: false,
      columnOrder: [...ColumnTypeList],
      maxWidthComment: -1,
      ignoreSaveSettings: SaveSettingType.scroll,
    };

    expect(CanvasTypeList).toContain(settings.canvasType);
    expect(DatabaseList).toContain(settings.database);
    expect(settings.columnOrder).toHaveLength(ColumnTypeList.length);
    expect(settings.show & Show.columnComment).toBe(0);
  });
});
