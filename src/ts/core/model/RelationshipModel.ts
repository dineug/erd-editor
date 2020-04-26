import {
  Relationship,
  RelationshipType,
  RelationshipPoint,
} from "../store/Relationship";
import { AddRelationship } from "../command/relationship";

interface RelationshipData {
  addRelationship?: AddRelationship;
  loadRelationship?: Relationship;
}

export class RelationshipModel implements Relationship {
  id: string;
  identification = false;
  relationshipType: RelationshipType;
  start: RelationshipPoint = {
    tableId: "",
    columnIds: [],
    x: 0,
    y: 0,
    direction: "bottom",
  };
  end: RelationshipPoint = {
    tableId: "",
    columnIds: [],
    x: 0,
    y: 0,
    direction: "bottom",
  };

  constructor(data: RelationshipData) {
    const { addRelationship, loadRelationship } = data;
    if (addRelationship) {
      const { id, relationshipType, start, end } = addRelationship;
      this.id = id;
      this.relationshipType = relationshipType;
      this.start = Object.assign(this.start, start);
      this.end = Object.assign(this.end, end);
    } else if (
      loadRelationship &&
      typeof loadRelationship.id === "string" &&
      typeof loadRelationship.identification === "boolean" &&
      typeof loadRelationship.relationshipType === "string" &&
      typeof loadRelationship.start === "object" &&
      loadRelationship.start !== null &&
      typeof loadRelationship.end === "object" &&
      loadRelationship.end !== null &&
      typeof loadRelationship.start.tableId === "string" &&
      typeof loadRelationship.start.x === "number" &&
      typeof loadRelationship.start.y === "number" &&
      typeof loadRelationship.start.direction === "string" &&
      Array.isArray(loadRelationship.start.columnIds) &&
      typeof loadRelationship.end.tableId === "string" &&
      typeof loadRelationship.end.x === "number" &&
      typeof loadRelationship.end.y === "number" &&
      typeof loadRelationship.end.direction === "string" &&
      Array.isArray(loadRelationship.end.columnIds)
    ) {
      const { id, relationshipType, start, end } = loadRelationship;
      this.id = id;
      this.relationshipType = relationshipType;
      this.start = Object.assign(this.start, start);
      this.end = Object.assign(this.end, end);
    } else {
      throw new Error("not found relationship");
    }
  }
}
