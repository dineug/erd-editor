import merge from 'deepmerge';
import { nanoid } from 'nanoid';

import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { DeepPartial, Relationship } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createRelationship = (
  value?: DeepPartial<Relationship>
): Relationship =>
  merge(
    {
      id: nanoid(),
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
    },
    (value as Relationship) ?? {}
  );
