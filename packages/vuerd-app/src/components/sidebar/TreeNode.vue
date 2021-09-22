<script lang="ts">
import {
  defineComponent,
  computed,
  ref,
  watch,
  nextTick,
  onMounted,
} from 'vue';
import { TreeNode, useTreeStore, TreeNodeType } from '@/store/tree';
import Icon from '@/components/Icon.vue';

const paddingLeft = 10;
const getPaddingLeft = (depth: number) => depth * paddingLeft;
const foldTypes = [TreeNodeType.root, TreeNodeType.folder];

export default defineComponent({
  name: 'TreeNode',
  components: {
    Icon,
  },
  props: {
    node: {
      type: TreeNode,
      default: new TreeNode(),
    },
    depth: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const [treeState, treeActions] = useTreeStore();
    const renameRef = ref<HTMLInputElement | null>(null);

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
      onToggle,
      onSelect,
      onBlur,
    };
  },
});
</script>

<template lang="pug">
.tree-node(
  v-if="!isRoot"
  class="flex items-center h-6 cursor-pointer"
  :style="styleMap"
  @mousedown="onSelect"
  @click="onToggle"
)
  div(
    class="flex items-center h-full"
  )
    template(v-if="isFolder")
      Icon(v-if="node.open" prefix="mdi" name="chevron-down" :size="16")
      Icon(v-else prefix="mdi" name="chevron-right" :size="16")
    div(v-else class="w-4")
  input.rename(v-if="node.edit" v-model="node.name" ref="renameRef" @blur="onBlur")
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
</style>
