import type { PeerStore } from '@dineug/erd-editor/peer.js';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import {
  createHubPeer,
  createWidePeer,
  wideTableName,
} from '@/__test-utils__/wide';
import { MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import {
  DEFAULT_PAGE_SIZE,
  type DocumentList,
  toDocumentList,
  toEntityDetails,
  toTableNameList,
} from '@/tools/outline';
import { runTool } from '@/tools/run';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

const wide = (n: number, nameLength = 0, indexes = 0) => {
  const peer = createWidePeer(n, nameLength, indexes);
  peers.push(peer);
  return peer;
};

const hub = (n: number) => {
  const peer = createHubPeer(n);
  peers.push(peer);
  return peer;
};

const seeded = () => {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
};

/** The schemas of 2,000 tables the specs share; importing one is slow under coverage. */
let thousands: PeerStore;
let tenants: PeerStore;

beforeAll(() => {
  thousands = createWidePeer(2000);
  tenants = createHubPeer(2000);
}, 120_000);

afterAll(() => {
  thousands.destroy();
  tenants.destroy();
});

const fitsOneRead = (value: unknown) =>
  expect(JSON.stringify(value).length).toBeLessThanOrEqual(MAX_READ_CHARS);

/** Every page of a list, following nextOffset from the start. */
function allPages<T extends { nextOffset?: number }>(
  page: (offset: number) => T
): T[] {
  const pages = [page(0)];
  while (pages.at(-1)!.nextOffset !== undefined) {
    pages.push(page(pages.at(-1)!.nextOffset!));
  }
  return pages;
}

const ids = (entities: Array<{ id: string }>) => entities.map(({ id }) => id);

function refusal(call: () => unknown): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the call was accepted');
}

const SEARCH_HINT =
  ' query finds tables by a word in a table or column name or comment, and namesOnly lists table names alone.';

describe('a page of a large document list', () => {
  it('lists 100 tables a page and says where the next page starts', () => {
    const peer = wide(400);
    const list = toDocumentList(peer.state);

    expect(list).toMatchObject({ tableCount: 400, relationshipCount: 399 });
    expect(list.tables).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(list.nextOffset).toBe(DEFAULT_PAGE_SIZE);
    expect(list.note).toBe(
      `This page lists tables 1 to 100 of 400; for the next page pass offset 100.${SEARCH_HINT}`
    );
    expect(list).not.toHaveProperty('matchCount');
    fitsOneRead(list);
  });

  it('ends a page early where one read is full', () => {
    const peer = wide(200, 300);
    const list = toDocumentList(peer.state);

    expect(list.tables.length).toBeGreaterThan(10);
    expect(list.tables.length).toBeLessThan(DEFAULT_PAGE_SIZE);
    expect(list.nextOffset).toBe(list.tables.length);
    fitsOneRead(list);
  });

  it('lists each relationship with the one of its tables that has fewer, ties going to the later', () => {
    const peer = wide(400);
    const list = toDocumentList(peer.state, { limit: 3 });
    const [t0, t1, t2] = peer.state.doc.tableIds;
    const between = (a: string, b: string) =>
      Object.values(peer.state.collections.relationshipEntities).find(
        ({ start, end }) => start.tableId === a && end.tableId === b
      )!.id;

    expect(list.tables.map(({ name }) => name)).toEqual([
      wideTableName(0),
      wideTableName(1),
      wideTableName(2),
    ]);
    expect(list.nextOffset).toBe(3);
    // wide tables 1 to 3 have three relationships each: 1 to 3 goes to 3, 2 to 4 and 5 to those.
    expect(ids(list.relationships).sort()).toEqual(
      [between(t0, t1), between(t1, t2)].sort()
    );
  });

  it('lists every table once across the pages, in document order', () => {
    const peer = wide(400);
    const pages = allPages(offset =>
      toDocumentList(peer.state, { offset, limit: 150 })
    );

    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flatMap(({ tables }) => ids(tables))).toEqual(
      peer.state.doc.tableIds
    );
    pages.forEach(fitsOneRead);
  });

  /** Every page from the start, each within one read, and what they list together, once each. */
  function wholeList(peer: PeerStore, limit?: number) {
    const pages = allPages(offset =>
      toDocumentList(peer.state, { offset, limit })
    );
    pages.forEach(fitsOneRead);
    const all = (pick: (page: DocumentList) => Array<{ id: string }>) => {
      const listed = pages.flatMap(page => ids(pick(page)));
      expect(new Set(listed).size).toBe(listed.length);
      return listed.sort();
    };
    return {
      pages,
      tables: pages.flatMap(({ tables }) => ids(tables)),
      relationships: all(page => page.relationships),
      indexes: all(page => page.indexes),
    };
  }

  const sorted = (values: string[]) => [...values].sort();

  it.each([undefined, 200, 1000])(
    'lists every relationship of a table 2,000 others refer to exactly once, limit %s',
    limit => {
      const whole = wholeList(tenants, limit);

      expect(whole.tables).toEqual(tenants.state.doc.tableIds);
      expect(whole.relationships).toEqual(
        sorted(tenants.state.doc.relationshipIds)
      );
    }
  );

  it.each([
    ['400 tables with two indexes each', () => wide(400, 0, 2)],
    ['200 tables with long names', () => wide(200, 300)],
  ])('lists every relationship and index exactly once: %s', (_, make) => {
    const peer = make();
    const whole = wholeList(peer);

    expect(whole.pages.length).toBeGreaterThan(1);
    expect(whole.tables).toEqual(peer.state.doc.tableIds);
    expect(whole.relationships).toEqual(sorted(peer.state.doc.relationshipIds));
    expect(whole.indexes).toEqual(sorted(peer.state.doc.indexIds));
  });

  it('brings what fits of a table too large for one read, and says what it left out', () => {
    const peer = hub(400);
    runTool(peer, 'erd_change_table_comment', {
      tableId: peer.state.doc.tableIds[0],
      value: 'hubroot',
    });
    const list = toDocumentList(peer.state, { query: 'hubroot' });

    fitsOneRead(list);
    expect(ids(list.tables)).toEqual([peer.state.doc.tableIds[0]]);
    expect(list.relationships.length).toBeGreaterThan(100);
    expect(list.note).toBe(
      `This page lists tables 1 to 1 of 1 matching the query. Table ${list.tables[0].id} has more relationships than one read holds, so ${400 - list.relationships.length} relationships of it are left out; erd_list without query lists every relationship once.`
    );
    // Unsearched, each child owns its own relationship, so none is left out.
    const whole = wholeList(peer);
    expect(whole.relationships).toEqual(sorted(peer.state.doc.relationshipIds));
  });

  it('names what of a table with too many indexes it left out, by id however long the name', () => {
    const peer = wide(1, 5000, 400);
    const list = toDocumentList(peer.state);

    fitsOneRead(list);
    expect(list.note).toBe(
      `This page lists tables 1 to 1 of 1. Table ${list.tables[0].id} has more indexes than one read holds, so ${400 - list.indexes.length} indexes of it are left out; erd_read sql with its tableIds gives its indexes.`
    );
  });

  it('lists the memos after the tables, so every memo is reached however many there are', () => {
    const peer = seeded();
    for (let i = 0; i < 600; i++) runTool(peer, 'erd_add_memo', {});

    const pages = allPages(offset => toDocumentList(peer.state, { offset }));
    const memos = pages.flatMap(({ memos }) => ids(memos));

    pages.forEach(fitsOneRead);
    expect(pages.length).toBeGreaterThan(1);
    expect(ids(pages[0].tables)).toEqual([SEED.users, SEED.orders, SEED.empty]);
    expect(memos).toEqual(peer.state.doc.memoIds);
    expect(pages[1].note).toMatch(/^This page lists memos \d+ to \d+ of 601/);
  });

  it('lists a table with its indexes, and the memos only in an unsearched list', () => {
    const peer = seeded();
    const pages = allPages(offset =>
      toDocumentList(peer.state, { offset, limit: 1 })
    );

    expect(
      pages.map(({ tables, memos }) => [...ids(tables), ...ids(memos)])
    ).toEqual([[SEED.users], [SEED.orders], [SEED.empty], [SEED.memo]]);
    expect(pages.map(({ indexes }) => ids(indexes))).toEqual([
      [],
      [SEED.index],
      [],
      [],
    ]);
    expect(pages[2].note).toBe(
      `This page lists tables 3 to 3 of 3; for the next page pass offset 3.${SEARCH_HINT}`
    );
    expect(pages[3]).not.toHaveProperty('note');
    expect(toDocumentList(peer.state, { query: 'users' }).memos).toEqual([]);
  });

  it('says so when the offset is past the end', () => {
    const peer = seeded();

    expect(toDocumentList(peer.state, { offset: 9 })).toMatchObject({
      tables: [],
      memos: [],
      note: 'offset 9 is past the end of the 3 tables and 1 memo.',
    });
    expect(toDocumentList(peer.state, { query: 'users', offset: 9 }).note).toBe(
      'offset 9 is past the end of the 1 table matching the query.'
    );
  });

  it('gives no note to a list that is whole', () => {
    const list = toDocumentList(seeded().state);

    expect(list).not.toHaveProperty('note');
    expect(list).not.toHaveProperty('nextOffset');
  });
});

describe('searching the tables', () => {
  it('puts a word in a table name first, then one in its comment, then one in a column', () => {
    const peer = wide(40);
    runTool(peer, 'erd_change_table_comment', {
      tableId: peer.state.doc.tableIds[1],
      value: 'Card payments of an order',
    });

    const list: DocumentList = toDocumentList(peer.state, {
      query: 'PAYMENT',
    });
    const names = list.tables.map(({ name }) => name);
    const byName = Array.from({ length: 40 }, (_, i) =>
      wideTableName(i)
    ).filter(name => name.startsWith('payment_'));
    // The rest hold a payment table's key as a column of their own.
    const byColumn = Array.from({ length: 40 }, (_, i) => i)
      .filter(i => i > 1 && byName.includes(wideTableName(Math.floor(i / 2))))
      .map(i => wideTableName(i))
      .filter(name => !byName.includes(name));

    expect(names).toEqual([...byName, wideTableName(1), ...byColumn]);
    expect(list.matchCount).toBe(names.length);
    expect(list.tableCount).toBe(40);
  });

  it('ranks a table whose name holds a word above one whose comment holds them all', () => {
    const peer = wide(10);
    // customer_0005 has none of the words in its name, but all three in its comment.
    runTool(peer, 'erd_change_table_comment', {
      tableId: peer.state.doc.tableIds[5],
      value: 'order payment shipment ledger',
    });

    const names = toDocumentList(peer.state, {
      query: 'order payment shipment',
    }).tables.map(({ name }) => name);

    expect(names.indexOf(wideTableName(1))).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(wideTableName(1))).toBeLessThan(
      names.indexOf(wideTableName(5))
    );
  });

  it('matches any of several words, in any case, and a column comment too', () => {
    const peer = wide(40);
    const named = (name: string) => /^(shipment|customer)_/.test(name);
    const found = toDocumentList(peer.state, {
      query: 'shipment, CUSTOMER',
      limit: 500,
    }).tables.map(({ name }) => name);
    const byName = found.filter(named);

    expect(byName).toEqual(
      Array.from({ length: 40 }, (_, i) => wideTableName(i)).filter(named)
    );
    expect(found.slice(0, byName.length)).toEqual(byName);
    expect(
      toDocumentList(peer.state, { query: 'charged', limit: 500 }).matchCount
    ).toBe(40);
  });

  it('keeps the query in the note of a later page', () => {
    const list = toDocumentList(thousands.state, { query: 'order', limit: 10 });

    expect(list.note).toBe(
      `This page lists tables 1 to 10 of ${list.matchCount} matching the query; for the next page pass offset 10 with the same query.${SEARCH_HINT}`
    );
  });

  it('says when no table matches, and refuses a query with no word', () => {
    const peer = wide(10);
    const list = toDocumentList(peer.state, { query: 'invoice' });

    expect(list).toMatchObject({ matchCount: 0, tables: [] });
    expect(list.note).toMatch(
      /^No table matches the query\..*, or namesOnly for every table name\.$/
    );
    expect(refusal(() => toDocumentList(peer.state, { query: ' , ' }))).toEqual(
      expect.objectContaining({
        code: ToolErrorCode.invalidArgs,
        message: 'query holds no word to look for',
      })
    );
  });
});

describe('the table names alone', () => {
  it('lists every name of a small schema in one read', () => {
    const peer = seeded();

    expect(toTableNameList(peer.state)).toEqual({
      tableCount: 3,
      tableNames: ['users', 'orders', 'empty'],
    });
  });

  it('lists 2,000 short names in one read', () => {
    const names = toTableNameList(thousands.state);

    expect(names.tableNames).toEqual(
      Array.from({ length: 2000 }, (_, i) => wideTableName(i))
    );
    expect(names).not.toHaveProperty('nextOffset');
    fitsOneRead(names);
  });

  it('pages names too long for one read, each page fitting one', () => {
    const peer = wide(300, 300);
    const pages = allPages(offset => toTableNameList(peer.state, { offset }));

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(({ tableNames }) => tableNames)).toEqual(
      Array.from({ length: 300 }, (_, i) => wideTableName(i, 300))
    );
    expect(pages[0].note).toMatch(
      /^This page lists names 1 to \d+ of 300; for the next page pass offset \d+\.$/
    );
    pages.forEach(fitsOneRead);
  });

  it('ranks the names a query finds, keeps to a limit and says where it ends', () => {
    const peer = wide(40);
    const found = toTableNameList(peer.state, { query: 'order', limit: 2 });

    expect(found.tableNames).toEqual([wideTableName(1), wideTableName(6)]);
    expect(found.matchCount).toBeGreaterThan(2);
    expect(found.nextOffset).toBe(2);
    expect(toTableNameList(peer.state, { query: 'invoice' }).note).toMatch(
      /^No table matches the query\..*try other words\.$/
    );
    expect(toTableNameList(peer.state, { offset: 50 }).note).toBe(
      'offset 50 is past the end of the 40 table names.'
    );
  });
});

describe('getting tables by name', () => {
  it('finds a table by its name in any case, every table so named, and reports the rest', () => {
    const peer = seeded();
    runTool(peer, 'erd_change_table_name', {
      tableId: SEED.empty,
      value: 'Users',
    });

    const details = toEntityDetails(peer.state, {
      tableIds: [SEED.orders],
      tableNames: ['USERS', 'orders', 'gone'],
    });

    expect(ids(details.tables!)).toEqual([SEED.orders, SEED.users, SEED.empty]);
    expect(details.missing).toEqual(['gone']);
  });

  it('does not find a table the document removed by its old name', () => {
    const peer = seeded();
    runTool(peer, 'erd_remove_table', { tableId: SEED.empty });

    expect(toEntityDetails(peer.state, { tableNames: ['empty'] })).toEqual({
      tables: [],
      missing: ['empty'],
    });
  });

  it('returns as many tables as one read holds and lists the rest to ask again', () => {
    const peer = wide(400);
    const details = toEntityDetails(peer.state, {
      tableIds: peer.state.doc.tableIds,
    });

    expect(details.tables!.length).toBeGreaterThan(10);
    expect([...ids(details.tables!), ...details.notReturned!]).toEqual(
      peer.state.doc.tableIds
    );
    expect(details.note).toBe(
      'notReturned lists the ids this answer had no room for; ask for them in another call.'
    );
    fitsOneRead(details);
  });

  it('carries on into the next kind once one read is full, in the order asked', () => {
    const peer = wide(400);
    const relationshipIds = peer.state.doc.relationshipIds.slice(0, 5);
    const details = toEntityDetails(peer.state, {
      tableIds: peer.state.doc.tableIds.slice(0, 200),
      relationshipIds,
    });

    expect(details.relationships).toEqual([]);
    expect(details.notReturned!.slice(-5)).toEqual(relationshipIds);
    fitsOneRead(details);
  });

  it('refuses a call for more entities than one answer can even name', () => {
    const { tableIds } = thousands.state.doc;

    expect(
      refusal(() =>
        toEntityDetails(thousands.state, {
          tableIds,
          tableNames: ['nowhere'],
        })
      )
    ).toEqual(
      expect.objectContaining({
        code: ToolErrorCode.tooLarge,
        message:
          'erd_get was asked for 2001 entities, more than one answer can even name; ask for fewer at a time',
      })
    );
  });

  it('returns the first entity asked for even when it alone is over one read', () => {
    const peer = wide(2, 40_000);
    const details = toEntityDetails(peer.state, {
      tableIds: peer.state.doc.tableIds,
      memoIds: [],
    });

    expect(ids(details.tables!)).toEqual([peer.state.doc.tableIds[0]]);
    expect(details.notReturned).toEqual([peer.state.doc.tableIds[1]]);
    expect(details.memos).toEqual([]);
    expect(
      toEntityDetails(peer.state, { tableIds: [peer.state.doc.tableIds[0]] })
        .note
    ).toBe(
      'This answer is over one read because its one entity is; erd_read sql with tableIds gives a table as DDL, which is shorter.'
    );
  });
});
