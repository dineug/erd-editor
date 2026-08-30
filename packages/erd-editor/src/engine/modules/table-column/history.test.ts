import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/table-column/actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  moveColumnAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { tableColumnPushUndoHistoryMap } from '@/engine/modules/table-column/history';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';

function setup(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function withColumns(): Store {
  const store = setup();
  store.dispatchSync(
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    addColumnAction({ id: 'c3', tableId: 't1' })
  );
  return store;
}

function pushUndo(
  type: keyof typeof tableColumnPushUndoHistoryMap,
  action: AnyAction,
  state: RootState
): AnyAction[] {
  const undoActions: AnyAction[] = [];
  tableColumnPushUndoHistoryMap[type](undoActions, action, state);
  return undoActions;
}

const columnIds = (store: Store, tableId: string) => [
  ...(query(store.state.collections)
    .collection('tableEntities')
    .selectById(tableId)?.columnIds ?? []),
];

describe('table-column history', () => {
  it('covers every action type declared by the module', () => {
    expect(Object.keys(tableColumnPushUndoHistoryMap).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });

  describe('addColumn', () => {
    it('undoes with a remove of the same column', () => {
      const store = setup();

      const undoActions = pushUndo(
        ActionType.addColumn,
        addColumnAction({ id: 'c1', tableId: 't1' }),
        store.state
      );

      expect(undoActions).toEqual([
        removeColumnAction({ id: 'c1', tableId: 't1' }),
      ]);
    });
  });

  describe('removeColumn', () => {
    it('undoes with an add of the same column', () => {
      const store = withColumns();

      const undoActions = pushUndo(
        ActionType.removeColumn,
        removeColumnAction({ id: 'c2', tableId: 't1' }),
        store.state
      );

      expect(undoActions).toEqual([
        addColumnAction({ id: 'c2', tableId: 't1' }),
      ]);
    });
  });

  const valueCases = [
    {
      type: ActionType.changeColumnName,
      action: changeColumnNameAction,
      field: 'name',
    },
    {
      type: ActionType.changeColumnDataType,
      action: changeColumnDataTypeAction,
      field: 'dataType',
    },
    {
      type: ActionType.changeColumnDefault,
      action: changeColumnDefaultAction,
      field: 'default',
    },
    {
      type: ActionType.changeColumnComment,
      action: changeColumnCommentAction,
      field: 'comment',
    },
  ] as const;

  for (const { type, action, field } of valueCases) {
    describe(type, () => {
      it('captures the value the column had before the change', () => {
        const store = withColumns();
        store.dispatchSync(
          action({ id: 'c1', tableId: 't1', value: 'previous' })
        );

        const undoActions = pushUndo(
          type,
          action({ id: 'c1', tableId: 't1', value: 'next' }),
          store.state
        );

        const column: any = query(store.state.collections)
          .collection('tableColumnEntities')
          .selectById('c1');
        expect(column[field]).toBe('previous');
        expect(undoActions).toEqual([
          action({ id: 'c1', tableId: 't1', value: 'previous' }),
        ]);
      });

      it('pushes nothing when the column is unknown', () => {
        const store = withColumns();

        const undoActions = pushUndo(
          type,
          action({ id: 'ghost', tableId: 't1', value: 'next' }),
          store.state
        );

        expect(undoActions).toEqual([]);
      });
    });
  }

  const optionCases = [
    {
      type: ActionType.changeColumnAutoIncrement,
      action: changeColumnAutoIncrementAction,
    },
    {
      type: ActionType.changeColumnNotNull,
      action: changeColumnNotNullAction,
    },
    {
      type: ActionType.changeColumnPrimaryKey,
      action: changeColumnPrimaryKeyAction,
    },
    {
      type: ActionType.changeColumnUnique,
      action: changeColumnUniqueAction,
    },
  ] as const;

  for (const { type, action } of optionCases) {
    describe(type, () => {
      it('undoes by inverting the requested value', () => {
        const store = withColumns();

        expect(
          pushUndo(
            type,
            action({ id: 'c1', tableId: 't1', value: true }),
            store.state
          )
        ).toEqual([action({ id: 'c1', tableId: 't1', value: false })]);

        expect(
          pushUndo(
            type,
            action({ id: 'c1', tableId: 't1', value: false }),
            store.state
          )
        ).toEqual([action({ id: 'c1', tableId: 't1', value: true })]);
      });

      it('pushes nothing when the column is unknown', () => {
        const store = withColumns();

        expect(
          pushUndo(
            type,
            action({ id: 'ghost', tableId: 't1', value: true }),
            store.state
          )
        ).toEqual([]);
      });
    });
  }

  describe('moveColumn', () => {
    it('targets the next column when moving forward', () => {
      const store = withColumns();

      const undoActions = pushUndo(
        ActionType.moveColumn,
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c3' }),
        store.state
      );

      expect(undoActions).toEqual([
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c2' }),
      ]);
    });

    it('targets the previous column when moving backward', () => {
      const store = withColumns();

      const undoActions = pushUndo(
        ActionType.moveColumn,
        moveColumnAction({ id: 'c3', tableId: 't1', targetId: 'c1' }),
        store.state
      );

      expect(undoActions).toEqual([
        moveColumnAction({ id: 'c3', tableId: 't1', targetId: 'c2' }),
      ]);
    });

    it('pushes nothing when the table is unknown', () => {
      const store = withColumns();

      expect(
        pushUndo(
          ActionType.moveColumn,
          moveColumnAction({ id: 'c1', tableId: 'nope', targetId: 'c2' }),
          store.state
        )
      ).toEqual([]);
    });

    it('pushes nothing when the moved column is not in the table', () => {
      const store = withColumns();

      expect(
        pushUndo(
          ActionType.moveColumn,
          moveColumnAction({ id: 'ghost', tableId: 't1', targetId: 'c2' }),
          store.state
        )
      ).toEqual([]);
    });

    it('pushes nothing when the target column is not in the table', () => {
      const store = withColumns();

      expect(
        pushUndo(
          ActionType.moveColumn,
          moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'ghost' }),
          store.state
        )
      ).toEqual([]);
    });

    it('produces an undefined target when id equals targetId at index 0', () => {
      const store = withColumns();

      const undoActions = pushUndo(
        ActionType.moveColumn,
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c1' }),
        store.state
      );

      // index === targetIndex takes the index - 1 branch, which underflows
      expect(undoActions).toEqual([
        moveColumnAction({
          id: 'c1',
          tableId: 't1',
          targetId: undefined as unknown as string,
        }),
      ]);
    });
  });

  describe('undo/redo round trips through the rx store', () => {
    it('reverts and replays an added column', () => {
      const { store } = createTestAppContext();

      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
      expect(columnIds(store, 't1')).toEqual(['c1']);

      store.undo();
      expect(columnIds(store, 't1')).toEqual([]);

      store.redo();
      expect(columnIds(store, 't1')).toEqual(['c1']);

      store.destroy();
    });

    it('reverts a renamed column to its previous name', () => {
      const { store } = createTestAppContext();

      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
      store.dispatchSync(
        changeColumnNameAction({ id: 'c1', tableId: 't1', value: 'first' })
      );
      store.dispatchSync(
        changeColumnNameAction({ id: 'c1', tableId: 't1', value: 'second' })
      );

      const name = () =>
        query(store.state.collections)
          .collection('tableColumnEntities')
          .selectById('c1')?.name;

      expect(name()).toBe('second');

      store.undo();
      expect(name()).toBe('first');

      store.redo();
      expect(name()).toBe('second');

      store.destroy();
    });

    it('reverts a moved column back to its original slot', () => {
      const { store } = createTestAppContext();

      store.dispatchSync(
        addColumnAction({ id: 'c1', tableId: 't1' }),
        addColumnAction({ id: 'c2', tableId: 't1' }),
        addColumnAction({ id: 'c3', tableId: 't1' })
      );
      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c3' })
      );
      expect(columnIds(store, 't1')).toEqual(['c2', 'c3', 'c1']);

      store.undo();
      expect(columnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);

      store.destroy();
    });
  });
});
