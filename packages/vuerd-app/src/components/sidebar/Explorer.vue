<script lang="ts">
import { defineComponent } from 'vue';

import Title from '@/components/sidebar/Title.vue';
import TreeNode from '@/components/sidebar/TreeNode.vue';
import { useTreeStore } from '@/store/tree';

export default defineComponent({
  components: {
    Title,
    TreeNode,
  },
  setup() {
    const [treeState] = useTreeStore();

    return {
      root: treeState.root,
    };
  },
});
</script>

<template lang="pug">
.explorer
  Title(label="Explorer")
  Title(label="Open Files")
  Title(label="Workspace")
  TreeNode(:node="root")
</template>

<style scoped lang="scss">
.explorer {
  @apply flex flex-col h-full border border-solid;
  border-color: transparent;
  background-color: var(--sidebar-background);
  fill: var(--font-color);
}
</style>
