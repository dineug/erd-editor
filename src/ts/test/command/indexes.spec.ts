import { createEditorContext } from "@src/core/EditorContext";
import {
  addIndex,
  removeIndex,
  changeIndexName,
  addIndexColumn,
  removeIndexColumn,
  moveIndexColumn,
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
    store.observe(index.columnIds, () => {
      expect(index.columnIds.includes(columnId)).toBe(true);
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
    index.columnIds.push(uuid(), uuid());

    // when
    const columnId = index.columnIds[0];
    store.dispatch(removeIndexColumn(index.id, columnId));

    // then
    store.observe(index.columnIds, () => {
      expect(index.columnIds.includes(columnId)).toBe(false);
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
    index.columnIds.push(uuid(), uuid(), uuid());

    // when
    const currentColumnId = index.columnIds[0];
    const targetColumnId = index.columnIds[2];
    store.dispatch(moveIndexColumn(index.id, currentColumnId, targetColumnId));

    // then
    store.observe(index.columnIds, () => {
      expect(index.columnIds[2]).toBe(currentColumnId);
      expect(index.columnIds[1]).toBe(targetColumnId);
      done();
    });
  });
});
