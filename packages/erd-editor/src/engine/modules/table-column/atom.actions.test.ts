import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  actions,
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
  tableColumnReducers,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

type Setup = {
  store: Store;
  clock: Clock;
};

function setup(): Setup {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  return { store, clock };
}

const selectColumn = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('tableColumnEntities')
    .selectById(id);

const selectTable = (store: Store, id: string) =>
  query(store.state.collections).collection('tableEntities').selectById(id);

const columnIds = (store: Store, tableId: string) => [
  ...(selectTable(store, tableId)?.columnIds ?? []),
];

const seqColumnIds = (store: Store, tableId: string) => [
  ...(selectTable(store, tableId)?.seqColumnIds ?? []),
];

const lwwOf = (store: Store, id: string) => store.state.lww[id];

describe('table-column atom.actions', () => {
  describe('addColumn', () => {
    it('creates the column entity and links it to a lazily created table', () => {
      const { store } = setup();

      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

      const column = selectColumn(store, 'c1');
      expect(column).toBeDefined();
      expect(column?.tableId).toBe('t1');
      expect(column?.name).toBe('');
      expect(column?.options).toBe(0);

      expect(selectTable(store, 't1')).toBeDefined();
      expect(columnIds(store, 't1')).toEqual(['c1']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1']);
    });

    it('appends columns in dispatch order', () => {
      const { store } = setup();

      store.dispatchSync(
        addColumnAction({ id: 'c1', tableId: 't1' }),
        addColumnAction({ id: 'c2', tableId: 't1' }),
        addColumnAction({ id: 'c3', tableId: 't1' })
      );

      expect(columnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
    });

    it('does not duplicate the id when the same column is added twice', () => {
      const { store } = setup();

      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

      expect(columnIds(store, 't1')).toEqual(['c1']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1']);
    });

    it('restores the original position when a removed column is added back', () => {
      const { store } = setup();

      store.dispatchSync(
        { ...addColumnAction({ id: 'c1', tableId: 't1' }), version: 1 },
        { ...addColumnAction({ id: 'c2', tableId: 't1' }), version: 1 },
        { ...addColumnAction({ id: 'c3', tableId: 't1' }), version: 1 }
      );
      store.dispatchSync({
        ...removeColumnAction({ id: 'c2', tableId: 't1' }),
        version: 2,
      });
      expect(columnIds(store, 't1')).toEqual(['c1', 'c3']);

      store.dispatchSync({
        ...addColumnAction({ id: 'c2', tableId: 't1' }),
        version: 3,
      });

      expect(columnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
    });

    it('records the add version in the lww register', () => {
      const { store } = setup();

      store.dispatchSync({
        ...addColumnAction({ id: 'c1', tableId: 't1' }),
        version: 42,
      });

      const tuple = lwwOf(store, 'c1');
      expect(tuple[0]).toBe('tableColumnEntities');
      expect(tuple[1]).toBe(42);
      expect(tuple[2]).toBe(-1);
    });

    it('falls back to the clock version when the action carries none', () => {
      const { store, clock } = setup();
      clock.merge(7);

      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

      expect(lwwOf(store, 'c1')[1]).toBe(7);
    });

    it('materializes the entity but skips the link for a stale add', () => {
      const { store } = setup();

      store.dispatchSync({
        ...removeColumnAction({ id: 'c1', tableId: 't1' }),
        version: 5,
      });
      store.dispatchSync({
        ...addColumnAction({ id: 'c1', tableId: 't1' }),
        version: 3,
      });

      // the entity is created outside the lww recipe, so it always lands
      expect(selectColumn(store, 'c1')).toBeDefined();
      // but the stale add must not re-link it to the table
      expect(columnIds(store, 't1')).toEqual([]);
      expect(lwwOf(store, 'c1')[1]).toBe(3);
      expect(lwwOf(store, 'c1')[2]).toBe(5);
    });
  });

  describe('removeColumn', () => {
    it('unlinks the column but keeps the entity as a tombstone', () => {
      const { store } = setup();

      store.dispatchSync(
        { ...addColumnAction({ id: 'c1', tableId: 't1' }), version: 1 },
        { ...addColumnAction({ id: 'c2', tableId: 't1' }), version: 1 }
      );
      store.dispatchSync({
        ...removeColumnAction({ id: 'c1', tableId: 't1' }),
        version: 2,
      });

      expect(columnIds(store, 't1')).toEqual(['c2']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1', 'c2']);
      expect(selectColumn(store, 'c1')).toBeDefined();
      expect(lwwOf(store, 'c1')[2]).toBe(2);
    });

    it('creates the table lazily and is a no-op when the column is not linked', () => {
      const { store } = setup();

      store.dispatchSync(removeColumnAction({ id: 'c1', tableId: 't1' }));

      expect(selectTable(store, 't1')).toBeDefined();
      expect(columnIds(store, 't1')).toEqual([]);
      expect(lwwOf(store, 'c1')[2]).toBe(0);
    });

    it('ignores a remove that is older than the add', () => {
      const { store } = setup();

      store.dispatchSync({
        ...addColumnAction({ id: 'c1', tableId: 't1' }),
        version: 5,
      });
      store.dispatchSync({
        ...removeColumnAction({ id: 'c1', tableId: 't1' }),
        version: 3,
      });

      expect(columnIds(store, 't1')).toEqual(['c1']);
      expect(lwwOf(store, 'c1')[2]).toBe(3);
    });

    it('falls back to the clock version when the action carries none', () => {
      const { store, clock } = setup();
      clock.merge(9);

      store.dispatchSync(removeColumnAction({ id: 'c1', tableId: 't1' }));

      expect(lwwOf(store, 'c1')[2]).toBe(9);
    });
  });

  const valueCases = [
    {
      label: 'changeColumnName',
      action: changeColumnNameAction,
      path: 'name',
      field: 'name',
      widthField: 'widthName',
    },
    {
      label: 'changeColumnComment',
      action: changeColumnCommentAction,
      path: 'comment',
      field: 'comment',
      widthField: 'widthComment',
    },
    {
      label: 'changeColumnDataType',
      action: changeColumnDataTypeAction,
      path: 'dataType',
      field: 'dataType',
      widthField: 'widthDataType',
    },
    {
      label: 'changeColumnDefault',
      action: changeColumnDefaultAction,
      path: 'default',
      field: 'default',
      widthField: 'widthDefault',
    },
  ] as const;

  for (const { label, action, path, field, widthField } of valueCases) {
    describe(label, () => {
      it('writes the value and the measured width', () => {
        const { store } = setup();
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync(
          action({ id: 'c1', tableId: 't1', value: 'abcdefg' })
        );

        const column: any = selectColumn(store, 'c1');
        expect(column[field]).toBe('abcdefg');
        expect(column.ui[widthField]).toBe(70);
        expect(lwwOf(store, 'c1')[3][path]).toBe(0);
      });

      it('clamps the width to the column minimum for short text', () => {
        const { store } = setup();
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync(action({ id: 'c1', tableId: 't1', value: 'ab' }));

        const column: any = selectColumn(store, 'c1');
        expect(column[field]).toBe('ab');
        expect(column.ui[widthField]).toBe(COLUMN_MIN_WIDTH);
      });

      it('creates a detached column when the id is unknown', () => {
        const { store } = setup();

        store.dispatchSync(action({ id: 'ghost', tableId: 't1', value: 'x' }));

        const column: any = selectColumn(store, 'ghost');
        expect(column).toBeDefined();
        expect(column.tableId).toBe('');
        expect(column[field]).toBe('x');
      });

      it('rejects a stale version and accepts an equal one', () => {
        const { store } = setup();
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync({
          ...action({ id: 'c1', tableId: 't1', value: 'newest' }),
          version: 5,
        });
        store.dispatchSync({
          ...action({ id: 'c1', tableId: 't1', value: 'stale' }),
          version: 3,
        });

        const column: any = selectColumn(store, 'c1');
        expect(column[field]).toBe('newest');
        expect(lwwOf(store, 'c1')[3][path]).toBe(5);

        store.dispatchSync({
          ...action({ id: 'c1', tableId: 't1', value: 'same-version' }),
          version: 5,
        });
        expect(selectColumn(store, 'c1')?.[field as 'name']).toBe(
          'same-version'
        );
      });

      it('falls back to the clock version when the action carries none', () => {
        const { store, clock } = setup();
        clock.merge(4);
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync(action({ id: 'c1', tableId: 't1', value: 'value' }));

        expect(lwwOf(store, 'c1')[3][path]).toBe(4);
      });
    });
  }

  const optionCases = [
    {
      label: 'changeColumnAutoIncrement',
      action: changeColumnAutoIncrementAction,
      path: 'options(autoIncrement)',
      mask: ColumnOption.autoIncrement,
    },
    {
      label: 'changeColumnPrimaryKey',
      action: changeColumnPrimaryKeyAction,
      path: 'options(primaryKey)',
      mask: ColumnOption.primaryKey,
    },
    {
      label: 'changeColumnUnique',
      action: changeColumnUniqueAction,
      path: 'options(unique)',
      mask: ColumnOption.unique,
    },
    {
      label: 'changeColumnNotNull',
      action: changeColumnNotNullAction,
      path: 'options(notNull)',
      mask: ColumnOption.notNull,
    },
  ] as const;

  for (const { label, action, path, mask } of optionCases) {
    describe(label, () => {
      it('sets and clears the option bit without touching the others', () => {
        const { store } = setup();
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
        store.dispatchSync(
          changeColumnNotNullAction({ id: 'c1', tableId: 't1', value: true }),
          changeColumnUniqueAction({ id: 'c1', tableId: 't1', value: true })
        );
        const baseline = (ColumnOption.notNull | ColumnOption.unique) & ~mask;

        store.dispatchSync(action({ id: 'c1', tableId: 't1', value: true }));
        expect(selectColumn(store, 'c1')?.options).toBe(baseline | mask);

        store.dispatchSync(action({ id: 'c1', tableId: 't1', value: false }));
        expect(selectColumn(store, 'c1')?.options).toBe(baseline);
        expect(lwwOf(store, 'c1')[3][path]).toBe(0);
      });

      it('creates a detached column when the id is unknown', () => {
        const { store } = setup();

        store.dispatchSync(action({ id: 'ghost', tableId: 't1', value: true }));

        expect(selectColumn(store, 'ghost')?.options).toBe(mask);
      });

      it('rejects a stale version', () => {
        const { store } = setup();
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync({
          ...action({ id: 'c1', tableId: 't1', value: true }),
          version: 6,
        });
        store.dispatchSync({
          ...action({ id: 'c1', tableId: 't1', value: false }),
          version: 2,
        });

        expect(selectColumn(store, 'c1')?.options).toBe(mask);
        expect(lwwOf(store, 'c1')[3][path]).toBe(6);
      });

      it('falls back to the clock version when the action carries none', () => {
        const { store, clock } = setup();
        clock.merge(3);
        store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

        store.dispatchSync(action({ id: 'c1', tableId: 't1', value: true }));

        expect(lwwOf(store, 'c1')[3][path]).toBe(3);
      });
    });
  }

  describe('changeColumnPrimaryKey ui keys', () => {
    it('mirrors the option onto ui.keys and leaves foreignKey alone', () => {
      const { store } = setup();
      store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
      const column: any = selectColumn(store, 'c1');
      column.ui.keys = ColumnUIKey.foreignKey;

      store.dispatchSync(
        changeColumnPrimaryKeyAction({ id: 'c1', tableId: 't1', value: true })
      );
      expect(selectColumn(store, 'c1')?.ui.keys).toBe(
        ColumnUIKey.foreignKey | ColumnUIKey.primaryKey
      );

      store.dispatchSync(
        changeColumnPrimaryKeyAction({ id: 'c1', tableId: 't1', value: false })
      );
      expect(selectColumn(store, 'c1')?.ui.keys).toBe(ColumnUIKey.foreignKey);
    });
  });

  describe('moveColumn', () => {
    const withColumns = () => {
      const { store } = setup();
      store.dispatchSync(
        addColumnAction({ id: 'c1', tableId: 't1' }),
        addColumnAction({ id: 'c2', tableId: 't1' }),
        addColumnAction({ id: 'c3', tableId: 't1' })
      );
      return store;
    };

    it('moves a column forward', () => {
      const store = withColumns();

      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c3' })
      );

      expect(columnIds(store, 't1')).toEqual(['c2', 'c3', 'c1']);
      expect(seqColumnIds(store, 't1')).toEqual(['c2', 'c3', 'c1']);
    });

    it('moves a column backward', () => {
      const store = withColumns();

      store.dispatchSync(
        moveColumnAction({ id: 'c3', tableId: 't1', targetId: 'c1' })
      );

      expect(columnIds(store, 't1')).toEqual(['c3', 'c1', 'c2']);
      expect(seqColumnIds(store, 't1')).toEqual(['c3', 'c1', 'c2']);
    });

    it('does nothing when id equals targetId', () => {
      const store = withColumns();

      store.dispatchSync(
        moveColumnAction({ id: 'c2', tableId: 't1', targetId: 'c2' })
      );

      expect(columnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
    });

    it('creates the table lazily and bails when the column is unknown', () => {
      const { store } = setup();

      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 'missing', targetId: 'c2' })
      );

      expect(selectTable(store, 'missing')).toBeDefined();
      expect(columnIds(store, 'missing')).toEqual([]);
    });

    it('bails when the target is not part of the table', () => {
      const store = withColumns();

      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'nope' })
      );

      expect(columnIds(store, 't1')).toEqual(['c1', 'c2', 'c3']);
    });

    it('reorders columnIds only when the seq list is missing an id', () => {
      const store = withColumns();
      const table: any = selectTable(store, 't1');
      table.seqColumnIds.splice(table.seqColumnIds.indexOf('c1'), 1);

      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c3' })
      );

      expect(columnIds(store, 't1')).toEqual(['c2', 'c3', 'c1']);
      expect(seqColumnIds(store, 't1')).toEqual(['c2', 'c3']);
    });

    it('reorders columnIds only when the seq list is missing the target', () => {
      const store = withColumns();
      const table: any = selectTable(store, 't1');
      table.seqColumnIds.splice(table.seqColumnIds.indexOf('c3'), 1);

      store.dispatchSync(
        moveColumnAction({ id: 'c1', tableId: 't1', targetId: 'c3' })
      );

      expect(columnIds(store, 't1')).toEqual(['c2', 'c3', 'c1']);
      expect(seqColumnIds(store, 't1')).toEqual(['c1', 'c2']);
    });
  });

  describe('exports', () => {
    it('maps every action type to a reducer', () => {
      expect(Object.keys(tableColumnReducers).sort()).toEqual(
        [
          'column.add',
          'column.changeAutoIncrement',
          'column.changeComment',
          'column.changeDataType',
          'column.changeDefault',
          'column.changeName',
          'column.changeNotNull',
          'column.changePrimaryKey',
          'column.changeUnique',
          'column.move',
          'column.remove',
        ].sort()
      );
      Object.values(tableColumnReducers).forEach(reducer =>
        expect(typeof reducer).toBe('function')
      );
    });

    it('exposes every action creator', () => {
      expect(Object.keys(actions)).toHaveLength(11);
      expect(actions.addColumnAction).toBe(addColumnAction);
      expect(actions.moveColumnAction).toBe(moveColumnAction);
      expect(String(removeColumnAction)).toBe('column.remove');
    });
  });
});
