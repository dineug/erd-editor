import {
  isBoolean,
  isNil,
  isNumber,
  isPlainObject,
  isString,
} from 'es-toolkit';

import { assign, entryId, validNumber } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  Direction,
  DirectionList,
  ReferentialAction,
  ReferentialActionList,
  Relationship,
  RelationshipType,
  RelationshipTypeList,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/v3/schema/relationship.entity';

export const createRelationship = (): Relationship => ({
  id: '',
  identification: false,
  relationshipType: RelationshipType.ZeroN,
  startRelationshipType: StartRelationshipType.dash,
  onDelete: ReferentialAction.none,
  onUpdate: ReferentialAction.none,
  start: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: Direction.bottom,
  },
  end: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: Direction.bottom,
  },
});

export function createAndMergeRelationshipEntities(
  json?: DeepPartial<Record<string, Relationship>>
): Record<string, Relationship> {
  const entities: Record<string, Relationship> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const [key, value] of Object.entries(json)) {
    if (!isPlainObject(value)) continue;
    const target = createRelationship();
    const assignString = assign(isString, target, value);
    const assignBoolean = assign(isBoolean, target, value);
    const startAssignNumber = assign(isNumber, target.start, value.start);
    const startAssignString = assign(isString, target.start, value.start);
    const endAssignNumber = assign(isNumber, target.end, value.end);
    const endAssignString = assign(isString, target.end, value.end);

    target.id = entryId(key, value);
    assignBoolean('identification');
    assign(
      validNumber(RelationshipTypeList),
      target,
      value
    )('relationshipType');
    assign(
      validNumber(StartRelationshipTypeList),
      target,
      value
    )('startRelationshipType');
    assign(validNumber(ReferentialActionList), target, value)('onDelete');
    assign(validNumber(ReferentialActionList), target, value)('onUpdate');

    startAssignString('tableId');
    startAssignNumber('x');
    startAssignNumber('y');
    assign(validNumber(DirectionList), target.start, value.start)('direction');
    assign(Array.isArray, target.start, value.start)('columnIds');

    endAssignString('tableId');
    endAssignNumber('x');
    endAssignNumber('y');
    assign(validNumber(DirectionList), target.end, value.end)('direction');
    assign(Array.isArray, target.end, value.end)('columnIds');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
