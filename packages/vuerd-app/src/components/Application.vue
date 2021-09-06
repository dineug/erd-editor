<script lang="ts">
import Sidebar from '@/components/sidebar/Sidebar.vue';
import Editor from '@/components/editor/Editor.vue';
import Sash from '@/components/Sash.vue';
import {
  ref,
  onMounted,
  onUnmounted,
  reactive,
  toRefs,
  defineComponent,
  watch,
  computed,
} from 'vue';
import { useViewportStore } from '@/store/ui/viewport.store';
import round from 'lodash/round';
import { Move } from '@/helpers/event.helper';
import { useThemeStore } from '@/store/ui/theme.store';
import { themeToString } from '@/helpers/theme.helper';

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

<template>
  <component is="style" type="text/css" v-text="theme"></component>
  <div class="application flex flex-col" ref="appRef">
    <div class="workspace flex flex-row">
      <Sidebar :width="sidebarWidth" />
      <div class="main">
        <Editor :width="editorWidth" />
        <Sash
          vertical
          @mousedown-sash="onMousedownSash"
          @global-move="onMousemoveSash"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.application {
  height: 100vh;
  position: relative;
  overflow: hidden;
  min-width: 400px;

  .workspace {
    height: 100%;

    .main {
      height: 100%;
      position: relative;
    }
  }
}
</style>
