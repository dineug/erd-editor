<script lang="ts">
import noop from 'lodash/noop';
import round from 'lodash/round';
import { debounceTime } from 'rxjs/operators';
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue';

import Editor from '@/components/editor/Editor.vue';
import Sash from '@/components/Sash.vue';
import Sidebar from '@/components/sidebar/Sidebar.vue';
import { createAndUpdateNode, findOenNode } from '@/core/indexedDB';
import { Move } from '@/helpers/event.helper';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { themeToString } from '@/helpers/theme.helper';
import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { TreeNode, useTreeStore } from '@/store/tree';
import { createMock } from '@/store/tree/mock';
import { useThemeStore } from '@/store/ui/theme.store';
import { useViewportStore } from '@/store/ui/viewport.store';

const MIN_WIDTH = 100;

export default defineComponent({
  components: {
    Sidebar,
    Editor,
    Sash,
  },
  setup() {
    const resizeObserver = new ResizeObserver(entries => {
      entries.forEach(({ contentRect: { width, height } }) => {
        viewportActions.changeViewport(width, height);
      });
    });

    const [viewportState, viewportActions] = useViewportStore();
    const [themeState] = useThemeStore();
    const [treeState, treeActions] = useTreeStore();
    const { push } = useUnsubscribe();

    const state = reactive({
      sidebarWidth: 170,
      editorWidth: 0,
    });

    let lastClientX = 0;

    const appRef = ref<HTMLElement | null>(null);

    const theme = computed(() => `:root{${themeToString(themeState)}}`);

    const setState = (newState: Partial<typeof state>) => {
      Object.assign(state, newState);
    };

    const onMousedownSash = ({ clientX }: MouseEvent) => {
      lastClientX = clientX;
    };

    const onMousemoveSash = ({ movementX, x }: Move) => {
      const sidebarWidth = state.sidebarWidth + movementX;
      const editorWidth = state.editorWidth - movementX;
      const position = movementX < 0 ? 'left' : 'right';

      if (position === 'left' && MIN_WIDTH <= sidebarWidth && x < lastClientX) {
        lastClientX += movementX;
        setState({ sidebarWidth, editorWidth });
      } else if (
        position === 'right' &&
        MIN_WIDTH <= editorWidth &&
        x > lastClientX
      ) {
        lastClientX += movementX;
        setState({ sidebarWidth, editorWidth });
      }
    };

    const onSave = () => {
      createAndUpdateNode(treeState.root).subscribe(noop);
    };

    findOenNode.subscribe(node => {
      if (node) {
        treeActions.setRoot(new TreeNode({ treeNode: node }));
        treeActions.setParent(treeState.root);
      } else {
        treeState.root.children.push(createMock());
        treeActions.setParent(treeState.root);
        onSave();
      }
    });

    watch(
      () => viewportState.width,
      (width, prevWidth) => {
        if (prevWidth === 0) return;

        const sidePercent = round(state.sidebarWidth / prevWidth, 2);
        const editorPercent = round(state.editorWidth / prevWidth, 2);
        const sidebarWidth = round(sidePercent * width, 2);
        const editorWidth = round(editorPercent * width, 2);

        if (MIN_WIDTH <= sidebarWidth && MIN_WIDTH <= editorWidth) {
          setState({ sidebarWidth, editorWidth });
        } else if (MIN_WIDTH > sidebarWidth) {
          setState({ sidebarWidth: MIN_WIDTH, editorWidth: width - MIN_WIDTH });
        } else if (MIN_WIDTH > editorWidth) {
          setState({ sidebarWidth: width - MIN_WIDTH, editorWidth: MIN_WIDTH });
        } else {
          setState({ sidebarWidth: MIN_WIDTH, editorWidth: MIN_WIDTH });
        }
      }
    );

    push(eventBus.on(Bus.App.save).pipe(debounceTime(1000)).subscribe(onSave));

    onMounted(() => {
      if (!appRef.value) return;

      const { width } = appRef.value.getBoundingClientRect();
      state.editorWidth = width - state.sidebarWidth;
      resizeObserver.observe(appRef.value);
    });

    onUnmounted(() => {
      resizeObserver.disconnect();
    });

    return {
      ...toRefs(state),
      appRef,
      theme,
      onMousedownSash,
      onMousemoveSash,
    };
  },
});
</script>

<template lang="pug">
component(is="style" type="text/css" v-text="theme")
#application(ref="appRef")
  div(class="flex h-full")
    Sidebar(:width="sidebarWidth")
    div(class="h-full relative")
      Editor(:width="editorWidth")
      Sash(vertical @mousedown-sash="onMousedownSash" @global-move="onMousemoveSash")
</template>

<style lang="scss">
#application {
  @apply flex flex-col relative min-w-screen-sm h-screen overflow-hidden text-sm;
  color: var(--font-color);

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track-background);
  }

  ::-webkit-scrollbar-corner {
    background: var(--scrollbar-track-background);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-background);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-background);
  }

  .scrollbar {
    scrollbar-color: var(--scrollbar-thumb-background)
      var(--scrollbar-track-background);
    scrollbar-width: thin;
  }
}
</style>
