import {
  cloneDeep,
  isArray,
  isBoolean,
  isNumber,
  isObject,
  isString,
} from '@/core/helper';
import { migrationRelationshipType } from '@/core/migration/relationshipType';
import { AddRelationship } from '@@types/engine/command/relationship.cmd';
import {
  Relationship,
  RelationshipPoint,
  RelationshipType,
  StartRelationshipType,
} from '@@types/engine/store/relationship.state';

interface RelationshipData {
  addRelationship?: AddRelationship;
  loadRelationship?: Relationship;
}

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
  startRelationshipType: StartRelationshipType = 'Dash';
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
  constraintName = '';
  visible = true;

  constructor({ addRelationship, loadRelationship }: RelationshipData) {
    if (addRelationship) {
      const { id, relationshipType, start, end, constraintName } =
        addRelationship;

      this.id = id;
      this.relationshipType = migrationRelationshipType(relationshipType);
      this.start.tableId = start.tableId;
      this.start.columnIds = [...start.columnIds];
      this.end.tableId = end.tableId;
      this.end.columnIds = [...end.columnIds];
      this.constraintName = constraintName;
    } else if (loadRelationship && isLoadRelationship(loadRelationship)) {
      const {
        id,
        identification,
        relationshipType,
        startRelationshipType,
        start,
        end,
        constraintName,
        visible,
      } = cloneDeep(loadRelationship);

      this.id = id;
      this.identification = identification;
      this.relationshipType = migrationRelationshipType(relationshipType);
      this.start = start;
      this.end = end;
      this.constraintName = constraintName || '';
      if (startRelationshipType) {
        this.startRelationshipType = startRelationshipType;
      }
      if (isBoolean(visible)) this.visible = visible;
    } else {
      throw new Error('not found relationship');
    }
  }
}
