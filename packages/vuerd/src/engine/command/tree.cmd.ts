import { ExecuteCommand } from '@/internal-types/command';
import {
  HideTree,
  RefreshTree,
  TreeCommandMap,
} from '@@types/engine/command/tree.cmd';
import { State } from '@@types/engine/store';

export function executeRefreshTree(state: State, data: RefreshTree) {
  const editor = document.querySelector('erd-editor');
  if (!editor) return;
  editor.treeDrawerRef.refresh();
}

export function executeHideTree(state: State, data: HideTree) {
  const editor = document.querySelector('erd-editor');
  if (!editor) return;
  editor.treeDrawerRef.hideAll();
}

export const executeTreeCommandMap: Record<
  keyof TreeCommandMap,
  ExecuteCommand
> = {
  'tree.refresh': executeRefreshTree,
  'tree.hide': executeHideTree,
};
