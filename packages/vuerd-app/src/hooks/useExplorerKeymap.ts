import { fromEvent } from 'rxjs';

import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { TreeNodeType, useTreeStore } from '@/store/tree';
import { getCurrentNode } from '@/store/tree/helper';

export function useExplorerKeymap() {
  const [treeState, treeActions] = useTreeStore();
  const { push } = useUnsubscribe();

  push(
    fromEvent<KeyboardEvent>(window, 'keydown').subscribe(event => {
      const currentNode = getCurrentNode();
      if (!treeState.focus || !currentNode) return;
      const isFolder = currentNode.type === TreeNodeType.folder;

      switch (event.key) {
        case 'ArrowUp':
          treeActions.selectMovePrev();
          break;
        case 'ArrowDown':
          treeActions.selectMoveNext();
          break;
        case 'ArrowLeft':
          isFolder && treeActions.close(currentNode);
          break;
        case 'ArrowRight':
          isFolder && treeActions.open(currentNode);
          break;
        case 'F2':
          treeActions.startRename();
          break;
        case 'Enter':
          currentNode.edit
            ? treeActions.endRename(currentNode)
            : treeActions.startRename();
          break;
        case 'Escape':
          currentNode.edit && treeActions.endRename(currentNode);
          break;
      }
    })
  );
}
