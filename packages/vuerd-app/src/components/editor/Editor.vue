<script lang="ts">
import { defineComponent, computed, watch, onMounted } from 'vue';
import { useViewportStore } from '@/store/ui/viewport.store';
import { useViewStore, ViewNode } from '@/store/view';
import SplitView from '@/components/editor/SplitView.vue';
import {
  resetWidthRatio,
  resetHeightRatio,
  resetSize,
} from '@/store/view/helper';

export default defineComponent({
  components: {
    SplitView,
  },
  props: {
    width: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const [viewState] = useViewStore();
    const [viewportState] = useViewportStore();
    const styleMap = computed(() => ({
      width: `${props.width}px`,
      height: `${viewportState.height}px`,
    }));

    const onDragover = (event: DragEvent) => {
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    };

    watch(
      () => props.width,
      width => {
        viewState.root.width = width;
        resetWidthRatio(viewState.root as ViewNode);
      }
    );

    watch(
      () => viewportState.height,
      height => {
        viewState.root.height = height;
        resetHeightRatio(viewState.root as ViewNode);
      }
    );

    onMounted(() => {
      viewState.root.width = props.width;
      viewState.root.height = viewportState.height;
      resetSize(viewState.root as ViewNode);
    });

    return {
      root: viewState.root as ViewNode,
      styleMap,
      onDragover,
    };
  },
});
</script>

<template lang="pug">
.editor(:style="styleMap" @dragover.prevent="onDragover" @drop.prevent)
  SplitView(:node="root")
</template>

<style scoped lang="scss">
.editor {
  @apply w-full h-full;
  background-color: var(--editor-background);
}
</style>
