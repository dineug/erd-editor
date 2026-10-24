import Fuse from 'fuse.js';
import { describe, expect, it } from 'vite-plus/test';

import { IME_CHOSEONG, IME_SAYONG } from '@/__test-utils__/hangulSeed';
import {
  Action,
  SEARCH_THRESHOLD,
  searchActions,
} from '@/components/quick-search/documentSearch';

const names = (actions: Action[]) => actions.map(action => action.name);

describe('searchActions', () => {
  const catalog: Action[] = [
    { name: 'New Table' },
    { name: 'New Memo' },
    { name: 'Auto Layout' },
    { name: 'customers', keywords: 'Table' },
  ];

  it('ranks an exact name match first', () => {
    const result = searchActions(catalog, 'New Memo');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('New Memo');
  });

  it('matches case-insensitively', () => {
    expect(names(searchActions(catalog, 'new memo'))).toContain('New Memo');
  });

  it('matches on the keywords field as well as the name', () => {
    const result = searchActions(
      [{ name: 'zzzz', keywords: 'Relationship' }],
      'Relationship'
    );

    expect(names(result)).toEqual(['zzzz']);
  });

  it('returns an empty list when nothing is close enough', () => {
    expect(searchActions(catalog, 'qqqqqqqqqq')).toEqual([]);
  });

  it('returns the matched items themselves, not fuse result wrappers', () => {
    const result = searchActions(catalog, 'customers');

    expect(result[0]).toBe(catalog[3]);
  });

  it('leaves the Table keyword of a table row out, which would fuzz to most words', () => {
    const tables: Action[] = [
      { name: 'users', keywords: 'Table', tableId: 'users' },
      { name: 'orders', keywords: 'Table', tableId: 'orders' },
    ];

    expect(searchActions(tables, 'email')).toEqual([]);
    expect(searchActions(tables, 'Table')).toEqual([]);
    expect(names(searchActions(tables, 'users'))[0]).toBe('users');
    // The same keyword on a row that is no table is still searched.
    expect(
      searchActions([{ name: 'zzzz', keywords: 'Table' }], 'Table')
    ).toHaveLength(1);
  });

  it('never returns more items than it was given', () => {
    expect(searchActions(catalog, 'Table').length).toBeLessThanOrEqual(
      catalog.length
    );
  });
});

describe('searchActions / Hangul', () => {
  const rows = (...list: string[]): Action[] => list.map(name => ({ name }));

  it('leaves a keyword without Hangul to Fuse, its rows and their order, where it drops no holder', () => {
    const catalog: Action[] = [
      ...rows('사용자', 'user사용자', 'users', 'New Memo'),
      { name: 'orders', keywords: 'Table', tableId: 'orders' },
    ];
    const fuse = new Fuse(catalog, {
      keys: [
        'name',
        {
          name: 'keywords',
          getFn: action => (action.tableId ? [] : (action.keywords ?? [])),
        },
      ],
      threshold: SEARCH_THRESHOLD,
    });

    for (const keyword of ['user', 'memo', 'ord', 'qqqq']) {
      expect(searchActions(catalog, keyword)).toEqual(
        fuse.search(keyword).map(result => result.item)
      );
    }
  });

  it('keeps 사용자 at every step a Korean IME hands over, where Fuse drops it', () => {
    const catalog = rows('사용자', '상품', '주문 내역', 'Auto Layout');

    expect(names(searchActions(catalog, 'ㅅ'))).toEqual(['사용자', '상품']);
    for (const step of [...IME_SAYONG, ...IME_CHOSEONG]) {
      expect(names(searchActions(catalog, step))).toContain('사용자');
    }
    expect(names(searchActions(catalog, '사요'))).toEqual(['사용자']);
    expect(names(searchActions(catalog, 'ㅈㅁ'))).toEqual(['주문 내역']);
  });

  it('ranks the rows holding it whole, then from their start, then inside, then what Fuse alone finds', () => {
    const catalog = rows('주문 사용자 목록', '사용쟈', '사용자 설정', '사용자');

    // 사용쟈 fuzzes to the keyword but does not spell it.
    expect(names(searchActions(catalog, '사용자'))).toEqual([
      '사용자',
      '사용자 설정',
      '주문 사용자 목록',
      '사용쟈',
    ]);
  });

  it('breaks a tie by the level order where Fuse finds none of the rows, the same each time', () => {
    const catalog = rows('사용자', '상인', '소원', '주문');

    const first = names(searchActions(catalog, 'ㅅㅇ'));

    expect(first).toEqual(['상인', '소원', '사용자']);
    expect(names(searchActions(catalog, 'ㅅㅇ'))).toEqual(first);
  });

  it('reads the keywords of a command, never the Table of a table row', () => {
    expect(
      names(searchActions([{ name: 'zzzz', keywords: '관계 그리기' }], 'ㄱㄱ'))
    ).toEqual(['zzzz']);
    expect(
      searchActions(
        [{ name: 'orders', keywords: '테이블', tableId: 'orders' }],
        'ㅌㅇㅂ'
      )
    ).toEqual([]);
  });
});
