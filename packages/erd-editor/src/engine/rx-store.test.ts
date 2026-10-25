import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Open } from '@/constants/open';
import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingType,
  NameCase,
  RelationshipType,
  Show,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { createHistory, History, HistoryOptions } from '@/engine/history';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  removeDictionaryEntriesAction$,
  setColumnDomainAction$,
  updateDictionaryEntryAction$,
} from '@/engine/modules/dictionary/generator.actions';
import { isListed } from '@/engine/modules/dictionary/membership';
import {
  changeOpenMapAction,
  clearAction,
  drawEndRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  editMemoAction,
  editMemoEndAction,
  editTableAction,
  editTableEndAction,
  editTableGroupAction,
  editTableGroupEndAction,
  focusColumnAction,
  focusTableAction,
  loadJsonAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  loadJsonAction$,
} from '@/engine/modules/editor/generator.actions';
import {
  FocusType,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  viewCloseAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeIgnoreSaveSettingsAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeRelationshipDataTypeSyncAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableGroupAction,
  changeTableNameAction,
  changeZIndexAction as changeTableZIndexAction,
  moveTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  pasteTableAction$,
  removeTableAction$,
} from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  changeColumnDataTypeAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { createRxStore, HISTORY_LIMIT, RxStore } from '@/engine/rx-store';
import {
  attachActionsTag,
  attachActionTag,
  attachDictionarySheetTag$,
  hasActionTag,
  Tag,
} from '@/engine/tag';
import { bHas } from '@/utils/bit';
import { createColumn } from '@/utils/collection/tableColumn.entity';

const unlock = (lockSettingType: number) =>
  changeLockSettingsAction({ lockSettingType, value: false, values: {} });

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

const GROUP_UI = { x: 0, y: 0, width: 600, height: 400, zIndex: 1 };

function createContext(): EngineContext {
  return {
    toWidth: (text: string) => text.length * 10,
    clock: new Clock(),
  };
}

const stores: RxStore[] = [];

function make(...args: Parameters<typeof createRxStore>): RxStore {
  const store = createRxStore(...args);
  stores.push(store);
  return store;
}

/** Let a queueMicrotask based asap callback run. */
async function tick() {
  await Promise.resolve();
  await Promise.resolve();
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

describe('createRxStore', () => {
  it('exposes the store surface plus history helpers', () => {
    const store = make(createContext());

    expect(typeof store.dispatch).toBe('function');
    expect(typeof store.dispatchSync).toBe('function');
    expect(typeof store.undo).toBe('function');
    expect(typeof store.redo).toBe('function');
    expect(store.history.size).toBe(0);
    expect(Object.isFrozen(store)).toBe(true);
  });

  it('uses the injected history factory and applies the history limit', () => {
    let seen: HistoryOptions | null = null;
    const setLimit = vi.fn();
    const injected = {
      ...createHistory({
        notify: () => {},
        dispatch: () => {},
        getNextVersion: () => 1,
      }),
      setLimit,
    } as unknown as History;

    const store = make(createContext(), {
      getHistory: options => {
        seen = options;
        return injected;
      },
    });

    expect(store.history).toBe(injected);
    expect(setLimit).toHaveBeenCalledWith(HISTORY_LIMIT);
    expect(seen).not.toBeNull();
    expect(typeof seen!.notify).toBe('function');
    expect(typeof seen!.dispatch).toBe('function');
    expect(typeof seen!.getNextVersion).toBe('function');
  });

  it('feeds the history options a version source bound to its own clock', () => {
    const context = createContext();
    let seen: HistoryOptions | null = null;

    make(context, {
      getHistory: options => {
        seen = options;
        return createHistory(options);
      },
    });

    expect(seen!.getNextVersion()).toBe(1);

    context.clock.merge(7);

    expect(seen!.getNextVersion()).toBe(8);
  });

  it('dispatchSync applies the reducer and stamps the next clock version', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync(addTable('t1'));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(1);
  });

  it('keeps a version that the action already carries', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync({ ...addTable('t1'), version: 42 });

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(42);
  });

  it('flattens generator actions before dispatching', () => {
    const store = make(createContext());

    store.dispatchSync(function* () {
      yield addTable('t1');
      yield addTable('t2');
    });

    expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
  });

  it('dispatch defers to a microtask', async () => {
    const store = make(createContext());

    store.dispatch(addTable('t1'));
    expect(store.state.doc.tableIds).toEqual([]);

    await tick();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('records undoable actions and restores state on undo/redo', async () => {
    const store = make(createContext());

    store.dispatchSync(addTable('t1'));
    expect(store.history.size).toBe(1);
    expect(store.history.hasUndo()).toBe(true);

    await tick();
    expect(store.state.editor.hasUndo).toBe(true);

    store.undo();
    expect(store.state.doc.tableIds).toEqual([]);

    store.redo();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('undoing a name change restores the previous name', () => {
    const store = make(createContext());

    store.dispatchSync(addTable('t1'));
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
    expect(store.state.collections.tableEntities['t1'].name).toBe('users');

    store.undo();
    expect(store.state.collections.tableEntities['t1'].name).toBe('');
  });

  it('groups stream actions into a single history entry', () => {
    vi.useFakeTimers();
    const store = make(createContext());

    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 0 })
    );
    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 0 })
    );

    expect(store.state.collections.tableEntities['t1'].ui.x).toBe(240);
    expect(store.history.size).toBe(0);

    vi.advanceTimersByTime(300);
    expect(store.history.size).toBe(1);

    store.undo();
    expect(store.state.collections.tableEntities['t1'].ui.x).toBe(200);
  });

  it('closes what a drop sends tagged as the drag into the drag entry, one undo taking back both', () => {
    vi.useFakeTimers();
    const store = make(createContext());
    store.dispatchSync(
      addTable('t1'),
      addTableGroupAction({ id: 'g1', ui: GROUP_UI })
    );
    vi.advanceTimersByTime(300);
    const before = store.history.size;

    store.dispatchSync(
      attachActionTag(
        Tag.drag,
        moveTableAction({ ids: ['t1'], movementX: 40, movementY: 0 })
      )
    );
    store.dispatchSync(
      attachActionTag(
        Tag.drag,
        changeTableGroupAction({ id: 't1', value: 'g1', prevValue: '' })
      )
    );
    vi.advanceTimersByTime(300);

    expect(store.history.size).toBe(before + 1);

    store.undo();
    expect(store.state.collections.tableEntities['t1']).toMatchObject({
      groupId: '',
      ui: { x: 200 },
    });

    store.redo();
    expect(store.state.collections.tableEntities['t1']).toMatchObject({
      groupId: 'g1',
      ui: { x: 240 },
    });
  });

  it('resetHistory empties both stacks and reports it', async () => {
    const store = make(createContext());

    store.dispatchSync(addTable('t1'));
    store.dispatchSync(addTable('t2'));
    store.undo();
    await tick();
    expect(store.state.editor.hasUndo).toBe(true);
    expect(store.state.editor.hasRedo).toBe(true);

    store.resetHistory();
    await tick();

    expect(store.history.size).toBe(0);
    expect(store.state.editor.hasUndo).toBe(false);
    expect(store.state.editor.hasRedo).toBe(false);
    store.redo();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('resetHistory drops a stream burst still being grouped', () => {
    vi.useFakeTimers();
    const store = make(createContext());
    store.dispatchSync(addTable('t1'));
    store.resetHistory();

    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 60, movementY: 0 })
    );
    store.resetHistory();
    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 40, movementY: 0 })
    );
    vi.advanceTimersByTime(300);

    expect(store.history.size).toBe(1);
    store.undo();
    expect(store.state.collections.tableEntities['t1'].ui.x).toBe(260);
  });

  it('records an entry after resetHistory against the state before its batch', () => {
    const store = make(createContext());
    store.dispatchSync(addTable('t1'));
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));

    store.resetHistory();
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'members' }));
    store.undo();

    expect(store.state.collections.tableEntities['t1'].name).toBe('users');
  });

  it('does not push history for actions tagged changeOnly', () => {
    const store = make(createContext());

    store.dispatchSync(attachActionTag(Tag.changeOnly, addTable('t1')));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.history.size).toBe(0);
  });

  it('does not push history for actions tagged shared', () => {
    const store = make(createContext());

    store.dispatchSync(attachActionTag(Tag.shared, addTable('t1')));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.history.size).toBe(0);
  });

  describe('the dictionary sheets', () => {
    const addWord = (id: string, name: string) =>
      addDictionaryAction({ kind: 'word', id, values: { name } });
    const addTerm = (id: string, name: string) =>
      addDictionaryAction({ kind: 'term', id, values: { name } });
    const fromTab = (action: AnyAction) =>
      attachActionTag(Tag.dictionarySheet, action);

    it("keeps each sheet's tab edits in its own history, and every other edit in the document's", async () => {
      const store = make(createContext());

      store.dispatchSync(fromTab(addWord('w1', 'Member')));
      store.dispatchSync(fromTab(addTerm('t1', 'Member No')));
      store.dispatchSync(fromTab(addWord('w2', 'Name')));
      store.dispatchSync(addTable('t1'));
      store.dispatchSync(addWord('w3', 'Code'));
      await tick();

      expect(store.sheetHistories.word.size).toBe(2);
      expect(store.sheetHistories.term.size).toBe(1);
      expect(store.sheetHistories.domain.size).toBe(0);
      expect(store.history.size).toBe(2);
      expect(store.state.editor.dictionaryHistory.word).toEqual({
        hasUndo: true,
        hasRedo: false,
      });

      store.undoSheet('word');
      expect(store.state.doc.wordIds).toEqual(['w1', 'w3']);
      expect(store.state.doc.termIds).toEqual(['t1']);
      expect(store.state.doc.tableIds).toEqual(['t1']);

      store.undo();
      store.undo();
      expect(store.state.doc.wordIds).toEqual(['w1']);
      expect(store.state.doc.tableIds).toEqual([]);

      store.redoSheet('word');
      expect(store.state.doc.wordIds).toEqual(['w1', 'w2']);
      await tick();
      expect(store.state.editor.dictionaryHistory.word).toEqual({
        hasUndo: true,
        hasRedo: false,
      });
      expect(store.state.editor.hasUndo).toBe(false);
    });

    it.each([
      [
        'load',
        (store: RxStore) => loadJsonAction({ value: toJson(store.state) }),
      ],
      ['clear', () => clearAction()],
    ])(
      'empties every sheet on a %s, so an undo brings no row of the old document back',
      (_, replace) => {
        const store = make(createContext());
        store.dispatchSync(fromTab(addWord('w1', 'Member')));
        store.dispatchSync(fromTab(addTerm('t1', 'Member No')));
        expect(store.sheetHistories.word.size).toBe(1);

        store.dispatchSync(replace(store));

        expect(store.sheetHistories.word.size).toBe(0);
        expect(store.sheetHistories.term.size).toBe(0);
        const listed = [...store.state.doc.wordIds];
        store.undoSheet('word');
        expect(store.state.doc.wordIds).toEqual(listed);
      }
    );

    it.each([
      [
        'load',
        (store: RxStore) => loadJsonAction({ value: toJson(store.state) }),
      ],
      ['clear', () => clearAction()],
    ])(
      "empties every sheet on a peer's %s, so an undo lists no row of the old document",
      (_, replace) => {
        const store = make(createContext());
        store.dispatchSync(fromTab(addWord('w1', 'Member')));
        store.dispatchSync(
          fromTab(removeDictionaryAction({ kind: 'word', id: 'w1' }))
        );

        store.dispatchSync(attachActionTag(Tag.shared, replace(store)));

        expect(store.sheetHistories.word.size).toBe(0);
        store.undoSheet('word');
        expect(store.state.doc.wordIds).toEqual([]);
      }
    );

    it.each([
      [
        'load',
        (store: RxStore) => loadJsonAction({ value: toJson(store.state) }),
      ],
      ['clear', () => clearAction()],
    ])(
      'empties every sheet when the document history undoes or redoes a %s',
      (_, replace) => {
        const store = make(createContext());
        store.dispatchSync(addWord('w1', 'Old'));
        store.dispatchSync(replace(store));
        store.dispatchSync(fromTab(addWord('w2', 'New')));
        expect(store.sheetHistories.word.size).toBe(1);

        store.undo();
        expect(store.sheetHistories.word.size).toBe(0);
        const listed = [...store.state.doc.wordIds];
        store.undoSheet('word');
        expect(store.state.doc.wordIds).toEqual(listed);

        store.dispatchSync(fromTab(addWord('w3', 'Other')));
        store.redo();
        expect(store.sheetHistories.word.size).toBe(0);
      }
    );

    it('keeps every sheet through a schema import, its undo and its redo, which keep the rows the entries were made on', () => {
      const store = make(createContext());
      store.dispatchSync(addWord('w1', 'Old'));
      store.dispatchSync(
        loadJsonAction$(toJson(store.state), { keepDictionaries: true })
      );
      store.dispatchSync(
        fromTab(
          updateDictionaryAction({
            kind: 'word',
            id: 'w1',
            values: { name: 'Edited' },
          })
        )
      );

      store.undo();
      store.redo();
      store.undo();
      expect(store.sheetHistories.word.size).toBe(1);

      store.undoSheet('word');
      expect(store.state.collections.wordEntities.w1.name).toBe('Old');
    });

    it("unlinks a column typed off a removed domain's type, so undoing the removal leaves it as typed", () => {
      const store = make(createContext());
      store.dispatchSync(
        addTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        addDictionaryAction({
          kind: 'domain',
          id: 'D',
          values: { name: 'Amount', dataType: 'DECIMAL(15,2)' },
        }),
        changeColumnDomainAction({ tableId: 't1', id: 'c1', value: 'D' }),
        changeColumnDataTypeAction({
          tableId: 't1',
          id: 'c1',
          value: 'DECIMAL(15,2)',
        })
      );
      const column = () => store.state.collections.tableColumnEntities.c1;

      store.dispatchSync(
        fromTab(removeDictionaryAction({ kind: 'domain', id: 'D' }))
      );
      store.dispatchSync(
        changeColumnDataTypeAction$({ tableId: 't1', id: 'c1', value: 'INT' })
      );
      expect(column()).toMatchObject({ domainId: '', dataType: 'INT' });

      store.undoSheet('domain');
      expect(store.state.doc.domainIds).toEqual(['D']);
      expect(column()).toMatchObject({ domainId: '', dataType: 'INT' });
    });

    describe('a removed domain a sheet replay types', () => {
      /** Domain D, typed INT on its sheet from TEXT, then c1 linked to it at INT. */
      function seed(store: RxStore) {
        store.dispatchSync(
          addTable('t1'),
          addColumnAction({ id: 'c1', tableId: 't1' }),
          changeColumnDataTypeAction({
            tableId: 't1',
            id: 'c1',
            value: 'VARCHAR',
          }),
          addDictionaryAction({
            kind: 'domain',
            id: 'D',
            values: { name: 'D', dataType: 'TEXT' },
          })
        );
        store.dispatchSync(
          attachDictionarySheetTag$(
            updateDictionaryEntryAction$('domain', 'D', { dataType: 'INT' })
          )
        );
        store.dispatchSync(setColumnDomainAction$('t1', 'c1', 'D'));
      }
      const removeD = () => removeDictionaryEntriesAction$('domain', ['D']);
      const domainOf = (store: RxStore) => ({
        listed: isListed(store.state.doc.domainIds, 'D'),
        dataType: store.state.collections.domainEntities.D.dataType,
      });
      const c1 = (store: RxStore) =>
        store.state.collections.tableColumnEntities.c1;

      it('unlinks a column it leaves off that type, so listing the domain again keeps every link at its type', () => {
        const store = make(createContext());
        seed(store);
        store.dispatchSync(removeD());

        store.undoSheet('domain');
        expect(c1(store)).toMatchObject({ domainId: '', dataType: 'INT' });

        store.undo();
        expect(domainOf(store)).toEqual({ listed: true, dataType: 'TEXT' });
        expect(c1(store)).toMatchObject({ domainId: '', dataType: 'INT' });

        store.redoSheet('domain');
        expect(c1(store)).toMatchObject({ domainId: 'D', dataType: 'INT' });
      });

      it('unlinks it on both of two peers when the other one lists the domain again from its own sheet', () => {
        const [a, b] = [make(createContext()), make(createContext())];
        const forward = (to: RxStore) => (actions: AnyAction[]) => {
          if (hasActionTag(actions, Tag.shared)) return;
          to.dispatchSync(attachActionsTag(Tag.shared, actions));
        };
        a.subscribe(forward(b));
        b.subscribe(forward(a));
        seed(a);
        b.dispatchSync(attachDictionarySheetTag$(removeD()));

        a.undoSheet('domain');
        b.undoSheet('domain');
        for (const store of [a, b]) {
          expect(domainOf(store)).toEqual({ listed: true, dataType: 'TEXT' });
          expect(c1(store)).toMatchObject({ domainId: '', dataType: 'INT' });
        }
      });
    });

    describe("a domain's type undone from its sheet", () => {
      const domain = (id: string, dataType: string) =>
        addDictionaryAction({
          kind: 'domain',
          id,
          values: { name: id, dataType },
        });
      const linked = (domainId: string, dataType: string) => [
        changeColumnDomainAction({ tableId: 't1', id: 'c1', value: domainId }),
        changeColumnDataTypeAction({
          tableId: 't1',
          id: 'c1',
          value: dataType,
        }),
      ];

      /** Domain D at INT linking c1, then the tab's change of D to BIGINT, which spreads to c1. */
      function seed() {
        const store = make(createContext());
        store.dispatchSync(
          addTable('t1'),
          addColumnAction({ id: 'c1', tableId: 't1' }),
          domain('D', 'INT'),
          domain('E', 'VARCHAR'),
          ...linked('D', 'INT')
        );
        store.dispatchSync(
          fromTab(
            updateDictionaryAction({
              kind: 'domain',
              id: 'D',
              values: { dataType: 'BIGINT' },
            })
          ),
          fromTab(
            changeColumnDataTypeAction({
              tableId: 't1',
              id: 'c1',
              value: 'BIGINT',
            })
          )
        );
        const column = () => store.state.collections.tableColumnEntities.c1;
        return { store, column };
      }

      it('takes back the columns the domain still links, and the domain', () => {
        const { store, column } = seed();
        expect(column().dataType).toBe('BIGINT');

        store.undoSheet('domain');
        expect(store.state.collections.domainEntities.D.dataType).toBe('INT');
        expect(column().dataType).toBe('INT');

        store.redoSheet('domain');
        expect(column().dataType).toBe('BIGINT');
      });

      it('leaves a column the canvas linked elsewhere since, at the type of the domain it links now', () => {
        const { store, column } = seed();
        store.dispatchSync(...linked('E', 'VARCHAR'));

        store.undoSheet('domain');
        expect(store.state.collections.domainEntities.D.dataType).toBe('INT');
        expect(column()).toMatchObject({ domainId: 'E', dataType: 'VARCHAR' });

        store.redoSheet('domain');
        expect(column()).toMatchObject({ domainId: 'E', dataType: 'VARCHAR' });
      });

      /**
       * Key pk at D1 and foreign key fk at D2, both INT, then the tab's change
       * of D1 to BIGINT, which the sync carries to fk and so off D2.
       */
      function seedRelated({ removed = false, d2Type = 'INT' } = {}) {
        const store = make(createContext());
        const link = (
          tableId: string,
          id: string,
          domainId: string,
          dataType: string
        ) => [
          changeColumnDomainAction({ tableId, id, value: domainId }),
          changeColumnDataTypeAction({ tableId, id, value: dataType }),
        ];
        store.dispatchSync(
          addTable('t1'),
          addTable('t2'),
          addColumnAction({ id: 'pk', tableId: 't1' }),
          addColumnAction({ id: 'fk', tableId: 't2' }),
          domain('D1', 'INT'),
          domain('D2', d2Type),
          domain('E', 'INT'),
          domain('F', 'BIGINT'),
          ...link('t1', 'pk', 'D1', 'INT'),
          ...link('t2', 'fk', 'D2', 'INT'),
          addRelationshipAction({
            id: 'r1',
            relationshipType: 4,
            start: { tableId: 't1', columnIds: ['pk'] },
            end: { tableId: 't2', columnIds: ['fk'] },
          })
        );
        if (removed) {
          store.dispatchSync(
            fromTab(removeDictionaryAction({ kind: 'domain', id: 'D2' }))
          );
        }
        store.dispatchSync(
          attachDictionarySheetTag$(
            updateDictionaryEntryAction$('domain', 'D1', { dataType: 'BIGINT' })
          )
        );
        const columnOf = (id: string) =>
          store.state.collections.tableColumnEntities[id];
        return { store, columnOf, link };
      }

      it('links again a column its own entry carried off another domain', () => {
        const { store, columnOf } = seedRelated();
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'BIGINT',
        });

        store.undoSheet('domain');
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'INT',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: 'D2',
          dataType: 'INT',
        });

        store.redoSheet('domain');
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'BIGINT',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'BIGINT',
        });
      });

      it('leaves the link the canvas gave that column since', () => {
        const { store, columnOf, link } = seedRelated();
        store.dispatchSync(...link('t2', 'fk', 'E', 'INT'));

        store.undoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: 'E',
          dataType: 'INT',
        });
      });

      it.each([
        ['at', 'INT', 'D2'],
        ['off', 'VARCHAR', ''],
      ])(
        "links again a column its own entry carried off a removed domain only while it ends %s that domain's type",
        (_, d2Type, domainId) => {
          const { store, columnOf } = seedRelated({ removed: true, d2Type });
          expect(columnOf('fk')).toMatchObject({
            domainId: '',
            dataType: 'BIGINT',
          });

          store.undoSheet('domain');
          expect(columnOf('fk')).toMatchObject({ domainId, dataType: 'INT' });

          store.undoSheet('domain');
          expect(store.state.doc.domainIds).toContain('D2');
          expect(columnOf('fk')).toMatchObject({ domainId, dataType: 'INT' });
        }
      );

      it('links again on an undo the link its redo took off, one the canvas gave since', () => {
        const { store, columnOf, link } = seedRelated();
        store.undoSheet('domain');
        store.dispatchSync(...link('t2', 'fk', 'E', 'INT'));

        store.redoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'BIGINT',
        });

        store.undoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: 'E',
          dataType: 'INT',
        });
      });

      it('links again on a redo the link its undo took off', () => {
        const { store, columnOf, link } = seedRelated();
        store.dispatchSync(...link('t2', 'fk', 'F', 'BIGINT'));

        store.undoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'INT',
        });

        store.redoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: 'F',
          dataType: 'BIGINT',
        });
      });

      const typeFk = (store: RxStore) =>
        store.dispatchSync(
          changeColumnDataTypeAction$({
            tableId: 't2',
            id: 'fk',
            value: 'TEXT',
          })
        );

      it('leaves a column typed by hand since unlinked at its type, and the key the sync carried with it', () => {
        const { store, columnOf } = seedRelated();
        typeFk(store);

        store.undoSheet('domain');
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'TEXT',
        });
        expect(columnOf('pk')).toMatchObject({
          domainId: '',
          dataType: 'TEXT',
        });
      });

      it.each([
        ['the sheet first', ['undoSheet', 'undo']],
        ['the canvas first', ['undo', 'undoSheet']],
      ] as const)(
        'leaves the columns of a typed type the canvas undoes and redoes around the undone sheet as typed, %s',
        (_, undos) => {
          const { store, columnOf } = seedRelated();
          typeFk(store);

          for (const undo of undos) {
            if (undo === 'undo') store.undo();
            else store.undoSheet('domain');
          }
          store.redo();

          expect(columnOf('fk')).toMatchObject({
            domainId: '',
            dataType: 'TEXT',
          });
          expect(columnOf('pk')).toMatchObject({
            domainId: '',
            dataType: 'TEXT',
          });
        }
      );
    });

    describe('a link the document history replays', () => {
      /** Domain d1 at INT linking c1, typed INT. */
      function seed() {
        const store = make(createContext());
        store.dispatchSync(
          addTable('t1'),
          addColumnAction({ id: 'c1', tableId: 't1' }),
          addDictionaryAction({
            kind: 'domain',
            id: 'd1',
            values: { name: 'Identifier', dataType: 'INT' },
          }),
          changeColumnDomainAction({ tableId: 't1', id: 'c1', value: 'd1' }),
          changeColumnDataTypeAction({ tableId: 't1', id: 'c1', value: 'INT' })
        );
        const toBigint = () =>
          store.dispatchSync(
            attachDictionarySheetTag$(
              updateDictionaryEntryAction$('domain', 'd1', {
                dataType: 'BIGINT',
              })
            )
          );
        const column = () => store.state.collections.tableColumnEntities.c1;
        return { store, toBigint, column };
      }
      const batchesOf = (store: RxStore, replay: () => void) => {
        let batches = 0;
        const unsubscribe = store.subscribe(() => batches++);
        replay();
        unsubscribe();
        return batches;
      };

      it.each(['TEXT', 'BIGINT'])(
        'gives the column an undone %s type takes off the domain the type the domain holds now',
        typed => {
          const { store, toBigint, column } = seed();
          store.dispatchSync(
            changeColumnDataTypeAction$({
              tableId: 't1',
              id: 'c1',
              value: typed,
            })
          );
          toBigint();

          store.undo();
          expect(column()).toMatchObject({
            domainId: 'd1',
            dataType: 'BIGINT',
          });

          store.redo();
          expect(column()).toMatchObject({ domainId: '', dataType: typed });
        }
      );

      it('gives a link redone the type its domain holds now', () => {
        const { store, toBigint, column } = seed();
        store.dispatchSync(
          changeColumnDomainAction({ tableId: 't1', id: 'c1', value: '' }),
          changeColumnDataTypeAction({
            tableId: 't1',
            id: 'c1',
            value: 'VARCHAR',
          })
        );
        store.dispatchSync(setColumnDomainAction$('t1', 'c1', 'd1'));
        store.undo();
        expect(column()).toMatchObject({ domainId: '', dataType: 'VARCHAR' });
        toBigint();

        store.redo();
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'BIGINT' });
      });

      it('gives the columns of a table brought back the type their domain holds now', () => {
        const { store, toBigint, column } = seed();
        store.dispatchSync(removeTableAction$('t1'));
        toBigint();
        expect(column().dataType).toBe('INT');

        store.undo();
        expect(store.state.doc.tableIds).toEqual(['t1']);
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'BIGINT' });
      });

      it('gives a column brought back on its own the type its domain holds now', () => {
        const { store, toBigint, column } = seed();
        store.dispatchSync(removeColumnAction$('t1', ['c1']));
        toBigint();
        expect(column().dataType).toBe('INT');

        store.undo();
        expect(store.state.collections.tableEntities.t1.columnIds).toEqual([
          'c1',
        ]);
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'BIGINT' });
      });

      it("sends a replay as the one batch it recorded where every column ends at its domain's type, and settles the rest in a second", () => {
        const { store, toBigint, column } = seed();
        store.dispatchSync(
          changeColumnDataTypeAction$({
            tableId: 't1',
            id: 'c1',
            value: 'TEXT',
          })
        );

        expect(batchesOf(store, store.undo)).toBe(1);
        expect(batchesOf(store, store.redo)).toBe(1);
        toBigint();
        expect(batchesOf(store, store.undo)).toBe(2);
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'BIGINT' });
      });

      it('settles no column of a table a peer removed since, sending the one batch it recorded', () => {
        const { store, toBigint, column } = seed();
        store.dispatchSync(
          changeColumnDataTypeAction$({
            tableId: 't1',
            id: 'c1',
            value: 'TEXT',
          })
        );
        store.dispatchSync(
          attachActionTag(Tag.shared, removeTableAction({ id: 't1' }))
        );
        toBigint();

        expect(batchesOf(store, store.undo)).toBe(1);
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'INT' });
      });

      const removeD1 = (store: RxStore) =>
        store.dispatchSync(
          attachDictionarySheetTag$(
            removeDictionaryEntriesAction$('domain', ['d1'])
          )
        );

      it.each([
        [
          'an undone type',
          (store: RxStore) =>
            store.dispatchSync(
              changeColumnDataTypeAction$({
                tableId: 't1',
                id: 'c1',
                value: 'TEXT',
              })
            ),
        ],
        [
          'the column of a table brought back',
          (store: RxStore) => store.dispatchSync(removeTableAction$('t1')),
        ],
      ])(
        'unlinks %s off the type of the removed domain it links, so undoing the removal leaves it unlinked',
        (_, edit) => {
          const { store, toBigint, column } = seed();
          edit(store);
          toBigint();
          removeD1(store);

          store.undo();
          expect(column()).toMatchObject({ domainId: '', dataType: 'INT' });

          store.undoSheet('domain');
          expect(store.state.doc.domainIds).toEqual(['d1']);
          expect(column()).toMatchObject({ domainId: '', dataType: 'INT' });
        }
      );

      it("reads a domain's type the entry writes as the replay's own, as a peer's history holds the domain sheet's edit", () => {
        const store = make(createContext());
        store.dispatchSync(
          addTable('t1'),
          addTable('t2'),
          addColumnAction({ id: 'pk', tableId: 't1' }),
          addColumnAction({ id: 'fk', tableId: 't2' }),
          ...['D1', 'D2'].map(id =>
            addDictionaryAction({
              kind: 'domain',
              id,
              values: { name: id, dataType: 'INT' },
            })
          ),
          changeColumnDomainAction({ tableId: 't1', id: 'pk', value: 'D1' }),
          changeColumnDataTypeAction({ tableId: 't1', id: 'pk', value: 'INT' }),
          changeColumnDomainAction({ tableId: 't2', id: 'fk', value: 'D2' }),
          changeColumnDataTypeAction({ tableId: 't2', id: 'fk', value: 'INT' }),
          addRelationshipAction({
            id: 'r1',
            relationshipType: 4,
            start: { tableId: 't1', columnIds: ['pk'] },
            end: { tableId: 't2', columnIds: ['fk'] },
          })
        );
        store.dispatchSync(
          updateDictionaryEntryAction$('domain', 'D1', { dataType: 'BIGINT' })
        );
        const columnOf = (id: string) =>
          store.state.collections.tableColumnEntities[id];

        store.undo();
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'INT',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: 'D2',
          dataType: 'INT',
        });

        store.redo();
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'BIGINT',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'BIGINT',
        });
      });

      it('keeps a link it brings back to a removed domain at its type', () => {
        const { store, column } = seed();
        store.dispatchSync(
          changeColumnDataTypeAction$({
            tableId: 't1',
            id: 'c1',
            value: 'TEXT',
          })
        );
        removeD1(store);

        store.undo();
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'INT' });
      });

      it("works the links out on the state of the store it replays into, as Time Travel's preview does", () => {
        const origin = make(createContext());
        origin.dispatchSync(
          ...[
            addTable('t1'),
            addTable('t2'),
            addColumnAction({ id: 'pk', tableId: 't1' }),
            addColumnAction({ id: 'fk', tableId: 't2' }),
            changeColumnDataTypeAction({
              tableId: 't1',
              id: 'pk',
              value: 'TEXT',
            }),
            changeColumnDataTypeAction({
              tableId: 't2',
              id: 'fk',
              value: 'VARCHAR',
            }),
            addDictionaryAction({
              kind: 'domain',
              id: 'd1',
              values: { name: 'Identifier', dataType: 'INT' },
            }),
          ].map(action => attachActionTag(Tag.shared, action))
        );
        origin.dispatchSync(setColumnDomainAction$('t1', 'pk', 'd1'));
        origin.dispatchSync(
          addRelationshipAction({
            id: 'r1',
            relationshipType: 4,
            start: { tableId: 't1', columnIds: ['pk'] },
            end: { tableId: 't2', columnIds: ['fk'] },
          })
        );

        const preview = make(createContext(), {
          getHistory: origin.history.clone,
        });
        preview.dispatchSync(initialLoadJsonAction$(toJson(origin.state)));
        origin.dispatchSync(
          attachDictionarySheetTag$(
            updateDictionaryEntryAction$('domain', 'd1', { dataType: 'BIGINT' })
          )
        );
        preview.undo();
        preview.undo();
        preview.redo();

        expect(preview.state.doc.relationshipIds).toEqual([]);
        expect(preview.state.collections.tableColumnEntities.pk).toMatchObject({
          domainId: 'd1',
          dataType: 'INT',
        });
        expect(preview.state.collections.tableColumnEntities.fk.dataType).toBe(
          'VARCHAR'
        );
      });

      /** Key pk and foreign key fk, related, with the domains and types given. */
      function seedKeyed(...actions: AnyAction[]) {
        const store = make(createContext());
        store.dispatchSync(
          addTable('t1'),
          addTable('t2'),
          addColumnAction({ id: 'pk', tableId: 't1' }),
          addColumnAction({ id: 'fk', tableId: 't2' }),
          ...actions,
          addRelationshipAction({
            id: 'r1',
            relationshipType: 4,
            start: { tableId: 't1', columnIds: ['pk'] },
            end: { tableId: 't2', columnIds: ['fk'] },
          })
        );
        const columnOf = (id: string) =>
          store.state.collections.tableColumnEntities[id];
        return { store, columnOf };
      }
      const domain = (id: string, dataType: string) =>
        addDictionaryAction({
          kind: 'domain',
          id,
          values: { name: id, dataType },
        });
      const typed = (tableId: string, id: string, value: string) =>
        changeColumnDataTypeAction({ tableId, id, value });
      const linked = (tableId: string, id: string, value: string) =>
        changeColumnDomainAction({ tableId, id, value });
      const focusOn = (store: RxStore, tableId: string, columnId: string) =>
        store.dispatchSync(
          focusColumnAction({
            tableId,
            columnId,
            focusType: FocusType.columnName,
            $mod: false,
            shiftKey: false,
          })
        );

      it.each([
        ['an unlink', () => setColumnDomainAction$('t1', 'pk', '')],
        [
          'a typed type',
          () =>
            changeColumnDataTypeAction$({
              tableId: 't1',
              id: 'pk',
              value: 'TEXT',
            }),
        ],
      ])(
        'undoes %s of a key as recorded, leaving a foreign key off the key as it was',
        (_, edit) => {
          const { store, columnOf } = seedKeyed(
            domain('D1', 'INT'),
            linked('t1', 'pk', 'D1'),
            typed('t1', 'pk', 'INT'),
            typed('t2', 'fk', 'BIGINT')
          );
          store.dispatchSync(edit());

          store.undo();
          expect(columnOf('pk')).toMatchObject({
            domainId: 'D1',
            dataType: 'INT',
          });
          expect(columnOf('fk')).toMatchObject({
            domainId: '',
            dataType: 'BIGINT',
          });
        }
      );

      it("undoes a serial key's unlink as recorded, leaving its foreign key on the domain it links", () => {
        const { store, columnOf } = seedKeyed(
          changeDatabaseAction({ value: Database.MySQL }),
          domain('D1', 'SERIAL'),
          domain('D2', 'BIGINT'),
          linked('t1', 'pk', 'D1'),
          typed('t1', 'pk', 'SERIAL'),
          typed('t2', 'fk', 'BIGINT UNSIGNED')
        );
        store.dispatchSync(setColumnDomainAction$('t2', 'fk', 'D2'));
        store.dispatchSync(setColumnDomainAction$('t1', 'pk', ''));

        store.undo();
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'SERIAL',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: 'D2',
          dataType: 'BIGINT',
        });
      });

      it("keeps a foreign key's link the replay brings back where the sync reaches it at that domain's type, over a peer's link since", () => {
        const { store, columnOf } = seedKeyed(
          domain('D1', 'INT'),
          domain('D2', 'TEXT'),
          domain('E', 'BIGINT'),
          domain('F', 'VARCHAR'),
          linked('t1', 'pk', 'D1'),
          typed('t1', 'pk', 'INT'),
          linked('t2', 'fk', 'E'),
          typed('t2', 'fk', 'BIGINT')
        );
        store.dispatchSync(setColumnDomainAction$('t1', 'pk', 'D2'));
        expect(columnOf('fk')).toMatchObject({
          domainId: '',
          dataType: 'TEXT',
        });
        store.dispatchSync(
          attachDictionarySheetTag$(
            updateDictionaryEntryAction$('domain', 'D1', { dataType: 'BIGINT' })
          )
        );
        store.dispatchSync(
          ...[linked('t2', 'fk', 'F'), typed('t2', 'fk', 'VARCHAR')].map(
            action => attachActionTag(Tag.shared, action)
          )
        );

        store.undo();
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'BIGINT',
        });
        expect(columnOf('fk')).toMatchObject({
          domainId: 'E',
          dataType: 'BIGINT',
        });
      });

      it('gives a column a peer linked since to a domain the replay types that type', () => {
        const { store, column } = seed();
        store.dispatchSync(
          updateDictionaryEntryAction$('domain', 'd1', { dataType: 'BIGINT' })
        );
        store.dispatchSync(
          ...[
            addTable('t2'),
            addColumnAction({ id: 'c2', tableId: 't2' }),
            changeColumnDomainAction({ tableId: 't2', id: 'c2', value: 'd1' }),
            changeColumnDataTypeAction({
              tableId: 't2',
              id: 'c2',
              value: 'BIGINT',
            }),
          ].map(action => attachActionTag(Tag.shared, action))
        );
        const c2 = () => store.state.collections.tableColumnEntities.c2;

        store.undo();
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'INT' });
        expect(c2()).toMatchObject({ domainId: 'd1', dataType: 'INT' });

        store.redo();
        expect(c2()).toMatchObject({ domainId: 'd1', dataType: 'BIGINT' });
      });

      it('spreads the type it gives a key brought back over the relationships brought back with it', () => {
        const { store, columnOf } = seedKeyed(
          addTable('t3'),
          addColumnAction({ id: 'fk2', tableId: 't3' }),
          domain('D1', 'INT'),
          typed('t1', 'pk', 'INT'),
          typed('t2', 'fk', 'INT'),
          typed('t3', 'fk2', 'INT'),
          addRelationshipAction({
            id: 'r2',
            relationshipType: 4,
            start: { tableId: 't1', columnIds: ['pk'] },
            end: { tableId: 't3', columnIds: ['fk2'] },
          })
        );
        store.dispatchSync(setColumnDomainAction$('t1', 'pk', 'D1'));
        store.dispatchSync(removeTableAction$('t1'));
        store.dispatchSync(
          attachDictionarySheetTag$(
            updateDictionaryEntryAction$('domain', 'D1', { dataType: 'BIGINT' })
          )
        );

        store.undo();
        expect(store.state.doc.relationshipIds).toHaveLength(2);
        expect(columnOf('pk')).toMatchObject({
          domainId: 'D1',
          dataType: 'BIGINT',
        });
        expect(columnOf('fk').dataType).toBe('BIGINT');
        expect(columnOf('fk2').dataType).toBe('BIGINT');
      });

      it('redoes a paste of a domain cell as recorded, spreading no type to the foreign key', () => {
        const { store, columnOf } = seedKeyed(
          domain('d1', 'uuid'),
          typed('t1', 'pk', 'INT'),
          typed('t2', 'fk', 'INT'),
          changeShowAction({ show: Show.columnDomain, value: true })
        );
        focusOn(store, 't1', 'pk');
        store.dispatchSync(
          pasteTableAction$([
            createColumn({ dataType: 'uuid', domainId: 'd1' }),
          ])
        );
        expect(columnOf('pk')).toMatchObject({
          domainId: 'd1',
          dataType: 'uuid',
        });

        store.undo();
        expect(columnOf('pk')).toMatchObject({ domainId: '', dataType: 'INT' });
        store.redo();
        expect(columnOf('pk')).toMatchObject({
          domainId: 'd1',
          dataType: 'uuid',
        });
        expect(columnOf('fk').dataType).toBe('INT');
      });

      it('unlinks a column an undone paste types off the type its domain holds now, as a typed type does', () => {
        const { store, toBigint, column } = seed();
        focusOn(store, 't1', 'c1');
        store.dispatchSync(
          pasteTableAction$([createColumn({ dataType: 'INT' })])
        );
        expect(column()).toMatchObject({ domainId: 'd1', dataType: 'INT' });
        toBigint();

        store.undo();
        expect(column()).toMatchObject({ domainId: '', dataType: 'INT' });
      });

      it.each([
        ['gives a column the type its listed domain holds now', false, 'd1'],
        ['unlinks a column off the type its removed domain holds', true, ''],
      ])(
        "%s when a schema import's undo brings it back",
        (_, removed, domainId) => {
          const { store, toBigint, column } = seed();
          const empty = make(createContext());
          store.dispatchSync(
            loadJsonAction$(toJson(empty.state), { keepDictionaries: true })
          );
          expect(store.state.doc.tableIds).toEqual([]);
          toBigint();
          if (removed) removeD1(store);

          store.undo();
          expect(store.state.doc.tableIds).toEqual(['t1']);
          expect(column()).toMatchObject({
            domainId,
            dataType: removed ? 'INT' : 'BIGINT',
          });
        }
      );
    });

    it("keeps every live column linking a listed domain at its type through random edits, a peer's among them, undos and redos", () => {
      let seed = 20261022;
      const pick = <T>(list: ReadonlyArray<T>): T => {
        seed = (seed * 48271) % 2147483647;
        return list[seed % list.length];
      };
      const types = ['INT', 'BIGINT', 'TEXT', 'SERIAL'];
      const domainIds = ['D1', 'D2', 'D3'];
      const columns = [
        ['t1', 'pk'],
        ['t2', 'fk'],
        ['t3', 'fk2'],
      ];
      const violations: string[] = [];

      for (let run = 0; run < 300; run++) {
        const store = make(createContext());
        store.dispatchSync(
          ...columns.flatMap(([tableId, id]) => [
            addTable(tableId),
            addColumnAction({ tableId, id }),
          ]),
          ...domainIds.map(id =>
            addDictionaryAction({
              kind: 'domain',
              id,
              values: { name: id, dataType: pick(types) },
            })
          ),
          ...['fk', 'fk2'].map((id, i) =>
            addRelationshipAction({
              id: `r${i}`,
              relationshipType: 4,
              start: { tableId: 't1', columnIds: ['pk'] },
              end: { tableId: `t${i + 2}`, columnIds: [id] },
            })
          )
        );
        store.resetHistory();
        const toDomain = (
          edit: Parameters<typeof attachDictionarySheetTag$>[0]
        ) => store.dispatchSync(attachDictionarySheetTag$(edit));
        const steps = [
          () => {
            const [tableId, id] = pick(columns);
            const value = pick(types);
            store.dispatchSync(
              changeColumnDataTypeAction$({ tableId, id, value })
            );
          },
          () => {
            const [tableId, id] = pick(columns);
            store.dispatchSync(
              setColumnDomainAction$(tableId, id, pick(['', ...domainIds]))
            );
          },
          () =>
            toDomain(
              updateDictionaryEntryAction$('domain', pick(domainIds), {
                dataType: pick(types),
              })
            ),
          () =>
            toDomain(
              removeDictionaryEntriesAction$('domain', [pick(domainIds)])
            ),
          () =>
            store.dispatchSync(
              updateDictionaryEntryAction$('domain', pick(domainIds), {
                dataType: pick(types),
              })
            ),
          () => {
            const [tableId, id] = pick(columns);
            const value = pick(domainIds);
            const { dataType } = store.state.collections.domainEntities[value];
            store.dispatchSync(
              ...[
                changeColumnDomainAction({ tableId, id, value }),
                changeColumnDataTypeAction({ tableId, id, value: dataType }),
              ].map(action => attachActionTag(Tag.shared, action))
            );
          },
          () =>
            store.dispatchSync(
              changeRelationshipDataTypeSyncAction({
                value: !store.state.settings.relationshipDataTypeSync,
              })
            ),
          () => store.undo(),
          () => store.redo(),
          () => store.undoSheet('domain'),
          () => store.redoSheet('domain'),
        ];

        for (let step = 0; step < 30; step++) {
          pick(steps)();
          const { doc, collections } = store.state;
          for (const [tableId, id] of columns) {
            if (!doc.tableIds.includes(tableId)) continue;
            const { domainId, dataType } = collections.tableColumnEntities[id];
            const domainType = collections.domainEntities[domainId]?.dataType;
            if (isListed(doc.domainIds, domainId) && dataType !== domainType) {
              violations.push(`${run}:${step} ${id} ${dataType} ${domainType}`);
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('puts a tagged batch with no dictionary row into the document history', () => {
      const store = make(createContext());

      store.dispatchSync(fromTab(addTable('t1')));

      expect(store.history.size).toBe(1);
      expect(store.sheetHistories.word.size).toBe(0);
    });

    it('refuses a sheet undo in a read-only document, and empties every sheet on reset', () => {
      let readonly = false;
      const store = make(createContext(), { getReadonly: () => readonly });

      store.dispatchSync(fromTab(addWord('w1', 'Member')));
      readonly = true;
      store.undoSheet('word');
      store.redoSheet('word');
      expect(store.state.doc.wordIds).toEqual(['w1']);

      readonly = false;
      store.resetHistory();
      expect(store.sheetHistories.word.size).toBe(0);
    });
  });

  describe('readonly', () => {
    it('drops readonly-ignored change actions', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(addTable('t1'));

      expect(store.state.doc.tableIds).toEqual([]);
      expect(store.history.size).toBe(0);
    });

    it('still applies view-only actions', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

      expect(store.state.settings.zoomLevel).toBe(0.5);
    });

    it('records no undo entry for a scroll or a zoom, and records again once writable', () => {
      vi.useFakeTimers();
      let readonly = true;
      const store = make(createContext(), { getReadonly: () => readonly });

      store.dispatchSync(scrollToAction({ originX: 40, originY: 40 }));
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: 40, movementY: 40 })
      );
      vi.advanceTimersByTime(250);
      store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      vi.advanceTimersByTime(250);

      expect(store.history.size).toBe(0);

      readonly = false;
      store.dispatchSync(scrollToAction({ originX: 80, originY: 80 }));
      expect(store.history.size).toBe(1);
    });

    it('lets shared-tagged actions through', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(attachActionTag(Tag.shared, addTable('t1')));

      expect(store.state.doc.tableIds).toEqual(['t1']);
    });

    it('blocks undo and redo', () => {
      let readonly = false;
      const store = make(createContext(), { getReadonly: () => readonly });

      store.dispatchSync(addTable('t1'));
      readonly = true;

      store.undo();
      expect(store.state.doc.tableIds).toEqual(['t1']);

      readonly = false;
      store.undo();
      expect(store.state.doc.tableIds).toEqual([]);

      readonly = true;
      store.redo();
      expect(store.state.doc.tableIds).toEqual([]);
    });
  });

  describe('readonly, on a store that also refuses what opens an edit', () => {
    /** Every way to open an edit, on the table t1, and two dialogs that only read. */
    const openingActions = () => [
      focusTableAction({ tableId: 't1', focusType: FocusType.tableName }),
      editTableAction(),
      editMemoAction({ id: 'm1' }),
      editTableGroupAction({ id: 'g1' }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN }),
      changeOpenMapAction({ [Open.mapColumns]: true }),
      changeOpenMapAction({ [Open.automaticTablePlacement]: true }),
      changeOpenMapAction({ [Open.timeTravel]: true }),
      changeOpenMapAction({ [Open.tableProperties]: true }),
      changeOpenMapAction({ [Open.diffViewer]: true }),
    ];

    function setup({ readonlyEditState = true } = {}) {
      let readonly = false;
      const store = make(createContext(), {
        getReadonly: () => readonly,
        readonlyEditState,
      });
      store.dispatchSync(addTable('t1'));
      return {
        store,
        setReadonly: (value: boolean) => {
          readonly = value;
        },
      };
    }

    it('drops each opening and keeps the focus and the dialogs that only read', () => {
      const { store, setReadonly } = setup();
      setReadonly(true);

      store.dispatchSync(...openingActions());

      const { editor } = store.state;
      expect(editor.focusTable?.tableId).toBe('t1');
      expect(editor.focusTable?.edit).toBe(false);
      expect(editor.editMemoId).toBeNull();
      expect(editor.editTableGroupId).toBeNull();
      expect(editor.drawRelationship).toBeNull();
      expect(editor.openMap[Open.mapColumns]).toBeFalsy();
      expect(editor.openMap[Open.automaticTablePlacement]).toBeFalsy();
      expect(editor.openMap[Open.timeTravel]).toBeFalsy();
      expect(editor.openMap[Open.tableProperties]).toBe(true);
      expect(editor.openMap[Open.diffViewer]).toBe(true);
      expect(store.history.size).toBe(1);
    });

    it('lets each close through, so what stood open as it turned readonly ends', () => {
      const { store, setReadonly } = setup();
      store.dispatchSync(...openingActions());
      setReadonly(true);

      store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
      expect(store.state.editor.drawRelationship?.start).toBeNull();

      store.dispatchSync(
        editTableEndAction(),
        editMemoEndAction(),
        editTableGroupEndAction(),
        drawEndRelationshipAction(),
        changeOpenMapAction({
          [Open.mapColumns]: false,
          [Open.automaticTablePlacement]: false,
          [Open.timeTravel]: false,
        })
      );

      const { editor } = store.state;
      expect(editor.focusTable?.edit).toBe(false);
      expect(editor.editMemoId).toBeNull();
      expect(editor.editTableGroupId).toBeNull();
      expect(editor.drawRelationship).toBeNull();
      expect(editor.openMap[Open.mapColumns]).toBe(false);
      expect(editor.openMap[Open.automaticTablePlacement]).toBe(false);
      expect(editor.openMap[Open.timeTravel]).toBe(false);
      expect(editor.openMap[Open.tableProperties]).toBe(true);
    });

    it('still raises a table, which writes no document', () => {
      const { store, setReadonly } = setup();
      setReadonly(true);

      store.dispatchSync(changeTableZIndexAction({ id: 't1', zIndex: 9 }));

      expect(store.state.collections.tableEntities.t1.ui.zIndex).toBe(9);
    });

    it('opens each edit while it is writable', () => {
      const { store } = setup();

      store.dispatchSync(...openingActions());
      store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

      const { editor } = store.state;
      expect(editor.focusTable?.edit).toBe(true);
      expect(editor.editMemoId).toBe('m1');
      expect(editor.editTableGroupId).toBe('g1');
      expect(editor.drawRelationship?.start?.tableId).toBe('t1');
      expect(editor.openMap[Open.mapColumns]).toBe(true);
      expect(editor.openMap[Open.automaticTablePlacement]).toBe(true);
      expect(editor.openMap[Open.timeTravel]).toBe(true);
    });

    it('opens each edit in a readonly store that does not ask for it', () => {
      const { store, setReadonly } = setup({ readonlyEditState: false });
      setReadonly(true);

      store.dispatchSync(...openingActions());
      store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

      const { editor } = store.state;
      expect(editor.focusTable?.edit).toBe(true);
      expect(editor.editMemoId).toBe('m1');
      expect(editor.editTableGroupId).toBe('g1');
      expect(editor.drawRelationship?.start?.tableId).toBe('t1');
      expect(editor.openMap[Open.mapColumns]).toBe(true);
      expect(editor.openMap[Open.automaticTablePlacement]).toBe(true);
      expect(editor.openMap[Open.timeTravel]).toBe(true);
    });
  });

  describe('change$', () => {
    it('emits change actions after the debounce window', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(addTable('t1'));
      store.dispatchSync(addTable('t2'));
      expect(seen).toHaveLength(0);

      vi.advanceTimersByTime(250);
      expect(seen).toHaveLength(1);
      expect(seen[0].map(action => action.type)).toEqual(['table.add']);

      subscription.unsubscribe();
    });

    it('ignores non-change actions', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(unselectAllAction(), addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(seen).toHaveLength(1);
      expect(seen[0].map(action => action.type)).toEqual(['table.add']);

      subscription.unsubscribe();
    });

    it('emits no scroll or zoom a readonly reader makes, though the viewport is unlocked', () => {
      vi.useFakeTimers();
      let readonly = false;
      const store = make(createContext(), { getReadonly: () => readonly });
      store.dispatchSync(unlock(LockSettingType.viewport));
      vi.advanceTimersByTime(250);
      readonly = true;
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(
        scrollToAction({ originX: 40, originY: 40 }),
        changeZoomLevelAction({ value: 0.5 })
      );
      // Writable again inside the debounce window, which sends none of it.
      vi.advanceTimersByTime(100);
      readonly = false;
      vi.advanceTimersByTime(150);
      expect(seen).toEqual([]);
      expect(store.state.settings.zoomLevel).toBe(0.5);

      store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));
      vi.advanceTimersByTime(250);
      expect(seen.map(actions => actions.map(({ type }) => type))).toEqual([
        ['settings.changeZoomLevel'],
      ]);

      subscription.unsubscribe();
    });

    it("emits only a peer's edit while readonly, none of the code settings and the database its reader changes", () => {
      vi.useFakeTimers();
      let readonly = false;
      const store = make(createContext(), { getReadonly: () => readonly });
      store.dispatchSync(
        unlock(LockSettingType.language),
        unlock(LockSettingType.tableNameCase),
        unlock(LockSettingType.columnNameCase),
        unlock(LockSettingType.bracketType)
      );
      vi.advanceTimersByTime(250);
      readonly = true;
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(
        changeLanguageAction({ value: Language.Kotlin }),
        changeTableNameCaseAction({ value: NameCase.snakeCase }),
        changeColumnNameCaseAction({ value: NameCase.snakeCase }),
        changeBracketTypeAction({ value: BracketType.backtick }),
        changeDatabaseAction({ value: Database.PostgreSQL }),
        attachActionTag(Tag.shared, addTable('t1'))
      );
      vi.advanceTimersByTime(250);

      expect(seen.map(actions => actions.map(({ type }) => type))).toEqual([
        ['table.add'],
      ]);
      expect(store.state.settings).toMatchObject({
        language: Language.Kotlin,
        database: Database.PostgreSQL,
      });

      subscription.unsubscribe();
    });
  });

  /**
   * The element's change event: a locked setting's change moves the screen
   * and never the file, so it leaves no change behind, the lock read as the
   * batch passes.
   */
  describe('change$ with the locks', () => {
    const lockedChanges = [
      scrollToAction({ originX: 40, originY: 40 }),
      streamScrollToAction({ movementX: 4, movementY: 4 }),
      changeZoomLevelAction({ value: 0.5 }),
      streamZoomLevelAction({ value: 0.1 }),
      changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
      changeLanguageAction({ value: Language.Kotlin }),
      changeTableNameCaseAction({ value: 8 }),
      changeColumnNameCaseAction({ value: 8 }),
      changeBracketTypeAction({ value: 8 }),
    ];

    function watch(store: RxStore) {
      const seen: string[][] = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions.map(({ type }) => type))
      );
      return { seen, subscription };
    }

    it('leaves out every change of a locked setting', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const { seen, subscription } = watch(store);

      for (const action of lockedChanges) store.dispatchSync(action);
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([]);
      expect(store.state.settings).toMatchObject({
        zoomLevel: 0.6,
        canvasType: CanvasType.schemaSQL,
        language: Language.Kotlin,
      });
      subscription.unsubscribe();
    });

    it('keeps the edit a locked change rides with', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const { seen, subscription } = watch(store);

      store.dispatchSync(
        scrollToAction({ originX: 9, originY: 9 }),
        addTable('t1')
      );
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([['table.add']]);
      subscription.unsubscribe();
    });

    it('reports the lock itself and every change of the setting once unlocked', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const { seen, subscription } = watch(store);

      store.dispatchSync(unlock(LockSettingType.language));
      vi.advanceTimersByTime(250);
      store.dispatchSync(changeLanguageAction({ value: Language.Go }));
      store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([
        ['settings.changeLockSettings'],
        ['settings.changeLanguage'],
      ]);
      subscription.unsubscribe();
    });

    it('leaves out a peer’s batch of the save switch the locks replaced, the value left as it was', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const { seen, subscription } = watch(store);
      const before = toJson(store.state);

      store.dispatchSync(
        attachActionTag(
          Tag.shared,
          changeIgnoreSaveSettingsAction({ saveSettingType: 3, value: true })
        )
      );
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([]);
      expect(toJson(store.state)).toBe(before);
      subscription.unsubscribe();
    });
  });

  it('merges remote versions into the clock', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync({ ...addTable('t1'), version: 10 });
    expect(context.clock.getVersion()).toBe(10);

    store.dispatchSync({ ...addTable('t2'), version: 3 });
    expect(context.clock.getVersion()).toBe(10);
  });

  it('destroy detaches every subscription and clears history', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync(addTable('t1'));
    expect(store.history.size).toBe(1);

    store.destroy();

    expect(store.history.size).toBe(0);
    store.dispatchSync(addTable('t2'));
    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(1);
  });

  it('tags helper produces bit flags the pipeline understands', () => {
    const tagged = attachActionTag(
      Tag.changeOnly,
      attachActionTag(Tag.shared, addTable('t1'))
    );

    expect(bHas(tagged.tags!, Tag.shared)).toBe(true);
    expect(bHas(tagged.tags!, Tag.changeOnly)).toBe(true);
  });

  describe('while a view is active', () => {
    /** A store holding one table and one column, standing in a view on the table. */
    function makeWithView(unlocked = 0) {
      const store = make(createContext());
      if (unlocked) store.dispatchSync(unlock(unlocked));
      store.dispatchSync(
        addTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' })
      );
      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization }),
        changeVisualizationModeAction({ value: VisualizationMode.flow })
      );
      store.dispatchSync(
        viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
        viewSetLayoutAction({
          kind: ViewKind.flow,
          positions: { t1: { x: 0, y: 0 } },
        })
      );
      return store;
    }

    /** The document as the view found it, to hold against after the view acts. */
    function documentPlacement(store: RxStore) {
      const { originX, originY, zoomLevel } = store.state.settings;
      const { x, y } = store.state.collections.tableEntities['t1'].ui;
      return { originX, originY, zoomLevel, table: { x, y } };
    }

    function collectChanges(store: RxStore) {
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );
      return { seen, subscription };
    }

    // AC-7, AC-8: every placement lands in the view and never in the document
    // or the host's change stream.
    it('takes the scrolls and zooms into the view, leaving the document and change$ untouched', () => {
      vi.useFakeTimers();
      const store = makeWithView();
      const before = documentPlacement(store);
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(scrollToAction({ originX: 120, originY: -80 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: 10, movementY: 10 })
      );
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      store.dispatchSync(changeZoomLevelAction$(0.8));
      store.dispatchSync(streamZoomLevelAction$(-0.1));
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([]);
      expect(documentPlacement(store)).toEqual(before);
      expect(store.state.editor.views.flow).toMatchObject({
        zoomLevel: 0.7,
      });
      expect(store.state.editor.views.flow?.originX).not.toBe(0);

      subscription.unsubscribe();
    });

    // AC-9: the document is closed to edits for as long as a view is open.
    it('drops the document edits before they reach the store', () => {
      vi.useFakeTimers();
      const store = makeWithView();
      const before = documentPlacement(store);
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(
        addTable('t2'),
        changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'renamed' }),
        addRelationshipAction({
          id: 'r1',
          relationshipType: 1,
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't1', columnIds: ['c1'] },
        }),
        changeTableColorAction({ id: 't1', color: '#fff', prevColor: '' }),
        moveTableAction({ ids: ['t1'], movementX: 50, movementY: 50 })
      );
      vi.advanceTimersByTime(250);

      expect(store.state.doc.tableIds).toEqual(['t1']);
      expect(store.state.doc.relationshipIds).toEqual([]);
      expect(store.state.collections.tableColumnEntities['c1'].name).toBe('id');
      expect(store.state.collections.tableEntities['t1'].ui.color).toBe('');
      expect(documentPlacement(store)).toEqual(before);
      expect(seen).toEqual([]);

      subscription.unsubscribe();
    });

    // AC-10
    it('leaves the undo stack where it was after any view manipulation', () => {
      vi.useFakeTimers();
      const store = makeWithView();
      const size = store.history.size;
      expect(size).toBeGreaterThan(0);

      store.dispatchSync(scrollToAction({ originX: 120, originY: -80 }));
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: 100, movementY: 100 })
      );
      store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      store.dispatchSync(addTable('t2'));
      store.dispatchSync(
        moveTableAction({ ids: ['t1'], movementX: 9, movementY: 9 })
      );
      vi.advanceTimersByTime(300);

      expect(store.history.size).toBe(size);
      expect(store.history.hasRedo()).toBe(false);
    });

    // AC-49
    it('refuses undo and redo, and takes them again once the view closes', () => {
      const store = make(createContext());
      store.dispatchSync(addTable('t1'));
      store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
      store.undo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('');
      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization }),
        changeVisualizationModeAction({ value: VisualizationMode.flow }),
        viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] })
      );

      store.undo();
      expect(store.state.doc.tableIds).toEqual(['t1']);
      store.redo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('');
      expect(store.history.hasUndo()).toBe(true);
      expect(store.history.hasRedo()).toBe(true);

      store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
      store.redo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('users');
      store.undo();
      store.undo();
      expect(store.state.doc.tableIds).toEqual([]);
    });

    // AC-48: a peer's edit reaches the document under the view, and never the history.
    it('applies a shared edit to the document without recording it', () => {
      const store = makeWithView();
      const size = store.history.size;

      store.dispatchSync(attachActionTag(Tag.shared, addTable('t2')));
      store.dispatchSync(
        attachActionTag(
          Tag.shared,
          changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'peer' })
        )
      );

      expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
      expect(store.state.collections.tableColumnEntities['c1'].name).toBe(
        'peer'
      );
      expect(store.history.size).toBe(size);
      expect(getActiveView(store.state)).not.toBeNull();
    });

    it('leaves a following placement from a peer to the document', () => {
      const store = makeWithView();

      store.dispatchSync(
        attachActionTag(
          Tag.shared | Tag.following,
          scrollToAction({ originX: 999, originY: 999 })
        )
      );

      expect(store.state.settings.originX).toBe(0);
      expect(store.state.editor.views.flow?.originX).toBe(0);
    });

    // AC-48: the host replacing the document closes the view with it.
    it.each([
      [
        'loadJson',
        (store: RxStore) => loadJsonAction({ value: toJson(store.state) }),
      ],
      ['clear', () => clearAction()],
    ])('lets %s through, and it empties the view', (_, replace) => {
      vi.useFakeTimers();
      const store = makeWithView();
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(replace(store));
      vi.advanceTimersByTime(250);

      expect(store.state.editor.views).toEqual({ flow: null });
      expect(getActiveView(store.state)).toBeNull();
      expect(seen).toHaveLength(1);

      store.dispatchSync(addTable('t9'));
      expect(store.state.doc.tableIds).toContain('t9');

      subscription.unsubscribe();
    });

    it('lets the tab change through, which is how a view is left from another tab', () => {
      vi.useFakeTimers();
      const store = makeWithView(LockSettingType.canvasType);
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization })
      );
      vi.advanceTimersByTime(250);

      expect(store.state.settings.canvasType).toBe(CanvasType.visualization);
      expect(seen.map(actions => actions.map(({ type }) => type))).toEqual([
        ['settings.changeCanvasType'],
      ]);

      subscription.unsubscribe();
    });

    it('gates the same way behind a Flow view, and stops when the tab leaves it', () => {
      const store = make(createContext());
      store.dispatchSync(addTable('t1'));
      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization }),
        changeVisualizationModeAction({ value: VisualizationMode.flow })
      );
      store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
      expect(getActiveView(store.state)?.kind).toBe(ViewKind.flow);

      store.dispatchSync(addTable('t2'));
      store.dispatchSync(scrollToAction({ originX: 50, originY: 50 }));
      expect(store.state.doc.tableIds).toEqual(['t1']);
      expect(store.state.settings.originX).toBe(0);
      expect(store.state.editor.views.flow?.originX).toBe(50);

      store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
      expect(getActiveView(store.state)).toBeNull();

      store.dispatchSync(addTable('t2'));
      store.dispatchSync(scrollToAction({ originX: 70, originY: 70 }));
      expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
      expect(store.state.settings.originX).toBe(70);
      expect(store.state.editor.views.flow?.originX).toBe(50);
    });

    it('classifies a batch by the state before it, so a close and a scroll travel apart', () => {
      const store = makeWithView();

      store.dispatchSync(
        viewCloseAction({ kind: ViewKind.flow }),
        scrollToAction({ originX: 10, originY: 10 })
      );
      expect(store.state.settings.originX).toBe(0);

      store.dispatchSync(scrollToAction({ originX: 10, originY: 10 }));
      expect(store.state.settings.originX).toBe(10);
    });
  });
});

describe('createRxStore stream flushing', () => {
  const recolor = (color: string, prevColor: string) =>
    changeTableColorAction({ id: 't1', color, prevColor });

  it('keeps the 200 ms settle without the flag, where flushStreamBuffers does nothing', () => {
    vi.useFakeTimers();
    const store = make(createContext());
    store.dispatchSync(addTable('t1'));
    const size = store.history.size;

    store.dispatchSync(recolor('#f00', ''));
    store.flushStreamBuffers();
    vi.advanceTimersByTime(199);
    expect(store.history.size).toBe(size);

    vi.advanceTimersByTime(1);
    expect(store.history.size).toBe(size + 1);
  });

  it('records a stream burst on one flushStreamBuffers call under the flag, without advancing timers', () => {
    vi.useFakeTimers();
    const store = make(createContext(), { manualStreamFlush: true });
    store.dispatchSync(addTable('t1'));
    const size = store.history.size;

    store.dispatchSync(recolor('#f00', ''));
    store.dispatchSync(recolor('#0f0', '#f00'));
    vi.advanceTimersByTime(10_000);
    expect(store.history.size).toBe(size);

    store.flushStreamBuffers();
    expect(store.history.size).toBe(size + 1);

    store.flushStreamBuffers();
    expect(store.history.size).toBe(size + 1);

    store.undo();
    expect(store.state.collections.tableEntities['t1'].ui.color).toBe('');
  });

  it('keeps one notifier across resetHistory, whose fresh chain drops the burst it replaced', () => {
    const store = make(createContext(), { manualStreamFlush: true });
    store.dispatchSync(addTable('t1'));

    store.dispatchSync(recolor('#f00', ''));
    store.resetHistory();
    store.flushStreamBuffers();
    expect(store.history.size).toBe(0);

    store.dispatchSync(recolor('#0f0', '#f00'));
    store.flushStreamBuffers();
    expect(store.history.size).toBe(1);

    store.undo();
    expect(store.state.collections.tableEntities['t1'].ui.color).toBe('#f00');
  });

  it('takes a flushStreamBuffers call after destroy without throwing', () => {
    const plain = make(createContext());
    const manual = make(createContext(), { manualStreamFlush: true });
    manual.dispatchSync(addTable('t1'));
    manual.dispatchSync(recolor('#f00', ''));

    plain.destroy();
    manual.destroy();

    expect(() => plain.flushStreamBuffers()).not.toThrow();
    expect(() => manual.flushStreamBuffers()).not.toThrow();
    expect(manual.history.size).toBe(0);
  });
});
