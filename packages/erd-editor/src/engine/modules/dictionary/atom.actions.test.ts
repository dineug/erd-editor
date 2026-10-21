import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  dictionaryEntries,
  measureDomainColumns,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import { loadJsonAction } from '@/engine/modules/editor/atom.actions';
import {
  addColumnAction,
  changeColumnDomainAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';
import { textInRange } from '@/utils/validation';

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
      order: '',
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
      order: '',
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

  it("reads each column's link once over a batch of many domains listed and one unlisting them", () => {
    const COLUMNS = 3_000;
    const DOMAINS = 500;
    const plain = createStore(
      { toWidth: text => text.length * 10, clock: new Clock() },
      false
    );
    plain.dispatchSync(
      ...Array.from({ length: COLUMNS }, (_, index) => {
        const target = { id: `c${index}`, tableId: `t${index % 30}` };
        return [
          addColumnAction(target),
          changeColumnDomainAction({
            ...target,
            value: `d${index % DOMAINS}`,
          }),
        ];
      }).flat()
    );

    let reads = 0;
    const columns = plain.state.collections.tableColumnEntities;
    for (const entity of Object.values(columns)) {
      let { domainId } = entity;
      Object.defineProperty(entity, 'domainId', {
        get: () => {
          reads += 1;
          return domainId;
        },
        set: (value: string) => {
          domainId = value;
        },
        enumerable: true,
      });
    }

    plain.dispatchSync(
      ...Array.from({ length: DOMAINS }, (_, index) =>
        addDictionaryAction({
          kind: 'domain',
          id: `d${index}`,
          values: { name: `domain_${index}` },
        })
      )
    );
    expect(columns.c1.ui.widthDomain).toBe(80);
    expect(columns.c2999.ui.widthDomain).toBe(100);

    plain.dispatchSync(
      ...Array.from({ length: DOMAINS }, (_, index) =>
        removeDictionaryAction({
          kind: 'domain',
          id: `d${DOMAINS - 1 - index}`,
        })
      )
    );
    expect(columns.c1.ui.widthDomain).toBe(COLUMN_MIN_WIDTH);
    expect(reads).toBe(COLUMNS);
  });
});

describe('measureDomainColumns over random edits', () => {
  // The measure as it walked every column for each domain, which an import of
  // hundreds of domains into thousands of columns made seconds of reads.
  function measureEveryColumn(
    state: RootState,
    domainId: string,
    toWidth: (text: string) => number
  ) {
    const width = textInRange(toWidth(getLiveDomainName(state, domainId)));
    for (const column of Object.values(state.collections.tableColumnEntities)) {
      if (column.domainId === domainId) column.ui.widthDomain = width;
    }
  }

  const DOMAIN_IDS = ['d0', 'd1', 'd2', 'd3'];
  const LINKS = ['', ...DOMAIN_IDS, 'gone'];
  const NAMES = ['N', 'amount', 'amount_n15_x', ''];
  const COLUMN_IDS = Array.from({ length: 12 }, (_, index) => `c${index}`);

  /** A seeded generator, so a failing seed fails again. */
  function createRng(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  function randomWrite(random: () => number): AnyAction {
    const pick = <T>(list: ReadonlyArray<T>): T =>
      list[Math.floor(random() * list.length)];
    const id = pick(COLUMN_IDS);
    const tableId = `t${COLUMN_IDS.indexOf(id) % 3}`;
    const domain = pick(DOMAIN_IDS);
    const roll = random();

    if (roll < 0.15) return addColumnAction({ id, tableId });
    if (roll < 0.25) return removeColumnAction({ id, tableId });
    if (roll < 0.5) {
      return changeColumnDomainAction({ id, tableId, value: pick(LINKS) });
    }
    if (roll < 0.65) {
      return addDictionaryAction({
        kind: 'domain',
        id: domain,
        ...(random() < 0.5 ? { values: { name: pick(NAMES) } } : {}),
      });
    }
    if (roll < 0.8) {
      return updateDictionaryAction({
        kind: 'domain',
        id: domain,
        values: { name: pick(NAMES) },
      });
    }
    return removeDictionaryAction({ kind: 'domain', id: domain });
  }

  const widths = (state: Pick<RootState, 'collections'>) =>
    Object.fromEntries(
      Object.entries(state.collections.tableColumnEntities).map(
        ([id, column]) => [id, column.ui.widthDomain]
      )
    );

  it.each([
    [20_261_022, false],
    [20_261_023, true],
    [20_261_024, false],
    [20_261_025, true],
  ])(
    'measures the columns a walk of every column measures, after every write and load (seed %i, observable %s)',
    (seed, observable) => {
      const random = createRng(seed);
      const store = createStore(
        { toWidth: text => text.length * 10, clock: new Clock() },
        observable
      );
      const met = new Set<string>();
      let version = 1;

      for (let step = 0; step < 400; step++) {
        if (random() < 0.03) {
          store.dispatchSync(loadJsonAction({ value: toJson(store.state) }));
        } else {
          const count = 1 + Math.floor(random() * 3);
          store.dispatchSync(
            ...Array.from({ length: count }, () =>
              // A peer's write older than what the registers hold, which they refuse.
              at(randomWrite(random), random() < 0.15 ? 1 : ++version)
            )
          );
        }

        const { state } = store;
        for (const domainId of LINKS) {
          // Every cell starts unmeasured, so a column measured wrongly or not at all shows.
          for (const column of Object.values(
            state.collections.tableColumnEntities
          )) {
            column.ui.widthDomain = 0;
          }
          const walked = {
            ...state,
            collections: {
              ...state.collections,
              tableColumnEntities: JSON.parse(
                JSON.stringify(state.collections.tableColumnEntities)
              ),
            },
          };

          measureEveryColumn(walked, domainId, store.context.toWidth);
          measureDomainColumns(state, domainId, store.context);
          expect(widths(state), `step ${step}, ${domainId}`).toEqual(
            widths(walked)
          );

          if (!getLiveDomainName(state, domainId)) continue;
          for (const [id, width] of Object.entries(widths(state))) {
            if (width === 0) continue;
            const { tableId } = state.collections.tableColumnEntities[id];
            const listed =
              state.collections.tableEntities[tableId]?.columnIds.includes(id);
            met.add(listed ? 'listed column' : 'removed column');
          }
        }
      }

      // The run must measure a named domain's live and removed columns, or it proves nothing of them.
      expect([...met].sort()).toEqual(['listed column', 'removed column']);
    }
  );
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
