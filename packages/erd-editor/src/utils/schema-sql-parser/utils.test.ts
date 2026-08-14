import { describe, expect, it } from 'vitest';

import { findByName } from '@/utils/schema-sql-parser/utils';

describe('schema-sql-parser/utils findByName', () => {
  const list = [
    { name: 'users', id: 1 },
    { name: 'Posts', id: 2 },
    { name: 'comments', id: 3 },
  ];

  it('finds an item by exact name', () => {
    expect(findByName(list, 'users')).toBe(list[0]);
    expect(findByName(list, 'comments')).toBe(list[2]);
  });

  it('matches case-insensitively in both directions', () => {
    expect(findByName(list, 'USERS')).toBe(list[0]);
    expect(findByName(list, 'posts')).toBe(list[1]);
    expect(findByName(list, 'PoStS')).toBe(list[1]);
  });

  it('returns null when nothing matches', () => {
    expect(findByName(list, 'unknown')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findByName([], 'users')).toBeNull();
  });

  it('returns the first match when names collide', () => {
    const duplicated = [
      { name: 'dup', tag: 'first' },
      { name: 'DUP', tag: 'second' },
    ];

    expect(findByName(duplicated, 'dup')?.tag).toBe('first');
  });

  it('treats the empty string as a real name', () => {
    const withEmpty = [{ name: '' }, { name: 'a' }];

    expect(findByName(withEmpty, '')).toBe(withEmpty[0]);
    expect(findByName([{ name: 'a' }], '')).toBeNull();
  });

  it('does not trim surrounding whitespace', () => {
    expect(findByName([{ name: ' users ' }], 'users')).toBeNull();
    expect(findByName([{ name: ' users ' }], ' USERS ')).not.toBeNull();
  });
});
