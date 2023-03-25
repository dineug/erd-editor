import { isArray, isBoolean, isNill, isNumber, isString } from '@dineug/shared';

import { assign, validString } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  DirectionList,
  Relationship,
  RelationshipEntity,
  RelationshipTypeList,
  StartRelationshipTypeList,
} from '@/v2/schema/relationshipEntity';

const createRelationshipEntity = (): RelationshipEntity => ({
  relationships: [],
});

const createRelationship = (): Relationship => ({
  id: '',
  identification: false,
  relationshipType: 'ZeroN',
  startRelationshipType: 'Dash',
  start: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  },
  end: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: 'bottom',
  },
  constraintName: '',
  visible: true,
});

export function createAndMergeRelationshipEntity(
  json?: DeepPartial<RelationshipEntity>
): RelationshipEntity {
  const entity = createRelationshipEntity();
  if (isNill(json) || !isArray(json.relationships)) {
    return entity;
  }

  for (const relationship of json.relationships) {
    const target = createRelationship();
    const assignString = assign(isString, target, relationship);
    const assignBoolean = assign(isBoolean, target, relationship);
    const startAssignNumber = assign(
      isNumber,
      target.start,
      relationship.start
    );
    const startAssignString = assign(
      isString,
      target.start,
      relationship.start
    );
    const endAssignNumber = assign(isNumber, target.end, relationship.end);
    const endAssignString = assign(isString, target.end, relationship.end);

    assignString('id');
    assignString('constraintName');
    assignBoolean('identification');
    assignBoolean('visible');
    assign(
      validString(RelationshipTypeList),
      target,
      relationship
    )('relationshipType');
    assign(
      validString(StartRelationshipTypeList),
      target,
      relationship
    )('startRelationshipType');

    startAssignString('tableId');
    startAssignNumber('x');
    startAssignNumber('y');
    assign(
      validString(DirectionList),
      target.start,
      relationship.start
    )('direction');

    if (isArray(relationship.start?.columnIds)) {
      target.start.columnIds = relationship.start?.columnIds.filter(
        isString
      ) as string[];
    }

    endAssignString('tableId');
    endAssignNumber('x');
    endAssignNumber('y');
    assign(
      validString(DirectionList),
      target.end,
      relationship.end
    )('direction');

    if (isArray(relationship.end?.columnIds)) {
      target.end.columnIds = relationship.end?.columnIds.filter(
        isString
      ) as string[];
    }

    entity.relationships.push(target);
  }

  return entity;
}
