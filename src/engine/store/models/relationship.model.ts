import {
  Relationship,
  RelationshipType,
  RelationshipPoint,
} from '@@types/engine/store/relationship.state';
import { AddRelationship } from '@@types/engine/command/relationship.cmd';
import {
  cloneDeep,
  isString,
  isArray,
  isNumber,
  isBoolean,
  isObject,
} from '@/core/helper';

interface RelationshipData {
  addRelationship?: AddRelationship;
  loadRelationship?: Relationship;
}

const migrationRelationshipTypes = ['ZeroOneN', 'One', 'N'];
const migrationRelationshipTypeMap = {
  ZeroOneN: 'ZeroN',
  One: 'OneOnly',
  N: 'OneN',
};
const migrationRelationshipType = (relationshipType: RelationshipType) =>
  migrationRelationshipTypes.includes(relationshipType)
    ? (migrationRelationshipTypeMap as any)[relationshipType]
    : relationshipType;

const isLoadRelationship = (loadRelationship: Relationship) =>
  isString(loadRelationship.id) &&
  isBoolean(loadRelationship.identification) &&
  isString(loadRelationship.relationshipType) &&
  isObject(loadRelationship.start) &&
  isObject(loadRelationship.end) &&
  isString(loadRelationship.start.tableId) &&
  isNumber(loadRelationship.start.x) &&
  isNumber(loadRelationship.start.y) &&
  isString(loadRelationship.start.direction) &&
  isArray(loadRelationship.start.columnIds) &&
  isString(loadRelationship.end.tableId) &&
  isNumber(loadRelationship.end.x) &&
  isNumber(loadRelationship.end.y) &&
  isString(loadRelationship.end.direction) &&
  isArray(loadRelationship.end.columnIds);

export class RelationshipModel implements Relationship {
  id: string;
  identification = false;
  relationshipType: RelationshipType = 'ZeroN';
  start: RelationshipPoint = {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  };
  end: RelationshipPoint = {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  };

  constructor({ addRelationship, loadRelationship }: RelationshipData) {
    if (addRelationship) {
      const { id, relationshipType, start, end } = addRelationship;

      this.id = id;
      this.relationshipType = migrationRelationshipType(relationshipType);
      this.start.tableId = start.tableId;
      this.start.columnIds = [...start.columnIds];
      this.end.tableId = end.tableId;
      this.end.columnIds = [...end.columnIds];
    } else if (loadRelationship && isLoadRelationship(loadRelationship)) {
      const { id, identification, relationshipType, start, end } = cloneDeep(
        loadRelationship
      );

      this.id = id;
      this.identification = identification;
      this.relationshipType = migrationRelationshipType(relationshipType);
      this.start = start;
      this.end = end;
    } else {
      throw new Error('not found relationship');
    }
  }
}
