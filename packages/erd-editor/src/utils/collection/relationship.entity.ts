import { SchemaV3Constants } from '@dineug/erd-editor-schema';

import { Relationship } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createRelationship = (
  value?: Partial<Relationship>
): Relationship => ({
  id: '',
  identification: false,
  relationshipType: SchemaV3Constants.RelationshipType.ZeroN,
  startRelationshipType: SchemaV3Constants.StartRelationshipType.dash,
  start: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: SchemaV3Constants.Direction.bottom,
  },
  end: {
    tableId: '',
    columnIds: [],
    x: 0,
    y: 0,
    direction: SchemaV3Constants.Direction.bottom,
  },
  meta: getDefaultEntityMeta(),
  ...value,
});
