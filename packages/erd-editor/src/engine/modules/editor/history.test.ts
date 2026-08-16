import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/editor/actions';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { editorPushUndoHistoryMap } from '@/engine/modules/editor/history';
import { createStore, Store } from '@/engine/store';
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
