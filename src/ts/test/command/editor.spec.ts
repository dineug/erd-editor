import { createEditorContext } from "@src/core/EditorContext";
import { getIndex } from "@src/core/Helper";
import { addTable } from "@src/core/command/table";
import { addColumn } from "@src/core/command/column";
import {
  focusTable,
  focusTableEnd,
  focusMoveTable,
  focusTargetTable,
  focusTargetColumn,
  selectAllColumn,
  selectEndColumn,
  editTable,
  editTableEnd,
  draggableColumn,
  draggableColumnEnd,
  drawStartRelationship,
  drawStartAddRelationship,
  drawEndRelationship,
  loadJson,
  initLoadJson,
  copyColumn,
  pasteColumn,
  clear,
  addFilterState,
  removeFilterState,
  focusFilter,
  focusFilterEnd,
  filterActive,
  filterActiveEnd,
  focusMoveFilter,
  focusTargetFilter,
  focusTargetFilterState,
  selectAllFilterState,
  selectEndFilterState,
  editFilter,
  editFilterEnd,
  changeFilterStateColumnType,
  changeFilterStateFilterCode,
  changeFilterStateValue,
  changeFilterOperatorType,
  draggableFilterState,
  draggableFilterStateEnd,
  moveFilterState,
  findActive,
  findActiveEnd,
  hasUndoRedo,
  drawRelationship,
} from "@src/core/command/editor";
import { TableModel } from "@src/core/model/TableModel";
import { FocusTableModel } from "@src/core/model/FocusTableModel";
import { ColumnModel } from "@src/core/model/ColumnModel";
import { FilterStateModel } from "@src/core/model/FilterModel";
import { FocusFilterModel } from "@src/core/model/FocusFilterModel";
import jsonData from "../../../../data/test.json";

describe("command: editor", () => {
  it("editor.focusTable", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    store.dispatch(focusTable(table.id));

    // then
    store.observe(editorState, () => {
      expect(editorState.focusTable).not.toBeNull();
      done();
    });
  });

  it("editor.focusTableEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.focusTable = new FocusTableModel(table, store);

    // when
    store.dispatch(focusTableEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.focusTable).toBeNull();
      done();
    });
  });

  it("editor.focusMoveTable", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.focusTable = new FocusTableModel(table, store);
    const focusTable = editorState.focusTable;

    // when
    store.dispatch(focusMoveTable("ArrowRight", false));

    // then
    store.observe(focusTable, () => {
      expect(focusTable.currentFocus).toBe("tableComment");
      done();
    });
  });

  it("editor.focusTargetTable", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.focusTable = new FocusTableModel(table, store);
    const focusTable = editorState.focusTable;

    // when
    const value = "tableComment";
    store.dispatch(focusTargetTable(value));

    // then
    store.observe(focusTable, () => {
      expect(focusTable.currentFocus).toBe(value);
      done();
    });
  });

  it("editor.focusTargetColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];
    editorState.focusTable = new FocusTableModel(table, store);
    const focusTable = editorState.focusTable;

    // when
    const value = "columnDataType";
    store.dispatch(focusTargetColumn(column.id, value, false, false));

    // then
    store.observe(focusTable, () => {
      expect(focusTable.currentFocus).toBe(value);
      expect(focusTable.currentFocusId).toBe(column.id);
      done();
    });
  });

  it("editor.selectAllColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    editorState.focusTable = new FocusTableModel(table, store);
    const focusTable = editorState.focusTable;

    // when
    store.dispatch(selectAllColumn());

    // then
    store.observe(focusTable, () => {
      expect(focusTable.focusColumns[0].select).toBe(true);
      expect(focusTable.focusColumns[1].select).toBe(true);
      done();
    });
  });

  it("editor.selectEndColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    editorState.focusTable = new FocusTableModel(table, store);
    const focusTable = editorState.focusTable;
    editorState.focusTable.focusColumns[0].select = true;
    editorState.focusTable.focusColumns[1].select = true;

    // when
    store.dispatch(selectEndColumn());

    // then
    store.observe(focusTable, () => {
      expect(focusTable.focusColumns[0].select).toBe(false);
      expect(focusTable.focusColumns[1].select).toBe(false);
      done();
    });
  });

  it("editor.editTable", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];

    // when
    store.dispatch(editTable(table.id, "tableComment"));

    // then
    store.observe(editorState, () => {
      expect(editorState.editTable).not.toBeNull();
      done();
    });
  });

  it("editor.editTableEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.editTable = {
      id: table.id,
      focusType: "tableComment",
    };

    // when
    store.dispatch(editTableEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.editTable).toBeNull();
      done();
    });
  });

  it("editor.draggableColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(draggableColumn(store, table.id, column.id, false));

    // then
    store.observe(editorState, () => {
      expect(editorState.draggableColumn).not.toBeNull();
      done();
    });
  });

  it("editor.draggableColumnEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];
    editorState.draggableColumn = {
      tableId: table.id,
      columnIds: [column.id],
    };

    // when
    store.dispatch(draggableColumnEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.draggableColumn).toBeNull();
      done();
    });
  });

  it("editor.drawStartRelationship", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    const value = "ZeroOneN";
    store.dispatch(drawStartRelationship(value));

    // then
    store.observe(editorState, () => {
      expect(editorState.drawRelationship?.relationshipType).toBe(value);
      done();
    });
  });

  it("editor.drawStartAddRelationship", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.drawRelationship = {
      relationshipType: "ZeroOneN",
      start: null,
      end: { x: 0, y: 0 },
    };

    // when
    store.dispatch(drawStartAddRelationship(table.id));

    // then
    store.observe(editorState.drawRelationship, () => {
      expect(editorState.drawRelationship?.start).not.toBeNull();
      done();
    });
  });

  it("editor.drawEndRelationship", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.drawRelationship = {
      relationshipType: "ZeroOneN",
      start: null,
      end: { x: 0, y: 0 },
    };

    // when
    store.dispatch(drawEndRelationship());

    // then
    store.observe(editorState, () => {
      expect(editorState.drawRelationship).toBeNull();
      done();
    });
  });

  it("editor.drawRelationship", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    editorState.drawRelationship = {
      relationshipType: "ZeroOneN",
      start: { table, x: 0, y: 0 },
      end: { x: 0, y: 0 },
    };

    // when
    const x = 5;
    const y = 10;
    store.dispatch(drawRelationship(x, y));

    // then
    store.observe(editorState.drawRelationship.end, () => {
      expect(editorState.drawRelationship?.end.x).toBe(x);
      expect(editorState.drawRelationship?.end.y).toBe(y);
      done();
    });
  });

  it("editor.loadJson", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;

    // when
    store.dispatch(loadJson(JSON.stringify(jsonData)));

    // then
    store.observe(tableState.tables, () => {
      expect(tableState.tables.length).not.toBe(0);
      done();
    });
  });

  it("editor.initLoadJson", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState } = store;

    // when
    store.dispatch(initLoadJson(JSON.stringify(jsonData)));

    // then
    store.observe(tableState.tables, () => {
      expect(tableState.tables.length).not.toBe(0);
      done();
    });
  });

  it("editor.copyColumn", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, editorState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(copyColumn(table.id, [column.id]));

    // then
    store.observe(editorState.copyColumns, () => {
      expect(editorState.copyColumns.length).toBe(1);
      done();
    });
  });

  it("editor.pasteColumn", (done) => {
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
    table.ui.active = true;
    table2.ui.active = true;
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(copyColumn(table.id, [column.id]), pasteColumn(store));

    // then
    store.observe(table2.columns, () => {
      expect(table.columns.length).toBe(3);
      expect(table2.columns.length).toBe(1);
      done();
    });
  });

  it("editor.clear", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );

    // when
    store.dispatch(clear());

    // then
    store.observe(tableState.tables, () => {
      expect(tableState.tables.length).toBe(0);
      done();
    });
  });

  it("editor.addFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    store.dispatch(addFilterState());

    // then
    store.observe(editorState.filterStateList, () => {
      expect(editorState.filterStateList.length).toBe(1);
      done();
    });
  });

  it("editor.removeFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    store.dispatch(removeFilterState([filterState.id]));

    // then
    store.observe(editorState.filterStateList, () => {
      expect(editorState.filterStateList.length).toBe(0);
      done();
    });
  });

  it("editor.focusFilter", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    store.dispatch(focusFilter());

    // then
    store.observe(editorState, () => {
      expect(editorState.focusFilter).not.toBeNull();
      done();
    });
  });

  it("editor.focusFilterEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );

    // when
    store.dispatch(focusFilterEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.focusFilter).toBeNull();
      done();
    });
  });

  it("editor.filterActive", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    store.dispatch(filterActive());

    // then
    store.observe(editorState, () => {
      expect(editorState.filterActive).toBe(true);
      done();
    });
  });

  it("editor.filterActiveEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterActive = true;

    // when
    store.dispatch(filterActiveEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.filterActive).toBe(false);
      done();
    });
  });

  it("editor.focusMoveFilter", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );
    const focusFilter = editorState.focusFilter;

    // when
    store.dispatch(focusMoveFilter("ArrowDown", false));

    // then
    store.observe(focusFilter, () => {
      expect(focusFilter.currentFocus).toBe("columnType");
      expect(focusFilter.currentFocusId).toBe(filterState.id);
      done();
    });
  });

  it("editor.focusTargetFilter", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );
    const focusFilter = editorState.focusFilter;
    focusFilter.focusFilterOperatorType = false;

    // when
    store.dispatch(focusTargetFilter("filterOperatorType"));

    // then
    store.observe(focusFilter, () => {
      expect(focusFilter.focusFilterOperatorType).toBe(true);
      done();
    });
  });

  it("editor.focusTargetFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );
    const focusFilter = editorState.focusFilter;

    // when
    store.dispatch(
      focusTargetFilterState(filterState.id, "filterCode", false, false)
    );

    // then
    store.observe(focusFilter, () => {
      expect(focusFilter.currentFocus).toBe("filterCode");
      expect(focusFilter.currentFocusId).toBe(filterState.id);
      done();
    });
  });

  it("editor.selectAllFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );
    const focusFilter = editorState.focusFilter;

    // when
    store.dispatch(selectAllFilterState());

    // then
    store.observe(focusFilter, () => {
      expect(focusFilter.focusFilterStateList[0].select).toBe(true);
      expect(focusFilter.focusFilterStateList[1].select).toBe(true);
      done();
    });
  });

  it("editor.selectEndFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    editorState.focusFilter = new FocusFilterModel(
      editorState.filterStateList,
      store
    );
    const focusFilter = editorState.focusFilter;
    focusFilter.focusFilterStateList[0].select = true;
    focusFilter.focusFilterStateList[1].select = true;

    // when
    store.dispatch(selectEndFilterState());

    // then
    store.observe(focusFilter, () => {
      expect(focusFilter.focusFilterStateList[0].select).toBe(false);
      expect(focusFilter.focusFilterStateList[1].select).toBe(false);
      done();
    });
  });

  it("editor.editFilter", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    store.dispatch(editFilter("filterCode", filterState.id));

    // then
    store.observe(editorState, () => {
      expect(editorState.editFilter).not.toBeNull();
      done();
    });
  });

  it("editor.editFilterEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];
    editorState.editFilter = {
      id: filterState.id,
      focusType: "filterCode",
    };

    // when
    store.dispatch(editFilterEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.editFilter).toBeNull();
      done();
    });
  });

  it("editor.changeFilterStateColumnType", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    const value = "name";
    store.dispatch(changeFilterStateColumnType(filterState.id, value));

    // then
    store.observe(filterState, () => {
      expect(filterState.columnType).toBe(value);
      done();
    });
  });

  it("editor.changeFilterStateFilterCode", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    const value = "eq";
    store.dispatch(changeFilterStateFilterCode(filterState.id, value));

    // then
    store.observe(filterState, () => {
      expect(filterState.filterCode).toBe(value);
      done();
    });
  });

  it("editor.changeFilterStateValue", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    const value = "test";
    store.dispatch(changeFilterStateValue(filterState.id, value));

    // then
    store.observe(filterState, () => {
      expect(filterState.value).toBe(value);
      done();
    });
  });

  it("editor.changeFilterOperatorType", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    const value = "AND";
    store.dispatch(changeFilterOperatorType(value));

    // then
    store.observe(editorState, () => {
      expect(editorState.filterOperatorType).toBe(value);
      done();
    });
  });

  it("editor.draggableFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];

    // when
    store.dispatch(draggableFilterState(store, filterState.id, false));

    // then
    store.observe(editorState, () => {
      expect(editorState.draggableFilterState).not.toBeNull();
      done();
    });
  });

  it("editor.draggableFilterStateEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];
    editorState.draggableFilterState = {
      filterStateIds: [filterState.id],
    };

    // when
    store.dispatch(draggableFilterStateEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.draggableFilterState).toBeNull();
      done();
    });
  });

  it("editor.moveFilterState", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.filterStateList.push(
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data }),
      new FilterStateModel({ addFilterState: addFilterState().data })
    );
    const filterState = editorState.filterStateList[0];
    const filterState2 = editorState.filterStateList[1];
    const filterState3 = editorState.filterStateList[2];

    // when
    store.dispatch(
      moveFilterState([filterState.id, filterState2.id], filterState3.id)
    );

    // then
    store.observe(editorState.filterStateList, () => {
      const index = getIndex(editorState.filterStateList, filterState.id);
      const index2 = getIndex(editorState.filterStateList, filterState2.id);
      const index3 = getIndex(editorState.filterStateList, filterState3.id);
      expect(index).toBe(1);
      expect(index2).toBe(2);
      expect(index3).toBe(0);
      done();
    });
  });

  it("editor.findActive", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    store.dispatch(findActive());

    // then
    store.observe(editorState, () => {
      expect(editorState.findActive).toBe(true);
      done();
    });
  });

  it("editor.findActiveEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;
    editorState.findActive = true;

    // when
    store.dispatch(findActiveEnd());

    // then
    store.observe(editorState, () => {
      expect(editorState.findActive).toBe(false);
      done();
    });
  });

  it("editor.hasUndoRedo", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { editorState } = store;

    // when
    store.dispatch(hasUndoRedo(true, true));

    // then
    store.observe(editorState, () => {
      expect(editorState.hasUndo).toBe(true);
      expect(editorState.hasRedo).toBe(true);
      done();
    });
  });
});
