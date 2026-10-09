import { omit } from 'es-toolkit';
import { describe, expect, it } from 'vite-plus/test';

import { parser, parserV2, toJson } from '@/parser';
import { createSchema, SchemaV3Constants } from '@/v3';
import { migrateScrollToOrigin } from '@/v3/parser/migrateScroll';

const V3_SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';

const {
  BracketType,
  CanvasType,
  Language,
  LockSettingFields,
  LockSettingType,
  NameCase,
} = SchemaV3Constants;
const LOCK_ALL = 63;

const DEFAULT_VIEW = {
  originX: 0,
  originY: 0,
  zoomLevel: 1,
  canvasType: CanvasType.ERD,
};
const DEFAULTS = {
  ...DEFAULT_VIEW,
  language: Language.GraphQL,
  tableNameCase: NameCase.pascalCase,
  columnNameCase: NameCase.camelCase,
  bracketType: BracketType.none,
};
const SAVED_VIEW = {
  originX: -40,
  originY: 90,
  zoomLevel: 0.5,
  canvasType: CanvasType.schemaSQL,
};
const SAVED_CODE = {
  language: Language.TypeScript,
  tableNameCase: NameCase.snakeCase,
  columnNameCase: NameCase.snakeCase,
  bracketType: BracketType.backtick,
};
const LIVE = { ...SAVED_VIEW, originY: -60, ...SAVED_CODE };

describe('parser', () => {
  it('parses a v3 document through the v3 parser', () => {
    const schema = parser(
      JSON.stringify({
        version: '3.0.0',
        settings: { width: 4000, databaseName: 'shop' },
        doc: { tableIds: ['t1'] },
        collections: {
          tableEntities: {
            t1: { id: 't1', name: 'users' },
          },
        },
      })
    );

    expect(schema.$schema).toBe(V3_SCHEMA_URL);
    expect(schema.version).toBe('3.0.0');
    expect(schema.settings.width).toBe(4000);
    expect(schema.settings.databaseName).toBe('shop');
    expect(schema.doc.tableIds).toEqual(['t1']);
    expect(schema.collections.tableEntities.t1.name).toBe('users');
  });

  it('converts anything that is not version 3.0.0 from v2', () => {
    const schema = parser(
      JSON.stringify({
        canvas: { width: 3000, databaseName: 'legacy' },
        table: {
          tables: [{ id: 't1', name: 'users', columns: [] }],
          indexes: [],
        },
        relationship: { relationships: [] },
        memo: { memos: [] },
      })
    );

    expect(schema.version).toBe('3.0.0');
    expect(schema.settings.width).toBe(3000);
    expect(schema.settings.databaseName).toBe('legacy');
    expect(schema.doc.tableIds).toEqual(['t1']);
    expect(schema.collections.tableEntities.t1.name).toBe('users');
  });

  it('treats a missing version as v2', () => {
    const schema = parser('{}');

    expect(schema.version).toBe('3.0.0');
    expect(schema.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
      tableGroupIds: [],
    });
  });

  it('migrates a legacy document onto the origin pair, legacy pair intact', () => {
    const settings = {
      width: 3000,
      height: 5000,
      zoomLevel: 0.4,
      scrollLeft: -120,
      scrollTop: 340,
      lockSettings: LOCK_ALL,
    };
    const schema = parser(JSON.stringify({ version: '3.0.0', settings }));

    expect(schema.settings).toMatchObject(migrateScrollToOrigin(settings));
    expect(schema.settings.scrollLeft).toBe(settings.scrollLeft);
    expect(schema.settings.scrollTop).toBe(settings.scrollTop);
  });

  it('leaves an empty source at four zeroes, where the term is zero too', () => {
    const schema = parser('{"version":"3.0.0"}');

    expect(schema.settings.scrollLeft).toBe(0);
    expect(schema.settings.scrollTop).toBe(0);
    expect(schema.settings.originX).toBe(0);
    expect(schema.settings.originY).toBe(0);
    expect(schema.settings.zoomLevel).toBe(1);
  });

  it('throws on malformed json', () => {
    expect(() => parser('not json')).toThrow(SyntaxError);
  });
});

describe('parserV2', () => {
  it('converts a v3 document down to v2', () => {
    const schema = parserV2(
      JSON.stringify({
        version: '3.0.0',
        settings: { width: 4000, databaseName: 'shop' },
        doc: { tableIds: ['t1'], memoIds: ['m1'] },
        collections: {
          tableEntities: { t1: { id: 't1', name: 'users' } },
          memoEntities: { m1: { id: 'm1', value: 'note' } },
        },
      })
    );

    expect(schema.canvas.width).toBe(4000);
    expect(schema.canvas.databaseName).toBe('shop');
    expect(schema.table.tables[0].name).toBe('users');
    expect(schema.memo.memos[0].value).toBe('note');
  });

  it('parses a v2 document as is', () => {
    const schema = parserV2(
      JSON.stringify({
        canvas: { width: 3000 },
        table: { tables: [{ id: 't1', name: 'users' }], indexes: [] },
      })
    );

    expect(schema.canvas.width).toBe(3000);
    expect(schema.table.tables[0].id).toBe('t1');
  });

  it('throws on malformed json', () => {
    expect(() => parserV2('{')).toThrow(SyntaxError);
  });
});

describe('toJson', () => {
  it('keeps only the persisted keys', () => {
    const schema = parser('{"version":"3.0.0"}');
    const extended = { ...schema, transient: 'drop me' } as any;

    const json = JSON.parse(toJson(extended));

    expect(Object.keys(json).sort()).toEqual([
      '$schema',
      'collections',
      'doc',
      'settings',
      'version',
    ]);
    expect(json).not.toHaveProperty('transient');
  });

  it('pretty prints with two spaces', () => {
    const schema = parser('{"version":"3.0.0"}');

    expect(toJson(schema)).toContain('\n  "version": "3.0.0"');
  });

  it('writes both pairs as they stand while the viewport is unlocked', () => {
    const schema = parser('{"version":"3.0.0","settings":{"lockSettings":0}}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.originX = -40;
    schema.settings.originY = -60;
    schema.settings.zoomLevel = 0.5;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(100);
    expect(json.settings.scrollLeft).toBe(200);
    expect(json.settings.originX).toBe(-40);
    expect(json.settings.originY).toBe(-60);
    expect(json.settings.zoomLevel).toBe(0.5);
  });

  it('writes back the legacy pair a document arrived with, byte for byte', () => {
    const settings = {
      width: 3000,
      height: 5000,
      zoomLevel: 0.4,
      scrollLeft: -120,
      scrollTop: 340,
      lockSettings: LOCK_ALL,
    };
    const source = JSON.stringify({ version: '3.0.0', settings });

    const json = JSON.parse(toJson(parser(source)));

    expect(json.settings.scrollLeft).toBe(settings.scrollLeft);
    expect(json.settings.scrollTop).toBe(settings.scrollTop);
    expect(json.settings).toMatchObject(migrateScrollToOrigin(settings));
  });

  it('parses its own output back to the same in-memory document', () => {
    const source = JSON.stringify({
      version: '3.0.0',
      settings: {
        width: 3333,
        height: 2000,
        zoomLevel: 1.5,
        scrollLeft: -137.25,
        scrollTop: 1234.5,
        lockSettings: LOCK_ALL,
      },
      doc: { tableIds: ['t1'] },
      collections: { tableEntities: { t1: { id: 't1', name: 'users' } } },
    });
    const schema = parser(source);

    expect(parser(toJson(schema))).toEqual(schema);
  });

  it('writes each locked setting at its lock, leaving the live one alone', () => {
    const schema = parser('{"version":"3.0.0","settings":{"lockSettings":63}}');
    Object.assign(schema.settings, LIVE);

    const json = JSON.parse(toJson(schema));

    expect(json.settings).toMatchObject(DEFAULTS);
    expect(schema.settings).toMatchObject(LIVE);
  });

  it.each(
    Object.entries(LockSettingType).map(([name, bit]) => [
      name,
      bit,
      LockSettingFields[bit],
    ])
  )('writes %s alone at its lock when only it is locked', (_, bit, fields) => {
    const schema = parser(
      JSON.stringify({ version: '3.0.0', settings: { lockSettings: bit } })
    );
    Object.assign(schema.settings, LIVE);

    const { settings } = JSON.parse(toJson(schema));

    for (const field of Object.keys(LIVE) as Array<keyof typeof LIVE>) {
      expect(settings[field]).toBe(
        fields.includes(field) ? DEFAULTS[field] : LIVE[field]
      );
    }
  });

  it('locks the origin and the zoom together as the viewport', () => {
    expect(LockSettingFields[LockSettingType.viewport]).toEqual([
      'originX',
      'originY',
      'zoomLevel',
    ]);
  });

  it('writes the lockedValues it held, not a later lock or the live value', () => {
    const schema = createSchema();
    Object.assign(schema.settings.lockedValues, {
      originX: 12,
      zoomLevel: 0.8,
    });
    schema.settings.originX = -40;

    const { settings } = JSON.parse(toJson(schema));

    expect(settings).toMatchObject({ originX: 12, zoomLevel: 0.8 });
    expect(settings).not.toHaveProperty('lockedValues');
    expect(Object.keys(settings).slice(-2)).toEqual([
      'ignoreSaveSettings',
      'lockSettings',
    ]);
    expect(parser(toJson(schema)).settings.lockedValues).toMatchObject({
      originX: 12,
      zoomLevel: 0.8,
    });
  });

  it('writes the fields of a document no parser built as they stand', () => {
    const raw = JSON.parse(toJson(createSchema()));
    raw.settings.originX = 77;

    expect(JSON.parse(toJson(raw)).settings).toMatchObject({
      originX: 77,
      lockSettings: LOCK_ALL,
    });
  });

  it('never mutates the settings it is handed', () => {
    const schema = createSchema();
    Object.assign(schema.settings, LIVE);
    const before = structuredClone(schema.settings);

    toJson(schema);

    expect(schema.settings).toEqual(before);
  });
});

/**
 * The save switches a release before the locks reads: off while the viewport is
 * locked, so it never saves where a reader scrolls, on while it follows them.
 */
describe('the save switches toJson writes for releases before the locks', () => {
  it.each([
    ['locked', LOCK_ALL, 3],
    ['locked alone', LockSettingType.viewport, 3],
    ['unlocked', LOCK_ALL & ~LockSettingType.viewport, 0],
    ['unlocked with nothing locked', 0, 0],
  ])('writes the viewport %s as %i', (_, lockSettings, ignoreSaveSettings) => {
    const schema = parser(
      JSON.stringify({ version: '3.0.0', settings: { lockSettings } })
    );

    expect(JSON.parse(toJson(schema)).settings.ignoreSaveSettings).toBe(
      ignoreSaveSettings
    );
  });

  it('reads none of it back, the locks alone saying what is saved', () => {
    const source = JSON.stringify({
      version: '3.0.0',
      settings: { lockSettings: 0, ignoreSaveSettings: 3, originX: -40 },
    });
    const schema = parser(source);
    schema.settings.originX = 80;

    expect(schema.settings).not.toHaveProperty('ignoreSaveSettings');
    expect(JSON.parse(toJson(schema)).settings).toMatchObject({
      ignoreSaveSettings: 0,
      originX: 80,
    });
  });
});

/**
 * A new document locks every lockable setting at its default, while a file
 * keeps the locks it names; one saved before them locks all of them too.
 */
describe('the locks of a new document and of a file', () => {
  it('writes a new document with every lock on and the defaults in place', () => {
    const schema = createSchema();
    Object.assign(schema.settings, LIVE);

    const { settings } = JSON.parse(toJson(schema));

    expect(settings.lockSettings).toBe(LOCK_ALL);
    expect(settings).toMatchObject(DEFAULTS);
    expect(settings).toMatchObject({ scrollLeft: 0, scrollTop: 0 });
  });

  it('reads a new document back as it wrote it', () => {
    const schema = createSchema();

    expect(parser(toJson(schema))).toEqual(schema);
  });

  it.each([
    [
      'a v3 file without the field',
      { version: '3.0.0', settings: { ...SAVED_VIEW, ...SAVED_CODE } },
    ],
    [
      'a v3 file that saved its view',
      {
        version: '3.0.0',
        settings: { ...SAVED_VIEW, ...SAVED_CODE, ignoreSaveSettings: 0 },
      },
    ],
    [
      'a v2 file',
      {
        canvas: {
          zoomLevel: 0.5,
          scrollLeft: -40,
          scrollTop: 90,
          language: 'TypeScript',
          tableCase: 'snakeCase',
          columnCase: 'snakeCase',
          bracketType: 'backtick',
        },
      },
    ],
  ])('locks every setting of %s, its view and tab at the start', (_, json) => {
    const { settings } = parser(JSON.stringify(json));

    expect(settings.lockSettings).toBe(LOCK_ALL);
    expect(settings).toMatchObject({ ...DEFAULT_VIEW, ...SAVED_CODE });
    expect(settings.lockedValues).toEqual({ ...DEFAULT_VIEW, ...SAVED_CODE });
  });

  it('keeps the locks a file names and the values it saved', () => {
    const settings = {
      lockSettings: LockSettingType.language | LockSettingType.viewport,
      ...SAVED_VIEW,
      ...SAVED_CODE,
    };
    const source = JSON.stringify({ version: '3.0.0', settings });

    const parsed = parser(source).settings;

    expect(parsed).toMatchObject(settings);
    expect(parsed.lockedValues).toEqual(omit(settings, ['lockSettings']));
  });

  it('keeps the bits no lock owns and writes them back', () => {
    const lockSettings = 1024 | LockSettingType.language;
    const schema = parser(
      JSON.stringify({ version: '3.0.0', settings: { lockSettings } })
    );

    expect(schema.settings.lockSettings).toBe(lockSettings);
    expect(JSON.parse(toJson(schema)).settings.lockSettings).toBe(lockSettings);
  });

  it('locks nothing with a bit no lock owns', () => {
    const schema = parser(
      JSON.stringify({ version: '3.0.0', settings: { lockSettings: 64 } })
    );
    Object.assign(schema.settings, LIVE);

    const { settings } = JSON.parse(toJson(schema));

    expect(settings).toMatchObject({ ...LIVE, ignoreSaveSettings: 0 });
  });
});

/**
 * The scripts are saved sparsely: a document that never had one keeps the
 * file it had, and one with either script writes both right after the locks.
 */
describe('the Schema SQL scripts toJson writes', () => {
  const withScripts = (before: string, after: string) => {
    const schema = createSchema();
    schema.settings.ddlScripts = { before, after };
    return JSON.parse(toJson(schema)).settings;
  };

  it('writes no key while both scripts are empty', () => {
    expect(withScripts('', '')).not.toHaveProperty('ddlScripts');
    expect(JSON.parse(toJson(createSchema())).settings).not.toHaveProperty(
      'ddlScripts'
    );
  });

  it.each([
    ['before alone', 'CREATE SCHEMA app;', ''],
    ['after alone', '', 'GRANT SELECT ON member TO app;'],
    ['both', 'CREATE SCHEMA app;', 'GRANT SELECT ON member TO app;'],
  ])('writes both fields once %s holds text', (_, before, after) => {
    expect(withScripts(before, after).ddlScripts).toEqual({ before, after });
  });

  it('writes a script of blanks alone, as it was typed', () => {
    expect(withScripts('  \n', '').ddlScripts).toEqual({
      before: '  \n',
      after: '',
    });
  });

  it('writes the key right after lockSettings', () => {
    expect(Object.keys(withScripts('a', 'b')).slice(-3)).toEqual([
      'ignoreSaveSettings',
      'lockSettings',
      'ddlScripts',
    ]);
  });

  it('writes no field the scripts do not have', () => {
    const schema = createSchema();
    schema.settings.ddlScripts = {
      before: 'a',
      after: '',
      middle: 'c',
    } as any;

    expect(JSON.parse(toJson(schema)).settings.ddlScripts).toEqual({
      before: 'a',
      after: '',
    });
  });

  it('reads its own output back to the same scripts', () => {
    const schema = createSchema();
    schema.settings.ddlScripts = { before: 'CREATE SCHEMA app;', after: '' };

    expect(parser(toJson(schema))).toEqual(schema);
  });

  it('writes the scripts of raw JSON as they stand, and none it lacks', () => {
    const raw = JSON.parse(toJson(createSchema()));

    expect(JSON.parse(toJson(raw)).settings).not.toHaveProperty('ddlScripts');

    raw.settings.ddlScripts = { before: '', after: 'SELECT 1;' };

    expect(JSON.parse(toJson(raw)).settings.ddlScripts).toEqual({
      before: '',
      after: 'SELECT 1;',
    });
  });
});

describe('the table groups toJson writes', () => {
  const source = {
    version: '3.0.0',
    settings: { show: SchemaV3Constants.Show.hideTableGroup },
    doc: { tableIds: ['t1', 't2'], tableGroupIds: ['g1'] },
    collections: {
      tableEntities: {
        t1: { id: 't1', name: 'invoice', groupId: 'g1' },
        t2: { id: 't2', name: 'member' },
      },
      tableGroupEntities: {
        g1: {
          id: 'g1',
          name: 'billing',
          color: '#0090ff',
          ui: { x: -40, y: 20, width: 640, height: 360, zIndex: 3 },
          meta: { updateAt: 2, createAt: 1 },
        },
      },
    },
  };

  it('writes the groups, their order, each membership and the hide bit', () => {
    const json = JSON.parse(toJson(parser(JSON.stringify(source))));

    expect(json.doc.tableGroupIds).toEqual(['g1']);
    expect(json.collections.tableGroupEntities).toEqual(
      source.collections.tableGroupEntities
    );
    expect(json.collections.tableEntities.t1.groupId).toBe('g1');
    expect(json.collections.tableEntities.t2.groupId).toBe('');
    expect(json.settings.show).toBe(SchemaV3Constants.Show.hideTableGroup);
  });

  it('reads its own output back to the same groups', () => {
    const schema = parser(JSON.stringify(source));

    expect(parser(toJson(schema))).toEqual(schema);
  });

  it('writes an empty collection and empty ids for a document with no group', () => {
    const json = JSON.parse(toJson(createSchema()));

    expect(json.doc.tableGroupIds).toEqual([]);
    expect(json.collections.tableGroupEntities).toEqual({});
  });

  it('leaves the groups out of the v2 document parserV2 converts to', () => {
    const schemaV2 = parserV2(JSON.stringify(source));

    expect(schemaV2.table.tables.map(({ name }) => name)).toEqual([
      'invoice',
      'member',
    ]);
    expect(JSON.stringify(schemaV2)).not.toMatch(/billing|groupId|tableGroup/);
  });
});
