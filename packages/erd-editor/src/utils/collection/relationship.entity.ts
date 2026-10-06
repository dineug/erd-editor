import { uuid25 } from '@dineug/uuid';

import {
  Direction,
  ReferentialAction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { DeepPartial, Relationship } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';
import { deepMerge } from '@/utils/deepMerge';

export const createRelationship = (
  value?: DeepPartial<Relationship>
): Relationship =>
  deepMerge<Relationship>(
    {
      id: uuid25(),
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
      meta: getDefaultEntityMeta(),
    },
    value ?? {}
  );
