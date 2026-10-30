import {
  Database,
  dictionaryActions$,
  type DispatchReport,
  editorActions$,
  indexActions,
  indexActions$,
  indexColumnActions$,
  LockSettingType,
  memoActions,
  memoActions$,
  type PeerStore,
  relationshipActions,
  relationshipActions$,
  RelationshipType,
  settingsActions,
  settingsActions$,
  Show,
  tableActions,
  tableActions$,
  tableColumnActions,
  tableColumnActions$,
  tableGroupActions,
  tableGroupActions$,
} from '@dineug/erd-editor/peer.js';

/** The ids a scenario's steps hand on to each other, named by the step that made each. */
export type ScenarioIds = Record<string, string>;

export type ScenarioStep = {
  /** Which of the scenario's peers makes the edit. */
  author: number;
  run: (peer: PeerStore, ids: ScenarioIds) => void;
};

export type Scenario = { module: string; steps: ScenarioStep[] };

const firstId = (report: DispatchReport): string => {
  const [id] = report.createdIds;
  if (id === undefined) throw new Error('the dispatch created nothing');
  return id;
};

const addTable = (peer: PeerStore, name: string): string => {
  const id = firstId(peer.dispatch([tableActions$.addTableAction$()]));
  peer.dispatch([tableActions.changeTableNameAction({ id, value: name })]);
  return id;
};

const addColumn = (peer: PeerStore, tableId: string, name: string): string => {
  const id = firstId(
    peer.dispatch([tableColumnActions$.addColumnAction$(tableId)])
  );
  peer.dispatch([
    tableColumnActions.changeColumnNameAction({ tableId, id, value: name }),
  ]);
  return id;
};

type DocumentJson = {
  doc: { tableIds: string[]; relationshipIds: string[] };
  collections: {
    tableEntities: Record<string, { name: string }>;
  };
};

const documentOf = (peer: PeerStore): DocumentJson => JSON.parse(peer.value);

/** The id of the listed table of that name, which an import or an append made. */
const tableNamed = (peer: PeerStore, name: string): string => {
  const { doc, collections } = documentOf(peer);
  const id = doc.tableIds.find(
    tableId => collections.tableEntities[tableId]?.name === name
  );
  if (id === undefined) throw new Error(`no table named ${name}`);
  return id;
};

/**
 * One scenario per module, each made only of what the public peer entry
 * exports, its edits alternating between two peers. No two peers add at once,
 * so the document lists keep one order everywhere.
 */
export const MODULE_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    module: 'table',
    steps: [
      { author: 0, run: (peer, ids) => (ids.table = addTable(peer, 'users')) },
      {
        author: 1,
        run: (peer, { table }) =>
          peer.dispatch([
            tableActions.changeTableCommentAction({
              id: table,
              value: 'people',
            }),
          ]),
      },
      {
        author: 0,
        run: (peer, { table }) =>
          peer.dispatch([
            tableActions.changeTableColorAction({
              id: table,
              color: '#e5484d',
              prevColor: '',
            }),
          ]),
      },
      {
        author: 1,
        run: (peer, { table }) =>
          peer.dispatch([
            tableActions.moveToTableAction({ id: table, x: 120, y: 80 }),
          ]),
      },
      { author: 0, run: (peer, ids) => (ids.spare = addTable(peer, 'spare')) },
      {
        author: 1,
        run: (peer, { spare }) =>
          peer.dispatch([tableActions$.removeTableAction$(spare)]),
      },
    ],
  },
  {
    module: 'column',
    steps: [
      {
        author: 0,
        run: (peer, ids) => {
          ids.table = addTable(peer, 'orders');
          ids.column = addColumn(peer, ids.table, 'id');
        },
      },
      {
        author: 1,
        run: (peer, { table, column }) =>
          peer.dispatch([
            tableColumnActions.changeColumnDataTypeAction({
              tableId: table,
              id: column,
              value: 'BIGINT',
            }),
          ]),
      },
      {
        author: 0,
        run: (peer, { table, column }) =>
          peer.dispatch([
            tableColumnActions.changeColumnNotNullAction({
              tableId: table,
              id: column,
              value: true,
            }),
          ]),
      },
      {
        author: 1,
        run: (peer, { table, column }) =>
          peer.dispatch([
            tableColumnActions.changeColumnPrimaryKeyAction({
              tableId: table,
              id: column,
              value: true,
            }),
          ]),
      },
      {
        author: 0,
        run: (peer, ids) => (ids.spare = addColumn(peer, ids.table, 'note')),
      },
      {
        author: 1,
        run: (peer, { table, spare }) =>
          peer.dispatch([
            tableColumnActions$.removeColumnAction$(table, [spare]),
          ]),
      },
    ],
  },
  {
    module: 'index',
    steps: [
      {
        author: 0,
        run: (peer, ids) => {
          ids.table = addTable(peer, 'accounts');
          ids.column = addColumn(peer, ids.table, 'email');
        },
      },
      {
        author: 1,
        run: (peer, ids) =>
          (ids.index = firstId(
            peer.dispatch([indexActions$.addIndexAction$(ids.table)])
          )),
      },
      {
        author: 0,
        run: (peer, { index, column }) =>
          peer.dispatch([
            indexColumnActions$.addIndexColumnAction$(index, column),
          ]),
      },
      {
        author: 1,
        run: (peer, { index, table }) =>
          peer.dispatch([
            indexActions.changeIndexNameAction({
              id: index,
              tableId: table,
              value: 'idx_accounts_email',
            }),
          ]),
      },
      {
        author: 0,
        run: (peer, { index }) =>
          peer.dispatch([indexActions$.changeIndexUniqueAction$(index)]),
      },
    ],
  },
  {
    module: 'relationship',
    steps: [
      {
        author: 0,
        run: (peer, ids) => {
          ids.parent = addTable(peer, 'authors');
          ids.key = addColumn(peer, ids.parent, 'id');
          peer.dispatch([
            tableColumnActions.changeColumnPrimaryKeyAction({
              tableId: ids.parent,
              id: ids.key,
              value: true,
            }),
          ]);
          ids.child = addTable(peer, 'books');
        },
      },
      {
        author: 1,
        run: (peer, ids) => {
          peer.dispatch([
            relationshipActions$.addRelationshipAction$(
              ids.parent,
              ids.child,
              RelationshipType.OneN
            ),
          ]);
          const [relationship] = documentOf(peer).doc.relationshipIds;
          if (relationship === undefined) throw new Error('no relationship');
          ids.relationship = relationship;
        },
      },
      {
        author: 0,
        run: (peer, { relationship }) =>
          peer.dispatch([
            relationshipActions.changeRelationshipTypeAction({
              id: relationship,
              value: RelationshipType.ZeroN,
            }),
          ]),
      },
    ],
  },
  {
    module: 'memo',
    steps: [
      {
        author: 0,
        run: (peer, ids) =>
          (ids.memo = firstId(peer.dispatch([memoActions$.addMemoAction$()]))),
      },
      {
        author: 1,
        run: (peer, { memo }) =>
          peer.dispatch([
            memoActions.changeMemoValueAction({ id: memo, value: 'draft' }),
          ]),
      },
      {
        author: 0,
        run: (peer, { memo }) =>
          peer.dispatch([
            memoActions.resizeMemoAction({
              id: memo,
              x: 10,
              y: 20,
              width: 320,
              height: 240,
            }),
          ]),
      },
      {
        author: 1,
        run: (peer, { memo }) =>
          peer.dispatch([
            memoActions.moveToMemoAction({ id: memo, x: 400, y: 60 }),
          ]),
      },
      {
        author: 0,
        run: (peer, { memo }) =>
          peer.dispatch([
            memoActions.changeMemoColorAction({
              id: memo,
              color: '#30a46c',
              prevColor: '',
            }),
          ]),
      },
    ],
  },
  {
    module: 'group',
    steps: [
      {
        author: 0,
        run: (peer, ids) => (ids.table = addTable(peer, 'invoices')),
      },
      {
        author: 1,
        run: (peer, ids) =>
          (ids.group = firstId(
            peer.dispatch([
              tableGroupActions$.addTableGroupAction$(
                { x: 2000, y: 2000, width: 400, height: 300 },
                { name: 'billing' }
              ),
            ])
          )),
      },
      {
        author: 0,
        run: (peer, { table, group }) =>
          peer.dispatch([
            tableGroupActions$.setTableGroupAction$([table], group),
          ]),
      },
      {
        author: 1,
        run: (peer, { group }) =>
          peer.dispatch([
            tableGroupActions.changeTableGroupNameAction({
              id: group,
              value: 'payments',
            }),
          ]),
      },
    ],
  },
  {
    module: 'dictionary',
    steps: [
      {
        author: 0,
        run: (peer, ids) =>
          (ids.word = firstId(
            peer.dispatch([
              dictionaryActions$.addDictionaryEntryAction$('word', {
                name: 'customer',
                abbreviation: 'CUST',
              }),
            ])
          )),
      },
      {
        author: 1,
        run: (peer, { word }) =>
          peer.dispatch([
            dictionaryActions$.updateDictionaryEntryAction$('word', word, {
              englishName: 'customer',
            }),
          ]),
      },
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            dictionaryActions$.addDictionaryEntryAction$('domain', {
              name: 'identifier',
              dataType: 'BIGINT',
            }),
          ]),
      },
    ],
  },
  {
    module: 'settings',
    steps: [
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            settingsActions.changeDatabaseNameAction({ value: 'shop' }),
          ]),
      },
      {
        author: 1,
        run: peer =>
          peer.dispatch([
            settingsActions.changeDatabaseAction({
              value: Database.PostgreSQL,
            }),
          ]),
      },
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            settingsActions.changeShowAction({
              show: Show.columnComment,
              value: false,
            }),
          ]),
      },
      {
        author: 1,
        run: peer =>
          peer.dispatch([
            settingsActions$.changeLockSettingsAction$(
              LockSettingType.unlockNameViewMode,
              true
            ),
          ]),
      },
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            settingsActions.changeNameViewModeAction({
              value: 'logical',
              shared: true,
              editorId: peer.editorId,
            }),
          ]),
      },
    ],
  },
  {
    module: 'import',
    steps: [
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            editorActions$.loadSchemaSQLAction$(
              'CREATE TABLE shops (id INT PRIMARY KEY, name VARCHAR(80));' +
                'CREATE TABLE items (id INT PRIMARY KEY, shop_id INT REFERENCES shops(id));'
            ),
          ]),
      },
      {
        author: 1,
        run: peer =>
          peer.dispatch([
            tableActions.changeTableCommentAction({
              id: tableNamed(peer, 'items'),
              value: 'imported',
            }),
          ]),
      },
    ],
  },
  {
    module: 'append',
    steps: [
      { author: 0, run: peer => addTable(peer, 'base') },
      {
        author: 1,
        run: peer =>
          peer.dispatch([
            editorActions$.appendSchemaAction$(
              'sql',
              'CREATE TABLE extras (id INT PRIMARY KEY);'
            ),
          ]),
      },
      {
        author: 0,
        run: peer =>
          peer.dispatch([
            tableActions.changeTableCommentAction({
              id: tableNamed(peer, 'extras'),
              value: 'appended',
            }),
          ]),
      },
    ],
  },
];

/** The storage form with every document list sorted, for peers that added at once. */
export const sortedValue = (value: string): unknown => {
  const parsed = JSON.parse(value) as { doc: Record<string, unknown> };
  const doc: Record<string, unknown> = {};
  for (const key of Object.keys(parsed.doc)) {
    const list = parsed.doc[key];
    doc[key] = Array.isArray(list) ? [...list].sort() : list;
  }
  return { ...parsed, doc };
};
