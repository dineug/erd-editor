<script lang="ts">
import { fromEvent, Observable, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  reactive,
  ref,
  toRefs,
} from 'vue';

import DropGuide from '@/components/editor/DropGuide.vue';
import ViewerTab from '@/components/editor/ViewerTab.vue';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { useVuerd } from '@/hooks/useVuerd';
import { Tab, useViewStore, ViewNode } from '@/store/view';
import { Placement, SIZE_VIEW_TAB_HEIGHT } from '@/store/view/constants';
import { split } from '@/store/view/helper';

export default defineComponent({
  components: {
    DropGuide,
    ViewerTab,
  },
  props: {
    node: {
      type: ViewNode,
      default: () => new ViewNode(),
    },
  },
  setup(props) {
    const state = reactive({
      dropView: false,
      placement: Placement.all,
    });
    const viewRef = ref<HTMLElement | null>(null);
    const { push } = useUnsubscribe();
    const { getVuerd } = useVuerd();
    const [viewState, viewActions] = useViewStore();

    let dragover$: Observable<DragEvent> | null = null;
    let dragenter$: Observable<DragEvent> | null = null;
    let subDragover: Subscription | null | undefined = null;
    let subDragenter: Subscription | null | undefined = null;

    const width = computed(() => props.node.width);
    const height = computed(() => props.node.height - SIZE_VIEW_TAB_HEIGHT);

    const styleMap = computed(() => ({
      width: `${width.value}px`,
      height: `${height.value}px`,
      top: `${SIZE_VIEW_TAB_HEIGHT}px`,
    }));

    const activeTab = computed(() => {
      if (!props.node.tabs.length) return null;
      return props.node.tabs.find(tab => tab.active) ?? props.node.tabs[0];
    });

    const splitView = (tab: Tab) => {
      if (tab && tab.viewNode) {
        let tabView!: ViewNode;
        switch (state.placement) {
          case Placement.all:
            if (props.node.id === tab.viewNode.id) {
              viewActions.tabActive({
                view: props.node,
                tab,
              });
            } else {
              viewActions.tabMove({ view: props.node });
            }
            break;
          default:
            if (props.node.id === tab.viewNode.id) {
              tabView = props.node;
            } else {
              tabView = tab.viewNode;
            }
            if (tabView.id !== props.node.id || props.node.tabs.length !== 1) {
              split(viewState.root, state.placement, tab, tabView, props.node);
            }
            viewActions.tabActiveAll();
            break;
        }
      }
    };

    const onDragenter = () => {
      eventBus.emit(Bus.EditorViewer.dropViewStart, props.node.id);
    };

    const onDragover = (event: DragEvent) => {
      const x = event.offsetX;
      const y = event.offsetY;
      const minWidth = width.value * 0.2;
      const minHeight = height.value * 0.2;
      if (x <= minWidth) {
        state.placement = Placement.left;
      } else if (x >= width.value - minWidth) {
        state.placement = Placement.right;
      } else if (y <= minHeight) {
        state.placement = Placement.top;
      } else if (y >= height.value - minHeight) {
        state.placement = Placement.bottom;
      } else {
        state.placement = Placement.all;
      }
    };

    const onDropStart = () => {
      subDragenter = dragenter$?.subscribe(onDragenter);
      subDragover = dragover$?.pipe(throttleTime(100)).subscribe(onDragover);
    };

    const onDropEnd = (tab: Tab) => {
      if (state.dropView) {
        splitView(tab);
      }
      state.dropView = false;
      subDragenter?.unsubscribe();
      subDragover?.unsubscribe();
    };

    const onDropViewStart = (viewId: string) => {
      state.dropView = props.node.id === viewId;
    };

    const onDropViewEnd = () => {
      state.dropView = false;
    };

    const onEditorLoad = (viewId?: string) => {
      if (!viewId || viewId === props.node.id) {
        nextTick(() => {
          const tab = activeTab.value;
          if (!tab || !viewRef.value) return;

          viewRef.value.childNodes.forEach(node =>
            viewRef.value?.removeChild(node)
          );

          const erdEditor = getVuerd(tab);
          viewRef.value.appendChild(erdEditor);
        });
      }
    };

    const onFocusView = () => {
      viewActions.viewFocusStart(props.node);
    };

    const onMousedown = () => {
      viewActions.tabAddPreviewEnd();
    };

    const onDragstartTab = () => {
      eventBus.emit(Bus.EditorViewer.dropStart);
    };

    const onDragenterTab = () => {
      eventBus.emit(Bus.EditorViewer.dropViewEnd);
    };

    push(
      eventBus.on(Bus.EditorViewer.dropStart).subscribe(onDropStart),
      eventBus.on(Bus.EditorViewer.dropEnd).subscribe(onDropEnd),
      eventBus.on(Bus.EditorViewer.dropViewStart).subscribe(onDropViewStart),
      eventBus.on(Bus.EditorViewer.dropViewEnd).subscribe(onDropViewEnd),
      eventBus.on(Bus.EditorViewer.editorLoad).subscribe(onEditorLoad)
    );

    onMounted(() => {
      if (!viewRef.value) return;
      dragover$ = fromEvent<DragEvent>(viewRef.value, 'dragover');
      dragenter$ = fromEvent<DragEvent>(viewRef.value, 'dragenter');
      onEditorLoad();
    });

    return {
      ...toRefs(state),
      width,
      height,
      styleMap,
      viewRef,
      onDragover,
      onFocusView,
      onMousedown,
      onDragstartTab,
      onDragenterTab,
    };
  },
});
</script>

<template lang="pug">
.viewer-container(@click="onFocusView" @mousedown="onMousedown")
  ViewerTab(
    :node="node"
    @dragstart="onDragstartTab"
    @dragenter="onDragenterTab"
  )
  .viewer-editor.scrollbar(
    ref="viewRef"
    :style="styleMap"
    :id="`editor-${node.id}`"
  )
  DropGuide(
    v-if="dropView"
    :width="width"
    :height="height"
    :placement="placement"
    @dragover="onDragover"
  )
</template>

<style scoped lang="scss">
.viewer-container {
  height: 100%;
  overflow: auto;

  .viewer-editor {
    width: 100%;
    position: absolute;
    z-index: 100;
    overflow: hidden;
  }
}
</style>
