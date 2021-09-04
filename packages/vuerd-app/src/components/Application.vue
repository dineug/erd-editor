<script lang="ts">
import Sidebar from '@/components/sidebar/Sidebar.vue';
import Editor from '@/components/editor/Editor.vue';
import {
  ref,
  onMounted,
  onBeforeUnmount,
  reactive,
  toRefs,
  defineComponent,
  computed,
} from 'vue';
import { useViewportStore } from '@/store/ui/viewport.store';

export default defineComponent({
  components: {
    Sidebar,
    Editor,
  },
  setup() {
    const [viewportState, viewportActions] = useViewportStore();
    const state = reactive({
      sideWidth: 170,
    });

    const appRef = ref<HTMLElement | null>(null);

    const editorWidth = computed(() => viewportState.width - state.sideWidth);

    const resizeObserver = new ResizeObserver(entries => {
      entries.forEach(({ contentRect: { width, height } }) => {
        viewportActions.changeViewport(width, height);
      });
    });

    onMounted(() => {
      appRef.value && resizeObserver.observe(appRef.value);
    });

    onBeforeUnmount(() => {
      appRef.value && resizeObserver.unobserve(appRef.value);
    });

    return {
      ...toRefs(state),
      appRef,
      editorWidth,
    };
  },
});
</script>

<template>
  <div class="application flex flex-col" ref="appRef">
    <div class="workspace flex flex-row">
      <Sidebar :width="sideWidth" />
      <div class="main">
        <Editor :width="editorWidth" />
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
