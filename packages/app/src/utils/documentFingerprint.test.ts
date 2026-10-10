import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  CanvasType,
  createPeerStore,
  LockSettingType,
  type PeerStore,
  settingsActions,
  settingsActions$,
  tableActions,
  tableActions$,
  tableGroupActions$,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { toDriveFingerprint, toFingerprint } from '@/utils/documentFingerprint';
import { toWidth } from '@/utils/text';

/** A table with a column, as the engine serializes it. */
function documentValue() {
  const store = createReplicationStore({ toWidth });
  store.setInitialValue('');
  store.dispatchSync([
    {
      type: 'table.add',
      payload: {
        id: 'users',
        ui: { x: 0, y: 0, zIndex: 1, widthName: 60, widthComment: 60 },
      },
    },
    { type: 'column.add', payload: { id: 'users.id', tableId: 'users' } },
  ] as any);
  const value = store.value;
  store.destroy();
  return value;
}

const VALUE = documentValue();

function changed(change: (json: any) => void, value = VALUE) {
  const json = JSON.parse(value);
  change(json);
  return JSON.stringify(json);
}

/** VALUE with orders removed, its column, index and relationship, a removed memo and group. */
const TOMBSTONES = changed(({ doc, collections }) => {
  const { users } = collections.tableEntities;
  collections.tableEntities.orders = { ...users, id: 'orders' };
  collections.tableColumnEntities['orders.id'] = {
    ...collections.tableColumnEntities['users.id'],
    id: 'orders.id',
    tableId: 'orders',
  };
  collections.indexEntities.byOrder = {
    id: 'byOrder',
    tableId: 'orders',
  };
  collections.indexColumnEntities['byOrder.id'] = {
    id: 'byOrder.id',
    indexId: 'byOrder',
  };
  const end = (tableId: string) => ({ tableId, x: 0, y: 0, direction: 1 });
  collections.relationshipEntities.placed = {
    id: 'placed',
    start: end('users'),
    end: end('orders'),
  };
  collections.memoEntities.note = { id: 'note', value: 'x' };
  // A file writes the group fields while a removed group's tombstone is left.
  doc.tableGroupIds = [];
  collections.tableGroupEntities = {
    team: {
      id: 'team',
      name: 'team',
      color: '',
      ui: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
    },
  };
});

/** The same entities, all of them in the document. */
const LIVE = changed(({ doc }) => {
  doc.tableIds.push('orders');
  doc.relationshipIds.push('placed');
  doc.indexIds.push('byOrder');
  doc.memoIds.push('note');
  doc.tableGroupIds.push('team');
}, TOMBSTONES);

const legacyScrollChanges: Array<[string, (json: any) => void]> = [
  ['scrollTop', json => (json.settings.scrollTop += 10)],
  ['scrollLeft', json => (json.settings.scrollLeft += 10)],
];

const lockableViewChanges: Array<[string, (json: any) => void]> = [
  ['originX', json => (json.settings.originX += 10)],
  ['originY', json => (json.settings.originY -= 10)],
  ['zoomLevel', json => (json.settings.zoomLevel = 0.5)],
  ['canvasType', json => (json.settings.canvasType = 'settings')],
];

const viewChanges = [...legacyScrollChanges, ...lockableViewChanges];

/** VALUE with no lock on, where a new document has every one. */
const UNLOCKED = changed(json => (json.settings.lockSettings = 0));

const derivedChanges: Array<[string, (json: any) => void]> = [
  [
    'a table width',
    json => (json.collections.tableEntities.users.ui.widthName = 999),
  ],
  [
    'a column width',
    json =>
      (json.collections.tableColumnEntities['users.id'].ui.widthDataType = 999),
  ],
  [
    'the foreign key bit',
    json => (json.collections.tableColumnEntities['users.id'].ui.keys |= 2),
  ],
];

const documentChanges: Array<[string, (json: any) => void]> = [
  ['the database', json => (json.settings.database += 1)],
  ['what is shown', json => (json.settings.show ^= 1)],
  ['the column order', json => json.settings.columnOrder.reverse()],
  ['the database name', json => (json.settings.databaseName = 'shop')],
  [
    'a Schema SQL script',
    json =>
      (json.settings.ddlScripts = { before: 'CREATE SCHEMA a;', after: '' }),
  ],
  [
    'a table name',
    json => (json.collections.tableEntities.users.name = 'people'),
  ],
  ['a table position', json => (json.collections.tableEntities.users.ui.x = 1)],
];

describe('toFingerprint', () => {
  it.each(viewChanges)('ignores %s', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it('counts the database name and the document, and no other setting', () => {
    const databaseName = changed(json => (json.settings.databaseName = 'shop'));
    const tableName = changed(
      json => (json.collections.tableEntities.users.name = 'people')
    );
    const database = changed(json => (json.settings.database += 1));

    expect(toFingerprint(databaseName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(tableName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(database)).toBe(toFingerprint(VALUE));
  });

  it('fingerprints a document with no script as it did before the scripts', () => {
    expect(JSON.parse(VALUE).settings).not.toHaveProperty('ddlScripts');
    expect(Object.keys(JSON.parse(toFingerprint(VALUE)))).toEqual([
      'doc',
      'collections',
      'databaseName',
    ]);
  });

  it('counts an edit of either Schema SQL script, the one an agent makes too', () => {
    const peer = createPeerStore({ nickname: 'agent', presence: false });
    peer.setInitialValue(VALUE);
    const opened = toFingerprint(peer.value);

    peer.dispatch(
      [
        settingsActions.changeDDLScriptAction({
          position: 'after',
          value: 'GRANT SELECT ON users TO app;',
        }),
      ],
      { label: 'script' }
    );
    const edited = peer.value;
    peer.destroy();

    expect(opened).toBe(toFingerprint(VALUE));
    expect(toFingerprint(edited)).not.toBe(opened);
    expect(JSON.parse(toFingerprint(edited)).ddlScripts).toEqual({
      before: '',
      after: 'GRANT SELECT ON users TO app;',
    });
  });
});

describe('toDriveFingerprint', () => {
  it.each(viewChanges)('ignores %s while no lock holds it', (_name, change) => {
    expect(toDriveFingerprint(changed(change, UNLOCKED))).toBe(
      toDriveFingerprint(UNLOCKED)
    );
  });

  it.each(legacyScrollChanges)(
    'ignores %s with every lock on',
    (_name, change) => {
      expect(toDriveFingerprint(changed(change))).toBe(
        toDriveFingerprint(VALUE)
      );
    }
  );

  it.each(lockableViewChanges)(
    'tells %s apart while a lock holds it',
    (_name, change) => {
      expect(toDriveFingerprint(changed(change))).not.toBe(
        toDriveFingerprint(VALUE)
      );
    }
  );

  it.each([
    ['viewport', 'originX', 'canvasType'],
    ['canvasType', 'canvasType', 'originX'],
  ] as const)(
    'reads the %s lock alone by the bit the engine saves',
    (lock, held, free) => {
      const change = Object.fromEntries(lockableViewChanges);
      const locked = changed(
        json => (json.settings.lockSettings = LockSettingType[lock])
      );

      expect(toDriveFingerprint(changed(change[held], locked))).not.toBe(
        toDriveFingerprint(locked)
      );
      expect(toDriveFingerprint(changed(change[free], locked))).toBe(
        toDriveFingerprint(locked)
      );
    }
  );

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).toBe(toDriveFingerprint(VALUE));
  });

  it.each(documentChanges)('tells %s apart', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).not.toBe(
      toDriveFingerprint(VALUE)
    );
  });

  it('ignores every view setting at once while no lock holds it', () => {
    const viewed = changed(
      json => viewChanges.forEach(([, change]) => change(json)),
      UNLOCKED
    );
    expect(toDriveFingerprint(viewed)).toBe(toDriveFingerprint(UNLOCKED));
  });

  describe('a view a lock holds, on a replica', () => {
    type Actions = Parameters<PeerStore['dispatch']>[0];

    const { viewport, canvasType } = LockSettingType;
    const moves: Array<[string, number, Actions]> = [
      [
        'viewport',
        viewport,
        [
          settingsActions.scrollToAction({ originX: -800, originY: -400 }),
          settingsActions.changeZoomLevelAction({ value: 0.5 }),
        ],
      ],
      [
        'tab',
        canvasType,
        [
          settingsActions.changeCanvasTypeAction({
            value: CanvasType.schemaSQL,
          }),
        ],
      ],
    ];
    const opened: PeerStore[] = [];

    afterEach(() => opened.splice(0).forEach(store => store.destroy()));

    function open(value: string) {
      const store = createPeerStore({ nickname: 'reader', presence: false });
      store.setInitialValue(value);
      opened.push(store);
      return store;
    }

    const lock = (bits: number, value: boolean) =>
      settingsActions$.changeLockSettingsAction$(bits, value);

    const lockSettingsOf = (value: string) =>
      JSON.parse(value).settings.lockSettings;

    it.each(moves)(
      'tells a locked %s moved by an unlock and a lock again apart',
      (_name, bit, move) => {
        const store = open(VALUE);
        const base = toDriveFingerprint(store.value);

        store.dispatch(move);
        store.dispatch([lock(bit, false)]);
        store.dispatch([lock(bit, true)]);

        expect(lockSettingsOf(store.value)).toBe(lockSettingsOf(VALUE));
        expect(toDriveFingerprint(store.value)).not.toBe(base);
      }
    );

    it.each(moves)(
      'ignores the %s moved while locked, which the value holds where it was locked',
      (_name, _bit, move) => {
        const store = open(VALUE);
        const base = toDriveFingerprint(store.value);

        store.dispatch(move);

        expect(toDriveFingerprint(store.value)).toBe(base);
      }
    );

    it.each(moves)(
      'ignores the %s moved while unlocked, which the value holds as it moves',
      (_name, bit, move) => {
        const store = open(VALUE);
        store.dispatch([lock(bit, false)]);
        const before = store.value;

        store.dispatch(move);

        expect(store.value).not.toBe(before);
        expect(toDriveFingerprint(store.value)).toBe(
          toDriveFingerprint(before)
        );
      }
    );

    it('opens a file saved before the locks at one fingerprint no view move changes', () => {
      const preLock = changed(({ settings }) => {
        delete settings.lockSettings;
        Object.assign(settings, {
          ignoreSaveSettings: 0,
          originX: -500,
          originY: -300,
          zoomLevel: 0.7,
          canvasType: CanvasType.schemaSQL,
        });
      });
      const here = open(preLock);
      const there = open(preLock);
      const base = toDriveFingerprint(here.value);

      expect(toDriveFingerprint(there.value)).toBe(base);
      here.dispatch(moves.flatMap(([, , move]) => move));

      expect(lockSettingsOf(here.value)).toBe(lockSettingsOf(VALUE));
      expect(toDriveFingerprint(here.value)).toBe(base);
    });
  });

  describe('what no longer hangs off the document', () => {
    it('leaves out a removed table, memo and table group and what belonged to the table', () => {
      expect(JSON.parse(VALUE).doc).not.toHaveProperty('tableGroupIds');
      expect(toDriveFingerprint(TOMBSTONES)).toBe(toDriveFingerprint(VALUE));
    });

    it('leaves out a removed table group beside one the document holds', () => {
      const beside = changed(({ collections }) => {
        const { team } = collections.tableGroupEntities;
        collections.tableGroupEntities.gone = { ...team, id: 'gone' };
      }, LIVE);

      expect(toDriveFingerprint(beside)).toBe(toDriveFingerprint(LIVE));
    });

    it('leaves out a relationship and an index the document still lists on a removed table', () => {
      const dangling = changed(({ doc }) => {
        doc.relationshipIds.push('placed', 'gone');
        doc.indexIds.push('byOrder', 'gone');
      }, TOMBSTONES);

      expect(toDriveFingerprint(dangling)).toBe(toDriveFingerprint(VALUE));
    });

    it.each([
      ['relationship', 'relationshipIds', 'relationshipEntities', 'placed'],
      ['index', 'indexIds', 'indexEntities', 'byOrder'],
      ['memo', 'memoIds', 'memoEntities', 'note'],
      ['table group', 'tableGroupIds', 'tableGroupEntities', 'team'],
    ])('tells a %s the document holds apart', (_name, ids, entities, id) => {
      const without = changed(({ doc, collections }) => {
        doc[ids] = doc[ids].filter((kept: string) => kept !== id);
        delete collections[entities][id];
      }, LIVE);

      expect(toDriveFingerprint(without)).not.toBe(toDriveFingerprint(LIVE));
    });

    it('tells a column of an index the document holds apart', () => {
      const without = changed(({ collections }) => {
        delete collections.indexColumnEntities['byOrder.id'];
      }, LIVE);

      expect(toDriveFingerprint(without)).not.toBe(toDriveFingerprint(LIVE));
    });
  });

  describe('across replicas', () => {
    afterEach(() => vi.useRealTimers());

    it('is the same for two replicas of one edit applied a second apart', () => {
      vi.useFakeTimers({ now: Date.UTC(2026, 8, 25) });
      const here = createPeerStore({ nickname: 'here', presence: false });
      const there = createPeerStore({ nickname: 'there', presence: false });
      here.setInitialValue(VALUE);
      there.setInitialValue(VALUE);
      const sent: unknown[][] = [];
      here.subscribe(actions => sent.push(actions));
      there.subscribe(() => {});

      const [id] = here.dispatch([tableActions$.addTableAction$()]).createdIds;
      here.dispatch([tableActions.changeTableNameAction({ id, value: 'x' })]);
      here.flushStreamBuffers();
      // The other tab applies the batches a second later, by its own clock.
      vi.advanceTimersByTime(1000);
      for (const actions of sent) there.receive(actions as any);

      expect(toDriveFingerprint(there.value)).toBe(
        toDriveFingerprint(here.value)
      );
      here.destroy();
      there.destroy();
    });

    const adds: Array<
      [string, string, () => ReturnType<typeof tableActions$.addTableAction$>]
    > = [
      ['tables', 'tableIds', () => tableActions$.addTableAction$()],
      [
        'table groups',
        'tableGroupIds',
        () =>
          tableGroupActions$.addTableGroupAction$({
            x: 2000,
            y: 2000,
            width: 400,
            height: 300,
          }),
      ],
    ];

    it.each(adds)(
      'is the same for two replicas that applied two adds of %s in opposite orders',
      (_name, ids, add) => {
        vi.useFakeTimers({ now: Date.UTC(2026, 8, 25) });
        const here = createPeerStore({ nickname: 'here', presence: false });
        const there = createPeerStore({ nickname: 'there', presence: false });
        here.setInitialValue(VALUE);
        there.setInitialValue(VALUE);
        const fromHere: unknown[][] = [];
        const fromThere: unknown[][] = [];
        here.subscribe(actions => fromHere.push(actions));
        there.subscribe(actions => fromThere.push(actions));

        // Each tab adds one before the other's batch arrives.
        const [mine] = here.dispatch([add()]).createdIds;
        const [theirs] = there.dispatch([add()]).createdIds;
        here.flushStreamBuffers();
        there.flushStreamBuffers();
        vi.advanceTimersByTime(1000);
        for (const actions of fromThere) here.receive(actions as any);
        for (const actions of fromHere) there.receive(actions as any);

        const order = (value: string) =>
          JSON.parse(value).doc[ids].filter((id: string) =>
            [mine, theirs].includes(id)
          );
        expect(order(here.value)).toEqual([mine, theirs]);
        expect(order(there.value)).toEqual([theirs, mine]);
        expect(toDriveFingerprint(there.value)).toBe(
          toDriveFingerprint(here.value)
        );
        here.destroy();
        there.destroy();
      }
    );
  });

  describe('in any order', () => {
    /** LIVE with a second memo, relationship, index and table group, so every list has two. */
    const TWO_OF_EACH = changed(({ doc, collections }) => {
      const copy = (ids: string, entities: string, from: string) => {
        const id = `${from}2`;
        collections[entities][id] = { ...collections[entities][from], id };
        doc[ids].push(id);
      };
      copy('memoIds', 'memoEntities', 'note');
      copy('relationshipIds', 'relationshipEntities', 'placed');
      copy('indexIds', 'indexEntities', 'byOrder');
      copy('tableGroupIds', 'tableGroupEntities', 'team');
    }, LIVE);

    it.each([
      ['tableIds', 'tableEntities'],
      ['memoIds', 'memoEntities'],
      ['relationshipIds', 'relationshipEntities'],
      ['indexIds', 'indexEntities'],
      ['tableGroupIds', 'tableGroupEntities'],
    ])('holds %s and %s to no order', (ids, entities) => {
      const reordered = changed(({ doc, collections }) => {
        doc[ids].reverse();
        collections[entities] = Object.fromEntries(
          Object.entries(collections[entities]).reverse()
        );
      }, TWO_OF_EACH);

      expect(JSON.parse(reordered).doc[ids]).toHaveLength(2);
      expect(toDriveFingerprint(reordered)).toBe(
        toDriveFingerprint(TWO_OF_EACH)
      );
    });

    it('still tells an entity the document gained apart', () => {
      expect(toDriveFingerprint(TWO_OF_EACH)).not.toBe(
        toDriveFingerprint(LIVE)
      );
    });
  });
});
