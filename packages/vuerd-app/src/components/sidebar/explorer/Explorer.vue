<script lang="ts">
import { defineComponent, toRefs } from 'vue';

import Title from '@/components/sidebar/Title.vue';
import TreeNode from '@/components/sidebar/explorer/TreeNode.vue';
import { useTreeStore } from '@/store/tree';
import { fromEvent } from 'rxjs';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { useExplorerKeymap } from '@/hooks/useExplorerKeymap';
import Contextmenu from '@/components/Contextmenu.vue';
import { useExplorerContextmenu } from '@/hooks/useExplorerContextmenu';
import OpenFile from '@/components/sidebar/explorer/OpenFile.vue';

export default defineComponent({
  components: {
    Title,
    TreeNode,
    OpenFile,
    Contextmenu,
  },
  setup() {
    const [treeState, treeActions] = useTreeStore();
    const { push } = useUnsubscribe();
    const { contextmenuState, onContextmenu, onCloseContextmenu } =
      useExplorerContextmenu();
    useExplorerKeymap();

    push(
      fromEvent<MouseEvent>(window, 'click').subscribe(event => {
        const el = event.target as HTMLElement | null;
        if (!el) return;

        if (!el.closest('.explorer') && !el.closest('.contextmenu')) {
          treeActions.focusout();
        }
        if (!el.closest('.tree-node') && !el.closest('.contextmenu')) {
          treeActions.selectNode(null);
        }
        el.closest('.contextmenu') || onCloseContextmenu();
      })
    );

    const onFocusin = () => {
      treeActions.focusin();
    };

    return {
      ...toRefs(contextmenuState),
      ...toRefs(treeState),
      onFocusin,
      onContextmenu,
      onCloseContextmenu,
    };
  },
});
</script>

<template lang="pug">
.explorer(:class="{focus}" @mousedown="onFocusin" @contextmenu="onContextmenu")
  Title(label="Explorer")
  Title(label="Open Files")
  OpenFile
  Title(label="Workspace")
  TreeNode(:node="root")

Contextmenu(v-if="menus" :menus="menus" :x="contextmenuX" :y="contextmenuY" @close="onCloseContextmenu")
</template>

<style scoped lang="scss">
.explorer {
  @apply flex flex-col h-full border border-solid;
  border-color: transparent;
  background-color: var(--sidebar-background);
  fill: var(--font-color);
  border: solid 1px transparent;

  &.focus {
    border-color: var(--focus-color);
  }
}
</style>
