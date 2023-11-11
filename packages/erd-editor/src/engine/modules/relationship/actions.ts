import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addRelationship: 'relationship.add',
  removeRelationship: 'relationship.remove',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addRelationship]: {
    id: string;
    relationshipType: number;
    start: RelationshipPoint;
    end: RelationshipPoint;
  };
  [ActionType.removeRelationship]: {
    id: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;

type RelationshipPoint = {
  tableId: string;
  columnIds: string[];
};
