import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { pushUndoHistoryMap } from '@/engine/history.actions';
import {
  DictionaryKind,
  DictionaryKindList,
} from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  checkColumn,
  checkDictionaryRow,
  checkTable,
  DictionaryCheck,
  listDictionaryChecks,
  walkDictionaryChecks,
} from '@/engine/modules/dictionary/checks';
import { orderedDictionaryRows } from '@/engine/modules/dictionary/dictionaryIndex';
import { reverseDictionaryListings } from '@/engine/modules/dictionary/history';
import { loadJsonAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  moveColumnAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';

const newStore = (observable: boolean) =>
  createStore({ toWidth: text => text.length, clock: new Clock() }, observable);

/** The checks as a walk holding nothing finds them: every target checked afresh, in the listing's order. */
function freshChecks(state: RootState): DictionaryCheck[] {
  const { doc, collections } = state;
  const checks: DictionaryCheck[] = [];

  for (const kind of DictionaryKindList) {
    for (const row of orderedDictionaryRows(state, kind)) {
      checks.push(...checkDictionaryRow(state, kind, row));
    }
  }
  for (const tableId of doc.tableIds) {
    const table = collections.tableEntities[tableId];
    if (!table) continue;

    checks.push(...checkTable(state, table));
    for (const columnId of table.columnIds) {
      const column = collections.tableColumnEntities[columnId];
      if (column) checks.push(...checkColumn(state, column));
    }
  }

  return checks;
}

const walked = (steps: Iterable<ReadonlyArray<DictionaryCheck>>) =>
  [...steps].flat();

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

const WORDS = ['회원', '번호', '이름', '주소', '가입', '가입일', '일자', 'NO'];
const ABBREVIATIONS = ['MBR', 'NO', 'NM', 'ADDR', 'JOIN', 'JNDT', 'DT', ''];
// Fragments no word holds, separators and a decomposed form, which compose to a word.
const FRAGMENTS = [
  ...WORDS,
  '멤버',
  '넘버',
  '자',
  'X',
  ' ',
  '_',
  '회원'.normalize('NFD'),
];
const ORDERS = ['a0', 'a1', 'a2', 'Zz', ''];
/** Names a term and a logical name share often, so terms match and mismatch. */
const NAMES = [
  '회원번호',
  '회원이름',
  '가입일자',
  '멤버넘버',
  '회원_주소',
  '번호',
  '회원X',
];

const TABLE_IDS = ['t0', 't1', 't2', 't3', 't4'];
const COLUMN_IDS = Array.from({ length: 14 }, (_, index) => `c${index}`);
const ROW_IDS: Record<DictionaryKind, string[]> = {
  word: ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'],
  term: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'],
  domain: ['d0', 'd1', 'd2', 'd3'],
};

type Rng = () => number;

const pick = <T>(rng: Rng, list: ReadonlyArray<T>): T =>
  list[Math.floor(rng() * list.length)];

function textOf(rng: Rng): string {
  if (rng() < 0.6) return pick(rng, NAMES);

  const parts = Array.from({ length: 1 + Math.floor(rng() * 3) }, () =>
    pick(rng, FRAGMENTS)
  );
  return rng() < 0.1 ? ` ${parts.join('')} ` : parts.join('');
}

const physicalOf = (rng: Rng) =>
  pick(rng, ['MBR_NO', 'NO', ' MBR_NO ', 'MBR_NM', 'x', '']);

function rowValues(rng: Rng, kind: DictionaryKind): Record<string, string> {
  const values: Record<string, string> = {};
  if (rng() < 0.7) {
    values.name =
      kind === 'word'
        ? pick(rng, WORDS)
        : kind === 'term'
          ? textOf(rng)
          : pick(rng, ['N10', 'V20', ' N10']);
  }
  if (rng() < 0.2) values.order = pick(rng, ORDERS);

  if (kind === 'word') {
    if (rng() < 0.5) values.abbreviation = pick(rng, ABBREVIATIONS);
    if (rng() < 0.5) values.synonyms = pick(rng, ['멤버', '멤버, 회원', '']);
    if (rng() < 0.3) values.forbiddenWords = pick(rng, ['넘버', '자', '']);
  }
  if (kind === 'term') {
    if (rng() < 0.5) values.physicalName = physicalOf(rng);
    if (rng() < 0.4) values.domainId = pick(rng, [...ROW_IDS.domain, '']);
  }
  if (kind === 'domain' && rng() < 0.3) values.dataType = 'INT';
  return values;
}

const existing = (ids: ReadonlyArray<string>, entities: object) =>
  ids.filter(id => Reflect.has(entities, id));

function tableWrite(rng: Rng, tables: string[]): AnyAction[] {
  const roll = rng();
  if (roll < 0.25 || !tables.length) {
    const id = pick(rng, TABLE_IDS);
    return [addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } })];
  }

  const id = pick(rng, tables);
  if (roll < 0.35) return [removeTableAction({ id })];
  if (roll < 0.65) {
    return [changeTableNameAction({ id, value: physicalOf(rng) })];
  }
  return [changeTableLogicalNameAction({ id, value: textOf(rng) })];
}

function columnWrite(
  rng: Rng,
  state: RootState,
  tables: string[]
): AnyAction[] {
  const { collections } = state;
  const columns = existing(COLUMN_IDS, collections.tableColumnEntities).map(
    id => collections.tableColumnEntities[id]
  );
  const roll = rng();

  if ((roll < 0.2 || !columns.length) && tables.length) {
    const id = pick(rng, COLUMN_IDS);
    const held = collections.tableColumnEntities[id];
    return [
      addColumnAction({ id, tableId: held?.tableId ?? pick(rng, tables) }),
    ];
  }
  if (!columns.length) return [];

  const column = pick(rng, columns);
  const ids = { id: column.id, tableId: column.tableId };
  if (roll < 0.27) return [removeColumnAction(ids)];
  if (roll < 0.34) {
    const siblings = collections.tableEntities[column.tableId]?.columnIds ?? [];
    return siblings.length
      ? [moveColumnAction({ ...ids, targetId: pick(rng, siblings) })]
      : [];
  }
  if (roll < 0.55) {
    return [changeColumnNameAction({ ...ids, value: physicalOf(rng) })];
  }
  if (roll < 0.85) {
    return [changeColumnLogicalNameAction({ ...ids, value: textOf(rng) })];
  }
  const value = pick(rng, [...ROW_IDS.domain, '', 'gone']);
  return [changeColumnDomainAction({ ...ids, value })];
}

function dictionaryWrite(rng: Rng): AnyAction[] {
  const kind = pick(rng, DictionaryKindList);
  const id = pick(rng, ROW_IDS[kind]);
  const roll = rng();

  if (roll < 0.35) {
    return [addDictionaryAction({ kind, id, values: rowValues(rng, kind) })];
  }
  if (roll < 0.85) {
    return [updateDictionaryAction({ kind, id, values: rowValues(rng, kind) })];
  }
  return [removeDictionaryAction({ kind, id })];
}

/** One random write to a table, a column or a dictionary row: the batch it dispatches. */
function randomWrite(rng: Rng, state: RootState): AnyAction[] {
  const tables = existing(TABLE_IDS, state.collections.tableEntities);
  const roll = rng();
  if (roll < 0.25) return tableWrite(rng, tables);
  if (roll < 0.6) return columnWrite(rng, state, tables);
  return dictionaryWrite(rng);
}

/** Sends a batch at the next version, as the editor stamps one, so a later write wins its registers. */
function send(store: Store, actions: AnyAction[]) {
  const { clock } = store.context;
  const version = clock.getNextVersion();
  clock.merge(version);
  store.dispatchSync(...actions.map(action => ({ ...action, version })));
}

/** Sends a batch and keeps its undo, as the editor's history makes it. */
function dispatch(store: Store, history: AnyAction[][], actions: AnyAction[]) {
  const undo: AnyAction[] = [];
  for (const action of actions) {
    pushUndoHistoryMap[action.type]?.(undo, action, store.state);
  }
  reverseDictionaryListings(undo);
  send(store, actions);
  if (undo.length) history.push(undo);
}

/** Every row id listed with values, and the tables with columns, so a run starts on checks of each kind. */
function initialWrites(rng: Rng): AnyAction[] {
  return [
    ...DictionaryKindList.flatMap(kind =>
      ROW_IDS[kind].map(id =>
        addDictionaryAction({ kind, id, values: rowValues(rng, kind) })
      )
    ),
    ...TABLE_IDS.slice(0, 3).flatMap((tableId, table) => [
      addTableAction({ id: tableId, ui: { x: 0, y: 0, zIndex: 1 } }),
      changeTableLogicalNameAction({ id: tableId, value: textOf(rng) }),
      ...COLUMN_IDS.slice(table * 3, table * 3 + 3).flatMap(id => [
        addColumnAction({ id, tableId }),
        changeColumnLogicalNameAction({ id, tableId, value: textOf(rng) }),
        changeColumnDomainAction({
          id,
          tableId,
          value: pick(rng, ROW_IDS.domain),
        }),
      ]),
    ]),
  ];
}

/**
 * Runs random writes, undos, loads and walks dropped or interleaved part way,
 * each followed by the listing and a fresh walk, which must agree on every
 * check and its order.
 */
function runRandom(seed: number, observable: boolean, steps: number) {
  const rng = createRng(seed);
  const store = newStore(observable);
  const history: AnyAction[][] = [];
  const met = new Set<string>();
  send(store, initialWrites(rng));

  for (let step = 0; step < steps; step++) {
    const roll = rng();
    const { state } = store;

    if (roll < 0.06 && history.length) {
      send(store, history.pop()!);
    } else if (roll < 0.08) {
      send(store, [loadJsonAction({ value: toJson(state) })]);
    } else if (roll < 0.1) {
      // The undo of a load that kept the dictionaries hands them over as they stand.
      send(store, [
        loadJsonAction({ value: toJson(state), keepDictionaries: true }),
      ]);
    } else if (roll < 0.14) {
      const dropped = walkDictionaryChecks(state);
      for (let taken = Math.floor(rng() * 20); taken > 0; taken--) {
        if (dropped.next().done) break;
      }
    } else if (roll < 0.18) {
      const walk = walkDictionaryChecks(state);
      const first = [walk.next(), walk.next()].flatMap(({ value }) =>
        value ? [...value] : []
      );
      listDictionaryChecks(state);
      expect([...first, ...walked(walk)], `step ${step}`).toEqual(
        freshChecks(state)
      );
    } else if (roll < 0.22) {
      // A peer's write older than what the registers hold, which they refuse.
      store.dispatchSync(
        ...randomWrite(rng, state).map(action => ({ ...action, version: 1 }))
      );
    } else {
      dispatch(store, history, randomWrite(rng, state));
    }

    const checks = listDictionaryChecks(store.state);
    expect(checks, `step ${step}`).toEqual(freshChecks(store.state));
    checks.forEach(({ code, target }) => met.add(`${target.kind} ${code}`));
  }

  return met;
}

describe('listDictionaryChecks over random edits', () => {
  it.each([
    [20_261_021, false],
    [20_261_022, true],
    [20_261_023, false],
    [20_261_024, true],
  ])(
    "agrees with a fresh walk after every write, a peer's stale one, undo and load (seed %i, observable %s)",
    (seed, observable) => {
      // The run must meet every check on every kind of target it can mark, or it proves nothing of them.
      expect([...runRandom(seed, observable, 600)].sort()).toEqual([
        'column forbiddenWord',
        'column physicalNameMismatch',
        'column synonymWord',
        'column unknownDomain',
        'column unregisteredWord',
        'domain duplicateName',
        'table forbiddenWord',
        'table physicalNameMismatch',
        'table synonymWord',
        'table unregisteredWord',
        'term duplicateName',
        'term forbiddenWord',
        'term synonymWord',
        'term unknownDomain',
        'term unregisteredWord',
        'word duplicateName',
      ]);
    }
  );
});

type Seeded = { store: Store; checks: DictionaryCheck[] };

/** Two tables that each hold checks of their own, beside words and a term. */
function seeded(): Seeded {
  const store = newStore(true);
  send(store, [
    addDictionaryAction({
      kind: 'word',
      id: 'w1',
      values: { name: '회원', abbreviation: 'MBR', synonyms: '멤버' },
    }),
    addDictionaryAction({
      kind: 'word',
      id: 'w2',
      values: { name: '번호', abbreviation: 'NO' },
    }),
    addDictionaryAction({
      kind: 'term',
      id: 'm1',
      values: { name: '회원번호', physicalName: 'MBR_NO' },
    }),
    addDictionaryAction({ kind: 'domain', id: 'd1', values: { name: 'N10' } }),
    ...['a', 'b'].flatMap(id => [
      addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
      changeTableNameAction({ id, value: 'x' }),
      changeTableLogicalNameAction({ id, value: '회원번호' }),
      addColumnAction({ id: `${id}1`, tableId: id }),
      changeColumnLogicalNameAction({
        id: `${id}1`,
        tableId: id,
        value: '멤버주소',
      }),
      changeColumnDomainAction({ id: `${id}1`, tableId: id, value: 'd1' }),
    ]),
  ]);
  return { store, checks: listDictionaryChecks(store.state) };
}

const ofTarget = (checks: DictionaryCheck[], id: string) =>
  checks.filter(({ target }) => target.id === id);

describe('the checks a walk holds', () => {
  it('builds again only the table whose name a write changed', () => {
    const { store, checks } = seeded();
    send(store, [changeTableNameAction({ id: 'a', value: 'y' })]);
    const after = listDictionaryChecks(store.state);

    expect(after).toEqual(freshChecks(store.state));
    expect(ofTarget(after, 'a')).not.toBe(ofTarget(checks, 'a'));
    expect(ofTarget(after, 'a')[0]).not.toBe(ofTarget(checks, 'a')[0]);
    for (const id of ['b', 'a1', 'b1']) {
      ofTarget(after, id).forEach((check, index) =>
        expect(check).toBe(ofTarget(checks, id)[index])
      );
    }
  });

  it("builds again the targets a term's write changes, and no other", () => {
    const { store, checks } = seeded();
    send(store, [
      updateDictionaryAction({
        kind: 'term',
        id: 'm1',
        values: { physicalName: 'MEMBER_NO' },
      }),
    ]);
    const after = listDictionaryChecks(store.state);

    expect(after).toEqual(freshChecks(store.state));
    expect(ofTarget(after, 'a')[0].suggestions).toEqual(['MEMBER_NO']);
    // The columns name no term, so their checks are the ones held.
    expect(ofTarget(after, 'a1')[0]).toBe(ofTarget(checks, 'a1')[0]);
  });

  it('reads every name again after a word changes', () => {
    const { store, checks } = seeded();
    send(store, [
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { synonyms: '멤버, 손님' },
      }),
    ]);
    const after = listDictionaryChecks(store.state);

    expect(after).toEqual(freshChecks(store.state));
    expect(ofTarget(after, 'a1')[0]).not.toBe(ofTarget(checks, 'a1')[0]);
  });

  it('forgets a removed column, so its undo builds its checks again', () => {
    const { store, checks } = seeded();
    const history: AnyAction[][] = [];
    dispatch(store, history, [removeColumnAction({ id: 'a1', tableId: 'a' })]);
    expect(ofTarget(listDictionaryChecks(store.state), 'a1')).toEqual([]);

    send(store, history.pop()!);
    const after = listDictionaryChecks(store.state);
    expect(after).toEqual(checks);
    expect(ofTarget(after, 'a1')[0]).not.toBe(ofTarget(checks, 'a1')[0]);
  });

  it('forgets nothing on a walk dropped part way, and holds nothing over a load', () => {
    const { store, checks } = seeded();
    const history: AnyAction[][] = [];
    dispatch(store, history, [removeColumnAction({ id: 'a1', tableId: 'a' })]);
    walkDictionaryChecks(store.state).next();

    send(store, history.pop()!);
    expect(ofTarget(listDictionaryChecks(store.state), 'a1')[0]).toBe(
      ofTarget(checks, 'a1')[0]
    );

    send(store, [loadJsonAction({ value: toJson(store.state) })]);
    const loaded = listDictionaryChecks(store.state);
    expect(loaded).toEqual(checks);
    expect(loaded[0]).not.toBe(checks[0]);
  });

  it('holds what a walk resumed past a write found on the indexes it began on', () => {
    const { store } = seeded();
    send(store, [removeDictionaryAction({ kind: 'term', id: 'm1' })]);
    listDictionaryChecks(store.state);

    // The walk read no term of the name as it began; its rest runs past one.
    const walk = walkDictionaryChecks(store.state);
    walk.next();
    send(store, [
      addDictionaryAction({
        kind: 'term',
        id: 'm2',
        values: { name: '회원번호', physicalName: 'MBR_NO' },
      }),
      changeTableNameAction({ id: 'a', value: 'y' }),
    ]);
    while (!walk.next().done);

    send(store, [removeDictionaryAction({ kind: 'term', id: 'm2' })]);
    expect(listDictionaryChecks(store.state)).toEqual(freshChecks(store.state));
  });

  it('checks the domain sheet of a walk resumed past a write on the index it began on', () => {
    const { store } = seeded();
    send(store, [
      updateDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { dataType: 'INT' },
      }),
    ]);

    // The walk began on a domain sheet holding one N10; a second lands before its step.
    const walk = walkDictionaryChecks(store.state);
    walk.next();
    send(store, [
      addDictionaryAction({
        kind: 'domain',
        id: 'd2',
        values: { name: 'N10' },
      }),
    ]);

    expect(
      walked(walk).filter(({ target }) => target.kind === 'domain')
    ).toEqual([]);
    const after = listDictionaryChecks(store.state);
    expect(after).toEqual(freshChecks(store.state));
    expect(
      ['d1', 'd2'].flatMap(id => ofTarget(after, id).map(({ code }) => code))
    ).toEqual(['duplicateName', 'duplicateName']);
  });

  it('walks a sheet, a term, a table or a column a step, the term sheet one step while its indexes stand', () => {
    const { store } = seeded();
    send(store, [
      addDictionaryAction({ kind: 'term', id: 'm2', values: { name: '회원' } }),
    ]);

    // The word sheet, two terms, the domain sheet, then two tables of a column each.
    const steps = [...walkDictionaryChecks(store.state)];
    expect(steps).toHaveLength(8);
    expect(steps.flat()).toEqual(freshChecks(store.state));

    const held = [...walkDictionaryChecks(store.state)];
    expect(held).toHaveLength(7);
    expect(held.flat()).toEqual(steps.flat());
  });
});
