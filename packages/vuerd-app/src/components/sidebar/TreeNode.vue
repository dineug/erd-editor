<script lang="ts">
import { defineComponent, computed } from 'vue';
import { TreeNode } from '@/store/tree';
import Icon from '@/components/Icon.vue';

const paddingLeft = 10;
const getPaddingLeft = (depth: number) => depth * paddingLeft;

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
    const isRoot = computed(() => props.depth === 0);
    const isChildren = computed(
      () => props.node.type === 'folder' && !!props.node.children.length
    );

    const styleMap = computed(() => ({
      paddingLeft: `${getPaddingLeft(props.depth)}px`,
    }));

    return {
      isRoot,
      isChildren,
      styleMap,
    };
  },
});
</script>

<template lang="pug">
div(
  v-if="!isRoot"
  class="flex items-center h-6"
  :style="styleMap"
)
  div(
    class="flex items-center h-full"
  )
    template(v-if="isChildren")
      Icon(v-if="node.open" prefix="mdi" name="chevron-down" :size="16")
      Icon(v-else prefix="mdi" name="chevron-right" :size="16")
    div(v-else class="w-4")
  div {{ node.name }}

TreeNode(
  v-if="isChildren && node.open"
  v-for="childNode in node.children"
  :key="childNode.id"
  :node="childNode"
  :depth="depth + 1"
)
</template>
