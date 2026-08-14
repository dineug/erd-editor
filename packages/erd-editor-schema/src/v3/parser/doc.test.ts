import { describe, expect, it } from 'vitest';

import { createAndMergeDoc } from '@/v3/parser/doc';

describe('createAndMergeDoc', () => {
  it('returns an empty doc when no json is given', () => {
    expect(createAndMergeDoc()).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
  });

  it('returns fresh arrays on every call', () => {
    const a = createAndMergeDoc();
    const b = createAndMergeDoc();

    expect(a.tableIds).not.toBe(b.tableIds);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'nope'],
    ['number', 42],
    ['array', []],
  ])('ignores a non-object source (%s)', (_label, source) => {
    expect(createAndMergeDoc(source as any)).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
  });

  it('merges every array field', () => {
    const doc = createAndMergeDoc({
      tableIds: ['t1', 't2'],
      relationshipIds: ['r1'],
      indexIds: ['i1'],
      memoIds: ['m1'],
    });

    expect(doc).toEqual({
      tableIds: ['t1', 't2'],
      relationshipIds: ['r1'],
      indexIds: ['i1'],
      memoIds: ['m1'],
    });
  });

  it('merges only the fields that are arrays', () => {
    const doc = createAndMergeDoc({
      tableIds: ['t1'],
      relationshipIds: 'r1' as any,
      indexIds: 1 as any,
      memoIds: null as any,
    });

    expect(doc).toEqual({
      tableIds: ['t1'],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
  });

  it('keeps the array reference from the source', () => {
    const tableIds = ['t1'];
    const doc = createAndMergeDoc({ tableIds });

    expect(doc.tableIds).toBe(tableIds);
  });

  it('ignores unknown keys', () => {
    const doc = createAndMergeDoc({ foo: ['bar'] } as any);

    expect(doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect((doc as any).foo).toBeUndefined();
  });
});
