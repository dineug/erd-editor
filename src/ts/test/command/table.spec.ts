import { createEditorContext } from "@src/core/EditorContext";
import { getData } from "@src/core/Helper";
import {
  addTable,
  addOnlyTable,
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
      expect(tableState.tables.length).toBe(1);
      done();
    });
  });

  it("table.addOnly", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;

    // when
    store.dispatch(addOnlyTable(store));

    // then
    store.observe(tableState.tables, () => {
      expect(tableState.tables.length).toBe(1);
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
      expect(table?.ui.top).toBe(command.data.ui.top + movementY);
      expect(table?.ui.left).toBe(command.data.ui.left + movementX);
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
      expect(tableState.tables.length).toBe(1);
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
      expect(table.ui.active).toBe(true);
      expect(table2.ui.active).toBe(false);
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
      expect(table.ui.active).toBe(false);
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
      expect(table.ui.active).toBe(true);
      expect(table2.ui.active).toBe(true);
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
      expect(table.ui.active).toBe(true);
      expect(table2.ui.active).toBe(false);
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
      expect(table.name).toBe(value);
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
      expect(table.comment).toBe(value);
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
      expect(table.ui.active).toBe(true);
      expect(table2.ui.active).toBe(false);
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
      expect(table.ui.top).toBe(50);
      expect(table.ui.left).toBe(50);
      expect(table2.ui.top).toBe(50);
      expect(table2.ui.left).toBe(464);
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
      expect(targetTable?.id).toBe(table.id);
      done();
    });
  });
});
