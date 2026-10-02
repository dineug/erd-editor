import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import {
  CanvasType,
  ColumnUIKey,
  SaveSettingType,
  StartRelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { unselectAllAction } from '@/engine/modules/editor/atom.actions';
import {
  changeCanvasTypeAction,
  changeIgnoreSaveSettingsAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { changeZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  createReplicationStore,
  ReplicationStore,
} from '@/engine/replication-store';
import { createStore } from '@/engine/store';
import { Tag } from '@/engine/tag';

const DAY = 24 * 60 * 60 * 1000;
const OFF = SaveSettingType.scroll | SaveSettingType.zoomLevel;

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

const stores: ReplicationStore[] = [];

function make(toWidth = (text: string) => text.length * 10): ReplicationStore {
  const store = createReplicationStore({ toWidth });
  stores.push(store);
  return store;
}

function parse(store: ReplicationStore) {
  return JSON.parse(store.value);
}

/** Let the schema GC promise chain settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function createTableJson(id: string, updateAt: number) {
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
    meta: { updateAt, createAt: updateAt },
  };
}

afterEach(() => {
  vi.useRealTimers();
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

  it('starts as a new document, which saves neither the scroll nor the zoom', () => {
    expect(parse(make()).settings.ignoreSaveSettings).toBe(OFF);
  });

  it('setInitialValue falls back to an empty document for blank input', async () => {
    const store = make();

    store.setInitialValue('   ');
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.ignoreSaveSettings).toBe(OFF);
  });

  it('setInitialValue coerces non-string input to an empty document', async () => {
    const store = make();

    store.setInitialValue(undefined as unknown as string);
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.ignoreSaveSettings).toBe(OFF);
  });

  it.each([
    ['a v3 file without the field', '{"version":"3.0.0"}'],
    ['a v2 file', '{"canvas":{"width":3000}}'],
  ])('setInitialValue keeps saving the view of %s', async (_, file) => {
    const store = make();

    store.setInitialValue(file);
    await settle();

    expect(parse(store).settings.ignoreSaveSettings).toBe(0);
  });

  it('setInitialValue shows text it cannot read as a new document, since it names no switch', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = make();

    store.setInitialValue('<<<<<<< HEAD\n{"version":"3.0.0"}\n=======');
    await settle();

    expect(error).toHaveBeenCalled();
    expect(parse(store).doc.tableIds).toEqual([]);
    expect(parse(store).settings.ignoreSaveSettings).toBe(OFF);
    error.mockRestore();
  });

  it('setInitialValue loads a v3 document', async () => {
    const store = make();
    const now = Date.now();

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
          tableEntities: { t1: createTableJson('t1', now) },
        },
      })
    );
    await settle();

    const json = parse(store);
    expect(json.doc.tableIds).toEqual(['t1']);
    expect(json.collections.tableEntities.t1.name).toBe('t1');
  });

  it('garbage collects stale entities that no longer belong to the doc', async () => {
    const store = make();
    const now = Date.now();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: ['keep'],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: {
            keep: createTableJson('keep', now),
            stale: createTableJson('stale', now - 10 * DAY),
          },
        },
      })
    );
    await settle();

    const json = parse(store);
    expect(Object.keys(json.collections.tableEntities)).toEqual(['keep']);
    expect(json.doc.tableIds).toEqual(['keep']);
  });

  it('keeps recently touched entities that are not referenced by the doc', async () => {
    const store = make();
    const now = Date.now();

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
          tableEntities: { fresh: createTableJson('fresh', now) },
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

  it('dispatchSync ignores actions outside of ChangeActionTypes', () => {
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
    /** A replica of a file that saves its view, so the value shows the origin. */
    function makeSavingView(): ReplicationStore {
      const store = make();
      store.dispatchSync(
        changeIgnoreSaveSettingsAction({ saveSettingType: OFF, value: false })
      );
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
   * What a host is handed after a scroll or a zoom. The change still comes, as
   * every hub waits for one save per change, and changed says whether the value
   * holds anything new: with both save switches off, a view change holds nothing.
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
     * with the switches given, or a new document's when none are.
     */
    function loaded(ignoreSaveSettings?: number) {
      vi.useFakeTimers();
      const store = make();
      store.dispatchSync(addTable('t1'));
      if (ignoreSaveSettings !== undefined) {
        store.dispatchSync([
          changeIgnoreSaveSettingsAction({
            saveSettingType: OFF,
            value: false,
          }),
          changeIgnoreSaveSettingsAction({
            saveSettingType: ignoreSaveSettings,
            value: true,
          }),
        ]);
      }
      vi.advanceTimersByTime(250);
      const change = vi.fn();
      store.on({ change });
      return { store, change };
    }

    it('changes nothing for a new document, whose switches both start off', () => {
      const { store, change } = loaded();
      const before = store.value;

      store.dispatchSync(view);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledWith({ value: before, changed: false });
      expect(parse(store).settings).toMatchObject({
        ignoreSaveSettings: OFF,
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('is saved with both switches on, as a file keeps where the diagram was left', () => {
      const { store, change } = loaded(0);
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

    it('changes nothing with both switches off, and is still reported', () => {
      const { store, change } = loaded(OFF);
      const before = store.value;

      store.dispatchSync(view);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
      expect(change).toHaveBeenCalledWith({ value: before, changed: false });
      expect(store.value).toBe(before);
    });

    it('saves only the half of the view whose switch is still on', () => {
      const { store, change } = loaded(SaveSettingType.scroll);
      const before = store.value;

      store.dispatchSync(view.slice(0, 2));
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenLastCalledWith({
        value: before,
        changed: false,
      });

      store.dispatchSync(view.slice(2));
      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenLastCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings.zoomLevel).toBe(0.75);
      expect(parse(store).settings.originX).toBe(0);
    });

    it('saves the origin a zoom moves with only the scroll switch on, though not the zoom', () => {
      const { store, change } = loaded(SaveSettingType.zoomLevel);
      const before = store.value;
      // What an editor relays for a zoom: the zoom, then the scroll that keeps
      // the scene point under the middle of its 1200 by 675 screen in place.
      const editor = createStore({
        toWidth: text => text.length * 10,
        clock: new Clock(),
      });
      const zoom = compositionActionsFlat(editor.state, editor.context, [
        changeZoomLevelAction$(0.5),
      ]);
      editor.destroy();

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
      expect(store.value).not.toBe(before);
      expect(parse(store).settings).toMatchObject({
        zoomLevel: 1,
        originX: 300,
        originY: 168.75,
      });
    });

    it('still saves a tab switch, which neither switch covers', () => {
      const { store, change } = loaded(OFF);
      const before = store.value;

      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.settings })
      );
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledWith({
        value: store.value,
        changed: true,
      });
      expect(store.value).not.toBe(before);
      expect(parse(store).settings.canvasType).toBe(CanvasType.settings);
    });

    it('measures each change against the one before it', () => {
      const { store, change } = loaded(OFF);

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

    /** One named table, both switches off, as a replica measuring with toWidth saves it. */
    function savedWith(toWidth: (text: string) => number) {
      const store = make(toWidth);
      store.dispatchSync([
        addTable('t1'),
        changeTableNameAction({ id: 't1', value: 'customer_accounts' }),
        changeIgnoreSaveSettingsAction({ saveSettingType: OFF, value: true }),
      ]);
      return store.value;
    }

    /** Opens text and lets the load's own rewrites in: the schema GC and the text widths. */
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

    it('changes nothing for a view change on a new empty file, whose first edit writes both switches off', async () => {
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
        ignoreSaveSettings: OFF,
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('saves a view change on a file without the field, as the release that wrote it did', async () => {
      const { store, change } = await open('{"version":"3.0.0"}');

      store.dispatchSync(scroll);
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledWith({
        value: store.value,
        changed: true,
      });
      expect(parse(store).settings).toMatchObject({
        ignoreSaveSettings: 0,
        originX: -100,
        originY: 50,
      });
    });

    /**
     * The seed saved with both switches off, by a machine with other fonts and
     * a release whose relationship and key flags fell behind its columns, with
     * a table removed long enough ago for the schema GC.
     */
    function staleFile() {
      const json = JSON.parse(createSeedValue());
      const relationship =
        json.collections.relationshipEntities[SEED.relationship];
      const userColumn = json.collections.tableColumnEntities[SEED.orderUser];

      json.settings.ignoreSaveSettings = OFF;
      // The relationship ends on orders.user_id, a nullable column outside the
      // primary key, which makes it non-identifying and ringed.
      relationship.identification = true;
      relationship.startRelationshipType = StartRelationshipType.dash;
      userColumn.ui.keys &= ~ColumnUIKey.foreignKey;
      json.collections.tableEntities.removed = createTableJson(
        'removed',
        Date.now() - 10 * DAY
      );
      return JSON.stringify(json);
    }

    it.each([0, 3, 7])(
      'changes nothing for a view change %i ms into a load, before its hooks would have run',
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
      expect(collections.tableEntities.removed).toBeUndefined();
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
