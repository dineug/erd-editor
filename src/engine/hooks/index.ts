import { CommandKey } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { useRelationshipSort } from './relationshipSort.hook';

export function useHooks(state: State, commandName: CommandKey) {
  useRelationshipSort(state, commandName);
}
