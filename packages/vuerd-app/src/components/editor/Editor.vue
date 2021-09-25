<script lang="ts">
import { fromEvent, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { computed, defineComponent, onMounted, ref,watch } from 'vue';

import SplitView from '@/components/editor/SplitView.vue';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { useViewportStore } from '@/store/ui/viewport.store';
import { useViewStore, ViewNode } from '@/store/view';
import {
  resetHeightRatio,
  resetSize,
  resetWidthRatio,
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
    const { push } = useUnsubscribe();
    const elRef = ref<HTMLElement | null>(null);

    const dragover$ = fromEvent<DragEvent>(window, 'dragover');
    let subDragover: Subscription | null | undefined = null;

    const styleMap = computed(() => ({
      width: `${props.width}px`,
      height: `${viewportState.height}px`,
    }));

    const onDragover = (event: DragEvent) => {
      event.dataTransfer && (event.dataTransfer.dropEffect = 'move');
    };

    const onDragoverTrack = (event: MouseEvent) => {
      if (!elRef.value) return;
      const { x, y, width, height } = elRef.value.getBoundingClientRect();
      const clientX = event.clientX - x;
      const clientY = event.clientY - y;
      if (clientX < 0 || clientY < 0 || clientX > width || clientY > height) {
        eventBus.emit(Bus.EditorViewer.dropViewEnd);
      }
    };

    const onEditorDragstart = () => {
      subDragover = dragover$
        .pipe(throttleTime(100))
        .subscribe(onDragoverTrack);
    };

    const onEditorDragend = () => {
      subDragover?.unsubscribe();
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

    push(
      eventBus.on(Bus.Editor.dragstart).subscribe(onEditorDragstart),
      eventBus.on(Bus.Editor.dragend).subscribe(onEditorDragend)
    );

    onMounted(() => {
      viewState.root.width = props.width;
      viewState.root.height = viewportState.height;
      resetSize(viewState.root as ViewNode);
    });

    return {
      root: viewState.root as ViewNode,
      elRef,
      styleMap,
      onDragover,
    };
  },
});
</script>

<template lang="pug">
.editor(
  :style="styleMap"
  ref="elRef"
  @dragover.prevent="onDragover"
  @drop.prevent
)
  SplitView(:node="root")
</template>

<style scoped lang="scss">
.editor {
  @apply w-full h-full;
  background-color: var(--editor-background);
}
</style>
