import { describe, expect, it } from 'vitest';

import * as v3 from '@/v3';
import { SchemaV3Constants, schemaV3Parser } from '@/v3';
import { parser } from '@/v3/parser';
import { SchemaV3Constants as sourceConstants } from '@/v3/schema';

describe('v3/index', () => {
  it('exposes exactly the two public runtime entry points', () => {
    expect(Object.keys(v3).sort()).toEqual([
      'SchemaV3Constants',
      'schemaV3Parser',
    ]);
  });

  it('aliases the v3 parser as schemaV3Parser', () => {
    expect(schemaV3Parser).toBe(parser);
    expect(typeof schemaV3Parser).toBe('function');
  });

  it('re-exports SchemaV3Constants without copying it', () => {
    expect(SchemaV3Constants).toBe(sourceConstants);
  });

  it('parses an empty source into a fully defaulted v3 document', () => {
    const result = schemaV3Parser({});

    expect(result.version).toBe('3.0.0');
    expect(result.$schema).toBe(
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json'
    );
    expect(result.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect(result.collections.tableEntities).toEqual({});
    expect(SchemaV3Constants.CanvasTypeList).toContain(
      result.settings.canvasType
    );
  });

  it('keeps known values from the source while defaulting the rest', () => {
    const result = schemaV3Parser({
      settings: {
        databaseName: 'sakila',
        database: SchemaV3Constants.Database.PostgreSQL,
      },
      doc: { tableIds: ['table-1'] },
    });

    expect(result.settings.databaseName).toBe('sakila');
    expect(result.settings.database).toBe(
      SchemaV3Constants.Database.PostgreSQL
    );
    expect(result.doc.tableIds).toEqual(['table-1']);
    expect(result.doc.memoIds).toEqual([]);
  });
});
