import { describe, expect, it } from 'vite-plus/test';

import { createSchema, parser } from '@/v3/parser';
import { OrderType } from '@/v3/schema/indexColumn.entity';
import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingTypeList,
  NameCase,
} from '@/v3/schema/settings';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';

describe('parser', () => {
  it('stamps the schema url and version', () => {
    const result = parser({});

    expect(result.$schema).toBe(SCHEMA_URL);
    expect(result.version).toBe('3.0.0');
  });

  it('produces a fully defaulted document for an empty source', () => {
    const result = parser({});

    expect(result.settings.width).toBe(2000);
    expect(result.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
      tableGroupIds: [],
    });
    expect(result.collections).toEqual({
      tableEntities: {},
      tableColumnEntities: {},
      relationshipEntities: {},
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {},
      tableGroupEntities: {},
    });
  });

  it('tolerates a missing collections object', () => {
    const result = parser({ settings: { databaseName: 'db' } });

    expect(result.settings.databaseName).toBe('db');
    expect(result.collections.tableEntities).toEqual({});
  });

  it('throws when the source is nullish', () => {
    expect(() => parser(null)).toThrow(TypeError);
    expect(() => parser(undefined)).toThrow(TypeError);
  });

  it('parses a full document', () => {
    const result = parser({
      settings: {
        width: 3000,
        database: Database.PostgreSQL,
        zoomLevel: 0.7,
        lockSettings: 63,
      },
      doc: {
        tableIds: ['t1'],
        relationshipIds: ['r1'],
        indexIds: ['i1'],
        memoIds: ['m1'],
        tableGroupIds: ['g1'],
      },
      collections: {
        tableEntities: { t1: { id: 't1', name: 'users', groupId: 'g1' } },
        tableColumnEntities: { c1: { id: 'c1', tableId: 't1', name: 'id' } },
        relationshipEntities: { r1: { id: 'r1', identification: true } },
        indexEntities: { i1: { id: 'i1', tableId: 't1', unique: true } },
        indexColumnEntities: {
          ic1: { id: 'ic1', indexId: 'i1', orderType: OrderType.DESC },
        },
        memoEntities: { m1: { id: 'm1', value: 'hello' } },
        tableGroupEntities: { g1: { id: 'g1', name: 'billing' } },
      },
    });

    expect(result.settings.width).toBe(3000);
    expect(result.settings.database).toBe(Database.PostgreSQL);
    expect(result.settings.zoomLevel).toBe(0.7);
    expect(result.doc.tableIds).toEqual(['t1']);
    expect(result.collections.tableEntities.t1.name).toBe('users');
    expect(result.collections.tableColumnEntities.c1.tableId).toBe('t1');
    expect(result.collections.relationshipEntities.r1.identification).toBe(
      true
    );
    expect(result.collections.indexEntities.i1.unique).toBe(true);
    expect(result.collections.indexColumnEntities.ic1.orderType).toBe(
      OrderType.DESC
    );
    expect(result.collections.memoEntities.m1.value).toBe('hello');
    expect(result.doc.tableGroupIds).toEqual(['g1']);
    expect(result.collections.tableGroupEntities.g1.name).toBe('billing');
    expect(result.collections.tableEntities.t1.groupId).toBe('g1');
  });

  it('reads a document saved before table groups as one with none', () => {
    const result = parser({
      doc: { tableIds: ['t1'] },
      collections: { tableEntities: { t1: { id: 't1', name: 'users' } } },
    });

    expect(result.doc.tableGroupIds).toEqual([]);
    expect(result.collections.tableGroupEntities).toEqual({});
    expect(result.collections.tableEntities.t1.groupId).toBe('');
  });

  it('drops unknown top level keys', () => {
    const result = parser({ foo: 'bar' });

    expect(Object.keys(result).sort()).toEqual([
      '$schema',
      'collections',
      'doc',
      'settings',
      'version',
    ]);
  });

  it('is idempotent when re-parsing its own output', () => {
    const first = parser({
      settings: { width: 4000 },
      doc: { tableIds: ['t1'] },
      collections: { tableEntities: { t1: { id: 't1', name: 'users' } } },
    });
    const second = parser(first);

    expect(second).toEqual(first);
  });
});

describe('createSchema', () => {
  it('locks every lockable setting of a document created from nothing', () => {
    const { lockSettings, lockedValues } = createSchema().settings;

    expect(lockSettings).toBe(
      LockSettingTypeList.reduce((acc, bit) => acc | bit, 0)
    );
    expect(lockedValues).toEqual({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      canvasType: CanvasType.ERD,
      language: Language.GraphQL,
      tableNameCase: NameCase.pascalCase,
      columnNameCase: NameCase.camelCase,
      bracketType: BracketType.none,
    });
  });

  it('is the empty source the parser defaults', () => {
    expect(createSchema()).toEqual(parser({}));
    expect(parser({ settings: {} }).settings).toEqual(createSchema().settings);
  });

  it('hands out a new document each time', () => {
    const first = createSchema();
    first.settings.lockSettings = 0;
    first.settings.lockedValues.originX = 40;
    first.doc.tableIds.push('t1');

    expect(createSchema().settings.lockSettings).toBe(63);
    expect(createSchema().settings.lockedValues.originX).toBe(0);
    expect(createSchema().doc.tableIds).toEqual([]);
  });
});
