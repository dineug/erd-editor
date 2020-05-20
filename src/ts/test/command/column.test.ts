import { createEditorContext } from "@src/core/EditorContext";
import { getIndex, uuid } from "@src/core/Helper";
import { addTable } from "@src/core/command/table";
import {
  addColumn,
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
      expect(1).toBe(table.columns.length);
      expect(1).toBe(table2.columns.length);
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
      expect(1).toBe(table.columns.length);
      expect(1).toBe(table2.columns.length);
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
      expect(1).toBe(table.columns.length);
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
      expect(1).toBe(table.columns.length);
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
      expect(value).toBe(column.name);
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
      expect(value).toBe(column.comment);
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
      expect(value).toBe(column.dataType);
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
      expect(value).toBe(column.default);
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
      expect(true).toBe(column.option.autoIncrement);
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
      expect(true).toBe(column.option.primaryKey);
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
      expect(true).toBe(column.option.unique);
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
      expect(true).toBe(column.option.notNull);
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
      expect(table.columns.length - 1).toBe(index);
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
      expect(true).toBe(startColumn.ui.active);
      expect(true).toBe(endColumn.ui.active);
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
      expect(false).toBe(startColumn.ui.active);
      expect(false).toBe(endColumn.ui.active);
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
      expect(column.id).toBe(targetColumn.id);
      expect(column2.id).toBe(targetColumn2.id);
      done();
    });
  });
});
