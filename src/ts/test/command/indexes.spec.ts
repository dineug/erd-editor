import { createEditorContext } from "@src/core/EditorContext";
import {
  addIndex,
  removeIndex,
  changeIndexName,
  addIndexColumn,
  removeIndexColumn,
  moveIndexColumn,
  changeIndexColumnOrderType,
  changeIndexUnique,
} from "@src/core/command/indexes";
import { uuid } from "@src/core/Helper";
import { IndexModel } from "@src/core/model/IndexModel";

describe("command: index", () => {
  it("index.add", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;

    // when
    store.dispatch(addIndex(uuid()));

    // then
    store.observe(tableState.indexes, () => {
      expect(tableState.indexes.length).toBe(1);
      done();
    });
  });

  it("index.remove", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data }),
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];

    // when
    store.dispatch(removeIndex([index.id]));

    // then
    store.observe(tableState.indexes, () => {
      expect(tableState.indexes.length).toBe(1);
      done();
    });
  });

  it("index.changeName", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];

    // when
    const value = "test";
    store.dispatch(changeIndexName(index.id, value));

    // then
    store.observe(index, () => {
      expect(index.name).toBe(value);
      done();
    });
  });

  it("index.changeUnique", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];

    // when
    const value = true;
    store.dispatch(changeIndexUnique(index.id, value));

    // then
    store.observe(index, () => {
      expect(index.unique).toBe(value);
      done();
    });
  });

  it("index.addColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];

    // when
    const columnId = uuid();
    store.dispatch(addIndexColumn(index.id, columnId));

    // then
    store.observe(index.columns, () => {
      expect(index.columns.some((column) => column.id === columnId)).toBe(true);
      done();
    });
  });

  it("index.removeColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];
    index.columns.push(
      {
        id: uuid(),
        orderType: "ASC",
      },
      {
        id: uuid(),
        orderType: "ASC",
      }
    );

    // when
    const columnId = index.columns[0].id;
    store.dispatch(removeIndexColumn(index.id, columnId));

    // then
    store.observe(index.columns, () => {
      expect(index.columns.some((column) => column.id === columnId)).toBe(
        false
      );
      done();
    });
  });

  it("index.moveColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];
    index.columns.push(
      {
        id: uuid(),
        orderType: "ASC",
      },
      {
        id: uuid(),
        orderType: "ASC",
      },
      {
        id: uuid(),
        orderType: "ASC",
      }
    );

    // when
    const currentColumnId = index.columns[0].id;
    const targetColumnId = index.columns[2].id;
    store.dispatch(moveIndexColumn(index.id, currentColumnId, targetColumnId));

    // then
    store.observe(index.columns, () => {
      expect(index.columns[2].id).toBe(currentColumnId);
      expect(index.columns[1].id).toBe(targetColumnId);
      done();
    });
  });

  it("index.changeColumnOrderType", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    tableState.indexes.push(
      new IndexModel({ addIndex: addIndex(uuid()).data })
    );
    const index = tableState.indexes[0];
    index.columns.push({
      id: uuid(),
      orderType: "ASC",
    });

    // when
    const column = index.columns[0];
    const value = "DESC";
    store.dispatch(changeIndexColumnOrderType(index.id, column.id, value));

    // then
    store.observe(column, () => {
      expect(column.orderType).toBe(value);
      done();
    });
  });
});
