import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData, uuid } from "../Helper";
import { getColumnIds } from "../helper/ColumnHelper";
import {
  relationshipSort,
  removeRelationshipColumnUIKeyValid,
} from "../helper/RelationshipHelper";
import { RelationshipType } from "../store/Relationship";
import { Table } from "../store/Table";
import { RelationshipModel } from "../model/RelationshipModel";
import { AddCustomColumn, executeAddCustomColumn } from "./column";

interface AddRelationshipPoint {
  tableId: string;
  columnIds: string[];
}
export interface AddRelationship {
  id: string;
  relationshipType: RelationshipType;
  start: AddRelationshipPoint;
  end: AddRelationshipPoint;
}
export function addRelationship(
  relationshipType: RelationshipType,
  startTable: Table,
  endTableId: string
): CommandEffect<AddRelationship> {
  const columnIds = getColumnIds(startTable.columns);
  return {
    name: "relationship.add",
    data: {
      id: uuid(),
      relationshipType,
      start: {
        tableId: startTable.id,
        columnIds,
      },
      end: {
        tableId: endTableId,
        columnIds: columnIds.map((columnId) => uuid()),
      },
    },
  };
}
export function executeAddRelationship(store: Store, data: AddRelationship) {
  Logger.debug("executeAddRelationship");
  const { relationships } = store.relationshipState;
  const { tables } = store.tableState;
  const { start, end } = data;
  const startTable = getData(tables, start.tableId);
  const endTable = getData(tables, end.tableId);
  if (start.columnIds.length !== 0 && startTable && endTable) {
    // create end table column
    const createEndColumns: AddCustomColumn[] = [];
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
    executeAddCustomColumn(store, createEndColumns);
    // add relationship
    relationships.push(new RelationshipModel({ addRelationship: data }));
    relationshipSort(tables, relationships);
  }
}

export interface RemoveRelationship {
  relationshipIds: string[];
}
export function removeRelationship(
  relationshipIds: string[]
): CommandEffect<RemoveRelationship> {
  return {
    name: "relationship.remove",
    data: {
      relationshipIds,
    },
  };
}
export function executeRemoveRelationship(
  store: Store,
  data: RemoveRelationship
) {
  Logger.debug("executeRemoveRelationship");
  const { relationships } = store.relationshipState;
  const { tables } = store.tableState;
  for (let i = 0; i < relationships.length; i++) {
    const relationship = relationships[i];
    if (
      data.relationshipIds.some(
        (relationshipId) => relationshipId === relationship.id
      )
    ) {
      relationships.splice(i, 1);
      i--;
      // column valid
      removeRelationshipColumnUIKeyValid(
        store,
        relationship.end.tableId,
        relationship.end.columnIds
      );
    }
  }
}

export interface ChangeRelationshipType {
  relationshipId: string;
  relationshipType: RelationshipType;
}
export function changeRelationshipType(
  relationshipId: string,
  relationshipType: RelationshipType
): CommandEffect<ChangeRelationshipType> {
  return {
    name: "relationship.changeRelationshipType",
    data: {
      relationshipId,
      relationshipType,
    },
  };
}
export function executeChangeRelationshipType(
  store: Store,
  data: ChangeRelationshipType
) {
  Logger.debug("executeChangeRelationshipType");
  const { relationships } = store.relationshipState;
  const relationship = getData(relationships, data.relationshipId);
  if (relationship) {
    relationship.relationshipType = data.relationshipType;
  }
}

export interface ChangeIdentification {
  relationshipId: string;
  identification: boolean;
}
export function ChangeIdentification(
  relationshipId: string,
  identification: boolean
): CommandEffect<ChangeIdentification> {
  return {
    name: "relationship.changeIdentification",
    data: {
      relationshipId,
      identification,
    },
  };
}
export function executeChangeIdentification(
  store: Store,
  data: ChangeIdentification
) {
  Logger.debug("executeChangeIdentification");
  const { relationships } = store.relationshipState;
  const relationship = getData(relationships, data.relationshipId);
  if (relationship) {
    relationship.identification = data.identification;
  }
}
