import { describe, expect, it } from 'vite-plus/test';

import { addAndSort } from '@/utils/collection/sequence';

describe('addAndSort', () => {
  it('appends the id to both lists when it is unknown to the sequence', () => {
    const ids = ['a'];
    const seqIds = ['a'];

    addAndSort(ids, seqIds, 'b');

    expect(ids).toEqual(['a', 'b']);
    expect(seqIds).toEqual(['a', 'b']);
  });

  it('appends to empty lists', () => {
    const ids: string[] = [];
    const seqIds: string[] = [];

    addAndSort(ids, seqIds, 'a');

    expect(ids).toEqual(['a']);
    expect(seqIds).toEqual(['a']);
  });

  it('restores the sequence order when the id already exists in the sequence', () => {
    const ids = ['b'];
    const seqIds = ['a', 'b', 'c'];

    addAndSort(ids, seqIds, 'a');

    expect(ids).toEqual(['a', 'b']);
    expect(seqIds).toEqual(['a', 'b', 'c']);
  });

  it('reinserts a removed id back into its original slot', () => {
    const seqIds = ['a', 'b', 'c', 'd'];
    const ids = ['a', 'b', 'd'];

    addAndSort(ids, seqIds, 'c');

    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not touch the sequence list when the id is already sequenced', () => {
    const seqIds = ['a', 'b'];
    const ids = ['b'];

    addAndSort(ids, seqIds, 'a');

    expect(seqIds).toEqual(['a', 'b']);
  });

  it('pushes ids missing from the sequence to the end', () => {
    const seqIds = ['a'];
    const ids = ['x'];

    addAndSort(ids, seqIds, 'a');

    expect(ids).toEqual(['a', 'x']);
  });

  it('keeps an already sorted sequenced id ahead of an unsequenced one', () => {
    const seqIds = ['a', 'b'];
    const ids = ['a', 'x'];

    addAndSort(ids, seqIds, 'b');

    expect(ids).toEqual(['a', 'b', 'x']);
  });

  it('keeps sequenced ids before unsequenced ones', () => {
    const seqIds = ['a', 'b'];
    const ids = ['x', 'b'];

    addAndSort(ids, seqIds, 'a');

    expect(ids.slice(0, 2)).toEqual(['a', 'b']);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('x');
  });

  it('allows a duplicate when the id is already present in ids', () => {
    const seqIds = ['a', 'b'];
    const ids = ['a', 'b'];

    addAndSort(ids, seqIds, 'a');

    expect(ids).toEqual(['a', 'a', 'b']);
    expect(seqIds).toEqual(['a', 'b']);
  });

  it('mutates in place and returns undefined', () => {
    const ids: string[] = [];
    const seqIds: string[] = [];

    const result = addAndSort(ids, seqIds, 'a');

    expect(result).toBeUndefined();
    expect(ids).toEqual(['a']);
  });
});
