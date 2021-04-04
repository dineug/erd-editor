import { FilterCommandMap } from '@@types/engine/command/editor/filter.cmd';
import { State } from '@@types/engine/store';
import { ExecuteCommand } from '@/internal-types/command';

export function executeFilterActive({ editorState: { filterState } }: State) {
  filterState.active = true;
}

export function executeFilterActiveEnd({
  editorState: { filterState },
}: State) {
  filterState.active = false;
}

export const executeFilterCommandMap: Record<
  keyof FilterCommandMap,
  ExecuteCommand
> = {
  'editor.filter.active': executeFilterActive,
  'editor.filter.activeEnd': executeFilterActiveEnd,
};
