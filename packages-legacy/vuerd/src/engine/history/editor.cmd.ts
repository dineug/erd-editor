import { createJsonStringify } from '@/core/file';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { IStore } from '@/internal-types/store';
import { BatchCommand } from '@@types/engine/command';

export function executeLoadJson(store: IStore, batchUndoCommand: BatchCommand) {
  batchUndoCommand.push(loadJson$(createJsonStringify(store)));
}

export function executeClear(store: IStore, batchUndoCommand: BatchCommand) {
  batchUndoCommand.push(loadJson$(createJsonStringify(store)));
}

export const executeEditorCommandMap = {
  'editor.loadJson': executeLoadJson,
  'editor.clear': executeClear,
};
