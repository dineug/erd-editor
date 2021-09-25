<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  watch,
} from 'vue';

import Icon from '@/components/Icon.vue';
import { validFileName } from '@/helpers';
import { useTreeNodeDraggable } from '@/hooks/useTreeNodeDraggable';
import { TreeNode, TreeNodeType, useTreeStore } from '@/store/tree';
import { useViewStore } from '@/store/view';

const defaultPaddingLeft = 6;
const paddingLeft = 10;
const getPaddingLeft = (depth: number) =>
  depth * paddingLeft + defaultPaddingLeft;
const foldTypes = [TreeNodeType.root, TreeNodeType.folder];

export default defineComponent({
  name: 'TreeNode',
  components: {
    Icon,
  },
  props: {
    node: {
      type: TreeNode,
      default: () => new TreeNode(),
    },
    depth: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const [treeState, treeActions] = useTreeStore();
    const [, viewActions] = useViewStore();
    const renameRef = ref<HTMLInputElement | null>(null);
    const draggable = useTreeNodeDraggable(props.node);

    const isRoot = computed(() => props.depth === 0);
    const isFolder = computed(() => foldTypes.includes(props.node.type));
    const isChildren = computed(
      () => isFolder.value && !!props.node.children.length
    );
    const isSelect = computed(() =>
      treeState.selectNodes.some(node => node.id === props.node.id)
    );

    const styleMap = computed(() => ({
      paddingLeft: `${getPaddingLeft(props.depth)}px`,
      backgroundColor: isSelect.value ? `var(--focus-foreground)` : undefined,
    }));

    const onToggle = () => {
      if (!isFolder.value) return;
      props.node.open
        ? treeActions.close(props.node)
        : treeActions.open(props.node);
    };

    const onClick = () => {
      onToggle();
      props.node.type === TreeNodeType.file &&
        viewActions.tabAddPreviewStart(props.node);
    };

    const onSelect = (event: MouseEvent) => {
      treeActions.selectNode(
        props.node,
        event.ctrlKey || event.metaKey,
        event.shiftKey
      );
    };

    const onBlur = () => {
      treeActions.endRename(props.node);
    };

    const onFocus = () => {
      if (!renameRef.value) return;
      renameRef.value.focus();
    };

    const onInput = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      if (!el) return;
      el.value = validFileName(el.value);
      // eslint-disable-next-line vue/no-mutating-props
      props.node.name = el.value;
    };

    const onOpenFile = () => {
      props.node.type === TreeNodeType.file && viewActions.tabAdd(props.node);
    };

    watch(
      () => props.node.edit,
      () => {
        nextTick(onFocus);
      }
    );

    onMounted(() => {
      onFocus();
    });

    return {
      isRoot,
      isFolder,
      isChildren,
      styleMap,
      renameRef,
      onClick,
      onSelect,
      onBlur,
      onInput,
      onOpenFile,
      ...draggable,
    };
  },
});
</script>

<template lang="pug">
.tree-node(
  v-if="!isRoot"
  class="flex items-center h-6 cursor-pointer"
  :class="guideClassMap"
  :style="styleMap"
  draggable="true"
  @mousedown="onSelect"
  @click="onClick"
  @dblclick="onOpenFile"
  @dragstart="onDragstart"
  @dragend="onDragend"
  @dragenter.prevent="onDragenter"
  @dragleave="onDragleave"
  @dragover.prevent="onDragover"
)
  div(
    class="flex items-center h-full"
  )
    template(v-if="isFolder")
      Icon(v-if="node.open" prefix="mdi" name="chevron-down" :size="16")
      Icon(v-else prefix="mdi" name="chevron-right" :size="16")
    div(v-else class="w-4")
  input.rename(v-if="node.edit" :value="node.name" ref="renameRef" @blur="onBlur" @input="onInput")
  div(v-else class="select-none") {{ node.name }}

TreeNode(
  v-if="isChildren && node.open"
  v-for="childNode in node.children"
  :key="childNode.id"
  :node="childNode"
  :depth="depth + 1"
)
</template>

<style lang="scss">
.tree-node {
  border: 1px solid transparent;
  box-sizing: border-box;

  &.guide-folder {
    color: var(--font-foreground);
    border: 1px solid var(--focus-color);
  }

  input.rename {
    width: 100%;
    outline: none;
    border: 1px solid transparent;
    background-color: var(--sidebar-background);
    color: var(--font-foreground);

    &:focus {
      border-color: var(--focus-color);
    }
  }
}
</style>
