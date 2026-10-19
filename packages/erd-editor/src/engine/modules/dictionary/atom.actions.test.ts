import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  dictionaryEntries,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  addColumnAction,
  changeColumnDomainAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

let store: Store;
let clock: Clock;

beforeEach(() => {
  clock = new Clock();
  store = createStore({ toWidth: text => text.length * 10, clock });
});

const at = (action: AnyAction, version: number): AnyAction => ({
  ...action,
  version,
});

const word = (id: string) => store.state.collections.wordEntities[id];
const term = (id: string) => store.state.collections.termEntities[id];
const domain = (id: string) => store.state.collections.domainEntities[id];
const column = (id: string) => store.state.collections.tableColumnEntities[id];
const registers = (id: string) => store.state.lww[id];

describe('dictionary/atom.actions addDictionary', () => {
  it('lists the row and writes each value it carries through its own register', () => {
    store.dispatchSync(
      at(
        addDictionaryAction({
          kind: 'word',
          id: 'w1',
          values: { name: 'Member', abbreviation: 'MBR' },
        }),
        3
      )
    );

    expect(store.state.doc.wordIds).toEqual(['w1']);
    expect(word('w1')).toEqual({
      id: 'w1',
      name: 'Member',
      abbreviation: 'MBR',
      englishName: '',
      description: '',
      synonyms: '',
      forbiddenWords: '',
    });
    expect(registers('w1')).toEqual([
      'wordEntities',
      3,
      -1,
      { name: 3, abbreviation: 3 },
    ]);
  });

  it('lists each kind in its own list, in the order the rows arrive', () => {
    store.dispatchSync(
      addDictionaryAction({ kind: 'term', id: 't2' }),
      addDictionaryAction({ kind: 'domain', id: 'd1' }),
      addDictionaryAction({ kind: 'term', id: 't1' })
    );

    expect(store.state.doc.termIds).toEqual(['t2', 't1']);
    expect(store.state.doc.domainIds).toEqual(['d1']);
    expect(store.state.doc.wordIds).toEqual([]);
    expect(term('t1').physicalName).toBe('');
    expect(domain('d1').dataType).toBe('');
  });

  it('keeps the values a newer edit wrote before the add arrived', () => {
    store.dispatchSync(
      at(
        updateDictionaryAction({
          kind: 'word',
          id: 'w1',
          values: { abbreviation: 'MEM' },
        }),
        6
      ),
      at(
        addDictionaryAction({
          kind: 'word',
          id: 'w1',
          values: { name: 'Member', abbreviation: 'MBR' },
        }),
        4
      )
    );

    expect(store.state.doc.wordIds).toEqual(['w1']);
    expect(word('w1')).toMatchObject({ name: 'Member', abbreviation: 'MEM' });
  });

  it('lists an id once however many adds arrive, keeping the newest add version', () => {
    store.dispatchSync(
      at(addDictionaryAction({ kind: 'term', id: 't1' }), 2),
      at(addDictionaryAction({ kind: 'term', id: 't1' }), 5),
      at(addDictionaryAction({ kind: 'term', id: 't1' }), 4)
    );

    expect(store.state.doc.termIds).toEqual(['t1']);
    expect(registers('t1')[1]).toBe(5);
  });

  it('lists no row a newer remove took out, whatever order the two arrive in', () => {
    store.dispatchSync(
      at(removeDictionaryAction({ kind: 'term', id: 't1' }), 7),
      at(
        addDictionaryAction({
          kind: 'term',
          id: 't1',
          values: { name: 'Member number' },
        }),
        5
      )
    );

    expect(store.state.doc.termIds).toEqual([]);
    expect(term('t1').name).toBe('Member number');
  });

  it('takes the clock version when the action carries none', () => {
    clock.merge(9);

    store.dispatchSync(
      addDictionaryAction({ kind: 'domain', id: 'd1', values: { name: 'N' } })
    );

    expect(registers('d1')).toEqual(['domainEntities', 9, -1, { name: 9 }]);
  });

  it('passes over a field no row holds, a value that is no string and a kind this release does not know', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: {
          name: 'Amount',
          dataType: 15,
          physicalName: 'AMT',
        } as never,
      }),
      addDictionaryAction({ kind: 'glossary', id: 'g1' } as never),
      updateDictionaryAction({
        kind: 'glossary',
        id: 'g1',
        values: { name: 'x' },
      } as never),
      removeDictionaryAction({ kind: 'glossary', id: 'd1' } as never)
    );

    expect(domain('d1')).toEqual({
      id: 'd1',
      name: 'Amount',
      category: '',
      dataType: '',
      description: '',
    });
    expect(registers('d1')[3]).toEqual({ name: 0 });
    expect(store.state.doc.domainIds).toEqual(['d1']);
    expect(registers('g1')).toBeUndefined();
  });
});

describe('dictionary/atom.actions updateDictionary', () => {
  it('writes each value through its own register and leaves the others', () => {
    store.dispatchSync(
      at(
        addDictionaryAction({
          kind: 'term',
          id: 't1',
          values: { name: 'Member number', physicalName: 'MBR_NO' },
        }),
        1
      ),
      at(
        updateDictionaryAction({
          kind: 'term',
          id: 't1',
          values: { physicalName: 'MEMBER_NO', domainId: 'd1' },
        }),
        2
      )
    );

    expect(term('t1')).toMatchObject({
      name: 'Member number',
      physicalName: 'MEMBER_NO',
      domainId: 'd1',
    });
    expect(registers('t1')[3]).toEqual({
      name: 1,
      physicalName: 2,
      domainId: 2,
    });
  });

  it('keeps the newer value of a field whatever order two edits arrive in', () => {
    const edit = (id: string, abbreviation: string, version: number) =>
      at(
        updateDictionaryAction({ kind: 'word', id, values: { abbreviation } }),
        version
      );

    store.dispatchSync(
      edit('w1', 'NEW', 8),
      edit('w1', 'OLD', 5),
      edit('w2', 'OLD', 5),
      edit('w2', 'NEW', 8)
    );

    expect(word('w1').abbreviation).toBe('NEW');
    expect(word('w2').abbreviation).toBe('NEW');
  });

  it('writes into a row that is not listed without listing it', () => {
    store.dispatchSync(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: 'Member' },
      })
    );

    expect(word('w1').name).toBe('Member');
    expect(store.state.doc.wordIds).toEqual([]);
  });
});

describe('dictionary/atom.actions removeDictionary', () => {
  it('unlists the row and keeps its values', () => {
    store.dispatchSync(
      addDictionaryAction({ kind: 'word', id: 'w1', values: { name: 'A' } }),
      addDictionaryAction({ kind: 'word', id: 'w2', values: { name: 'B' } }),
      addDictionaryAction({ kind: 'word', id: 'w3', values: { name: 'C' } })
    );

    store.dispatchSync(
      at(removeDictionaryAction({ kind: 'word', id: 'w2' }), 4)
    );

    expect(store.state.doc.wordIds).toEqual(['w1', 'w3']);
    expect(word('w2').name).toBe('B');
    expect(registers('w2')[2]).toBe(4);
  });

  it('leaves a row a newer add listed, and a row never listed', () => {
    store.dispatchSync(
      at(addDictionaryAction({ kind: 'term', id: 't1' }), 6),
      at(removeDictionaryAction({ kind: 'term', id: 't1' }), 3),
      at(removeDictionaryAction({ kind: 'term', id: 'ghost' }), 3)
    );

    expect(store.state.doc.termIds).toEqual(['t1']);
    expect(registers('ghost')).toEqual(['termEntities', -1, 3, {}]);
  });

  it('lists a row again at the end when an add newer than its remove arrives', () => {
    store.dispatchSync(
      addDictionaryAction({ kind: 'word', id: 'w1', values: { name: 'A' } }),
      addDictionaryAction({ kind: 'word', id: 'w2', values: { name: 'B' } })
    );
    store.dispatchSync(
      at(removeDictionaryAction({ kind: 'word', id: 'w1' }), 5)
    );

    store.dispatchSync(at(addDictionaryAction({ kind: 'word', id: 'w1' }), 6));

    expect(store.state.doc.wordIds).toEqual(['w2', 'w1']);
    expect(word('w1').name).toBe('A');
  });
});

describe('dictionary/atom.actions domain cells', () => {
  const linkColumn = (id: string, domainId: string) =>
    store.dispatchSync(
      addColumnAction({ id, tableId: 't1' }),
      changeColumnDomainAction({ id, tableId: 't1', value: domainId })
    );

  it('measures every column linking a domain when the domain is renamed', () => {
    store.dispatchSync(
      addDictionaryAction({ kind: 'domain', id: 'd1', values: { name: 'N' } })
    );
    linkColumn('c1', 'd1');
    linkColumn('c2', 'd1');
    linkColumn('c3', '');
    store.dispatchSync(removeColumnAction({ id: 'c2', tableId: 't1' }));

    store.dispatchSync(
      updateDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'amount_n15_x' },
      })
    );

    expect(column('c1').ui.widthDomain).toBe(120);
    expect(column('c2').ui.widthDomain).toBe(120);
    expect(column('c3').ui.widthDomain).toBe(COLUMN_MIN_WIDTH);
  });

  it('measures no name once the domain is removed, and its name again once listed', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'amount_n15_x' },
      })
    );
    linkColumn('c1', 'd1');
    expect(column('c1').ui.widthDomain).toBe(120);

    store.dispatchSync(
      at(removeDictionaryAction({ kind: 'domain', id: 'd1' }), 5)
    );
    expect(column('c1').domainId).toBe('d1');
    expect(column('c1').ui.widthDomain).toBe(COLUMN_MIN_WIDTH);

    store.dispatchSync(
      at(addDictionaryAction({ kind: 'domain', id: 'd1' }), 6)
    );
    expect(column('c1').ui.widthDomain).toBe(120);
  });

  it('measures a column that linked a domain before the domain arrived', () => {
    linkColumn('c1', 'd1');
    expect(column('c1').ui.widthDomain).toBe(COLUMN_MIN_WIDTH);

    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'amount_n15_x' },
      })
    );

    expect(column('c1').ui.widthDomain).toBe(120);
  });

  it('measures nothing for a rename the register refuses, or an edit of another field', () => {
    store.dispatchSync(
      at(
        addDictionaryAction({
          kind: 'domain',
          id: 'd1',
          values: { name: 'amount_n15_x' },
        }),
        5
      )
    );
    linkColumn('c1', 'd1');
    column('c1').ui.widthDomain = 999;

    store.dispatchSync(
      at(
        updateDictionaryAction({
          kind: 'domain',
          id: 'd1',
          values: { name: 'older' },
        }),
        2
      ),
      updateDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { dataType: 'NUMERIC(15)' },
      }),
      addDictionaryAction({ kind: 'domain', id: 'd1' })
    );

    expect(domain('d1')).toMatchObject({
      name: 'amount_n15_x',
      dataType: 'NUMERIC(15)',
    });
    expect(column('c1').ui.widthDomain).toBe(999);
  });

  it('measures no column for a term or a word', () => {
    linkColumn('c1', 'x1');
    column('c1').ui.widthDomain = 999;

    store.dispatchSync(
      addDictionaryAction({ kind: 'term', id: 'x1', values: { name: 'T' } }),
      removeDictionaryAction({ kind: 'term', id: 'x1' }),
      addDictionaryAction({ kind: 'word', id: 'x1', values: { name: 'W' } })
    );

    expect(column('c1').ui.widthDomain).toBe(999);
  });
});

describe('dictionaryEntries', () => {
  it('reads the kind fields in their order, the string values alone', () => {
    expect(
      dictionaryEntries('word', {
        synonyms: 'Mbr',
        name: 'Member',
        abbreviation: 7,
        id: 'w2',
      })
    ).toEqual([
      ['name', 'Member'],
      ['synonyms', 'Mbr'],
    ]);
  });

  it('reads nothing from a payload with no values object', () => {
    expect(dictionaryEntries('term', undefined)).toEqual([]);
    expect(dictionaryEntries('term', 'name')).toEqual([]);
    expect(dictionaryEntries('term', null)).toEqual([]);
  });
});
