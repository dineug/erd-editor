import { isPlainObject } from 'es-toolkit';
import { round } from 'es-toolkit/compat';
import { describe, expect, it } from 'vite-plus/test';

import { DeepPartial } from '@/internal-types';
import {
  type LegacyScrollBox,
  migrateScrollToOrigin,
} from '@/v3/parser/migrateScroll';
import { createAndMergeSettings as mergeSettings } from '@/v3/parser/settings';
import {
  BracketType,
  CanvasType,
  ColumnType,
  Database,
  Language,
  LanguageList,
  LockSettingType,
  NameCase,
  Settings,
  Show,
} from '@/v3/schema/settings';

const LOCK_ALL = 63;

/** What a document saved before these fields left the settings. */
type LegacyFields = Partial<
  Record<
    | 'width'
    | 'height'
    | 'scrollTop'
    | 'scrollLeft'
    | 'relationshipOptimization'
    | 'ignoreSaveSettings',
    unknown
  >
>;

/** A file that names its locks, so the view and the tab it saved stay. */
const createAndMergeSettings = (json?: DeepPartial<Settings> & LegacyFields) =>
  mergeSettings(
    isPlainObject(json) ? { lockSettings: LOCK_ALL, ...json } : json
  );

const legacyBox = (box: Partial<LegacyScrollBox> = {}): LegacyScrollBox => ({
  width: 2000,
  height: 2000,
  zoomLevel: 1,
  scrollLeft: 0,
  scrollTop: 0,
  ...box,
});

const defaultShow =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnPrimaryKey |
  Show.columnNotNull |
  Show.relationship;

const defaultColumnOrder = [
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnNotNull,
  ColumnType.columnUnique,
  ColumnType.columnAutoIncrement,
  ColumnType.columnDefault,
  ColumnType.columnComment,
];

describe('createAndMergeSettings', () => {
  it('returns the default settings when no json is given', () => {
    expect(createAndMergeSettings()).toEqual({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      show: defaultShow,
      database: Database.MySQL,
      databaseName: '',
      canvasType: CanvasType.ERD,
      language: Language.GraphQL,
      tableNameCase: NameCase.pascalCase,
      columnNameCase: NameCase.camelCase,
      bracketType: BracketType.none,
      relationshipDataTypeSync: true,
      columnOrder: defaultColumnOrder,
      maxWidthComment: -1,
      lockSettings: LOCK_ALL,
      lockedValues: {
        originX: 0,
        originY: 0,
        zoomLevel: 1,
        canvasType: CanvasType.ERD,
        language: Language.GraphQL,
        tableNameCase: NameCase.pascalCase,
        columnNameCase: NameCase.camelCase,
        bracketType: BracketType.none,
      },
      ddlScripts: { before: '', after: '' },
    });
  });

  it('leaves the default origin at zero, where the box term vanishes too', () => {
    const settings = createAndMergeSettings();

    expect(settings.zoomLevel).toBe(1);
    expect(settings).toMatchObject(migrateScrollToOrigin(legacyBox()));
  });

  it('computes the default show bitmask as 431', () => {
    expect(createAndMergeSettings().show).toBe(431);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'nope'],
    ['array', []],
  ])('ignores a non-object source (%s)', (_label, source) => {
    expect(createAndMergeSettings(source as any)).toEqual(mergeSettings());
  });

  describe('the legacy canvas box', () => {
    const originOf = (json: LegacyFields) =>
      createAndMergeSettings({ zoomLevel: 0.5, ...json });

    it.each([
      ['a width below the minimum', { width: 10 }, { originX: 500 }],
      ['a width above the maximum', { width: 999_999 }, { originX: 5000 }],
      ['a width inside the range', { width: 5_000 }, { originX: 1250 }],
      ['a height below the minimum', { height: -1 }, { originY: 500 }],
      ['a height above the maximum', { height: 20_001 }, { originY: 5000 }],
    ])('migrates from %s clamped', (_label, json, origin) => {
      expect(originOf(json)).toMatchObject(origin);
    });

    it('reads a non-number width and height at the default box', () => {
      expect(originOf({ width: '3000', height: null })).toMatchObject({
        originX: 500,
        originY: 500,
      });
    });

    it('keeps none of the fields a document saved before they left', () => {
      const settings = createAndMergeSettings({
        width: 4000,
        height: 3000,
        scrollTop: 12,
        scrollLeft: -34,
        relationshipOptimization: true,
        ignoreSaveSettings: 3,
      });

      for (const field of [
        'width',
        'height',
        'scrollTop',
        'scrollLeft',
        'relationshipOptimization',
        'ignoreSaveSettings',
      ]) {
        expect(settings).not.toHaveProperty(field);
      }
    });
  });

  describe('zoomLevel', () => {
    it('clamps below the minimum', () => {
      expect(createAndMergeSettings({ zoomLevel: 0 }).zoomLevel).toBe(0.1);
    });

    it('clamps above the maximum', () => {
      expect(createAndMergeSettings({ zoomLevel: 10 }).zoomLevel).toBe(1.5);
    });

    it('keeps a value inside the range', () => {
      expect(createAndMergeSettings({ zoomLevel: 0.5 }).zoomLevel).toBe(0.5);
    });

    it('keeps a magnified zoom a v3 document may now carry', () => {
      expect(createAndMergeSettings({ zoomLevel: 1.2 }).zoomLevel).toBe(1.2);
      expect(createAndMergeSettings({ zoomLevel: 1.5 }).zoomLevel).toBe(1.5);
      expect(createAndMergeSettings({ zoomLevel: 1.51 }).zoomLevel).toBe(1.5);
    });

    it('ignores a non-number', () => {
      expect(
        createAndMergeSettings({ zoomLevel: '0.5' as any }).zoomLevel
      ).toBe(1);
    });
  });

  describe('maxWidthComment', () => {
    it('keeps the -1 sentinel untouched', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: -1 }).maxWidthComment
      ).toBe(-1);
    });

    it('clamps below 60', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 10 }).maxWidthComment
      ).toBe(60);
    });

    it('clamps above 200', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 1000 }).maxWidthComment
      ).toBe(200);
    });

    it('keeps a value inside the range', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 120 }).maxWidthComment
      ).toBe(120);
    });

    it('ignores a non-number', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: '120' as any })
          .maxWidthComment
      ).toBe(-1);
    });
  });

  describe('plain assignments', () => {
    it('assigns numbers, strings and booleans', () => {
      const settings = createAndMergeSettings({
        show: Show.relationship,
        lockSettings: LockSettingType.language,
        databaseName: 'sakila',
        canvasType: CanvasType.schemaSQL,
        relationshipDataTypeSync: false,
      });

      expect(settings.show).toBe(Show.relationship);
      expect(settings.lockSettings).toBe(LockSettingType.language);
      expect(settings.databaseName).toBe('sakila');
      expect(settings.canvasType).toBe(CanvasType.schemaSQL);
      expect(settings.relationshipDataTypeSync).toBe(false);
    });

    it('keeps the alternate key bit a document carries, off by default', () => {
      const shown = Show.relationship | Show.columnAlternateKey;

      expect(createAndMergeSettings({ show: shown }).show).toBe(shown);
      expect(createAndMergeSettings().show & Show.columnAlternateKey).toBe(0);
    });

    it('shows table groups unless a document carries the hide bit', () => {
      const hidden = Show.relationship | Show.hideTableGroup;

      expect(createAndMergeSettings({ show: hidden }).show).toBe(hidden);
      expect(createAndMergeSettings().show & Show.hideTableGroup).toBe(0);
      expect(
        createAndMergeSettings({ show: Show.relationship }).show &
          Show.hideTableGroup
      ).toBe(0);
    });

    it('ignores wrongly typed values', () => {
      const settings = createAndMergeSettings({
        show: null as any,
        databaseName: 10 as any,
        relationshipDataTypeSync: 'false' as any,
      });

      expect(settings.show).toBe(defaultShow);
      expect(settings.databaseName).toBe('');
      expect(settings.relationshipDataTypeSync).toBe(true);
    });

    it('accepts any string for canvasType (not validated against CanvasTypeList)', () => {
      expect(createAndMergeSettings({ canvasType: 'nope' }).canvasType).toBe(
        'nope'
      );
    });
  });

  describe('enum validated numbers', () => {
    it('assigns valid enum members', () => {
      const settings = createAndMergeSettings({
        database: Database.PostgreSQL,
        language: Language.Kotlin,
        tableNameCase: NameCase.snakeCase,
        columnNameCase: NameCase.none,
        bracketType: BracketType.backtick,
      });

      expect(settings.database).toBe(Database.PostgreSQL);
      expect(settings.language).toBe(Language.Kotlin);
      expect(settings.tableNameCase).toBe(NameCase.snakeCase);
      expect(settings.columnNameCase).toBe(NameCase.none);
      expect(settings.bracketType).toBe(BracketType.backtick);
    });

    it('keeps the Databricks database', () => {
      expect(
        createAndMergeSettings({ database: Database.Databricks }).database
      ).toBe(Database.Databricks);
    });

    it('keeps the Snowflake database', () => {
      expect(
        createAndMergeSettings({ database: Database.Snowflake }).database
      ).toBe(Database.Snowflake);
    });

    it('keeps the Go language', () => {
      expect(createAndMergeSettings({ language: Language.Go }).language).toBe(
        Language.Go
      );
    });

    it('keeps the SQLAlchemy language', () => {
      expect(
        createAndMergeSettings({ language: Language.SQLAlchemy }).language
      ).toBe(Language.SQLAlchemy);
    });

    it('keeps the TypeORM language', () => {
      expect(
        createAndMergeSettings({ language: Language.TypeORM }).language
      ).toBe(Language.TypeORM);
    });

    it('keeps the Sequelize language', () => {
      expect(
        createAndMergeSettings({ language: Language.Sequelize }).language
      ).toBe(Language.Sequelize);
    });

    it('keeps the Drizzle language', () => {
      expect(
        createAndMergeSettings({ language: Language.Drizzle }).language
      ).toBe(Language.Drizzle);
    });

    it('keeps the DBML language', () => {
      expect(createAndMergeSettings({ language: Language.DBML }).language).toBe(
        Language.DBML
      );
    });

    it('keeps the AML language', () => {
      expect(createAndMergeSettings({ language: Language.AML }).language).toBe(
        Language.AML
      );
    });

    it('keeps the Mermaid language', () => {
      expect(
        createAndMergeSettings({ language: Language.Mermaid }).language
      ).toBe(Language.Mermaid);
    });

    it('keeps the PHP language', () => {
      expect(createAndMergeSettings({ language: Language.PHP }).language).toBe(
        Language.PHP
      );
    });

    it('keeps the Doctrine language', () => {
      expect(
        createAndMergeSettings({ language: Language.Doctrine }).language
      ).toBe(Language.Doctrine);
    });

    it('keeps the Rust language', () => {
      expect(createAndMergeSettings({ language: Language.Rust }).language).toBe(
        Language.Rust
      );
    });

    it('keeps the SeaORM language', () => {
      expect(
        createAndMergeSettings({ language: Language.SeaORM }).language
      ).toBe(Language.SeaORM);
    });

    it('keeps the Swift language', () => {
      expect(
        createAndMergeSettings({ language: Language.Swift }).language
      ).toBe(Language.Swift);
    });

    it('keeps the Zod language', () => {
      expect(createAndMergeSettings({ language: Language.Zod }).language).toBe(
        Language.Zod
      );
    });

    it('keeps the JSONSchema language', () => {
      expect(
        createAndMergeSettings({ language: Language.JSONSchema }).language
      ).toBe(Language.JSONSchema);
    });

    it('opens a language flag it does not know as GraphQL, as an editor older than the flag does', () => {
      expect(
        createAndMergeSettings({ language: Math.max(...LanguageList) * 2 })
          .language
      ).toBe(Language.GraphQL);
    });

    it('ignores numbers outside the enum lists', () => {
      const settings = createAndMergeSettings({
        database: 999,
        language: 0,
        tableNameCase: -1,
        columnNameCase: 1024,
        bracketType: 7,
      });

      expect(settings.database).toBe(Database.MySQL);
      expect(settings.language).toBe(Language.GraphQL);
      expect(settings.tableNameCase).toBe(NameCase.pascalCase);
      expect(settings.columnNameCase).toBe(NameCase.camelCase);
      expect(settings.bracketType).toBe(BracketType.none);
    });

    it('ignores non-number enum values', () => {
      expect(createAndMergeSettings({ database: '4' as any }).database).toBe(
        Database.MySQL
      );
    });
  });

  describe('ddlScripts', () => {
    it('starts both scripts empty', () => {
      expect(createAndMergeSettings().ddlScripts).toEqual({
        before: '',
        after: '',
      });
    });

    it('keeps the two strings a document saved, as they were written', () => {
      const ddlScripts = {
        before: '\r\n  CREATE EXTENSION IF NOT EXISTS pgcrypto;  ',
        after: 'GRANT SELECT ON member TO app;',
      };

      expect(createAndMergeSettings({ ddlScripts }).ddlScripts).toEqual(
        ddlScripts
      );
    });

    it('reads a script that is not a string, or is missing, as empty', () => {
      expect(
        createAndMergeSettings({
          ddlScripts: { before: 12 as any, after: null as any },
        }).ddlScripts
      ).toEqual({ before: '', after: '' });
      expect(
        createAndMergeSettings({ ddlScripts: { after: 'SELECT 1;' } })
          .ddlScripts
      ).toEqual({ before: '', after: 'SELECT 1;' });
      expect(
        createAndMergeSettings({ ddlScripts: { before: ['x'] as any } })
          .ddlScripts
      ).toEqual({ before: '', after: '' });
    });

    it.each([
      ['a number', 7],
      ['null', null],
      ['an array', ['SELECT 1;']],
      ['a string', 'SELECT 1;'],
    ])('ignores ddlScripts that are %s', (_label, ddlScripts) => {
      expect(
        createAndMergeSettings({ ddlScripts: ddlScripts as any }).ddlScripts
      ).toEqual({ before: '', after: '' });
    });

    it('drops a key it does not know', () => {
      const { ddlScripts } = createAndMergeSettings({
        ddlScripts: { before: 'a', after: 'b', middle: 'c' } as any,
      });

      expect(ddlScripts).toEqual({ before: 'a', after: 'b' });
      expect(ddlScripts).not.toHaveProperty('middle');
    });

    it('gives each parse a pair of its own', () => {
      const first = createAndMergeSettings();
      const second = createAndMergeSettings();

      first.ddlScripts.before = 'changed';

      expect(second.ddlScripts.before).toBe('');
    });
  });

  describe('columnOrder', () => {
    it('accepts a permutation of every column type', () => {
      const columnOrder = [...defaultColumnOrder].reverse();
      const settings = createAndMergeSettings({ columnOrder });

      expect(settings.columnOrder).toEqual(columnOrder);
      expect(settings.columnOrder).toBe(columnOrder);
    });

    it('rejects an array with the wrong length', () => {
      expect(
        createAndMergeSettings({ columnOrder: [ColumnType.columnName] })
          .columnOrder
      ).toEqual(defaultColumnOrder);
    });

    it('rejects an array of the right length that is missing a member', () => {
      const columnOrder = [
        ColumnType.columnName,
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
      ];

      expect(createAndMergeSettings({ columnOrder }).columnOrder).toEqual(
        defaultColumnOrder
      );
    });

    it('rejects a non-array', () => {
      expect(
        createAndMergeSettings({ columnOrder: 'nope' as any }).columnOrder
      ).toEqual(defaultColumnOrder);
    });
  });
});

describe('the legacy scroll migration', () => {
  const legacy = (zoomLevel: number) => ({
    width: 3333,
    height: 3333,
    zoomLevel,
    scrollLeft: -137.25,
    scrollTop: 1234.5,
  });

  it.each([0.5, 0.1, 1.5])(
    'migrates a document with no origin pair at zoom %s',
    zoomLevel => {
      const json = legacy(zoomLevel);
      const settings = createAndMergeSettings(json);

      expect(settings.originX).toBe(
        round(json.scrollLeft + (json.width * (1 - zoomLevel)) / 2, 4)
      );
      expect(settings.originY).toBe(
        round(json.scrollTop + (json.height * (1 - zoomLevel)) / 2, 4)
      );
    }
  );

  it.each([0.5, 0.1, 1.5])(
    'keeps none of the legacy fields after the migration at zoom %s',
    zoomLevel => {
      const settings = createAndMergeSettings(legacy(zoomLevel));

      for (const field of ['width', 'height', 'scrollLeft', 'scrollTop']) {
        expect(settings).not.toHaveProperty(field);
      }
    }
  );

  it('reads a missing scroll field at zero', () => {
    expect(
      createAndMergeSettings({ zoomLevel: 0.5, scrollLeft: 10 })
    ).toMatchObject({ originX: 510, originY: 500 });
  });

  it('migrates from the clamped box and zoom, not the raw json', () => {
    const settings = createAndMergeSettings({
      width: 999_999,
      height: 10,
      zoomLevel: 10,
      scrollLeft: 40,
      scrollTop: 60,
    });

    expect(settings.zoomLevel).toBe(1.5);
    expect(settings).toMatchObject(
      migrateScrollToOrigin({
        width: 20_000,
        height: 2000,
        zoomLevel: 1.5,
        scrollLeft: 40,
        scrollTop: 60,
      })
    );
  });

  it('keeps an origin pair the document carries and migrates nothing', () => {
    const settings = createAndMergeSettings({
      ...legacy(0.5),
      originX: -11,
      originY: 22.5,
    });

    expect(settings.originX).toBe(-11);
    expect(settings.originY).toBe(22.5);
  });

  it.each([
    ['only originX', { originX: -11 }],
    ['only originY', { originY: 22.5 }],
    ['a non-number originX', { originX: '-11' as any, originY: 22.5 }],
  ])('migrates when the document carries %s', (_label, origin) => {
    const json = { ...legacy(0.5), ...origin };
    const settings = createAndMergeSettings(json);

    expect(settings).toMatchObject(migrateScrollToOrigin(legacy(0.5)));
  });
});

describe('a document saved before the locks', () => {
  const saved = {
    originX: -11,
    originY: 22.5,
    zoomLevel: 0.5,
    canvasType: CanvasType.schemaSQL,
    language: Language.Java,
    tableNameCase: NameCase.snakeCase,
    columnNameCase: NameCase.none,
    bracketType: BracketType.doubleQuote,
  };

  it.each([
    ['without a switch', saved],
    ['that saved its view', { ...saved, ignoreSaveSettings: 0 }],
    ['that saved none of it', { ...saved, ignoreSaveSettings: 3 }],
  ])('locks every setting of a file %s', (_label, json) => {
    expect(mergeSettings(json as DeepPartial<Settings>).lockSettings).toBe(
      LOCK_ALL
    );
  });

  it('opens its view and tab where a new document does and locks them there', () => {
    const settings = mergeSettings(saved);
    const start = {
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      canvasType: CanvasType.ERD,
    };

    expect(settings).toMatchObject(start);
    expect(settings.lockedValues).toMatchObject(start);
  });

  it('locks the code settings at what it saved', () => {
    const { lockedValues, ...settings } = mergeSettings(saved);
    const code = {
      language: Language.Java,
      tableNameCase: NameCase.snakeCase,
      columnNameCase: NameCase.none,
      bracketType: BracketType.doubleQuote,
    };

    expect(settings).toMatchObject(code);
    expect(lockedValues).toMatchObject(code);
  });

  it('keeps everything a file that names its locks saved, unlocked or not', () => {
    const settings = mergeSettings({ ...saved, lockSettings: 0 });

    expect(settings.lockSettings).toBe(0);
    expect(settings).toMatchObject(saved);
    expect(settings.lockedValues).toEqual(saved);
  });
});

describe('the view and the tab a lock can hold', () => {
  it.each([
    ['an infinite originX', { originX: Infinity, originY: 0 }],
    ['a NaN originY', { originX: 0, originY: NaN }],
  ])('migrates the origin of %s rather than locking it', (_label, origin) => {
    const settings = createAndMergeSettings({
      ...origin,
      scrollLeft: -10,
      scrollTop: 20,
    });

    expect(Number.isFinite(settings.originX)).toBe(true);
    expect(Number.isFinite(settings.originY)).toBe(true);
    expect(settings).toMatchObject(
      migrateScrollToOrigin(legacyBox({ scrollLeft: -10, scrollTop: 20 }))
    );
    expect(settings.lockedValues.originX).toBe(settings.originX);
  });

  it('opens a tab locked at Settings, which only a hand edit writes, on the ERD', () => {
    const settings = mergeSettings({
      canvasType: CanvasType.settings,
      lockSettings: LockSettingType.canvasType,
    });

    expect(settings.canvasType).toBe(CanvasType.ERD);
    expect(settings.lockedValues.canvasType).toBe(CanvasType.ERD);
  });

  it('keeps the Settings tab a file saved with its tab unlocked', () => {
    const settings = mergeSettings({
      canvasType: CanvasType.settings,
      lockSettings: 0,
    });

    expect(settings.canvasType).toBe(CanvasType.settings);
  });

  it.each([
    ['locked', LockSettingType.canvasType, CanvasType.ERD],
    ['unlocked', 0, CanvasType.settings],
  ])(
    'keeps a bit no lock owns beside a tab %s at Settings',
    (_label, bit, canvasType) => {
      const lockSettings = 64 | bit;
      const settings = mergeSettings({
        canvasType: CanvasType.settings,
        lockSettings,
      });

      expect(settings.lockSettings).toBe(lockSettings);
      expect(settings.canvasType).toBe(canvasType);
      expect(settings.lockedValues.canvasType).toBe(canvasType);
    }
  );

  it.each([
    [4.5, LockSettingType.language],
    [NaN, 0],
    [Infinity, 0],
  ])(
    'reads a lockSettings of %d as the int32 a bit test sees',
    (value, bits) => {
      expect(mergeSettings({ lockSettings: value }).lockSettings).toBe(bits);
    }
  );
});
