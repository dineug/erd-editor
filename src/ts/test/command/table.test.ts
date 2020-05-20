import { createEditorContext } from "@src/core/EditorContext";
import { getData } from "@src/core/Helper";
import {
  addTable,
  moveTable,
  removeTable,
  selectTable,
  selectEndTable,
  selectAllTable,
  selectOnlyTable,
  changeTableName,
  changeTableComment,
  dragSelectTable,
  sortTable,
  loadTable,
} from "@src/core/command/table";
import { TableModel } from "@src/core/model/TableModel";

describe("command: table", () => {
  it("table.add", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;

    // when
    store.dispatch(addTable(store));

    // then
    store.observe(tableState.tables, () => {
      expect(1).toBe(tableState.tables.length);
      done();
    });
  });

  it("table.move", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;
    const command = addTable(store);

    // when
    const movementX = 1;
    const movementY = 2;
    store.dispatch(
      command,
      moveTable(store, false, movementX, movementY, command.data.id)
    );

    // then
    store.observe(tableState.tables, () => {
      const table = getData(tableState.tables, command.data.id);
      expect(command.data.ui.top + movementY).toBe(table?.ui.top);
      expect(command.data.ui.left + movementX).toBe(table?.ui.left);
      done();
    });
  });

  it("table.remove", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    store.dispatch(removeTable(store, table.id));

    // then
    store.observe(tableState.tables, () => {
      expect(1).toBe(tableState.tables.length);
      done();
    });
  });

  it("table.select", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    const table2 = tableState.tables[1];

    // when
    store.dispatch(selectTable(store, false, table.id));

    // then
    store.observe(table2.ui, () => {
      expect(true).toBe(table.ui.active);
      expect(false).toBe(table2.ui.active);
      done();
    });
  });

  it("table.selectEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    store.dispatch(selectEndTable());

    // then
    store.observe(table.ui, () => {
      expect(false).toBe(table.ui.active);
      done();
    });
  });

  it("table.selectAll", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    const table2 = tableState.tables[1];

    // when
    store.dispatch(selectAllTable());

    // then
    store.observe(table2.ui, () => {
      expect(true).toBe(table.ui.active);
      expect(true).toBe(table2.ui.active);
      done();
    });
  });

  it("table.selectOnly", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    const table2 = tableState.tables[1];

    // when
    store.dispatch(selectOnlyTable(store, table.id));

    // then
    store.observe(table2.ui, () => {
      expect(true).toBe(table.ui.active);
      expect(false).toBe(table2.ui.active);
      done();
    });
  });

  it("table.changeName", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    const value = "test";
    store.dispatch(changeTableName(helper, table.id, value));

    // then
    store.observe(table, () => {
      expect(value).toBe(table.name);
      done();
    });
  });

  it("table.changeComment", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    const value = "test";
    store.dispatch(changeTableComment(helper, table.id, value));

    // then
    store.observe(table, () => {
      expect(value).toBe(table.comment);
      done();
    });
  });

  it("table.dragSelect", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    const table2 = tableState.tables[1];
    table.ui.top = 200;
    table.ui.left = 200;
    table2.ui.top = 400;
    table2.ui.left = 400;

    // when
    store.dispatch(
      dragSelectTable(
        {
          x: 100,
          y: 100,
        },
        {
          x: 400,
          y: 400,
        }
      )
    );

    // then
    store.observe(table2.ui, () => {
      expect(true).toBe(table.ui.active);
      expect(false).toBe(table2.ui.active);
      done();
    });
  });

  it("table.sort", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    const table2 = tableState.tables[1];

    // when
    store.dispatch(sortTable());

    // then
    store.observe(table2.ui, () => {
      expect(50).toBe(table.ui.top);
      expect(50).toBe(table.ui.left);
      expect(50).toBe(table2.ui.top);
      expect(464).toBe(table2.ui.left);
      done();
    });
  });

  it("table.load", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;

    // when
    const table = new TableModel(
      { addTable: addTable(store).data },
      canvasState.show
    );
    store.dispatch(loadTable(table));

    // then
    store.observe(tableState.tables, () => {
      const targetTable = getData(tableState.tables, table.id);
      expect(table.id).toBe(targetTable?.id);
      done();
    });
  });
});
