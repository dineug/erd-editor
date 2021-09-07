<script lang="ts">
import { defineComponent, computed } from 'vue';

export default defineComponent({
  props: {
    width: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const styleMap = computed(() => ({
      width: `${props.width}px`,
    }));

    return {
      styleMap,
    };
  },
});
</script>

<template>
  <div class="editor" :style="styleMap">editor</div>
</template>

<style scoped lang="scss">
.editor {
  width: 100%;
  height: 100%;
  background-color: var(--editor-background);
}
</style>
