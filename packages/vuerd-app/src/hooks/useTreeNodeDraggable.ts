import { computed, reactive } from 'vue';

import { TreeNode, TreeNodeType, useTreeStore } from '@/store/tree';

const state = reactive({
  draggable: false,
  targetNode: null as TreeNode | null,
});

export function useTreeNodeDraggable(node: TreeNode) {
  const [, treeActions] = useTreeStore();

  const guideClassMap = computed(() => ({
    'guide-folder':
      state.targetNode?.id === node.id && node.type === TreeNodeType.folder,
  }));

  const hasDrag = computed(
    () => state.draggable && node.type === TreeNodeType.folder
  );

  const onDragstart = () => {
    state.draggable = true;
  };

  const onDragend = () => {
    treeActions.move(state.targetNode);
    state.draggable = false;
    state.targetNode = null;
  };

  const onDragenter = () => {
    state.targetNode = hasDrag.value ? node : null;
  };

  const onDragleave = () => {
    // hasDrag.value && (state.targetNode = null);
  };

  const onDragover = () => {
    state.targetNode = hasDrag.value ? node : null;
  };

  return {
    guideClassMap,
    onDragstart,
    onDragend,
    onDragenter,
    onDragleave,
    onDragover,
  };
}
