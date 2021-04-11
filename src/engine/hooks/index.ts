import { CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Observable, Subscription } from 'rxjs';
import { useRelationshipSort } from './relationshipSort.hook';
import { useResetZIndex } from './resetZIndex.hook';

export const useHooks = (
  hook$: Observable<Array<CommandTypeAll>>,
  state: State
): Subscription[] => [
  useRelationshipSort(hook$, state),
  useResetZIndex(hook$, state),
];
