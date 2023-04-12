import {
  isArray,
  isBoolean,
  isNill,
  isNumber,
  isObject,
  isString,
} from '@dineug/shared';

import {
  assign,
  assignMeta,
  getDefaultEntityMeta,
  validNumber,
} from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import {
  Direction,
  DirectionList,
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
  meta: getDefaultEntityMeta(),
});

export function createAndMergeRelationshipEntities(
  json?: DeepPartial<PartialRecord<Relationship>>
): PartialRecord<Relationship> {
  const entities: PartialRecord<Relationship> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createRelationship();
    const assignString = assign(isString, target, value);
    const assignBoolean = assign(isBoolean, target, value);
    const startAssignNumber = assign(isNumber, target.start, value.start);
    const startAssignString = assign(isString, target.start, value.start);
    const endAssignNumber = assign(isNumber, target.end, value.end);
    const endAssignString = assign(isString, target.end, value.end);

    assignString('id');
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

    startAssignString('tableId');
    startAssignNumber('x');
    startAssignNumber('y');
    assign(validNumber(DirectionList), target.start, value.start)('direction');
    assign(isArray, target.start, value.start)('columnIds');

    endAssignString('tableId');
    endAssignNumber('x');
    endAssignNumber('y');
    assign(validNumber(DirectionList), target.end, value.end)('direction');
    assign(isArray, target.end, value.end)('columnIds');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
