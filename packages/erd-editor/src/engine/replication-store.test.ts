import { toJson } from '@dineug/erd-editor-schema';
import { type AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createSeedValue,
  createUserStore,
  SEED,
  type SeededStore,
} from '@/__test-utils__/peerSeed';
import {
  CanvasType,
  ColumnUIKey,
  Language,
  LockSettingType,
  NameCase,
  StartRelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  getLWWAction,
  mergeLWWAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { changeMemoColorAction } from '@/engine/modules/memo/atom.actions';
import { changeRelationshipColumnsAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeLockSettingsAction$,
  changeZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { createPeerStore } from '@/engine/peer-store';
import {
  createReplicationStore,
  ReplicationStore,
} from '@/engine/replication-store';
import { createStore } from '@/engine/store';
import { Tag } from '@/engine/tag';

const LOCK_ALL = 63;
const { viewport } = LockSettingType;

const unlock = (lockSettingType: number) =>
  changeLockSettingsAction({ lockSettingType, value: false, values: {} });

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

const stores: ReplicationStore[] = [];
/** The element stores and subscriptions a spec leaves open, closed after it. */
const closers: Array<() => void> = [];

function make(toWidth = (text: string) => text.length * 10): ReplicationStore {
  const store = createReplicationStore({ toWidth });
  stores.push(store);
  return store;
}

function parse(store: ReplicationStore) {
  return JSON.parse(store.value);
}

/** An editor window on the file: its element's stores and the replica saving for it. */
function openWindow(file: string) {
  const user = createUserStore(file);
  const replica = make();
  replica.setInitialValue(file);
  closers.push(user.destroy);

  return {
    user,
    replica,
    receive: (actions: AnyAction[]) => {
      user.sharedStore.dispatchSync(actions);
      replica.dispatchSync(actions);
    },
    savedSettings: () =>
      [toJson(user.rxStore.state), replica.value].map(
        value => JSON.parse(value).settings
      ),
  };
}

/** A batch as a worker receives it: postMessage hands over a copy. */
const copy = (actions: AnyAction[]) => structuredClone(actions);

/** Paints the seed's users table and memo, and sends the stroke at once. */
function paint({ rxStore, sharedStore }: SeededStore, color: string) {
  rxStore.dispatchSync(
    changeTableColorAction({ id: SEED.users, color, prevColor: '' }),
    changeMemoColorAction({ id: SEED.memo, color, prevColor: '' })
  );
  sharedStore.flushStreamBuffers();
}

/** The colours of the users table and the memo, as a store would save them. */
function colours(store: ReplicationStore | SeededStore) {
  const { collections } = JSON.parse(
    'value' in store ? store.value : toJson(store.rxStore.state)
  );
  return [
    collections.tableEntities[SEED.users].ui.color,
    collections.memoEntities[SEED.memo].ui.color,
  ];
}

/** Let the schema GC promise chain settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function createTableJson(id: string) {
  return {
    id,
    name: id,
    comment: '',
    columnIds: [],
    seqColumnIds: [],
    ui: {
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: 60,
      widthComment: 60,
      color: '',
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  closers.splice(0).forEach(close => close());
  while (stores.length) {
    const store = stores.pop();
    try {
      store?.destroy();
    } catch {
      // already destroyed by the test
    }
  }
});

describe('createReplicationStore', () => {
  it('starts from an empty v3 document', () => {
    const store = make();
    const json = parse(store);

    expect(json.version).toBe('3.0.0');
    expect(json.doc.tableIds).toEqual([]);
    expect(json.collections.tableEntities).toEqual({});
    expect(Object.isFrozen(store)).toBe(true);
  });

  it('starts as a new document, every setting locked', () => {
    expect(parse(make()).settings.lockSettings).toBe(LOCK_ALL);
  });

  it('setInitialValue falls back to an empty document for blank input', async () => {
    const store = make();

    store.setInitialValue('   ');
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.lockSettings).toBe(LOCK_ALL);
  });

  it('setInitialValue coerces non-string input to an empty document', async () => {
    const store = make();

    store.setInitialValue(undefined as unknown as string);
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.lockSettings).toBe(LOCK_ALL);
  });

  it.each([
    ['a v3 file without the field', '{"version":"3.0.0"}'],
    ['a v2 file', '{"canvas":{"width":3000}}'],
  ])('setInitialValue locks every setting of %s', async (_, file) => {
    const store = make();

    store.setInitialValue(file);
    await settle();

    expect(parse(store).settings.lockSettings).toBe(LOCK_ALL);
    expect(parse(store).settings).not.toHaveProperty('ignoreSaveSettings');
  });

  it('setInitialValue shows text it cannot read as a new document, every setting locked', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = make();

    store.setInitialValue('<<<<<<< HEAD\n{"version":"3.0.0"}\n=======');
    await settle();

    expect(error).toHaveBeenCalled();
    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.lockSettings).toBe(LOCK_ALL);
    error.mockRestore();
  });

  it('setInitialValue loads a v3 document', async () => {
    const store = make();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: ['t1'],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: { t1: createTableJson('t1') },
        },
      })
    );
    await settle();

    const json = parse(store);
    expect(json.doc.tableIds).toEqual(['t1']);
    expect(json.collections.tableEntities.t1.name).toBe('t1');
  });

  it('keeps entities the doc no longer lists', async () => {
    const store = make();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: [],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: { fresh: createTableJson('fresh') },
        },
      })
    );
    await settle();

    expect(Object.keys(parse(store).collections.tableEntities)).toEqual([
      'fresh',
    ]);
  });

  it('dispatchSync applies change actions', () => {
    const store = make();

    store.dispatchSync(addTable('t1'));
    store.dispatchSync([changeTableNameAction({ id: 't1', value: 'users' })]);

    const json = parse(store);
    expect(json.doc.tableIds).toEqual(['t1']);
    expect(json.collections.tableEntities.t1.name).toBe('users');
  });

  it('dispatchSync ignores actions outside of ReplicaActionTypes', () => {
    const store = make();
    const before = store.value;

    store.dispatchSync(unselectAllAction());

    expect(store.value).toBe(before);
  });

  it('strips tags before handing actions to the reducers', () => {
    const store = make();

    store.dispatchSync({
      ...addTable('t1'),
      tags: Tag.shared | Tag.following,
      version: 1,
    });

    expect(parse(store).doc.tableIds).toEqual(['t1']);
  });

  it('dispatch defers to a microtask', async () => {
    const store = make();

    store.dispatch(addTable('t1'));
    expect(parse(store).doc.tableIds).toEqual([]);

    await Promise.resolve();
    await Promise.resolve();
    expect(parse(store).doc.tableIds).toEqual(['t1']);
  });

  describe('observers', () => {
    it('notifies change listeners after the debounce window', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      store.on({ change });

      store.dispatchSync(addTable('t1'));
      expect(change).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenCalledTimes(1);
    });

    it('reports a batch of the save switch the locks replaced, which changes nothing', () => {
      vi.useFakeTimers();
      const store = make();
      store.dispatchSync(unlock(viewport));
      vi.advanceTimersByTime(250);
      const change = vi.fn();
      store.on({ change });
      const before = store.value;

      store.dispatchSync({
        type: 'settings.changeIgnoreSaveSettings',
        payload: { saveSettingType: 3, value: true },
        tags: Tag.shared,
        version: 5,
      });
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
      expect(change).toHaveBeenCalledWith({ value: before, changed: false });
      expect(parse(store).settings).not.toHaveProperty('ignoreSaveSettings');
    });

    it('reports no change for the registers a window answers a join with', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      store.on({ change });
      const before = store.value;

      store.dispatchSync({
        ...mergeLWWAction({
          lww: { 'settings.code': ['settings', -1, -1, { language: 8 }] },
        }),
        tags: Tag.shared,
        version: 8,
      });
      vi.advanceTimersByTime(250);

      expect(change).not.toHaveBeenCalled();
      expect(store.value).toBe(before);
    });

    it('reports no change for a load, which a host has just read', async () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      store.on({ change });

      store.setInitialValue(JSON.stringify({ version: '3.0.0' }));
      await vi.advanceTimersByTimeAsync(250);

      expect(change).not.toHaveBeenCalled();
    });

    it('registers the same listener record only once', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      const listeners = { change };

      store.on(listeners);
      store.on(listeners);

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
    });

    it('the returned unsubscribe stops notifications', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      const off = store.on({ change });

      off();
      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(change).not.toHaveBeenCalled();
    });

    it('a throwing listener does not stop the others', () => {
      vi.useFakeTimers();
      const store = make();
      const boom = vi.fn(() => {
        throw new Error('boom');
      });
      const ok = vi.fn();
      store.on({ change: boom });
      store.on({ change: ok });

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(boom).toHaveBeenCalledTimes(1);
      expect(ok).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * A replica has no screen. Had it kept the default editor size the store
   * starts with, a document replicated with its view far outside the content
   * would be pulled onto it against a frame nobody looks through and drift from the source.
   */
  describe('the view of a replica', () => {
    /** A replica of a file whose viewport is unlocked, so the value shows the origin. */
    function makeSavingView(): ReplicationStore {
      const store = make();
      store.dispatchSync(unlock(viewport));
      return store;
    }

    it('keeps an absolute scroll exactly as it arrives', () => {
      const store = makeSavingView();
      store.dispatchSync(addTable('t1'));

      store.dispatchSync(
        scrollToAction({ originX: -40_000, originY: 12_345.6789 })
      );

      expect(parse(store).settings.originX).toBe(-40_000);
      expect(parse(store).settings.originY).toBe(12_345.6789);
    });

    it('keeps a streamed scroll unclamped, with content and without', () => {
      const withContent = makeSavingView();
      withContent.dispatchSync(addTable('t1'));
      const empty = makeSavingView();

      for (const store of [withContent, empty]) {
        store.dispatchSync(scrollToAction({ originX: -40_000, originY: 0 }));
        store.dispatchSync(
          streamScrollToAction({ movementX: -500, movementY: 250.5 })
        );

        expect(parse(store).settings.originX).toBe(-40_500);
        expect(parse(store).settings.originY).toBe(250.5);
      }
    });
  });

  /**
   * What a host is handed after a scroll, a zoom or another locked setting's
   * change. The change still comes, as every hub waits for one save per change,
   * and changed says whether the value holds anything new: locked, it does not.
   */
  describe('a view change', () => {
    const view = [
      scrollToAction({ originX: -320, originY: 180 }),
      streamScrollToAction({ movementX: 40, movementY: -25 }),
      changeZoomLevelAction({ value: 0.5 }),
      streamZoomLevelAction({ value: 0.25 }),
    ];

    /**
     * A replica holding one table, whose own debounced change has gone out,
     * with the locks given unlocked, or a new document's when none are.
     */
    function loaded(unlocked = 0) {
      vi.useFakeTimers();
      const store = make();
      store.dispatchSync(addTable('t1'));
      if (unlocked) store.dispatchSync(unlock(unlocked));
      vi.advanceTimersByTime(250);
      const change = vi.fn();
      store.on({ change });
      return { store, change };
    }

    /** What an editor relays for a zoom: the zoom, then the scroll holding the middle of its screen. */
    function relayedZoom() {
      const editor = createStore({
        toWidth: text => text.length * 10,
        clock: new Clock(),
      });
      const zoom = compositionActionsFlat(editor.state, editor.context, [
        changeZoomLevelAction$(0.5),
      ]);
      editor.destroy();
      return zoom;
    }

    it('changes nothing for a new document, whose locks all start on, and is still reported', () => {
      const { store, change } = loaded();
      const before = store.value;

      store.dispatchSync(view);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
      expect(change).toHaveBeenCalledWith({ value: before, changed: false });
      expect(parse(store).settings).toMatchObject({
        lockSettings: LOCK_ALL,
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('is saved with the viewport unlocked, as a file keeps where the diagram was left', () => {
      const { store, change } = loaded(viewport);
      const before = store.value;

      store.dispatchSync(view);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
      expect(change).toHaveBeenCalledWith({
        value: store.value,
        changed: true,
      });
      expect(store.value).not.toBe(before);
      expect(parse(store).settings).toMatchObject({
        originX: -280,
        originY: 155,
        zoomLevel: 0.75,
      });
    });

    it('keeps the origin and the zoom of the lock wherever a locked view goes', () => {
      const { store, change } = loaded(viewport);
      store.dispatchSync(
        changeLockSettingsAction({
          lockSettingType: viewport,
          value: true,
          values: { originX: 64, originY: -32, zoomLevel: 0.8 },
        })
      );
      vi.advanceTimersByTime(250);
      const locked = store.value;

      store.dispatchSync([...view, ...relayedZoom()]);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenLastCalledWith({
        value: locked,
        changed: false,
      });
      expect(parse(store).settings).toMatchObject({
        originX: 64,
        originY: -32,
        zoomLevel: 0.8,
      });
    });

    it('saves the zoom and the origin it moves together once unlocked', () => {
      const { store, change } = loaded(viewport);
      const zoom = relayedZoom();

      store.dispatchSync(zoom);
      vi.advanceTimersByTime(250);

      expect(zoom.map(({ type }) => type)).toEqual([
        'settings.changeZoomLevel',
        'settings.scrollTo',
      ]);
      expect(change).toHaveBeenCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings).toMatchObject({
        zoomLevel: 0.5,
        originX: 300,
        originY: 168.75,
      });
    });

    it.each([
      ['a tab switch', changeCanvasTypeAction({ value: CanvasType.settings })],
      ['a language', changeLanguageAction({ value: Language.Kotlin })],
    ])('changes nothing for %s while locked', (_, action) => {
      const { store, change } = loaded();
      const before = store.value;

      store.dispatchSync(action);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledWith({ value: before, changed: false });
    });

    it.each([
      [
        'a tab switch',
        LockSettingType.canvasType,
        changeCanvasTypeAction({ value: CanvasType.settings }),
        { canvasType: CanvasType.settings },
      ],
      [
        'a language',
        LockSettingType.language,
        changeLanguageAction({ value: Language.Kotlin }),
        { language: Language.Kotlin },
      ],
    ])('saves %s once unlocked', (_, bit, action, saved) => {
      const { store, change } = loaded(bit);

      store.dispatchSync(action);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings).toMatchObject(saved);
    });

    it('measures each change against the one before it', () => {
      const { store, change } = loaded();

      store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
      vi.advanceTimersByTime(250);
      store.dispatchSync(view);
      vi.advanceTimersByTime(250);
      store.dispatchSync(changeTableNameAction({ id: 't1', value: 'people' }));
      vi.advanceTimersByTime(250);

      expect(change.mock.calls.map(([{ changed }]) => changed)).toEqual([
        true,
        false,
        true,
      ]);
    });
  });

  /**
   * A file the replica would not write as it is: one an older release wrote,
   * without the origin, or one another machine measured with its own fonts. The
   * value differs from it from the load on, so only a change action says changed.
   */
  describe('changed after a load', () => {
    const macWidth = (text: string) => Math.round(text.length * 7.1) + 2;
    const winWidth = (text: string) => Math.round(text.length * 6.6) + 2;
    const scroll = scrollToAction({ originX: -100, originY: 50 });

    /** One named table, every setting locked, as a replica measuring with toWidth saves it. */
    function savedWith(toWidth: (text: string) => number) {
      const store = make(toWidth);
      store.dispatchSync([
        addTable('t1'),
        changeTableNameAction({ id: 't1', value: 'customer_accounts' }),
      ]);
      return store.value;
    }

    /** Opens text, whose load writes the text widths before it returns, and lets the timers run. */
    async function open(text: string, toWidth = macWidth) {
      vi.useFakeTimers();
      const store = make(toWidth);
      store.setInitialValue(text);
      await vi.advanceTimersByTimeAsync(10);
      const change = vi.fn();
      store.on({ change });
      return { store, change };
    }

    it('reopens a file on the machine that saved it to the same bytes', async () => {
      const file = savedWith(macWidth);

      const { store } = await open(file, macWidth);

      expect(store.value).toBe(file);
    });

    it('measures a file another machine saved again, and a view change on it changes nothing', async () => {
      const file = savedWith(macWidth);
      const { store, change } = await open(file, winWidth);
      const opened = store.value;

      store.dispatchSync(scroll);
      vi.advanceTimersByTime(250);

      expect(opened).not.toBe(file);
      expect(parse(store).collections.tableEntities.t1.ui.widthName).toBe(
        winWidth('customer_accounts')
      );
      expect(change).toHaveBeenCalledWith({ value: opened, changed: false });

      store.dispatchSync(
        changeTableNameAction({ id: 't1', value: 'accounts' })
      );
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenLastCalledWith({
        value: store.value,
        changed: true,
      });
    });

    it('keeps the widths its load measured, which no hook measures again, past the registers a join brings in', async () => {
      vi.useFakeTimers();
      let measure = macWidth;
      const store = make(text => measure(text));
      store.setInitialValue(savedWith(macWidth));
      const opened = store.value;
      const change = vi.fn();
      store.on({ change });

      store.dispatchSync({
        ...mergeLWWAction({
          lww: { 'settings.code': ['settings', -1, -1, { language: 1 }] },
        }),
        tags: Tag.shared,
        version: 1,
      });
      // A measure that moves after the load rewrites nothing until an edit measures.
      measure = winWidth;
      await vi.advanceTimersByTimeAsync(10);
      store.dispatchSync(scroll);
      vi.advanceTimersByTime(250);

      expect(store.value).toBe(opened);
      expect(parse(store).collections.tableEntities.t1.ui.widthName).toBe(
        macWidth('customer_accounts')
      );
      expect(change).toHaveBeenCalledWith({ value: opened, changed: false });
    });

    it('changes nothing for a view change on a file an older release saved without the origin', async () => {
      const legacy = JSON.parse(savedWith(macWidth));
      delete legacy.settings.originX;
      delete legacy.settings.originY;
      const file = JSON.stringify(legacy, null, 2);
      const { store, change } = await open(file);
      const opened = store.value;

      store.dispatchSync(scroll);
      vi.advanceTimersByTime(250);

      expect(opened).not.toBe(file);
      expect(change).toHaveBeenCalledWith({ value: opened, changed: false });
    });

    it('changes nothing for a view change on a new empty file, whose first edit writes every lock on', async () => {
      const { store, change } = await open('');
      const opened = store.value;

      store.dispatchSync([scroll, changeZoomLevelAction({ value: 0.5 })]);
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenCalledWith({ value: opened, changed: false });

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenLastCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings).toMatchObject({
        lockSettings: LOCK_ALL,
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('changes nothing for a view change on a file saved before the locks, whose first edit writes them on', async () => {
      const file = JSON.stringify({
        version: '3.0.0',
        settings: {
          ignoreSaveSettings: 0,
          originX: -100,
          originY: 50,
          zoomLevel: 0.5,
          canvasType: CanvasType.schemaSQL,
          language: Language.Kotlin,
        },
      });
      const { store, change } = await open(file);
      const opened = store.value;

      store.dispatchSync([scroll, changeZoomLevelAction({ value: 0.8 })]);
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenCalledWith({ value: opened, changed: false });

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenLastCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings).toMatchObject({
        lockSettings: LOCK_ALL,
        originX: 0,
        originY: 0,
        zoomLevel: 1,
        canvasType: CanvasType.ERD,
        language: Language.Kotlin,
      });
    });

    /**
     * The seed saved with every lock on, by a machine with other fonts and
     * a release whose relationship and key flags fell behind its columns, with
     * a table the doc no longer lists.
     */
    function staleFile() {
      const json = JSON.parse(createSeedValue());
      const relationship =
        json.collections.relationshipEntities[SEED.relationship];
      const userColumn = json.collections.tableColumnEntities[SEED.orderUser];

      // The relationship ends on orders.user_id, a nullable column outside the
      // primary key, which makes it non-identifying and ringed.
      relationship.identification = true;
      relationship.startRelationshipType = StartRelationshipType.dash;
      userColumn.ui.keys &= ~ColumnUIKey.foreignKey;
      json.collections.tableEntities.removed = createTableJson('removed');
      return JSON.stringify(json);
    }

    it.each([0, 3, 7])(
      'changes nothing for a view change %i ms into a load',
      async delay => {
        vi.useFakeTimers();
        const store = make(winWidth);
        const change = vi.fn();
        store.on({ change });

        store.setInitialValue(staleFile());
        if (delay) await vi.advanceTimersByTimeAsync(delay);
        store.dispatchSync(scroll);
        await vi.advanceTimersByTimeAsync(250);

        expect(change).toHaveBeenCalledTimes(1);
        expect(change).toHaveBeenCalledWith({
          value: store.value,
          changed: false,
        });
      }
    );

    it('rewrites a stale file in full before the load returns', async () => {
      vi.useFakeTimers();
      const file = staleFile();
      const stale = JSON.parse(file).collections;
      const store = make(winWidth);

      store.setInitialValue(file);
      const opened = store.value;
      await vi.advanceTimersByTimeAsync(50);

      const { collections } = JSON.parse(opened);
      const relationship = collections.relationshipEntities[SEED.relationship];
      const userName = collections.tableColumnEntities[SEED.userName];
      expect(store.value).toBe(opened);
      expect(collections.tableEntities.removed).toMatchObject({
        name: 'removed',
      });
      expect(userName.ui.widthDataType).toBe(winWidth('VARCHAR(255)'));
      expect(userName.ui.widthDataType).not.toBe(
        stale.tableColumnEntities[SEED.userName].ui.widthDataType
      );
      expect(relationship).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.ring,
      });
      expect(
        collections.tableColumnEntities[SEED.orderUser].ui.keys &
          ColumnUIKey.foreignKey
      ).toBe(ColumnUIKey.foreignKey);
    });

    /**
     * The seed with orders.user_id out of its table, so its relationship ends
     * on no column the document holds, under flags it no longer derives.
     */
    function brokenLinkFile() {
      const json = JSON.parse(createSeedValue());
      const orders = json.collections.tableEntities[SEED.orders];
      const relationship =
        json.collections.relationshipEntities[SEED.relationship];

      orders.columnIds = orders.columnIds.filter(
        (id: string) => id !== SEED.orderUser
      );
      relationship.identification = true;
      relationship.startRelationshipType = StartRelationshipType.ring;
      json.collections.tableColumnEntities[SEED.orderUser].ui.keys &=
        ~ColumnUIKey.foreignKey;
      return JSON.stringify(json);
    }

    it('loads a relationship with no end column left under the flags a new one starts with, and a view change on it changes nothing', async () => {
      vi.useFakeTimers();
      const store = make(winWidth);
      const change = vi.fn();
      store.on({ change });

      store.setInitialValue(brokenLinkFile());
      const opened = store.value;
      await vi.advanceTimersByTimeAsync(50);
      store.dispatchSync(scroll);
      await vi.advanceTimersByTimeAsync(250);

      const { collections } = JSON.parse(opened);
      expect(collections.relationshipEntities[SEED.relationship]).toMatchObject(
        {
          identification: false,
          startRelationshipType: StartRelationshipType.dash,
        }
      );
      expect(
        collections.tableColumnEntities[SEED.orderUser].ui.keys &
          ColumnUIKey.foreignKey
      ).toBe(0);
      expect(change.mock.calls).toEqual([[{ value: opened, changed: false }]]);
    });

    it('takes a load that came while a change was pending as the value, changing nothing', async () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      store.on({ change });

      store.dispatchSync(addTable('t1'));
      store.setInitialValue(savedWith(winWidth));
      await vi.advanceTimersByTimeAsync(250);
      const opened = store.value;
      store.dispatchSync(scroll);
      vi.advanceTimersByTime(250);

      expect(change.mock.calls).toEqual([
        [{ value: opened, changed: false }],
        [{ value: opened, changed: false }],
      ]);
      expect(parse(store).collections.tableEntities.t1.name).toBe(
        'customer_accounts'
      );
    });
  });

  /**
   * A code setting changed while locked reaches only the readers open then; one
   * that joins later from the file shows the value the lock holds. An unlock
   * carries the unlocker's values, so every store saves one value after it.
   */
  describe('an unlock after a reader joined from the file', () => {
    const codeLocks = LockSettingType.language | LockSettingType.tableNameCase;
    const onScreen = {
      language: Language.Kotlin,
      tableNameCase: NameCase.snakeCase,
    };
    const inFile = {
      language: Language.GraphQL,
      tableNameCase: NameCase.pascalCase,
    };

    type Reader = {
      receive: (actions: AnyAction[]) => void;
      savedSettings: () => object[];
    };
    const readers: Reader[] = [];

    afterEach(() => {
      readers.splice(0);
    });

    /** What a host does with the batch a reader sent: hands it to every other reader. */
    const relay = (from: Reader, actions: AnyAction[]) =>
      readers.forEach(reader => reader !== from && reader.receive(actions));

    /** An editor window whose replica and every other reader take what it sends. */
    function openEditor(value: string) {
      const editor = openWindow(value);
      readers.push(editor);
      closers.push(
        editor.user.sharedStore.subscribe(actions => {
          editor.replica.dispatchSync(actions);
          relay(editor, actions);
        })
      );
      return editor;
    }

    /** A coding agent's headless peer, which joins from the file as a window does. */
    function openAgent(value: string) {
      const peer = createPeerStore({ nickname: 'agent', presence: false });
      peer.setInitialValue(value);
      const reader: Reader = {
        receive: actions => peer.receive(actions),
        savedSettings: () => [JSON.parse(peer.value).settings],
      };
      readers.push(reader);
      closers.push(
        peer.subscribe(actions => relay(reader, actions)),
        peer.destroy
      );
      return peer;
    }

    /**
     * A window that changed both settings while they were locked, and the
     * file it leaves, which an editor and an agent joining after it open.
     */
    async function joinedLater() {
      const first = openEditor(createSeedValue());
      first.user.rxStore.dispatchSync(
        changeLanguageAction({ value: onScreen.language }),
        changeTableNameCaseAction({ value: onScreen.tableNameCase })
      );
      const file = first.replica.value;
      openEditor(file);
      const agent = openAgent(file);
      await settle();

      expect(JSON.parse(file).settings).toMatchObject(inFile);
      return { first, agent };
    }

    /** The settings every editor, the agent and every replica would save. */
    const savedSettings = () =>
      readers.flatMap(reader => reader.savedSettings());

    const expectOneValue = (values: object) => {
      const [first, ...rest] = savedSettings();

      expect(rest).toHaveLength(4);
      for (const settings of rest) expect(settings).toEqual(first);
      expect(first).toMatchObject({
        ...values,
        lockSettings: LOCK_ALL & ~codeLocks,
      });
    };

    it('saves the values the window that unlocked showed, on every store', async () => {
      const { first } = await joinedLater();

      first.user.rxStore.dispatchSync(
        changeLockSettingsAction$(codeLocks, false)
      );
      await settle();

      expectOneValue(onScreen);
    });

    it('saves the values of the agent that joined later, when it unlocks', async () => {
      const { agent } = await joinedLater();

      agent.dispatch([changeLockSettingsAction$(codeLocks, false)]);
      await settle();

      expectOneValue(inFile);
    });
  });

  /**
   * An unlock and a newer relock of the same setting reach the readers in
   * either order. The relock holds the file, and the code register alone
   * decides what the unlock shows, so every screen ends on one value.
   */
  describe('an unlock crossing a newer relock', () => {
    const { language } = LockSettingType;
    const lockLanguage = (
      value: boolean,
      version: number,
      carried: object
    ) => ({
      ...changeLockSettingsAction({
        lockSettingType: language,
        value,
        values: carried,
      }),
      tags: Tag.shared,
      version,
    });
    const unlocked = lockLanguage(false, 10, { language: Language.Kotlin });
    // The relocker never saw the unlock, so it locks at the value it shows.
    const relocked = lockLanguage(true, 11, { language: Language.Go });

    /** One window per delivery order, each handed both batches in it. */
    async function crossed() {
      const file = createSeedValue();
      const windows = [
        [unlocked, relocked],
        [relocked, unlocked],
      ].map(order => {
        const editor = openWindow(file);
        order.forEach(action => editor.receive([{ ...action }]));
        return editor;
      });
      await settle();
      return windows;
    }

    const savedSettings = (windows: Array<ReturnType<typeof openWindow>>) =>
      windows.flatMap(editor => editor.savedSettings());

    it('saves one value on every store, the one the relock carries', async () => {
      const [first, ...rest] = savedSettings(await crossed());

      expect(rest).toHaveLength(3);
      for (const settings of rest) expect(settings).toEqual(first);
      expect(first).toMatchObject({
        language: Language.Go,
        lockSettings: LOCK_ALL,
      });
    });

    it('shows the value the unlock carries on every screen, the replicas included', async () => {
      const windows = await crossed();

      expect(
        windows.map(({ user }) => user.rxStore.state.settings.language)
      ).toEqual([Language.Kotlin, Language.Kotlin]);

      // An unlock carrying no value saves the screen each store shows.
      windows.forEach(editor => editor.receive([lockLanguage(false, 12, {})]));
      const [first, ...rest] = savedSettings(windows);

      for (const settings of rest) expect(settings).toEqual(first);
      expect(first).toMatchObject({
        language: Language.Kotlin,
        lockSettings: LOCK_ALL & ~language,
      });
    });
  });

  /**
   * A window opened on a file another window holds starts with no registers,
   * which no file saves: its first subscribe asks for them, and the answer
   * reaches its element and its replica alike, as webview-client relays it.
   */
  describe('a replica of a window joining one already open', () => {
    /** The open window's edits, the file they leave, and a window joining it. */
    async function joinOpenWindow() {
      const open = createUserStore(createSeedValue());
      const toJoined: Array<(actions: AnyAction[]) => void> = [];
      closers.push(
        open.sharedStore.subscribe(actions =>
          toJoined.forEach(send => send(actions))
        ),
        open.destroy
      );
      open.rxStore.dispatchSync(
        changeLockSettingsAction$(LockSettingType.language, false),
        changeLanguageAction({ value: Language.Kotlin }),
        changeTableNameAction({ id: SEED.users, value: 'members' })
      );
      paint(open, '#111111');
      await settle();

      const { user: joined, replica } = openWindow(toJson(open.rxStore.state));
      toJoined.push(actions => {
        joined.sharedStore.dispatchSync(copy(actions));
        replica.dispatchSync(copy(actions));
      });
      closers.push(
        joined.sharedStore.subscribe(actions => {
          replica.dispatchSync(copy(actions));
          open.sharedStore.dispatchSync(copy(actions));
        })
      );
      await settle();

      const { lww } = open.rxStore.state;
      const older =
        Math.min(lww['settings.code'][3].language, lww[SEED.users][3].name) - 1;
      return { open, joined, replica, older };
    }

    it('refuses a setter older than the registers the open window answered with', async () => {
      const { joined, replica, older } = await joinOpenWindow();
      const stale = [
        changeLanguageAction({ value: Language.Java }),
        changeTableNameAction({ id: SEED.users, value: 'people' }),
      ].map(action => ({ ...action, tags: Tag.shared, version: older }));

      joined.sharedStore.dispatchSync(stale);
      replica.dispatchSync(stale);
      await settle();

      const saved = parse(replica);
      expect(saved.settings.language).toBe(Language.Kotlin);
      expect(saved.collections.tableEntities[SEED.users].name).toBe('members');
      expect(saved.settings).toEqual(
        JSON.parse(toJson(joined.rxStore.state)).settings
      );
    });

    it('saves a colour the open window paints after the join, which travels with no version', async () => {
      const { open, joined, replica } = await joinOpenWindow();

      paint(open, '#222222');
      await settle();

      expect(colours(replica)).toEqual(['#222222', '#222222']);
      expect(colours(replica)).toEqual(colours(joined));
    });
  });

  /**
   * A window answers a join with its registers on the way out, which reach its
   * own replica too, as webview-client hands that replica every batch its
   * element sends.
   */
  describe('a replica of a window answering a join', () => {
    it('saves a colour its window paints after the answer', async () => {
      const { user, replica } = openWindow(createSeedValue());
      closers.push(
        user.sharedStore.subscribe(actions =>
          replica.dispatchSync(copy(actions))
        )
      );

      paint(user, '#111111');
      user.sharedStore.dispatchSync({ ...getLWWAction(), tags: Tag.shared });
      paint(user, '#222222');
      await settle();

      expect(colours(replica)).toEqual(['#222222', '#222222']);
      expect(colours(replica)).toEqual(colours(user));
    });
  });

  it('applies a remap as a change and derives the flags an editor derives from it', async () => {
    vi.useFakeTimers();
    const seed = createSeedValue();
    const store = make();
    const user = createUserStore(seed);
    store.setInitialValue(seed);
    await vi.advanceTimersByTimeAsync(50);
    const change = vi.fn();
    store.on({ change });
    const remap = () =>
      changeRelationshipColumnsAction({
        id: SEED.relationship,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderId] },
      });

    store.dispatchSync(remap());
    user.rxStore.dispatchSync(remap());
    await vi.advanceTimersByTimeAsync(250);

    const derived = (collections: any) => ({
      relationship: {
        identification:
          collections.relationshipEntities[SEED.relationship].identification,
        startRelationshipType:
          collections.relationshipEntities[SEED.relationship]
            .startRelationshipType,
        end: collections.relationshipEntities[SEED.relationship].end.columnIds,
      },
      foreignKeys: [SEED.orderId, SEED.orderUser, SEED.orderNote].filter(
        id =>
          collections.tableColumnEntities[id].ui.keys & ColumnUIKey.foreignKey
      ),
    });
    expect(change).toHaveBeenCalledWith({ value: store.value, changed: true });
    expect(derived(parse(store).collections)).toEqual({
      relationship: {
        identification: true,
        startRelationshipType: StartRelationshipType.dash,
        end: [SEED.orderId],
      },
      foreignKeys: [SEED.orderId],
    });
    expect(derived(parse(store).collections)).toEqual(
      derived(user.rxStore.state.collections)
    );
    user.destroy();
  });

  it('destroy detaches subscriptions and observers', () => {
    vi.useFakeTimers();
    const store = make();
    const change = vi.fn();
    store.on({ change });

    store.destroy();
    store.dispatchSync(addTable('t1'));
    vi.advanceTimersByTime(250);

    expect(change).not.toHaveBeenCalled();
    expect(parse(store).doc.tableIds).toEqual([]);
  });
});
