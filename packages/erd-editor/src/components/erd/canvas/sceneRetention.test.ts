import { describe, expect, it } from 'vite-plus/test';

import {
  createRetentionPool,
  RETAINED_AT_LEAST,
  RETAINED_PER_DRAWN,
} from '@/components/erd/canvas/sceneRetention';

const ids = (...list: string[]) => new Set(list);

describe('the retention pool', () => {
  it('keeps nothing while every table it has seen is still drawn', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });

    expect(pool.retain(ids('a', 'b'), ids('a', 'b'))).toEqual(ids());
    expect(pool.retain(ids('a', 'b'), ids('a', 'b'))).toEqual(ids());
  });

  it('retains a table from the moment it leaves the drawn set', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });

    pool.retain(ids('a', 'b'), ids('a', 'b'));

    expect(pool.retain(ids('b'), ids('a', 'b'))).toEqual(ids('a'));
  });

  it('never retains a table it has not drawn', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });

    expect(pool.retain(ids('a'), ids('a', 'far'))).toEqual(ids());
  });

  it('lets a table back out of the pool once it is drawn again', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });
    const all = ids('a', 'b');

    pool.retain(ids('a', 'b'), all);
    pool.retain(ids('b'), all);

    expect(pool.retain(ids('a', 'b'), all)).toEqual(ids());
  });

  it('drops what left longest ago once past the bound', () => {
    const pool = createRetentionPool({ perDrawn: 1, atLeast: 0 });
    const all = ids('a', 'b', 'c', 'd');

    pool.retain(ids('a'), all);
    pool.retain(ids('b'), all);
    pool.retain(ids('c'), all);

    expect(pool.retain(ids('d'), all)).toEqual(ids('c'));
  });

  it('scales the bound with how much is drawn', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });
    const all = ids('a', 'b', 'c', 'd', 'e', 'f');

    pool.retain(ids('a', 'b', 'c', 'd'), all);

    expect(pool.retain(ids('e', 'f'), all)).toEqual(ids('a', 'b', 'c', 'd'));
    expect(pool.retain(ids('e'), all)).toEqual(ids('d', 'f'));
  });

  it('holds the floor where too little is drawn to carry the pool', () => {
    const pool = createRetentionPool({ perDrawn: 1, atLeast: 3 });
    const all = ids('a', 'b', 'c', 'd');

    pool.retain(ids('a', 'b', 'c', 'd'), all);

    expect(pool.retain(ids(), all)).toEqual(ids('b', 'c', 'd'));
  });

  it('counts a table as newest again each time it leaves', () => {
    const pool = createRetentionPool({ perDrawn: 1, atLeast: 0 });
    const all = ids('a', 'b', 'c');

    pool.retain(ids('a', 'b'), all);
    pool.retain(ids('b'), all);
    pool.retain(ids('a', 'b'), all);
    pool.retain(ids('a'), all);
    pool.retain(ids('c'), all);

    expect(pool.retain(ids('c'), all)).toEqual(ids('a'));
  });

  it('forgets a table the document no longer holds', () => {
    const pool = createRetentionPool({ perDrawn: 2, atLeast: 0 });

    pool.retain(ids('a', 'b'), ids('a', 'b'));
    pool.retain(ids('b'), ids('a', 'b'));

    expect(pool.retain(ids('b'), ids('b'))).toEqual(ids());
  });

  it('defaults to three per drawn table and a floor of sixteen', () => {
    expect(RETAINED_PER_DRAWN).toBe(3);
    expect(RETAINED_AT_LEAST).toBe(16);

    const pool = createRetentionPool();
    const all = new Set(Array.from({ length: 40 }, (_, i) => `t${i}`));

    pool.retain(all, all);

    expect(pool.retain(ids('t0'), all).size).toBe(16);
    expect(pool.retain(new Set(Array.from(all).slice(0, 10)), all).size).toBe(
      16
    );
  });
});
