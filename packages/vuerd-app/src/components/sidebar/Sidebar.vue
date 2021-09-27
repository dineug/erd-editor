<script lang="ts">
import { computed, defineComponent } from 'vue';

import Explorer from '@/components/sidebar/explorer/Explorer.vue';

export default defineComponent({
  components: {
    Explorer,
  },
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
div(class="h-full" :style="styleMap")
  component(is="Explorer")
</template>
