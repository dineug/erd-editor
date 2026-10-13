import { type ErdTarget, goToErdTarget } from '@/components/erd/goToErdTarget';
import {
  clearRelationshipHighlight,
  setRelationshipHighlight,
} from '@/components/erd/relationshipHighlight';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import type { RxStore } from '@/engine/rx-store';

import type { ExplorerNode } from './explorerTree';

/** Where on the canvas a row goes: none for a folder, which only folds and unfolds. */
export function targetOf(node: ExplorerNode): ErdTarget | null {
  switch (node.kind) {
    case 'folder':
      return null;
    case 'table':
    case 'index':
    case 'groupTable':
      return { kind: 'table', tableId: node.tableId };
    case 'column':
      return {
        kind: 'column',
        tableId: node.tableId,
        columnId: node.columnId,
        focusType: FocusType.columnName,
      };
    case 'foreignKey':
      return { kind: 'relationship', relationshipId: node.relationshipId };
    case 'tableGroup':
      return { kind: 'tableGroup', tableGroupId: node.tableGroupId };
    case 'memo':
      return { kind: 'memo', memoId: node.memoId };
  }
}

/**
 * Goes where a row stands for, by the one jump rule, and lights a foreign
 * key's relationship once there. Table Properties gives way first, so the
 * object the jump shows is not left under it (an owner decision of 2026-10-13).
 */
export function activateNode(store: RxStore, node: ExplorerNode): void {
  const target = targetOf(node);
  if (!target) return;

  const editorId = store.state.editor.id;
  clearRelationshipHighlight(editorId);
  if (store.state.editor.openMap[Open.tableProperties]) {
    store.dispatchSync(changeOpenMapAction({ [Open.tableProperties]: false }));
  }
  goToErdTarget(store, target);
  if (target.kind === 'relationship') {
    setRelationshipHighlight(editorId, target.relationshipId);
  }
}
