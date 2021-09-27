<script lang="ts">
import { fromEvent, Subject, Subscription } from 'rxjs';
import { debounceTime, throttleTime } from 'rxjs/operators';
import { computed, defineComponent, ref } from 'vue';

import Icon from '@/components/Icon.vue';
import { findParentLiByElement, getData } from '@/helpers';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { Tab, useViewStore, ViewNode } from '@/store/view';
import { tabGroups } from '@/store/view/helper';

export default defineComponent({
  components: {
    Icon,
  },
  setup() {
    const [viewState, viewActions] = useViewStore();
    const { push } = useUnsubscribe();
    const elRef = ref<HTMLElement | null>(null);
    const groups = computed(() => tabGroups(viewState.root));

    const draggable$: Subject<DragEvent> = new Subject();
    let draggableListener: Subscription[] = [];

    const getClassMap = (group: ViewNode, tab: Tab) => ({
      draggable:
        viewState.draggableTab &&
        viewState.draggableTab.viewNode?.id === group.id &&
        viewState.draggableTab.id === tab.id,
      active: tab.active,
    });

    const onActive = (view: ViewNode, tab?: Tab) => {
      viewActions.tabActive({ view, tab });
    };

    const onClose = (view: ViewNode, tab: Tab) => {
      viewActions.tabClose({ view, tab });
    };

    const onMousedown = () => {
      const selection = window.getSelection();
      selection && selection.removeAllRanges();
    };

    const onDragoverGroup = (event: DragEvent) => {
      draggable$.next(event);
    };

    const onDraggableStart = () => {
      if (!elRef.value) return;

      const list = elRef.value.querySelectorAll('.draggable');
      list.forEach((li: Element) => {
        draggableListener.push(
          fromEvent<DragEvent>(li as HTMLElement, 'dragover')
            .pipe(throttleTime(300))
            .subscribe(onDragoverGroup)
        );
      });
    };

    const onDraggableEnd = () => {
      draggableListener.forEach((draggable: Subscription) =>
        draggable.unsubscribe()
      );
      draggableListener = [];
    };

    const onDragover = (event: DragEvent) => {
      const li = findParentLiByElement(event.target as HTMLElement);
      if (li && li.dataset.id && li.dataset.viewId && viewState.draggableTab) {
        const view = getData(groups.value, li.dataset.viewId);
        if (!view) return;

        const tab = getData(view.tabs, li.dataset.id);
        if (!tab) return;

        viewActions.tabMove({ view, tab });
      }
    };

    const onDragstart = (event: DragEvent, view: ViewNode, tab: Tab) => {
      tab.viewNode = view;
      viewActions.tabDraggableStart(tab);
      onDraggableStart();
      eventBus.emit(Bus.EditorTab.draggableStart);
      eventBus.emit(Bus.EditorViewer.dropStart);
      eventBus.emit(Bus.Editor.dragstart);
      event.dataTransfer && event.dataTransfer.setData('text/plain', tab.id);
    };

    const onDragend = () => {
      eventBus.emit(Bus.EditorViewer.dropEnd, viewState.draggableTab);
      eventBus.emit(Bus.EditorTab.draggableEnd);
      eventBus.emit(Bus.Editor.dragend);
      onDraggableEnd();
      viewActions.tabDraggableEnd();
    };

    push(
      eventBus.on(Bus.OpenFile.draggableStart).subscribe(onDraggableStart),
      eventBus.on(Bus.OpenFile.draggableEnd).subscribe(onDraggableEnd),
      draggable$.pipe(debounceTime(50)).subscribe(onDragover)
    );

    return {
      groups,
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
.open-file.scrollbar
  ul(v-for="(group, i) in groups" :key="group.id")
    li
      span.arrow(v-if="groups.length !== 1")
        .none-arrow
      span.group-title(v-if="groups.length !== 1") Group {{i + 1}}
      transition-group(name="tab" tag="ul")
        li.draggable(
          v-for="tab in group.tabs"
          :key="tab.id"
          :data-id="tab.id"
          :data-view-id="group.id"
        )
          span.arrow(@click.stop="onClose(group, tab)")
            Icon(:size="12" prefix="mdi" name="close")
          span.node(
            :class="getClassMap(group, tab)"
            draggable="true"
            @click="onActive(group, tab)"
            @mousedown="onMousedown"
            @dragstart="onDragstart($event, group, tab)"
            @dragend="onDragend"
          )
            span.name {{tab.name}}
</template>

<style scoped lang="scss">
.open-file {
  overflow-y: auto;
  max-height: 300px;
  margin-left: 6px;

  ul {
    position: relative;
    z-index: 200;

    li {
      padding-left: 10px;
      white-space: nowrap;
      overflow: hidden;

      .arrow {
        cursor: pointer;
        padding: 0 2px;

        .none-arrow {
          display: inline-block;
          width: 5px;
          height: 15px;
        }
      }

      .group-title {
        @apply text-sm;
      }

      .node {
        @apply h-6;
        cursor: pointer;
        display: inline-flex;
        align-items: center;

        &.draggable {
          opacity: 0.5;
        }

        &.active {
          color: var(--font-foreground);
        }

        .name {
          @apply text-sm;
        }
      }
    }
  }
}

/* animation */
.tab-move {
  transition: transform 0.3s;
}

.tab-enter,
.tab-leave-to {
  display: none;
}

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
