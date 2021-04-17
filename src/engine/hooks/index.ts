import { Helper } from '@@types/core/helper';
import { CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Observable, Subscription } from 'rxjs';
import { useRelationshipSort } from './relationshipSort.hook';
import { useResetZIndex } from './resetZIndex.hook';
import { useRecalculatingTableWidth } from './recalculatingTableWidth.hook';

export const useHooks = (
  hook$: Observable<Array<CommandTypeAll>>,
  state: State,
  helper: Helper
): Subscription[] => [
  useRecalculatingTableWidth(hook$, state, helper),
  useRelationshipSort(hook$, state, helper),
  useResetZIndex(hook$, state, helper),
];
