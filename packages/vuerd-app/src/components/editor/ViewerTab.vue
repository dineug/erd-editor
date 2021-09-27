<script lang="ts">
import { fromEvent, Observable, Subject,Subscription } from 'rxjs';
import { debounceTime,throttleTime } from 'rxjs/operators';
import { computed,defineComponent, onMounted, reactive, ref } from 'vue';

import Icon from '@/components/Icon.vue';
import { findParentLiByElement, getData } from '@/helpers';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { Tab,useViewStore, ViewNode } from '@/store/view';
import { SIZE_VIEW_TAB_HEIGHT } from '@/store/view/constants';

const TAB_PADDING = 42.5;

export default defineComponent({
  components: {
    Icon,
  },
  props: {
    node: {
      type: ViewNode,
      default: () => new ViewNode(),
    },
  },
  emits: {
    dragstart: (event: DragEvent) => true,
    dragenter: (event: DragEvent) => true,
  },
  setup(props, { emit }) {
    const [viewState, viewActions] = useViewStore();
    const { push } = useUnsubscribe();
    const state = reactive({
      minWidth: 0,
    });
    const elRef = ref<HTMLElement | null>(null);

    const styleMap = computed(() => ({
      width: `${props.node.width}px`,
    }));

    const ulStyleMap = computed(() => ({
      'min-width': `${state.minWidth}px`,
      height: `${SIZE_VIEW_TAB_HEIGHT}px`,
    }));

    const draggable$: Subject<DragEvent> = new Subject();
    let dragenter$: Observable<DragEvent> | null = null;
    let draggableListener: Subscription[] = [];
    let subDragenter: Subscription | null | undefined = null;
    let subDraggable: Subscription | null | undefined = null;

    const getClassMap = (tab: Tab) => ({
      draggable:
        viewState.draggableTab &&
        viewState.draggableTab.viewNode?.id === props.node.id &&
        viewState.draggableTab.id === tab.id,
      active: tab.active,
    });

    const setMinWidth = () => {
      if (!elRef.value || props.node.tabs.length) return;

      const ul = elRef.value.childNodes[0];
      state.minWidth = 0;
      ul.childNodes.forEach((child: ChildNode) => {
        const li = child as HTMLElement;
        const span = li.querySelector<HTMLElement>('.name');
        if (span) {
          state.minWidth += span.offsetWidth + TAB_PADDING;
        }
      });
    };

    const onActive = (tab?: Tab) => {
      viewActions.tabActive({ view: props.node, tab });
    };

    const onClose = (tab: Tab) => {
      viewActions.tabClose({ view: props.node, tab });
    };

    const onMousedown = () => {
      const selection = window.getSelection();
      selection && selection.removeAllRanges();
      viewActions.tabAddPreviewEnd();
    };

    const onDragstart = (event: DragEvent, tab: Tab) => {
      tab.viewNode = props.node;
      viewActions.tabDraggableStart(tab);
      emit('dragstart', event);
      eventBus.emit(Bus.EditorTab.draggableStart);
      eventBus.emit(Bus.OpenFile.draggableStart);
      eventBus.emit(Bus.Editor.dragstart);
      event.dataTransfer && event.dataTransfer.setData('text/plain', tab.id);
    };

    const onDragend = () => {
      eventBus.emit(Bus.EditorViewer.dropEnd, viewState.draggableTab);
      eventBus.emit(Bus.EditorTab.draggableEnd);
      eventBus.emit(Bus.OpenFile.draggableEnd);
      eventBus.emit(Bus.Editor.dragend);
      viewActions.tabDraggableEnd();
    };

    const onDragover = (event: DragEvent) => {
      const li = findParentLiByElement(event.target as HTMLElement);
      if (
        li &&
        li.dataset.id &&
        viewState.draggableTab &&
        viewState.draggableTab.id !== li.dataset.id
      ) {
        const tab = getData(props.node.tabs, li.dataset.id);
        tab && viewActions.tabMove({ view: props.node, tab });
      }
    };

    const onDragenter = (event: DragEvent) => {
      if (
        viewState.draggableTab &&
        viewState.draggableTab.viewNode?.id !== props.node.id
      ) {
        viewActions.tabMove({ view: props.node });
      }
      emit('dragenter', event);
    };

    const onDragoverGroup = (event: DragEvent) => {
      draggable$.next(event);
    };

    const onDraggableStart = () => {
      if (!elRef.value) return;
      subDragenter = dragenter$?.subscribe(onDragenter);
      const ul = elRef.value.childNodes[0];
      ul.childNodes.forEach((li: ChildNode) => {
        draggableListener.push(
          fromEvent<DragEvent>(li as HTMLElement, 'dragover')
            .pipe(throttleTime(300))
            .subscribe(onDragoverGroup)
        );
      });
    };

    const onDraggableEnd = () => {
      subDragenter?.unsubscribe();
      draggableListener.forEach((draggable: Subscription) =>
        draggable.unsubscribe()
      );
      draggableListener = [];
    };

    viewActions.tabViewDelete({ view: props.node });

    push(
      eventBus.on(Bus.EditorTab.draggableStart).subscribe(onDraggableStart),
      eventBus.on(Bus.EditorTab.draggableEnd).subscribe(onDraggableEnd)
    );

    onMounted(() => {
      if (!elRef.value) return;
      setMinWidth();
      dragenter$ = fromEvent<DragEvent>(elRef.value, 'dragenter');
      subDraggable = draggable$.pipe(debounceTime(50)).subscribe(onDragover);
    });

    return {
      elRef,
      styleMap,
      ulStyleMap,
      getClassMap,
      onActive,
      onClose,
      onMousedown,
      onDragstart,
      onDragend,
    };
  },
});
</script>

<template lang="pug">
.split-view-tab.scrollbar(:style="styleMap" ref="elRef")
  transition-group(
    :style="ulStyleMap"
    name="tab"
    tag="ul"
    :css="false"
  )
    li(
      draggable="true"
      v-for="tab in node.tabs"
      :key="tab.id"
      :data-id="tab.id"
      :class="getClassMap(tab)"
      :title="tab.path"
      @click="onActive(tab)"
      @mousedown="onMousedown"
      @dragstart="onDragstart($event, tab)"
      @dragend="onDragend"
    )
      span.name {{tab.name}}
      span.close(@click.stop="onClose(tab)")
        Icon(:size="12" prefix="mdi" name="close")
</template>

<style scoped lang="scss">
.split-view-tab {
  position: absolute;
  overflow-x: auto;
  z-index: 200;

  /* width */
  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  ul {
    overflow-y: hidden;
    background-color: var(--tab-bar-background);

    li {
      box-sizing: border-box;
      padding: 5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
      height: 31px;
      color: var(--font-color);
      background-color: var(--tab-background);

      &.draggable {
        opacity: 0.5;
      }

      &.active {
        color: var(--font-foreground);
        background-color: var(--tab-foreground);
      }

      .name {
        padding-right: 7px;
        @apply text-sm;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }

      .close {
        fill: var(--font-color);

        &:hover {
          fill: var(--font-foreground);
        }
      }
    }
  }
}

/* animation */
.tab-move {
  transition: transform 0.3s;
}

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
