import { generateOrderKeyBetween, isOrderKey } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { ColumnOption, RelationshipType } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import {
  type DictionaryRowOf,
  orderedDictionaryRows,
} from '@/engine/modules/dictionary/dictionaryIndex';
import { toDomainTypeActions } from '@/engine/modules/dictionary/domainTypes';
import {
  DictionaryRefusalCode,
  toDictionaryImport,
  validateDictionaryValues,
} from '@/engine/modules/dictionary/entryWrites';
import {
  addDictionaryEntryAction$,
  commitDictionaryCellsAction$,
  deriveColumnNameAction$,
  deriveTableNameAction$,
  importDictionaryAction$,
  insertDictionaryEntriesAction$,
  rederiveNamesAction$,
  RederiveScope,
  removeDictionaryEntriesAction$,
  setColumnDomainAction$,
  setColumnLogicalNameAction$,
  setTableLogicalNameAction$,
  sortDictionaryAction$,
  updateDictionaryEntryAction$,
} from '@/engine/modules/dictionary/generator.actions';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeRelationshipDataTypeSyncAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  changeColumnNameDerivedAction,
} from '@/engine/modules/table-column/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { bHas } from '@/utils/bit';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

/** A headless store on a new document, with the seed actions applied. */
function setup(...seed: AnyAction[][]): PeerStore {
  const peer = createPeerStore({ nickname: 'spec', presence: false });
  peers.push(peer);
  peer.setInitialValue('');
  if (seed.length) peer.dispatch(seed.flat());
  return peer;
}

const send = (peer: PeerStore, generator: GeneratorAction) =>
  peer.dispatch([generator]);

const typesOf = (actions: ReadonlyArray<AnyAction>) =>
  actions.map(({ type }) => type);

const table = (id: string, name = id, logicalName = ''): AnyAction[] => [
  addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
  changeTableNameAction({ id, value: name }),
  ...(logicalName
    ? [changeTableLogicalNameAction({ id, value: logicalName })]
    : []),
];

type ColumnSeed = {
  name?: string;
  dataType?: string;
  domainId?: string;
  logicalName?: string;
  derived?: boolean;
};

function column(
  tableId: string,
  id: string,
  {
    name = '',
    dataType = '',
    domainId = '',
    logicalName = '',
    derived,
  }: ColumnSeed = {}
): AnyAction[] {
  const target = { tableId, id };
  return [
    addColumnAction(target),
    changeColumnNameAction({ ...target, value: name }),
    changeColumnDataTypeAction({ ...target, value: dataType }),
    changeColumnDomainAction({ ...target, value: domainId }),
    changeColumnLogicalNameAction({ ...target, value: logicalName }),
    ...(derived
      ? [changeColumnNameDerivedAction({ ...target, value: true })]
      : []),
  ];
}

const relate = (
  id: string,
  start: [tableId: string, columnId: string],
  end: [tableId: string, columnId: string]
) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.OneN,
    start: { tableId: start[0], columnIds: [start[1]] },
    end: { tableId: end[0], columnIds: [end[1]] },
  });

// Seeded rows carry keys in the order they are made, as every row a document
// or a generator lists does.
let seedKey: string | null = null;
const nextSeedKey = () => (seedKey = generateOrderKeyBetween(seedKey, null));

const word = (id: string, name: string, abbreviation: string) =>
  addDictionaryAction({
    kind: 'word',
    id,
    values: { name, abbreviation, order: nextSeedKey() },
  });

const term = (id: string, name: string, physicalName = '', domainId = '') =>
  addDictionaryAction({
    kind: 'term',
    id,
    values: { name, physicalName, domainId, order: nextSeedKey() },
  });

const domain = (id: string, name: string, dataType: string) =>
  addDictionaryAction({
    kind: 'domain',
    id,
    values: { name, dataType, order: nextSeedKey() },
  });

const WORDS = [
  word('w-member', 'Member', 'MBR'),
  word('w-number', 'Number', 'NO'),
  word('w-name', 'Name', 'NM'),
];

/** A sheet's listed rows in the order it shows them. */
const sheetOf = <K extends DictionaryKind>(peer: PeerStore, kind: K) =>
  orderedDictionaryRows(peer.state, kind);

const namesOf = (peer: PeerStore) =>
  sheetOf(peer, 'word').map(({ name }) => name);

const columnOf = (peer: PeerStore, id: string) =>
  peer.state.collections.tableColumnEntities[id];

const tableOf = (peer: PeerStore, id: string) =>
  peer.state.collections.tableEntities[id];

const isDerived = (peer: PeerStore, id: string) =>
  bHas(columnOf(peer, id).options, ColumnOption.nameDerived);

function rowsOf<K extends DictionaryKind>(
  peer: PeerStore,
  kind: K
): Array<DictionaryRowOf[K]> {
  const rows = peer.state.collections[`${kind}Entities`] as Record<
    string,
    DictionaryRowOf[K]
  >;
  return peer.state.doc[`${kind}Ids`].map(id => rows[id]);
}

describe('setColumnLogicalNameAction$', () => {
  it('writes the logical name and the term it names, its physical name, domain and type, in one undo', () => {
    const peer = setup(
      [domain('d-text', 'Short Text', 'VARCHAR(255)')],
      [term('t-member-name', 'Member Name', 'MBR_NM', 'd-text')],
      table('users'),
      column('users', 'c1', { dataType: 'INT' })
    );

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Name')
    );

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(columnOf(peer, 'c1')).toMatchObject({
      logicalName: 'Member Name',
      name: 'MBR_NM',
      domainId: 'd-text',
      dataType: 'VARCHAR(255)',
    });
    expect(isDerived(peer, 'c1')).toBe(true);

    peer.undo();

    expect(columnOf(peer, 'c1')).toMatchObject({
      logicalName: '',
      name: '',
      domainId: '',
      dataType: 'INT',
    });
    expect(isDerived(peer, 'c1')).toBe(false);
  });

  it('composes the name from the words when no term matches, linking no domain', () => {
    const peer = setup(WORDS, table('users'), column('users', 'c1'));

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Number')
    );

    expect(typesOf(report.actions)).toEqual([
      'column.changeLogicalName',
      'column.changeName',
      'column.changeNameDerived',
    ]);
    expect(columnOf(peer, 'c1').name).toBe('MBR_NO');
    expect(columnOf(peer, 'c1').domainId).toBe('');
    expect(isDerived(peer, 'c1')).toBe(true);
  });

  it('derives again over a name the dictionaries derived before', () => {
    const peer = setup(
      WORDS,
      table('users'),
      column('users', 'c1', { name: 'MBR_NO', derived: true })
    );

    send(peer, setColumnLogicalNameAction$('users', 'c1', 'Member Name'));

    expect(columnOf(peer, 'c1').name).toBe('MBR_NM');
    expect(isDerived(peer, 'c1')).toBe(true);
  });

  it('leaves a name typed by hand as it is and writes the logical name alone', () => {
    const peer = setup(
      WORDS,
      table('users'),
      column('users', 'c1', { name: 'mem_no' })
    );

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Number')
    );

    expect(typesOf(report.actions)).toEqual(['column.changeLogicalName']);
    expect(columnOf(peer, 'c1').name).toBe('mem_no');
    expect(isDerived(peer, 'c1')).toBe(false);
  });

  it('keeps the name and its flag when a word of the logical name is not registered', () => {
    const peer = setup(
      WORDS,
      table('users'),
      column('users', 'c1', { name: 'MBR_NO', derived: true })
    );

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Grade')
    );

    expect(typesOf(report.actions)).toEqual(['column.changeLogicalName']);
    expect(columnOf(peer, 'c1').name).toBe('MBR_NO');
    expect(isDerived(peer, 'c1')).toBe(true);
  });

  it('sends nothing, and makes no undo entry, when every value already holds', () => {
    const peer = setup(WORDS, table('users'), column('users', 'c1'));
    send(peer, setColumnLogicalNameAction$('users', 'c1', 'Member Number'));

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Number')
    );

    expect(report.actions).toEqual([]);
    expect(report.batches).toBe(0);
    expect(report.historyEntries).toBe(0);
  });

  it('derives nothing over empty sheets, writing the logical name alone', () => {
    const peer = setup(
      table('users'),
      column('users', 'c1', { dataType: 'INT' })
    );

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Member Number')
    );

    expect(typesOf(report.actions)).toEqual(['column.changeLogicalName']);
    expect(columnOf(peer, 'c1')).toMatchObject({ name: '', dataType: 'INT' });
    expect(isDerived(peer, 'c1')).toBe(false);
  });

  it('composes a term holding no physical name from the words, and links its domain', () => {
    const peer = setup(
      WORDS,
      [domain('d-no', 'Number', 'NUMERIC(10)')],
      [term('t-member-number', 'Member Number', '', 'd-no')],
      table('users'),
      column('users', 'c1')
    );

    send(peer, setColumnLogicalNameAction$('users', 'c1', 'Member Number'));

    expect(columnOf(peer, 'c1')).toMatchObject({
      name: 'MBR_NO',
      domainId: 'd-no',
      dataType: 'NUMERIC(10)',
    });
  });

  it('links the domain of a term that derives no name, leaving the name and its flag', () => {
    const peer = setup(
      [domain('d-no', 'Number', 'NUMERIC(10)')],
      [term('t-grade', 'Grade', '', 'd-no')],
      table('users'),
      column('users', 'c1')
    );

    const report = send(
      peer,
      setColumnLogicalNameAction$('users', 'c1', 'Grade')
    );

    expect(typesOf(report.actions)).toEqual([
      'column.changeLogicalName',
      'column.changeDomain',
      'column.changeDataType',
    ]);
    expect(columnOf(peer, 'c1').name).toBe('');
    expect(isDerived(peer, 'c1')).toBe(false);
  });

  it('spreads the type of the linked domain through the data type sync', () => {
    const peer = setup(
      [domain('d-id', 'Identifier', 'BIGINT')],
      [term('t-member-id', 'Member Id', 'MBR_ID', 'd-id')],
      table('users'),
      column('users', 'pk', { dataType: 'INT' }),
      table('orders'),
      column('orders', 'fk', { name: 'user_id', dataType: 'INT' }),
      [relate('r1', ['users', 'pk'], ['orders', 'fk'])]
    );

    send(peer, setColumnLogicalNameAction$('users', 'pk', 'Member Id'));

    expect(columnOf(peer, 'pk').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'fk').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'fk').domainId).toBe('');
  });

  it('sends nothing for a column the document never held', () => {
    const peer = setup(WORDS);

    expect(
      send(peer, setColumnLogicalNameAction$('users', 'ghost', 'Member'))
        .actions
    ).toEqual([]);
  });
});

describe('deriveColumnNameAction$ and the table derivations', () => {
  it('derives a column from the logical name it holds without writing that name', () => {
    const peer = setup(
      WORDS,
      table('users'),
      column('users', 'c1', { logicalName: 'Member Name' })
    );

    const report = send(peer, deriveColumnNameAction$('users', 'c1'));

    expect(typesOf(report.actions)).toEqual([
      'column.changeName',
      'column.changeNameDerived',
    ]);
    expect(columnOf(peer, 'c1').name).toBe('MBR_NM');
  });

  it('writes a table logical name and derives its name, linking no domain', () => {
    const peer = setup(
      [domain('d-text', 'Short Text', 'VARCHAR(255)')],
      [term('t-member', 'Member', 'TB_MEMBER', 'd-text')],
      table('t1', '')
    );

    const report = send(peer, setTableLogicalNameAction$('t1', 'Member'));

    expect(report.historyEntries).toBe(1);
    expect(typesOf(report.actions)).toEqual([
      'table.changeLogicalName',
      'table.changeName',
      'table.changeNameDerived',
    ]);
    expect(tableOf(peer, 't1')).toMatchObject({
      logicalName: 'Member',
      name: 'TB_MEMBER',
      nameDerived: true,
    });
  });

  it('derives a table from the logical name it holds, and leaves a typed name', () => {
    const peer = setup(
      WORDS,
      table('t1', '', 'Member Name'),
      table('t2', 'people', 'Member')
    );

    send(peer, deriveTableNameAction$('t1'));
    const report = send(peer, deriveTableNameAction$('t2'));

    expect(tableOf(peer, 't1')).toMatchObject({
      name: 'MBR_NM',
      nameDerived: true,
    });
    expect(report.actions).toEqual([]);
    expect(tableOf(peer, 't2').name).toBe('people');
  });

  it('sends nothing for a table the document never held', () => {
    const peer = setup(WORDS);

    expect(
      send(peer, setTableLogicalNameAction$('ghost', 'Member')).actions
    ).toEqual([]);
    expect(send(peer, deriveTableNameAction$('ghost')).actions).toEqual([]);
  });
});

describe('rederiveNamesAction$', () => {
  function seeded() {
    return setup(
      WORDS,
      [domain('d-text', 'Short Text', 'VARCHAR(255)')],
      [term('t-member-name', 'Member Name', 'MBR_NM', 'd-text')],
      table('t1', 'members', 'Member'),
      column('t1', 'c1', { name: 'member_name', logicalName: 'Member Name' }),
      column('t1', 'c2', { name: 'note' }),
      table('t2', 'numbers', 'Number'),
      column('t2', 'c3', { name: 'member_no', logicalName: 'Member Number' })
    );
  }

  it('puts one column back under the dictionaries and derives it again', () => {
    const peer = seeded();

    const report = send(
      peer,
      rederiveNamesAction$({
        scope: RederiveScope.column,
        tableId: 't1',
        columnId: 'c1',
      })
    );

    expect(report.historyEntries).toBe(1);
    expect(columnOf(peer, 'c1')).toMatchObject({
      name: 'MBR_NM',
      domainId: 'd-text',
      dataType: 'VARCHAR(255)',
    });
    expect(isDerived(peer, 'c1')).toBe(true);
    expect(tableOf(peer, 't1').name).toBe('members');
  });

  it('derives a table, its name and every column in one dispatch, one undo bringing all back', () => {
    const peer = seeded();

    const report = send(
      peer,
      rederiveNamesAction$({ scope: RederiveScope.table, tableId: 't1' })
    );

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(tableOf(peer, 't1')).toMatchObject({
      name: 'MBR',
      nameDerived: true,
    });
    expect(columnOf(peer, 'c1').name).toBe('MBR_NM');
    expect(columnOf(peer, 'c2').name).toBe('note');
    expect(isDerived(peer, 'c2')).toBe(false);
    expect(columnOf(peer, 'c3').name).toBe('member_no');

    peer.undo();

    expect(tableOf(peer, 't1')).toMatchObject({
      name: 'members',
      nameDerived: false,
    });
    expect(columnOf(peer, 'c1')).toMatchObject({
      name: 'member_name',
      domainId: '',
      dataType: '',
    });
    expect(isDerived(peer, 'c1')).toBe(false);
  });

  it('turns the flag on for a logical name that derives nothing, keeping the name', () => {
    const peer = setup(
      WORDS,
      table('t1'),
      column('t1', 'c1', { name: 'grade', logicalName: 'Grade' })
    );

    const report = send(
      peer,
      rederiveNamesAction$({ scope: RederiveScope.table, tableId: 't1' })
    );

    expect(typesOf(report.actions)).toEqual(['column.changeNameDerived']);
    expect(columnOf(peer, 'c1').name).toBe('grade');
    expect(isDerived(peer, 'c1')).toBe(true);
  });

  it('derives the selected tables alone', () => {
    const peer = seeded();
    peer.dispatch([
      selectAction({ t2: SelectType.table, c1: SelectType.memo }),
    ]);

    send(peer, rederiveNamesAction$({ scope: RederiveScope.selection }));

    expect(tableOf(peer, 't2').name).toBe('NO');
    expect(columnOf(peer, 'c3').name).toBe('MBR_NO');
    expect(tableOf(peer, 't1').name).toBe('members');
  });

  it('derives every table of the document', () => {
    const peer = seeded();

    send(peer, rederiveNamesAction$({ scope: RederiveScope.document }));

    expect(tableOf(peer, 't1').name).toBe('MBR');
    expect(tableOf(peer, 't2').name).toBe('NO');
    expect(columnOf(peer, 'c1').name).toBe('MBR_NM');
    expect(columnOf(peer, 'c3').name).toBe('MBR_NO');
  });

  it('sends nothing for a table or a column the document does not hold', () => {
    const peer = seeded();

    expect(
      send(
        peer,
        rederiveNamesAction$({ scope: RederiveScope.table, tableId: 'ghost' })
      ).actions
    ).toEqual([]);
    expect(
      send(
        peer,
        rederiveNamesAction$({
          scope: RederiveScope.column,
          tableId: 't1',
          columnId: 'ghost',
        })
      ).actions
    ).toEqual([]);
  });
});

describe('setColumnDomainAction$', () => {
  function linked() {
    return setup(
      [domain('d-id', 'Identifier', 'BIGINT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT' }),
      table('orders'),
      column('orders', 'fk', { dataType: 'INT' }),
      [relate('r1', ['users', 'pk'], ['orders', 'fk'])]
    );
  }

  it('links a column and gives it and its foreign key the domain type in one undo', () => {
    const peer = linked();

    const report = send(peer, setColumnDomainAction$('users', 'pk', 'd-id'));

    expect(report.historyEntries).toBe(1);
    expect(typesOf(report.actions)).toEqual([
      'column.changeDomain',
      'column.changeDataType',
      'column.changeDataType',
    ]);
    expect(columnOf(peer, 'pk')).toMatchObject({
      domainId: 'd-id',
      dataType: 'BIGINT',
    });
    expect(columnOf(peer, 'fk').dataType).toBe('BIGINT');

    peer.undo();

    expect(columnOf(peer, 'pk')).toMatchObject({
      domainId: '',
      dataType: 'INT',
    });
    expect(columnOf(peer, 'fk').dataType).toBe('INT');
  });

  it('unlinks alone for none, keeping the type', () => {
    const peer = linked();
    send(peer, setColumnDomainAction$('users', 'pk', 'd-id'));

    const report = send(peer, setColumnDomainAction$('users', 'pk', ''));

    expect(typesOf(report.actions)).toEqual(['column.changeDomain']);
    expect(columnOf(peer, 'pk')).toMatchObject({
      domainId: '',
      dataType: 'BIGINT',
    });
  });

  it('sends nothing for a domain the document does not list, a link already made or an unknown column', () => {
    const peer = linked();
    send(peer, setColumnDomainAction$('users', 'pk', 'd-id'));

    expect(
      send(peer, setColumnDomainAction$('users', 'pk', 'd-id')).actions
    ).toEqual([]);
    expect(
      send(peer, setColumnDomainAction$('orders', 'fk', 'd-gone')).actions
    ).toEqual([]);
    expect(
      send(peer, setColumnDomainAction$('users', 'ghost', 'd-id')).actions
    ).toEqual([]);
  });

  it('leaves the foreign key alone while the data type sync is off', () => {
    const peer = linked();
    peer.dispatch([changeRelationshipDataTypeSyncAction({ value: false })]);

    send(peer, setColumnDomainAction$('users', 'pk', 'd-id'));

    expect(columnOf(peer, 'fk').dataType).toBe('INT');
  });
});

describe('a domain type the dictionaries change', () => {
  function governed() {
    return setup(
      [domain('d-id', 'Identifier', 'INT'), domain('d-code', 'Code', 'INT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT', domainId: 'd-id' }),
      column('users', 'other', { dataType: 'INT', domainId: 'd-id' }),
      table('orders'),
      column('orders', 'fk', { dataType: 'INT' }),
      column('orders', 'code', { dataType: 'INT', domainId: 'd-code' }),
      [
        relate('r1', ['users', 'pk'], ['orders', 'fk']),
        relate('r2', ['users', 'other'], ['orders', 'code']),
      ]
    );
  }

  it('rewrites every linked column and its foreign keys with the update, in one undo', () => {
    const peer = governed();

    const report = send(
      peer,
      updateDictionaryEntryAction$('domain', 'd-id', { dataType: 'BIGINT' })
    );

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(columnOf(peer, 'pk').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'other').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'fk').dataType).toBe('BIGINT');

    peer.undo();

    expect(peer.state.collections.domainEntities['d-id'].dataType).toBe('INT');
    expect(columnOf(peer, 'pk').dataType).toBe('INT');
    expect(columnOf(peer, 'fk').dataType).toBe('INT');
  });

  it('unlinks a foreign key the sync gives a type its own domain does not hold', () => {
    const peer = governed();

    const report = send(
      peer,
      updateDictionaryEntryAction$('domain', 'd-id', { dataType: 'BIGINT' })
    );

    expect(columnOf(peer, 'code')).toMatchObject({
      dataType: 'BIGINT',
      domainId: '',
    });
    expect(
      report.actions.filter(({ type }) => type === 'column.changeDomain')
    ).toEqual([
      expect.objectContaining({
        payload: { tableId: 'orders', id: 'code', value: '' },
      }),
    ]);

    peer.undo();

    expect(columnOf(peer, 'code')).toMatchObject({
      dataType: 'INT',
      domainId: 'd-code',
    });
  });

  it('settles two related domains a commit changes, each column at its own type', () => {
    const peer = setup(
      [domain('d-key', 'Key', 'INT'), domain('d-ref', 'Reference', 'INT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT', domainId: 'd-key' }),
      table('orders'),
      column('orders', 'fk', { dataType: 'INT', domainId: 'd-ref' }),
      [relate('r1', ['users', 'pk'], ['orders', 'fk'])]
    );

    const report = send(
      peer,
      commitDictionaryCellsAction$('domain', [
        { id: 'd-key', values: { dataType: 'BIGINT' } },
        { id: 'd-ref', values: { dataType: 'NUMERIC(20)' } },
      ])
    );

    expect(report.historyEntries).toBe(1);
    expect(columnOf(peer, 'pk')).toMatchObject({
      dataType: 'BIGINT',
      domainId: 'd-key',
    });
    expect(columnOf(peer, 'fk')).toMatchObject({
      dataType: 'NUMERIC(20)',
      domainId: 'd-ref',
    });
    expect(typesOf(report.actions)).not.toContain('column.changeDomain');
  });

  it('gives a serial domain linked to a key and its foreign key its own type on both', () => {
    const peer = setup(
      [domain('d-serial', 'Serial', 'serial')],
      table('orders'),
      column('orders', 'fk', { dataType: 'serial', domainId: 'd-serial' }),
      table('users'),
      column('users', 'pk', { dataType: 'serial', domainId: 'd-serial' }),
      [relate('r1', ['users', 'pk'], ['orders', 'fk'])]
    );

    const report = send(
      peer,
      commitDictionaryCellsAction$('domain', [
        { id: 'd-serial', values: { dataType: 'bigserial' } },
      ])
    );

    expect(columnOf(peer, 'pk').dataType).toBe('bigserial');
    expect(columnOf(peer, 'fk')).toMatchObject({
      dataType: 'bigserial',
      domainId: 'd-serial',
    });
    expect(typesOf(report.actions)).not.toContain('column.changeDomain');
  });

  it('rewrites the linked columns and the foreign keys from a grid commit in one undo', () => {
    const peer = governed();

    const report = send(
      peer,
      commitDictionaryCellsAction$('domain', [
        { id: 'd-id', values: { dataType: 'BIGINT' } },
      ])
    );

    expect(report.historyEntries).toBe(1);
    expect(columnOf(peer, 'pk').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'fk').dataType).toBe('BIGINT');
  });

  it('rewrites the linked columns and the foreign keys from an import in one undo', () => {
    const peer = governed();

    const report = send(
      peer,
      importDictionaryAction$('domain', [
        { name: 'Identifier', dataType: 'BIGINT' },
      ])
    );

    expect(report.historyEntries).toBe(1);
    expect(typesOf(report.actions)).toContain('dictionary.update');
    expect(columnOf(peer, 'pk').dataType).toBe('BIGINT');
    expect(columnOf(peer, 'fk').dataType).toBe('BIGINT');
  });

  it('leaves the columns of a removed table alone, and unlinks a foreign key the sync takes off a removed domain', () => {
    const peer = governed();
    peer.dispatch([
      addTableAction({ id: 'gone', ui: { x: 0, y: 0, zIndex: 1 } }),
      ...column('gone', 'stale', { dataType: 'INT', domainId: 'd-id' }),
    ]);
    peer.dispatch([removeTableAction({ id: 'gone' })]);
    send(peer, removeDictionaryEntriesAction$('domain', ['d-code']));

    send(
      peer,
      updateDictionaryEntryAction$('domain', 'd-id', { dataType: 'BIGINT' })
    );

    expect(columnOf(peer, 'stale').dataType).toBe('INT');
    expect(columnOf(peer, 'code')).toMatchObject({
      dataType: 'BIGINT',
      domainId: '',
    });
  });
});

describe('toDomainTypeActions for a type written directly', () => {
  it('unlinks the column typed and a foreign key it reaches whose domain differs', () => {
    const peer = setup(
      [domain('d-id', 'Identifier', 'INT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT', domainId: 'd-id' }),
      table('orders'),
      column('orders', 'fk', { dataType: 'INT', domainId: 'd-id' }),
      column('orders', 'free', { dataType: 'INT' }),
      [
        relate('r1', ['users', 'pk'], ['orders', 'fk']),
        relate('r2', ['users', 'pk'], ['orders', 'free']),
      ]
    );

    const actions = toDomainTypeActions(peer.state, {
      dataTypes: [{ tableId: 'users', id: 'pk', value: 'BIGINT' }],
    });

    expect(typesOf(actions)).toEqual([
      'column.changeDataType',
      'column.changeDataType',
      'column.changeDataType',
      'column.changeDomain',
      'column.changeDomain',
    ]);
    peer.dispatch(actions);
    expect(columnOf(peer, 'pk')).toMatchObject({
      dataType: 'BIGINT',
      domainId: '',
    });
    expect(columnOf(peer, 'fk')).toMatchObject({
      dataType: 'BIGINT',
      domainId: '',
    });
    expect(columnOf(peer, 'free')).toMatchObject({
      dataType: 'BIGINT',
      domainId: '',
    });
  });

  it('sends no link to a domain the document does not list', () => {
    const peer = setup(
      [domain('d-id', 'Identifier', 'INT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT', domainId: 'd-id' })
    );

    const actions = toDomainTypeActions(peer.state, {
      domainTypes: new Map([['d-id', 'BIGINT']]),
      links: [{ tableId: 'users', id: 'pk', value: 'd-gone' }],
    });

    expect(actions.map(({ type, payload }) => [type, payload.value])).toEqual([
      ['column.changeDataType', 'BIGINT'],
    ]);
  });

  it('keeps the link of a column typed to its own domain type, sending it anyway', () => {
    const peer = setup(
      [domain('d-id', 'Identifier', 'INT')],
      table('users'),
      column('users', 'pk', { dataType: 'INT', domainId: 'd-id' })
    );

    const actions = toDomainTypeActions(peer.state, {
      dataTypes: [{ tableId: 'users', id: 'pk', value: 'INT' }],
    });

    expect(typesOf(actions)).toEqual(['column.changeDataType']);
  });
});

describe('dictionary rows', () => {
  it('adds a row at the end of its sheet, an empty one with no values', () => {
    const peer = setup([word('w1', 'Member', 'MBR')]);

    const named = send(
      peer,
      addDictionaryEntryAction$('word', {
        name: 'Name',
        abbreviation: 'NM',
        englishName: '',
      })
    );
    const empty = send(peer, addDictionaryEntryAction$('word'));

    expect(named.historyEntries).toBe(1);
    expect(named.actions[0].payload.values).toEqual({
      name: 'Name',
      abbreviation: 'NM',
      order: expect.any(String),
    });
    // An empty row carries its key alone, which places it last.
    expect(Object.keys(empty.actions[0].payload.values)).toEqual(['order']);
    expect(rowsOf(peer, 'word').map(row => row.name)).toEqual([
      'Member',
      'Name',
      '',
    ]);
  });

  it('inserts empty rows before or after a row, at the end when it is gone, in one dispatch and one undo', () => {
    const peer = setup();
    send(peer, addDictionaryEntryAction$('word', { name: 'A' }));
    send(peer, addDictionaryEntryAction$('word', { name: 'C' }));
    const [a, c] = sheetOf(peer, 'word');

    const before = send(
      peer,
      insertDictionaryEntriesAction$('word', 2, { id: c.id, place: 'before' })
    );
    expect(before.historyEntries).toBe(1);
    expect(typesOf(before.actions)).toEqual([
      'dictionary.add',
      'dictionary.add',
    ]);
    expect(namesOf(peer)).toEqual(['A', '', '', 'C']);

    send(
      peer,
      insertDictionaryEntriesAction$('word', 1, { id: a.id, place: 'after' })
    );
    expect(namesOf(peer)).toEqual(['A', '', '', '', 'C']);

    send(
      peer,
      insertDictionaryEntriesAction$('word', 1, { id: 'gone', place: 'before' })
    );
    send(peer, insertDictionaryEntriesAction$('word', 1));
    expect(namesOf(peer)).toEqual(['A', '', '', '', 'C', '', '']);
    expect(
      send(peer, insertDictionaryEntriesAction$('word', 0)).actions
    ).toEqual([]);

    peer.undo();
    peer.undo();
    peer.undo();
    peer.undo();
    expect(namesOf(peer)).toEqual(['A', 'C']);
  });

  it('keys again the rows that share the key at the place, so the rows land between them', () => {
    const peer = setup([
      addDictionaryAction({
        kind: 'word',
        id: 'x',
        values: { name: 'X', order: 'a0' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'y',
        values: { name: 'Y', order: 'a0' },
      }),
      addDictionaryAction({ kind: 'word', id: 'z', values: { name: 'Z' } }),
    ]);
    expect(namesOf(peer)).toEqual(['X', 'Y', 'Z']);

    const report = send(
      peer,
      insertDictionaryEntriesAction$('word', 1, { id: 'x', place: 'after' })
    );
    expect(namesOf(peer)).toEqual(['X', '', 'Y', 'Z']);
    expect(
      report.actions
        .filter(({ type }) => type === 'dictionary.update')
        .map(({ payload }) => payload.id)
    ).toEqual(['y']);

    send(
      peer,
      insertDictionaryEntriesAction$('word', 1, { id: 'z', place: 'after' })
    );
    expect(namesOf(peer)).toEqual(['X', '', 'Y', 'Z', '']);
    expect(sheetOf(peer, 'word').every(({ order }) => isOrderKey(order))).toBe(
      true
    );
  });

  it('adds the rows a commit, an import or a single add brings after the last row', () => {
    const peer = setup([
      addDictionaryAction({
        kind: 'word',
        id: 'x',
        values: { name: 'X', order: 'b00' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'y',
        values: { name: 'Y', order: 'a5' },
      }),
    ]);

    send(peer, addDictionaryEntryAction$('word', { name: 'A' }));
    send(
      peer,
      commitDictionaryCellsAction$('word', [
        { values: { name: 'B' } },
        { values: { name: 'C' } },
      ])
    );
    send(
      peer,
      importDictionaryAction$('word', [
        {
          name: 'D',
          abbreviation: '',
          englishName: '',
          description: '',
          synonyms: '',
          forbiddenWords: '',
        },
      ])
    );

    expect(namesOf(peer)).toEqual(['Y', 'X', 'A', 'B', 'C', 'D']);
  });

  it('sorts a sheet by a field for everyone in one dispatch, empty cells last and ties as they stood', () => {
    const peer = setup([
      domain('d-text', 'Text', 'VARCHAR'),
      domain('d-amount', 'Amount', 'NUMERIC'),
      term('t1', 'W10', '', 'd-text'),
      term('t2', 'w2', '', 'd-amount'),
      term('t3', '', '', 'd-amount'),
      term('t4', 'W1', '', ''),
    ]);
    send(peer, insertDictionaryEntriesAction$('term', 0));

    const ascending = send(
      peer,
      sortDictionaryAction$('term', 'name', 'ascending', 'en')
    );
    expect(ascending.historyEntries).toBe(1);
    expect(sheetOf(peer, 'term').map(({ id }) => id)).toEqual([
      't4',
      't2',
      't1',
      't3',
    ]);

    send(peer, sortDictionaryAction$('term', 'name', 'descending', 'en'));
    expect(sheetOf(peer, 'term').map(({ id }) => id)).toEqual([
      't1',
      't2',
      't4',
      't3',
    ]);

    send(peer, sortDictionaryAction$('term', 'domainId', 'ascending', 'en'));
    expect(sheetOf(peer, 'term').map(({ id }) => id)).toEqual([
      't2',
      't3',
      't1',
      't4',
    ]);

    expect(
      send(peer, sortDictionaryAction$('term', 'domainId', 'ascending', 'en'))
        .actions
    ).toEqual([]);
    expect(
      send(peer, sortDictionaryAction$('term', 'order', 'ascending')).actions
    ).toEqual([]);

    peer.undo();
    expect(sheetOf(peer, 'term').map(({ id }) => id)).toEqual([
      't1',
      't2',
      't4',
      't3',
    ]);
  });

  it('lists a removed row again in its place when the removal is undone', () => {
    const peer = setup();
    send(peer, addDictionaryEntryAction$('word', { name: 'A' }));
    send(peer, addDictionaryEntryAction$('word', { name: 'B' }));
    send(peer, addDictionaryEntryAction$('word', { name: 'C' }));
    const [a, b] = sheetOf(peer, 'word');

    send(peer, removeDictionaryEntriesAction$('word', [a.id, b.id]));
    expect(namesOf(peer)).toEqual(['C']);
    peer.undo();
    expect(namesOf(peer)).toEqual(['A', 'B', 'C']);
  });

  it('refuses a name another listed row holds, compared trimmed and composed', () => {
    const peer = setup([word('w1', 'Member', 'MBR'), word('w2', '가', 'GA')]);

    expect(
      send(peer, addDictionaryEntryAction$('word', { name: ' Member ' }))
        .actions
    ).toEqual([]);
    expect(
      send(peer, addDictionaryEntryAction$('word', { name: '가' })).actions
    ).toEqual([]);
    expect(
      send(peer, updateDictionaryEntryAction$('word', 'w2', { name: 'Member' }))
        .actions
    ).toEqual([]);
    expect(
      send(peer, addDictionaryEntryAction$('word', { name: 'member' })).actions
    ).toHaveLength(1);
  });

  it('writes only the fields that change, and nothing for a row it does not list', () => {
    const peer = setup([word('w1', 'Member', 'MBR')]);

    const report = send(
      peer,
      updateDictionaryEntryAction$('word', 'w1', {
        name: 'Member',
        abbreviation: 'MEM',
      })
    );

    expect(report.actions.map(({ payload }) => payload)).toEqual([
      { kind: 'word', id: 'w1', values: { abbreviation: 'MEM' } },
    ]);
    expect(
      send(
        peer,
        updateDictionaryEntryAction$('word', 'w1', { abbreviation: 'MEM' })
      ).actions
    ).toEqual([]);
    expect(
      send(
        peer,
        updateDictionaryEntryAction$('word', 'ghost', { name: 'Ghost' })
      ).actions
    ).toEqual([]);
  });

  it('refuses a term naming a domain the document does not list', () => {
    const peer = setup([domain('d1', 'Text', 'TEXT')], [term('t1', 'Note')]);

    expect(
      send(
        peer,
        updateDictionaryEntryAction$('term', 't1', { domainId: 'd-gone' })
      ).actions
    ).toEqual([]);
    expect(
      send(peer, updateDictionaryEntryAction$('term', 't1', { domainId: 'd1' }))
        .actions
    ).toHaveLength(1);
  });

  it('composes a term physical name from the words when its name is written over none', () => {
    const peer = setup(WORDS, [term('t1', 'Member', 'MEMBER')]);

    send(peer, addDictionaryEntryAction$('term', { name: 'Member Number' }));
    send(
      peer,
      updateDictionaryEntryAction$('term', 't1', { physicalName: '' })
    );

    expect(rowsOf(peer, 'term').map(row => row.physicalName)).toEqual([
      '',
      'MBR_NO',
    ]);
  });

  it('removes each listed row named once from the end back, in one dispatch an undo takes back whole', () => {
    const peer = setup(WORDS);

    const report = send(
      peer,
      removeDictionaryEntriesAction$('word', [
        'w-member',
        'w-name',
        'w-member',
        'ghost',
      ])
    );

    expect(report.historyEntries).toBe(1);
    expect(typesOf(report.actions)).toEqual([
      'dictionary.remove',
      'dictionary.remove',
    ]);
    expect(report.actions.map(({ payload }) => payload.id)).toEqual([
      'w-name',
      'w-member',
    ]);
    expect(peer.state.doc.wordIds).toEqual(['w-number']);
    expect(
      send(peer, removeDictionaryEntriesAction$('word', ['ghost'])).actions
    ).toEqual([]);

    peer.undo();

    expect(peer.state.doc.wordIds).toEqual(['w-number', 'w-member', 'w-name']);
  });

  it('passes over a kind this release does not know', () => {
    const peer = setup(WORDS);
    const kind = 'synonym' as DictionaryKind;

    expect(send(peer, addDictionaryEntryAction$(kind, {})).actions).toEqual([]);
    expect(
      send(peer, removeDictionaryEntriesAction$(kind, ['w-member'])).actions
    ).toEqual([]);
    expect(
      send(peer, importDictionaryAction$(kind, [{ name: 'x' }])).actions
    ).toEqual([]);
  });
});

describe('commitDictionaryCellsAction$', () => {
  it('updates the listed rows and adds the rows past the end in one undo', () => {
    const peer = setup([word('w1', 'Member', 'MBR')]);

    const report = send(
      peer,
      commitDictionaryCellsAction$('word', [
        { id: 'w1', values: { abbreviation: 'MEM' } },
        { values: { name: 'Name', abbreviation: 'NM' } },
        { values: { name: 'Number', abbreviation: 'NO' } },
      ])
    );

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(
      rowsOf(peer, 'word').map(({ name, abbreviation }) => [name, abbreviation])
    ).toEqual([
      ['Member', 'MEM'],
      ['Name', 'NM'],
      ['Number', 'NO'],
    ]);

    peer.undo();

    expect(
      rowsOf(peer, 'word').map(({ name, abbreviation }) => [name, abbreviation])
    ).toEqual([['Member', 'MBR']]);
  });

  it('refuses two equal names in one commit and sends nothing of it', () => {
    const peer = setup([word('w1', 'Member', 'MBR')]);

    const report = send(
      peer,
      commitDictionaryCellsAction$('word', [
        { id: 'w1', values: { abbreviation: 'MEM' } },
        { values: { name: 'Name' } },
        { values: { name: 'Name ' } },
      ])
    );

    expect(report.actions).toEqual([]);
    expect(report.historyEntries).toBe(0);
    expect(peer.state.doc.wordIds).toEqual(['w1']);
    expect(peer.state.collections.wordEntities.w1.abbreviation).toBe('MBR');
  });

  it('lets a commit swap two names, since neither is held once it lands', () => {
    const peer = setup([word('w1', 'Member', 'MBR'), word('w2', 'Name', 'NM')]);

    send(
      peer,
      commitDictionaryCellsAction$('word', [
        { id: 'w1', values: { name: 'Name' } },
        { id: 'w2', values: { name: 'Member' } },
      ])
    );

    expect(rowsOf(peer, 'word').map(row => row.name)).toEqual([
      'Name',
      'Member',
    ]);
  });

  it('composes the empty physical names of the terms it names', () => {
    const peer = setup(WORDS);

    send(
      peer,
      commitDictionaryCellsAction$('term', [
        { values: { name: 'Member Name' } },
        { values: { name: 'Member Number', physicalName: 'MEMBER_NO' } },
        { values: { name: 'Grade' } },
      ])
    );

    expect(rowsOf(peer, 'term').map(row => row.physicalName)).toEqual([
      'MBR_NM',
      'MEMBER_NO',
      '',
    ]);
  });

  it('passes over a row a peer removed meanwhile, writing the rest', () => {
    const peer = setup([word('w1', 'Member', 'MBR'), word('w2', 'Name', 'NM')]);
    send(peer, removeDictionaryEntriesAction$('word', ['w2']));

    const report = send(
      peer,
      commitDictionaryCellsAction$('word', [
        { id: 'w2', values: { abbreviation: 'X' } },
        { id: 'w1', values: { abbreviation: 'MEM' } },
      ])
    );

    expect(report.actions.map(({ payload }) => payload.id)).toEqual(['w1']);
  });
});

describe('validateDictionaryValues', () => {
  it('names each refused row by its position, its name and the text refused', () => {
    const peer = setup(
      [word('w1', 'Member', 'MBR')],
      [domain('d1', 'Text', 'TEXT')],
      [term('t1', 'Note', 'NOTE', 'd1')]
    );

    expect(
      validateDictionaryValues(peer.state, 'word', [
        { values: { name: 'Name' } },
        { values: { name: ' Member' } },
        { values: { name: '' } },
        { values: { name: '' } },
      ])
    ).toEqual([
      {
        code: DictionaryRefusalCode.duplicateName,
        index: 1,
        name: 'Member',
        value: 'Member',
      },
    ]);
    expect(
      validateDictionaryValues(peer.state, 'term', [
        { id: 't1', values: { domainId: 'd1' } },
        { id: 't1', values: { name: 'Note' } },
        { values: { name: 'Body', domainId: 'd-gone' } },
      ])
    ).toEqual([
      {
        code: DictionaryRefusalCode.unknownDomain,
        index: 2,
        name: 'Body',
        value: 'd-gone',
      },
    ]);
  });
});

describe('importDictionaryAction$', () => {
  it('adds the new names and updates the held ones in one dispatch and one undo', () => {
    const peer = setup([word('w1', 'Member', 'MBR')]);

    const report = send(
      peer,
      importDictionaryAction$('word', [
        { name: 'Member', abbreviation: 'MEM', englishName: 'Member' },
        { name: 'Name', abbreviation: 'NM', englishName: '' },
      ])
    );

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(
      report.actions.map(({ type, payload }) => [type, payload.values])
    ).toEqual([
      ['dictionary.update', { abbreviation: 'MEM', englishName: 'Member' }],
      [
        'dictionary.add',
        { name: 'Name', abbreviation: 'NM', order: expect.any(String) },
      ],
    ]);

    peer.undo();

    expect(
      rowsOf(peer, 'word').map(({ name, abbreviation }) => [name, abbreviation])
    ).toEqual([['Member', 'MBR']]);
  });

  it('sends nothing for the same file again, and one update for one field changed', () => {
    const peer = setup();
    const rows = [
      { name: 'Member', abbreviation: 'MBR' },
      { name: 'Name', abbreviation: 'NM' },
    ];
    send(peer, importDictionaryAction$('word', rows));

    const again = send(peer, importDictionaryAction$('word', rows));
    const changed = send(
      peer,
      importDictionaryAction$('word', [
        rows[0],
        { name: 'Name', abbreviation: 'NAM' },
      ])
    );

    expect(again.actions).toEqual([]);
    expect(again.batches).toBe(0);
    expect(again.historyEntries).toBe(0);
    expect(typesOf(changed.actions)).toEqual(['dictionary.update']);
    expect(changed.historyEntries).toBe(1);
  });

  it('folds the rows of one name, the later values in the earlier place', () => {
    const peer = setup();
    const rows = [
      { name: 'Member', abbreviation: 'M1' },
      { name: 'Name', abbreviation: 'NM' },
      { name: ' Member', abbreviation: 'MBR' },
      { name: '', abbreviation: 'none' },
    ];

    expect(toDictionaryImport(peer.state, 'word', rows)).toMatchObject({
      added: 2,
      updated: 0,
      folded: 2,
      unknownDomains: [],
    });

    send(peer, importDictionaryAction$('word', rows));

    expect(
      rowsOf(peer, 'word').map(({ name, abbreviation }) => [name, abbreviation])
    ).toEqual([
      [' Member', 'MBR'],
      ['Name', 'NM'],
    ]);
  });

  it('reads a term domain by name, keeping an unknown one as none and counting it', () => {
    const peer = setup([domain('d1', 'Text', 'TEXT')]);
    const rows = [
      { name: 'Note', physicalName: 'NOTE', domain: 'Text' },
      { name: 'Body', physicalName: 'BODY', domain: 'Long Text' },
      { name: 'Title', physicalName: 'TITLE', domain: ' Long Text ' },
      { name: 'Memo', physicalName: 'MEMO', domain: '' },
    ];

    expect(toDictionaryImport(peer.state, 'term', rows).unknownDomains).toEqual(
      ['Long Text']
    );

    send(peer, importDictionaryAction$('term', rows));

    expect(rowsOf(peer, 'term').map(row => [row.name, row.domainId])).toEqual([
      ['Note', 'd1'],
      ['Body', ''],
      ['Title', ''],
      ['Memo', ''],
    ]);
  });

  it('composes the empty physical names of the terms it brings and holds them on the next import', () => {
    const peer = setup(WORDS);
    const rows = [
      { name: 'Member Name', physicalName: '' },
      { name: 'Grade', physicalName: '' },
    ];

    send(peer, importDictionaryAction$('term', rows));
    const again = send(peer, importDictionaryAction$('term', rows));

    expect(rowsOf(peer, 'term').map(row => row.physicalName)).toEqual([
      'MBR_NM',
      '',
    ]);
    expect(again.actions).toEqual([]);
  });
});
