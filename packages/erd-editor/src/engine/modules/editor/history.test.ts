import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { ActionType } from '@/engine/modules/editor/actions';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  loadJsonAction$,
  loadSchemaSQLAction$,
} from '@/engine/modules/editor/generator.actions';
import { editorPushUndoHistoryMap } from '@/engine/modules/editor/history';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDomainAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';
import { createTable } from '@/utils/collection/table.entity';

const TABLE_ID = 'table-1';

function createFixture(): { store: Store } {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });

  const json = JSON.stringify({
    version: '3.0.0',
    settings: { databaseName: 'fixture' },
    doc: { tableIds: [TABLE_ID] },
    collections: {
      tableEntities: {
        [TABLE_ID]: createTable({ id: TABLE_ID, name: 'users' }),
      },
    },
  });

  store.dispatchSync(loadJsonAction({ value: json }));

  return { store };
}

describe('editor/history', () => {
  it('registers undo builders only for loadJson and clear', () => {
    expect(Object.keys(editorPushUndoHistoryMap).sort()).toEqual(
      [ActionType.clear, ActionType.loadJson].sort()
    );
  });

  describe('loadJson', () => {
    it('pushes a clear followed by a snapshot of the current document', () => {
      const { store } = createFixture();
      const undoActions: AnyAction[] = [];

      editorPushUndoHistoryMap[ActionType.loadJson](
        undoActions,
        loadJsonAction({ value: '{"version":"3.0.0"}' }),
        store.state
      );

      expect(undoActions).toHaveLength(2);
      expect(undoActions[0].type).toBe(ActionType.clear);
      expect(undoActions[1].type).toBe(ActionType.loadJson);
      expect(undoActions[1].payload.value).toBe(toJson(store.state));
      expect(JSON.parse(undoActions[1].payload.value).doc.tableIds).toEqual([
        TABLE_ID,
      ]);

      store.destroy();
    });

    it('restores the previous document when the undo actions are dispatched', () => {
      const { store } = createFixture();
      const undoActions: AnyAction[] = [];
      const nextJson = JSON.stringify({
        version: '3.0.0',
        settings: { databaseName: 'next' },
        doc: { tableIds: ['table-2'] },
        collections: {
          tableEntities: {
            'table-2': createTable({ id: 'table-2', name: 'orders' }),
          },
        },
      });

      editorPushUndoHistoryMap[ActionType.loadJson](
        undoActions,
        loadJsonAction({ value: nextJson }),
        store.state
      );

      store.dispatchSync(loadJsonAction({ value: nextJson }));
      expect(store.state.doc.tableIds).toEqual(['table-2']);
      expect(store.state.settings.databaseName).toBe('next');

      store.dispatchSync(...undoActions);
      expect(store.state.doc.tableIds).toEqual([TABLE_ID]);
      expect(store.state.settings.databaseName).toBe('fixture');
      expect(store.state.collections.tableEntities[TABLE_ID].name).toBe(
        'users'
      );

      store.destroy();
    });
  });

  describe('clear', () => {
    it('pushes a single loadJson snapshot of the current document', () => {
      const { store } = createFixture();
      const undoActions: AnyAction[] = [];

      editorPushUndoHistoryMap[ActionType.clear](
        undoActions,
        clearAction(),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.loadJson);
      expect(undoActions[0].payload.value).toBe(toJson(store.state));

      store.destroy();
    });

    it('restores the cleared document when the undo action is dispatched', () => {
      const { store } = createFixture();
      const undoActions: AnyAction[] = [];

      editorPushUndoHistoryMap[ActionType.clear](
        undoActions,
        clearAction(),
        store.state
      );

      store.dispatchSync(clearAction());
      expect(store.state.doc.tableIds).toEqual([]);
      expect(store.state.collections.tableEntities).toEqual({});

      store.dispatchSync(...undoActions);
      expect(store.state.doc.tableIds).toEqual([TABLE_ID]);
      expect(store.state.collections.tableEntities[TABLE_ID].name).toBe(
        'users'
      );

      store.destroy();
    });

    it('carries the flag of a clear that keeps the dictionaries into its undo', () => {
      const { store } = createFixture();
      const undoActions: AnyAction[] = [];

      editorPushUndoHistoryMap[ActionType.clear](
        undoActions,
        clearAction({ keepDictionaries: true }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].payload.keepDictionaries).toBe(true);

      store.destroy();
    });

    it('appends to an existing undo action list instead of replacing it', () => {
      const { store } = createFixture();
      const existing = { type: 'noop', payload: undefined } as AnyAction;
      const undoActions: AnyAction[] = [existing];

      editorPushUndoHistoryMap[ActionType.clear](
        undoActions,
        clearAction(),
        store.state
      );

      expect(undoActions).toHaveLength(2);
      expect(undoActions[0]).toBe(existing);

      store.destroy();
    });
  });
});

describe('the undo of a schema import, which keeps the dictionaries', () => {
  let app: AppContext;

  beforeEach(() => {
    app = createTestAppContext();
    app.store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: 'Member', abbreviation: 'MBR' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: 'Member number' },
      }),
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Number', dataType: 'INT' },
      }),
      addTableAction({ id: 'users', ui: { x: 0, y: 0, zIndex: 2 } }),
      changeTableNameAction({ id: 'users', value: 'users' }),
      addColumnAction({ id: 'users.no', tableId: 'users' }),
      changeColumnDomainAction({
        tableId: 'users',
        id: 'users.no',
        value: 'd1',
      })
    );
  });

  afterEach(() => {
    app.store.destroy();
  });

  /** An edit another peer made, at a version past every local one. */
  const fromPeer = (action: AnyAction) => {
    const { store } = app;
    store.dispatchSync(
      attachActionTag(Tag.shared, {
        ...action,
        version: store.context.clock.getNextVersion(),
      })
    );
  };

  /** Each batch that loads a document: the import, then its undo. */
  function recordLoads() {
    const batches: AnyAction[][] = [];
    app.store.subscribe(actions => {
      actions.some(({ type }) => type === ActionType.loadJson) &&
        batches.push(actions);
    });
    return batches;
  }

  const tableNames = () =>
    app.store.state.doc.tableIds.map(
      id => app.store.state.collections.tableEntities[id].name
    );

  it('loads back a text without the words and terms, the domains and every link kept', () => {
    const batches = recordLoads();
    app.store.dispatchSync(
      loadSchemaSQLAction$('CREATE TABLE orders (id INT);')
    );

    app.store.undo();

    const [, undo] = batches;
    expect(undo.map(({ type }) => type)).toEqual([
      'editor.loadJson',
      'editor.clear',
      'editor.loadJson',
    ]);
    expect(
      undo.every(({ payload }) => payload?.keepDictionaries === true)
    ).toBe(true);
    const text = JSON.parse(undo[2].payload.value);
    expect(text.collections).not.toHaveProperty('wordEntities');
    expect(text.collections).not.toHaveProperty('termEntities');
    expect(text.doc).not.toHaveProperty('wordIds');
    expect(text.doc).not.toHaveProperty('termIds');
    expect(text.doc.domainIds).toEqual(['d1']);
    expect(text.collections.domainEntities.rows[0][0]).toBe('d1');
    expect(tableNames()).toEqual(['users']);
    expect(
      app.store.state.collections.tableColumnEntities['users.no'].domainId
    ).toBe('d1');
  });

  it('keeps the dictionary edits a peer made between the import, its undo and its redo', () => {
    app.store.dispatchSync(
      loadSchemaSQLAction$('CREATE TABLE orders (id INT);')
    );
    fromPeer(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { abbreviation: 'MEM' },
      })
    );

    app.store.undo();

    expect(tableNames()).toEqual(['users']);
    expect(app.store.state.collections.wordEntities.w1.abbreviation).toBe(
      'MEM'
    );

    fromPeer(addDictionaryAction({ kind: 'term', id: 't2', values: {} }));
    app.store.redo();

    expect(tableNames()).toEqual(['orders']);
    expect(app.store.state.collections.wordEntities.w1.abbreviation).toBe(
      'MEM'
    );
    expect(app.store.state.doc.termIds).toEqual(['t1', 't2']);
    expect(app.store.state.doc.domainIds).toEqual(['d1']);
  });

  it('loads the whole document back for the undo of an unflagged load', () => {
    const batches = recordLoads();
    app.store.dispatchSync(loadJsonAction$(toJson(app.store.state)));
    fromPeer(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { abbreviation: 'MEM' },
      })
    );

    app.store.undo();

    const [, undo] = batches;
    expect(undo.some(({ payload }) => payload?.keepDictionaries)).toBe(false);
    expect(JSON.parse(undo[2].payload.value).doc.wordIds).toEqual(['w1']);
    expect(app.store.state.collections.wordEntities.w1.abbreviation).toBe(
      'MBR'
    );
  });
});
