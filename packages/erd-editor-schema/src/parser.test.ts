import { describe, expect, it } from 'vite-plus/test';

import { parser, parserV2, toJson } from '@/parser';
import { SchemaV3Constants } from '@/v3';
import { migrateScrollToOrigin } from '@/v3/parser/migrateScroll';

const V3_SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';

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
    });
  });

  it('migrates a legacy document onto the origin pair, legacy pair intact', () => {
    const settings = {
      width: 3000,
      height: 5000,
      zoomLevel: 0.4,
      scrollLeft: -120,
      scrollTop: 340,
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

  it('writes both pairs when nothing is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
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
      },
      doc: { tableIds: ['t1'] },
      collections: { tableEntities: { t1: { id: 't1', name: 'users' } } },
    });
    const schema = parser(source);

    expect(parser(toJson(schema))).toEqual(schema);
  });

  it('zeroes only the origin pair when the scroll setting is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.originX = -40;
    schema.settings.originY = -60;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.originX).toBe(0);
    expect(json.settings.originY).toBe(0);
    expect(json.settings.scrollTop).toBe(100);
    expect(json.settings.scrollLeft).toBe(200);
    expect(json.settings.zoomLevel).toBe(0.5);
  });

  it('reloads a scroll-ignoring export at the origin it wrote', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.originX = -40;
    schema.settings.originY = -60;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll;

    const reloaded = parser(toJson(schema)).settings;

    expect(reloaded.originX).toBe(0);
    expect(reloaded.originY).toBe(0);
  });

  it('resets the zoom level when the zoom save setting is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.originY = 100;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.zoomLevel;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(100);
    expect(json.settings.originY).toBe(100);
    expect(json.settings.zoomLevel).toBe(1);
  });

  it('resets both when both bits are set, leaving the live settings alone', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.originX = -40;
    schema.settings.originY = -60;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll |
      SchemaV3Constants.SaveSettingType.zoomLevel;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.originX).toBe(0);
    expect(json.settings.originY).toBe(0);
    expect(json.settings.zoomLevel).toBe(1);
    expect(schema.settings.originX).toBe(-40);
    expect(schema.settings.originY).toBe(-60);
    expect(schema.settings.zoomLevel).toBe(0.5);
  });

  it('never mutates the settings it is handed', () => {
    const schema = parser(
      JSON.stringify({
        version: '3.0.0',
        settings: { width: 3000, height: 5000, zoomLevel: 0.4 },
      })
    );
    schema.settings.originX = -40;
    schema.settings.originY = -60;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll |
      SchemaV3Constants.SaveSettingType.zoomLevel;
    const before = { ...schema.settings };

    toJson(schema);

    expect(schema.settings).toEqual(before);
  });
});
