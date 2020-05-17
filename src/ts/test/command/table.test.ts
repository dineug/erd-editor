import { createEditorContext } from "../../core/EditorContext";
import { getData } from "../../core/Helper";
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
} from "../../core/command/table";
import { TableModel } from "../../core/model/TableModel";

test("command: table.add", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const command = addTable(store);
  store.dispatch(command);

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, command.data.id);
    expect(command.data.id).toBe(table?.id);
    done();
  });
});

test("command: table.move", (done) => {
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

test("command: table.remove", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const command = addTable(store);
  store.dispatch(command, addTable(store), removeTable(store, command.data.id));

  // then
  store.observe(tableState.tables, () => {
    expect(1).toBe(tableState.tables.length);
    done();
  });
});

test("command: table.select", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const addTableCommand = addTable(store);
  const addTableCommand2 = addTable(store);
  store.dispatch(
    addTableCommand,
    addTableCommand2,
    selectTable(store, false, addTableCommand.data.id)
  );

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, addTableCommand.data.id);
    const table2 = getData(tableState.tables, addTableCommand2.data.id);
    expect(true).toBe(table?.ui.active);
    expect(false).toBe(table2?.ui.active);
    done();
  });
});

test("command: table.selectEnd", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const command = addTable(store);
  store.dispatch(command, selectEndTable());

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, command.data.id);
    expect(false).toBe(table?.ui.active);
    done();
  });
});

test("command: table.selectAll", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const addTableCommand = addTable(store);
  const addTableCommand2 = addTable(store);
  store.dispatch(addTableCommand, addTableCommand2, selectAllTable());

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, addTableCommand.data.id);
    const table2 = getData(tableState.tables, addTableCommand2.data.id);
    expect(true).toBe(table?.ui.active);
    expect(true).toBe(table2?.ui.active);
    done();
  });
});

test("command: table.selectOnly", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const addTableCommand = addTable(store);
  const addTableCommand2 = addTable(store);
  store.dispatch(
    addTableCommand,
    addTableCommand2,
    selectOnlyTable(store, addTableCommand.data.id)
  );

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, addTableCommand.data.id);
    const table2 = getData(tableState.tables, addTableCommand2.data.id);
    expect(true).toBe(table?.ui.active);
    expect(false).toBe(table2?.ui.active);
    done();
  });
});

test("command: table.changeName", (done) => {
  // given
  const context = createEditorContext();
  const { store, helper } = context;
  const { tableState } = store;
  helper.setSpan(document.createElement("span"));

  // when
  const command = addTable(store);
  const value = "test";
  store.dispatch(command, changeTableName(helper, command.data.id, value));

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, command.data.id);
    expect(value).toBe(table?.name);
    done();
  });
});

test("command: table.changeComment", (done) => {
  // given
  const context = createEditorContext();
  const { store, helper } = context;
  const { tableState } = store;
  helper.setSpan(document.createElement("span"));

  // when
  const command = addTable(store);
  const value = "test";
  store.dispatch(command, changeTableComment(helper, command.data.id, value));

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, command.data.id);
    expect(value).toBe(table?.comment);
    done();
  });
});

test("command: table.dragSelect", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const addTableCommand = addTable(store);
  const addTableCommand2 = addTable(store);
  store.dispatch(
    addTableCommand,
    addTableCommand2,
    moveTable(store, false, 0, 100, addTableCommand.data.id),
    moveTable(store, false, 200, 300, addTableCommand2.data.id),
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
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, addTableCommand.data.id);
    const table2 = getData(tableState.tables, addTableCommand2.data.id);
    expect(true).toBe(table?.ui.active);
    expect(false).toBe(table2?.ui.active);
    done();
  });
});

test("command: table.sort", (done) => {
  // given
  const context = createEditorContext();
  const { store } = context;
  const { tableState } = store;

  // when
  const addTableCommand = addTable(store);
  const addTableCommand2 = addTable(store);
  store.dispatch(addTableCommand, addTableCommand2, sortTable());

  // then
  store.observe(tableState.tables, () => {
    const table = getData(tableState.tables, addTableCommand.data.id);
    const table2 = getData(tableState.tables, addTableCommand2.data.id);
    expect(50).toBe(table?.ui.top);
    expect(50).toBe(table?.ui.left);
    expect(50).toBe(table2?.ui.top);
    expect(464).toBe(table2?.ui.left);
    done();
  });
});

test("command: table.load", (done) => {
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
