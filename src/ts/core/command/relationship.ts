import { Command } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData, uuid } from "../Helper";
import {
  relationshipSort,
  removeValidRelationshipColumnId,
} from "../helper/RelationshipHelper";
import { Relationship, RelationshipType } from "../store/Relationship";
import { Table } from "../store/Table";
import { RelationshipModel } from "../model/RelationshipModel";

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
): Command<"relationship.add"> {
  const columnIds = startTable.columns
    .filter((column) => column.option.primaryKey)
    .map((column) => column.id);
  return {
    type: "relationship.add",
    data: {
      id: uuid(),
      relationshipType,
      start: {
        tableId: startTable.id,
        columnIds,
      },
      end: {
        tableId: endTableId,
        columnIds: columnIds.map(() => uuid()),
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
    relationships.push(new RelationshipModel({ addRelationship: data }));
    relationshipSort(tables, relationships);
  }
}

export interface RemoveRelationship {
  relationshipIds: string[];
}
export function removeRelationship(
  relationshipIds: string[]
): Command<"relationship.remove"> {
  return {
    type: "relationship.remove",
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
  for (let i = 0; i < relationships.length; i++) {
    const relationship = relationships[i];
    if (
      data.relationshipIds.some(
        (relationshipId) => relationshipId === relationship.id
      )
    ) {
      relationships.splice(i, 1);
      i--;
      // relationship valid
      removeValidRelationshipColumnId(
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
): Command<"relationship.changeRelationshipType"> {
  return {
    type: "relationship.changeRelationshipType",
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
export function changeIdentification(
  relationshipId: string,
  identification: boolean
): Command<"relationship.changeIdentification"> {
  return {
    type: "relationship.changeIdentification",
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

export function loadRelationship(
  relationship: Relationship
): Command<"relationship.load"> {
  return {
    type: "relationship.load",
    data: relationship,
  };
}
export function executeLoadRelationship(store: Store, data: Relationship) {
  Logger.debug("executeLoadRelationship");
  const { relationships } = store.relationshipState;
  const { tables } = store.tableState;
  relationships.push(new RelationshipModel({ loadRelationship: data }));

  // valid end column ui key
  const table = getData(tables, data.end.tableId);
  if (table) {
    data.end.columnIds.forEach((columnId) => {
      const column = getData(table.columns, columnId);
      if (column) {
        if (column.option.primaryKey) {
          column.ui.pfk = true;
          column.ui.pk = false;
          column.ui.fk = false;
        } else {
          column.ui.pfk = false;
          column.ui.pk = false;
          column.ui.fk = true;
        }
      }
    });
  }
}
