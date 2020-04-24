import {
  Relationship,
  RelationshipType,
  RelationshipPoint,
} from "../store/Relationship";
import { AddRelationship } from "../command/relationship";

interface RelationshipData {
  addRelationship?: AddRelationship;
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
    const { addRelationship } = data;
    if (addRelationship) {
      this.id = addRelationship.id;
      this.relationshipType = addRelationship.relationshipType;
      this.start = Object.assign(this.start, addRelationship.start);
      this.end = Object.assign(this.end, addRelationship.end);
    } else {
      throw new Error("not found relationship");
    }
  }
}
