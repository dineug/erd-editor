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

/** A table with a column, in the file form a replica hands out. */
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

const lockableViewChanges: Array<[string, (json: any) => void]> = [
  ['originX', json => (json.settings.originX += 10)],
  ['originY', json => (json.settings.originY -= 10)],
  ['zoomLevel', json => (json.settings.zoomLevel = 0.5)],
  ['canvasType', json => (json.settings.canvasType = 'settings')],
];

/** VALUE with no lock on, where a new document has every one. */
const UNLOCKED = changed(json => (json.settings.lockSettings = 0));

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

const fingerprints = [
  ['toFingerprint', toFingerprint],
  ['toDriveFingerprint', toDriveFingerprint],
] as const;

describe('toFingerprint', () => {
  it.each(lockableViewChanges)('ignores %s', (_name, change) => {
    expect(toFingerprint(changed(change, UNLOCKED))).toBe(
      toFingerprint(UNLOCKED)
    );
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

describe('the file form both fingerprints read', () => {
  const stores: Array<{ destroy: () => void }> = [];

  afterEach(() => stores.splice(0).forEach(store => store.destroy()));

  /** A replica opened on value, measuring text as measure does. */
  function opened(value: string, measure = toWidth) {
    const store = createReplicationStore({ toWidth: measure });
    store.setInitialValue(value);
    stores.push(store);
    return store;
  }

  it('holds no column ui, no width and no removed entity to leave out', () => {
    const { collections } = JSON.parse(VALUE);

    expect(collections.tableColumnEntities['users.id']).not.toHaveProperty(
      'ui'
    );
    expect(Object.keys(collections.tableEntities.users.ui)).toEqual([
      'x',
      'y',
      'color',
    ]);
  });

  it.each(fingerprints)(
    'is the same, with %s, on two machines that measure text apart',
    (_name, fingerprint) => {
      const here = opened(VALUE, text => text.length * 7);
      const there = opened(VALUE, text => text.length * 11);

      expect(fingerprint(there.value)).toBe(fingerprint(here.value));
      expect(fingerprint(here.value)).toBe(fingerprint(VALUE));
    }
  );

  it.each(fingerprints)(
    'is, with %s, what it was before a table, a memo and a table group added and removed again',
    (_name, fingerprint) => {
      const store = opened(VALUE);
      store.dispatchSync([
        {
          type: 'table.add',
          payload: { id: 'orders', ui: { x: 0, y: 0, zIndex: 2 } },
        },
        {
          type: 'memo.add',
          payload: { id: 'note', ui: { x: 0, y: 0, zIndex: 3 } },
        },
        {
          type: 'tableGroup.add',
          payload: {
            id: 'team',
            ui: { x: 0, y: 0, width: 400, height: 300, zIndex: 1 },
          },
        },
      ] as any);
      const added = store.value;
      store.dispatchSync([
        { type: 'table.remove', payload: { id: 'orders' } },
        { type: 'memo.remove', payload: { id: 'note' } },
        { type: 'tableGroup.remove', payload: { id: 'team' } },
      ] as any);

      expect(fingerprint(added)).not.toBe(fingerprint(VALUE));
      expect(fingerprint(store.value)).toBe(fingerprint(VALUE));
      expect(
        JSON.parse(store.runtimeValue).collections.tableEntities
      ).toHaveProperty('orders');
    }
  );

  it.each(fingerprints)(
    'reads, with %s, a value an older release stored, and the file form a replica opens it to as a new one',
    (_name, fingerprint) => {
      const store = opened(VALUE);
      store.dispatchSync([
        {
          type: 'table.add',
          payload: { id: 'orders', ui: { x: 0, y: 0, zIndex: 2 } },
        },
        { type: 'table.remove', payload: { id: 'orders' } },
      ] as any);
      const older = store.runtimeValue;

      expect(() => fingerprint(older)).not.toThrow();
      expect(fingerprint(opened(older).value)).toBe(fingerprint(VALUE));
    }
  );
});

describe('toDriveFingerprint', () => {
  it.each(lockableViewChanges)(
    'ignores %s while no lock holds it',
    (_name, change) => {
      expect(toDriveFingerprint(changed(change, UNLOCKED))).toBe(
        toDriveFingerprint(UNLOCKED)
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

  it.each(documentChanges)('tells %s apart', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).not.toBe(
      toDriveFingerprint(VALUE)
    );
  });

  it('ignores every view setting at once while no lock holds it', () => {
    const viewed = changed(
      json => lockableViewChanges.forEach(([, change]) => change(json)),
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
    const LISTS = [
      'tableIds',
      'relationshipIds',
      'indexIds',
      'memoIds',
      'tableGroupIds',
    ] as const;

    /** VALUE with two more ids in every doc list, as two tabs' adds leave it. */
    const TWO_MORE = changed(({ doc }) => {
      for (const ids of LISTS) {
        doc[ids] = [...(doc[ids] ?? []), `${ids}.a`, `${ids}.b`];
      }
    });

    it.each(LISTS)('holds %s to no order', ids => {
      const reordered = changed(({ doc }) => doc[ids].reverse(), TWO_MORE);

      expect(reordered).not.toBe(TWO_MORE);
      expect(toDriveFingerprint(reordered)).toBe(toDriveFingerprint(TWO_MORE));
    });

    it('still tells an id the document gained apart', () => {
      expect(toDriveFingerprint(TWO_MORE)).not.toBe(toDriveFingerprint(VALUE));
    });
  });
});
