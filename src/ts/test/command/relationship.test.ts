import { createEditorContext } from "@src/core/EditorContext";
import { getData, uuid } from "@src/core/Helper";
import { addTable } from "@src/core/command/table";
import { AddCustomColumn, addColumn } from "@src/core/command/column";
import {
  addRelationship,
  changeRelationshipType,
  changeIdentification,
  loadRelationship,
  removeRelationship,
} from "@src/core/command/relationship";
import { TableModel } from "@src/core/model/TableModel";
import { ColumnModel } from "@src/core/model/ColumnModel";
import { RelationshipModel } from "@src/core/model/RelationshipModel";

describe("command: relationship", () => {
  it("relationship.add", (done) => {
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
    const startColumn = startTable.columns[0];
    startColumn.option.primaryKey = true;
    startColumn.ui.pk = true;

    // when
    // TODO: Refactoring addRelationship
    const addRelationshipCommand = addRelationship(
      "ZeroOneN",
      startTable,
      endTable.id
    );
    const createEndColumns: AddCustomColumn[] = [];
    const { start, end } = addRelationshipCommand.data;
    start.columnIds.forEach((startColumnId, index) => {
      const startColumn = getData(startTable.columns, startColumnId);
      if (startColumn) {
        createEndColumns.push({
          tableId: end.tableId,
          id: end.columnIds[index],
          option: null,
          ui: {
            active: false,
            pk: false,
            fk: true,
            pfk: false,
          },
          value: {
            name: startColumn.name,
            comment: startColumn.comment,
            dataType: startColumn.dataType,
            default: startColumn.default,
            widthName: startColumn.ui.widthName,
            widthComment: startColumn.ui.widthComment,
            widthDataType: startColumn.ui.widthDataType,
            widthDefault: startColumn.ui.widthDefault,
          },
        });
      }
    });
    store.dispatch(
      {
        type: "column.addCustom",
        data: createEndColumns,
      },
      addRelationshipCommand
    );

    // then
    store.observe(relationshipState.relationships, () => {
      const endColumn = endTable.columns[0];
      expect(1).toBe(relationshipState.relationships.length);
      expect(true).toBe(endColumn.ui.fk);
      done();
    });
  });

  it("relationship.remove", (done) => {
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
    endColumn.ui.fk = true;
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
    store.dispatch(removeRelationship([relationship.id]));

    // then
    store.observe(relationshipState.relationships, () => {
      expect(0).toBe(relationshipState.relationships.length);
      expect(false).toBe(endColumn.ui.fk);
      done();
    });
  });

  it("relationship.changeRelationshipType", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { relationshipState, canvasState } = store;
    relationshipState.relationships.push(
      new RelationshipModel({
        addRelationship: addRelationship(
          "ZeroOneN",
          new TableModel({ addTable: addTable(store).data }, canvasState.show),
          ""
        ).data,
      })
    );
    const relationship = relationshipState.relationships[0];

    // when
    const value = "OneN";
    store.dispatch(changeRelationshipType(relationship.id, value));

    // then
    store.observe(relationship, () => {
      expect(value).toBe(relationship.relationshipType);
      done();
    });
  });

  it("relationship.changeIdentification", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { relationshipState, canvasState } = store;
    relationshipState.relationships.push(
      new RelationshipModel({
        addRelationship: addRelationship(
          "ZeroOneN",
          new TableModel({ addTable: addTable(store).data }, canvasState.show),
          ""
        ).data,
      })
    );
    const relationship = relationshipState.relationships[0];

    // when
    const value = true;
    store.dispatch(changeIdentification(relationship.id, value));

    // then
    store.observe(relationship, () => {
      expect(value).toBe(relationship.identification);
      done();
    });
  });

  it("relationship.load", (done) => {
    // given
    const context = createEditorContext();
    const { store } = context;
    const { relationshipState, canvasState } = store;

    // when
    const relationship = new RelationshipModel({
      addRelationship: addRelationship(
        "ZeroOneN",
        new TableModel({ addTable: addTable(store).data }, canvasState.show),
        ""
      ).data,
    });
    store.dispatch(loadRelationship(relationship));

    // then
    store.observe(relationshipState.relationships, () => {
      expect(1).toBe(relationshipState.relationships.length);
      done();
    });
  });
});
