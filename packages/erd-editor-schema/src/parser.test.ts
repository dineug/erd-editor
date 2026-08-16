import { describe, expect, it } from 'vite-plus/test';

import { parser, parserV2, toJson } from '@/parser';
import { SchemaV3Constants } from '@/v3';

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

  it('keeps scroll and zoom when nothing is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.zoomLevel = 0.5;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(100);
    expect(json.settings.scrollLeft).toBe(200);
    expect(json.settings.zoomLevel).toBe(0.5);
  });

  it('resets the scroll when the scroll save setting is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(0);
    expect(json.settings.scrollLeft).toBe(0);
    expect(json.settings.zoomLevel).toBe(0.5);
  });

  it('resets the zoom level when the zoom save setting is ignored', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.zoomLevel;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(100);
    expect(json.settings.zoomLevel).toBe(1);
  });

  it('resets both when both bits are set and mutates the input settings', () => {
    const schema = parser('{"version":"3.0.0"}');
    schema.settings.scrollTop = 100;
    schema.settings.scrollLeft = 200;
    schema.settings.zoomLevel = 0.5;
    schema.settings.ignoreSaveSettings =
      SchemaV3Constants.SaveSettingType.scroll |
      SchemaV3Constants.SaveSettingType.zoomLevel;

    const json = JSON.parse(toJson(schema));

    expect(json.settings.scrollTop).toBe(0);
    expect(json.settings.scrollLeft).toBe(0);
    expect(json.settings.zoomLevel).toBe(1);
    expect(schema.settings.scrollTop).toBe(0);
    expect(schema.settings.zoomLevel).toBe(1);
  });
});
