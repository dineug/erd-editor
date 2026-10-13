import { describe, expect, it } from 'vite-plus/test';

import {
  emptyPairing,
  longestCommonIndexes,
  pairByOverlap,
  pairEntities,
} from './pairEntities';

type Item = { id: string; name: string; members?: string[] };

const pairs = (pairing: ReturnType<typeof pairEntities>) => [
  ...pairing.toNext.entries(),
];

describe('pairEntities', () => {
  it('pairs by id first, both ways', () => {
    const pairing = pairEntities<Item>(
      [{ id: 'a', name: 'x' }],
      [{ id: 'a', name: 'y' }]
    );

    expect(pairs(pairing)).toEqual([['a', 'a']]);
    expect([...pairing.toPrev.entries()]).toEqual([['a', 'a']]);
  });

  it('pairs what is left by each key in turn, one to one, in document order', () => {
    const byName = (item: Item) => item.name || null;
    const pairing = pairEntities<Item>(
      [
        { id: 'p1', name: 'users' },
        { id: 'p2', name: 'users' },
        { id: 'p3', name: '' },
      ],
      [
        { id: 'n1', name: 'users' },
        { id: 'n2', name: '' },
      ],
      [byName]
    );

    expect(pairs(pairing)).toEqual([['p1', 'n1']]);
  });

  it('reads a later key only for what an earlier one left', () => {
    const pairing = pairEntities<Item>(
      [
        { id: 'p1', name: 'a' },
        { id: 'p2', name: 'b' },
      ],
      [
        { id: 'n1', name: 'b' },
        { id: 'n2', name: 'z' },
      ],
      [item => item.name, () => 'any']
    );

    expect(pairs(pairing)).toEqual([
      ['p2', 'n1'],
      ['p1', 'n2'],
    ]);
  });
});

describe('pairByOverlap', () => {
  it('pairs each saved entity with the current one sharing the most, ties going to the first', () => {
    const pairing = emptyPairing();
    pairByOverlap<Item>(
      pairing,
      [
        { id: 'p1', name: '', members: ['a', 'b'] },
        { id: 'p2', name: '', members: ['c'] },
        { id: 'p3', name: '', members: [] },
      ],
      [
        { id: 'n1', name: '', members: ['a'] },
        { id: 'n2', name: '', members: ['a', 'b'] },
        { id: 'n3', name: '', members: ['c', 'd'] },
      ],
      item => item.members ?? []
    );

    expect(pairs(pairing)).toEqual([
      ['p1', 'n2'],
      ['p2', 'n3'],
    ]);
  });

  it('leaves alone what shares nothing or is paired already', () => {
    const pairing = pairEntities<Item>(
      [{ id: 'kept', name: '', members: ['a'] }],
      [{ id: 'kept', name: '', members: ['a'] }]
    );
    pairByOverlap<Item>(
      pairing,
      [
        { id: 'kept', name: '', members: ['a'] },
        { id: 'p', name: '', members: ['x'] },
      ],
      [
        { id: 'kept', name: '', members: ['a'] },
        { id: 'n', name: '', members: ['y'] },
      ],
      item => item.members ?? []
    );

    expect(pairs(pairing)).toEqual([['kept', 'kept']]);
  });
});

describe('longestCommonIndexes', () => {
  it('keeps the positions of the longest run both orders share, as places in the second', () => {
    expect([...longestCommonIndexes(['a', 'b', 'c'], ['b', 'c', 'a'])]).toEqual(
      [0, 1]
    );
    expect([...longestCommonIndexes(['a', 'b'], ['a', 'b'])]).toEqual([0, 1]);
    expect([...longestCommonIndexes([], ['a'])]).toEqual([]);
    expect([
      ...longestCommonIndexes(['a', 'b', 'c'], ['c', 'b', 'a']),
    ]).toHaveLength(1);
  });
});
