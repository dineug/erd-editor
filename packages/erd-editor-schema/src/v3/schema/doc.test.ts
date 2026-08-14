import { describe, expect, it } from 'vitest';

import * as docModule from '@/v3/schema/doc';
import { Doc } from '@/v3/schema/doc';

const createDoc = (): Doc => ({
  tableIds: [],
  relationshipIds: [],
  indexIds: [],
  memoIds: [],
});

describe('v3/schema/doc', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(docModule)).toEqual([]);
  });

  it('declares exactly the four id lists that drive rendering order', () => {
    expect(Object.keys(createDoc()).sort()).toEqual([
      'indexIds',
      'memoIds',
      'relationshipIds',
      'tableIds',
    ]);
  });

  it('starts empty and preserves insertion order', () => {
    const doc = createDoc();

    expect(doc.tableIds).toEqual([]);

    doc.tableIds.push('table-1', 'table-2');
    doc.memoIds.push('memo-1');

    expect(doc.tableIds).toEqual(['table-1', 'table-2']);
    expect(doc.memoIds).toHaveLength(1);
    expect(doc.relationshipIds).toEqual([]);
    expect(doc.indexIds).toEqual([]);
  });

  it('removes an id from only the list that owns it', () => {
    const doc: Doc = {
      tableIds: ['table-1', 'table-2'],
      relationshipIds: ['relationship-1'],
      indexIds: ['index-1'],
      memoIds: ['memo-1'],
    };

    doc.tableIds = doc.tableIds.filter(id => id !== 'table-1');

    expect(doc.tableIds).toEqual(['table-2']);
    expect(doc.relationshipIds).toEqual(['relationship-1']);
    expect(doc.indexIds).toEqual(['index-1']);
    expect(doc.memoIds).toEqual(['memo-1']);
  });

  it('keeps the lists independent so the same id can appear in two of them', () => {
    const doc = createDoc();
    doc.tableIds.push('shared-id');
    doc.memoIds.push('shared-id');

    expect(doc.tableIds).toContain('shared-id');
    expect(doc.memoIds).toContain('shared-id');
    expect(doc.tableIds).not.toBe(doc.memoIds);
  });
});
