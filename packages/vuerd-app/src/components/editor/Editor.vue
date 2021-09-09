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

<template lang="pug">
.editor(:style="styleMap") editor
</template>

<style scoped lang="scss">
.editor {
  @apply w-full h-full;
  background-color: var(--editor-background);
}
</style>
