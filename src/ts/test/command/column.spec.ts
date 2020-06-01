import { createEditorContext } from "@src/core/EditorContext";
import { getIndex, uuid } from "@src/core/Helper";
import { addTable } from "@src/core/command/table";
import {
  addColumn,
  addOnlyColumn,
  addCustomColumn,
  removeColumn,
  removeOnlyColumn,
  changeColumnName,
  changeColumnComment,
  changeColumnDataType,
  changeColumnDefault,
  changeColumnAutoIncrement,
  changeColumnPrimaryKey,
  changeColumnUnique,
  changeColumnNotNull,
  moveColumn,
  activeColumn,
  activeEndColumn,
  loadColumn,
} from "@src/core/command/column";
import { TableModel } from "@src/core/model/TableModel";
import { ColumnModel } from "@src/core/model/ColumnModel";
import { RelationshipModel } from "@src/core/model/RelationshipModel";

describe("command: column", () => {
  it("column.add", (done) => {
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
    store.dispatch(addColumn(store));

    // then
    store.observe(table2.columns, () => {
      expect(table.columns.length).toBe(1);
      expect(table2.columns.length).toBe(1);
      done();
    });
  });

  it("column.addOnly", (done) => {
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
    store.dispatch(addOnlyColumn(store));

    // then
    store.observe(table2.columns, () => {
      expect(table.columns.length).toBe(1);
      expect(table2.columns.length).toBe(1);
      done();
    });
  });

  it("column.addCustom", (done) => {
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
    store.dispatch(addCustomColumn(null, null, null, [table.id, table2.id]));

    // then
    store.observe(table2.columns, () => {
      expect(table.columns.length).toBe(1);
      expect(table2.columns.length).toBe(1);
      done();
    });
  });

  it("column.remove", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
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
    store.dispatch(removeColumn(table.id, [column.id]));

    // then
    store.observe(table.columns, () => {
      expect(table.columns.length).toBe(1);
      done();
    });
  });

  it("column.removeOnly", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
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
    store.dispatch(removeOnlyColumn(table.id, [column.id]));

    // then
    store.observe(table.columns, () => {
      expect(table.columns.length).toBe(1);
      done();
    });
  });

  it("column.changeName", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    const value = "test";
    store.dispatch(changeColumnName(helper, table.id, column.id, value));

    // then
    store.observe(column, () => {
      expect(column.name).toBe(value);
      done();
    });
  });

  it("column.changeComment", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    const value = "test";
    store.dispatch(changeColumnComment(helper, table.id, column.id, value));

    // then
    store.observe(column, () => {
      expect(column.comment).toBe(value);
      done();
    });
  });

  it("column.changeDataType", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    const value = "test";
    store.dispatch(changeColumnDataType(helper, table.id, column.id, value));

    // then
    store.observe(column, () => {
      expect(column.dataType).toBe(value);
      done();
    });
  });

  it("column.changeDefault", (done) => {
    // given
    const context = createEditorContext();
    const { store, helper } = context;
    const { tableState, canvasState } = store;
    helper.setSpan(document.createElement("span"));
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    const value = "test";
    store.dispatch(changeColumnDefault(helper, table.id, column.id, value));

    // then
    store.observe(column, () => {
      expect(column.default).toBe(value);
      done();
    });
  });

  it("column.changeAutoIncrement", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(changeColumnAutoIncrement(store, table.id, column.id));

    // then
    store.observe(column.option, () => {
      expect(column.option.autoIncrement).toBe(true);
      done();
    });
  });

  it("column.changePrimaryKey", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(changeColumnPrimaryKey(store, table.id, column.id));

    // then
    store.observe(column.option, () => {
      expect(column.option.primaryKey).toBe(true);
      done();
    });
  });

  it("column.changeUnique", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(changeColumnUnique(store, table.id, column.id));

    // then
    store.observe(column.option, () => {
      expect(column.option.unique).toBe(true);
      done();
    });
  });

  it("column.changeNotNull", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];

    // when
    store.dispatch(changeColumnNotNull(store, table.id, column.id));

    // then
    store.observe(column.option, () => {
      expect(column.option.notNull).toBe(true);
      done();
    });
  });

  it("column.move", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );
    const column = table.columns[0];
    const targetColumn = table.columns[1];

    // when
    store.dispatch(
      moveColumn(table.id, [column.id], table.id, targetColumn.id)
    );

    // then
    store.observe(table.columns, () => {
      const index = getIndex(table.columns, column.id);
      expect(index).toBe(table.columns.length - 1);
      done();
    });
  });

  it("column.active", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, relationshipState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const startTable = tableState.tables[0];
    const endTable = tableState.tables[1];
    startTable.columns.push(
      new ColumnModel({ addColumn: addColumn(store, startTable.id).data[0] })
    );
    endTable.columns.push(
      new ColumnModel({ addColumn: addColumn(store, endTable.id).data[0] })
    );
    const startColumn = startTable.columns[0];
    const endColumn = endTable.columns[0];
    startColumn.option.primaryKey = true;
    const relationship = new RelationshipModel({
      loadRelationship: {
        id: uuid(),
        identification: false,
        relationshipType: "ZeroOneN",
        start: {
          tableId: startTable.id,
          columnIds: [startColumn.id],
          direction: "bottom",
          x: 0,
          y: 0,
        },
        end: {
          tableId: endTable.id,
          columnIds: [endColumn.id],
          direction: "bottom",
          x: 0,
          y: 0,
        },
      },
    });
    relationshipState.relationships.push(relationship);

    // when
    store.dispatch(activeColumn(relationship));

    // then
    store.observe(endColumn.ui, () => {
      expect(startColumn.ui.active).toBe(true);
      expect(endColumn.ui.active).toBe(true);
      done();
    });
  });

  it("column.activeEnd", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState, relationshipState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show),
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const startTable = tableState.tables[0];
    const endTable = tableState.tables[1];
    startTable.columns.push(
      new ColumnModel({ addColumn: addColumn(store, startTable.id).data[0] })
    );
    endTable.columns.push(
      new ColumnModel({ addColumn: addColumn(store, endTable.id).data[0] })
    );
    const startColumn = startTable.columns[0];
    const endColumn = endTable.columns[0];
    startColumn.option.primaryKey = true;
    startColumn.ui.pk = true;
    startColumn.ui.active = true;
    endColumn.ui.fk = true;
    endColumn.ui.active = true;
    relationshipState.relationships.push(
      new RelationshipModel({
        loadRelationship: {
          id: uuid(),
          identification: false,
          relationshipType: "ZeroOneN",
          start: {
            tableId: startTable.id,
            columnIds: [startColumn.id],
            direction: "bottom",
            x: 0,
            y: 0,
          },
          end: {
            tableId: endTable.id,
            columnIds: [endColumn.id],
            direction: "bottom",
            x: 0,
            y: 0,
          },
        },
      })
    );
    const relationship = relationshipState.relationships[0];

    // when
    store.dispatch(activeEndColumn(relationship));

    // then
    store.observe(endColumn.ui, () => {
      expect(startColumn.ui.active).toBe(false);
      expect(endColumn.ui.active).toBe(false);
      done();
    });
  });

  it("column.load", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { tableState, canvasState } = store;
    tableState.tables.push(
      new TableModel({ addTable: addTable(store).data }, canvasState.show)
    );
    const table = tableState.tables[0];
    table.columns.push(
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] }),
      new ColumnModel({ addColumn: addColumn(store, table.id).data[0] })
    );

    // when
    const column = new ColumnModel({
      addColumn: addColumn(store, table.id).data[0],
    });
    const column2 = new ColumnModel({
      addColumn: addColumn(store, table.id).data[0],
    });
    store.dispatch(loadColumn(table.id, [column, column2], [0, 2]));

    // then
    store.observe(table.columns, () => {
      const targetColumn = table.columns[0];
      const targetColumn2 = table.columns[2];
      expect(targetColumn.id).toBe(column.id);
      expect(targetColumn2.id).toBe(column2.id);
      done();
    });
  });
});
