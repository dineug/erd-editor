<script lang="ts">
import { computed, defineComponent } from 'vue';
import Explorer from '@/components/sidebar/Explorer.vue';

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

<template>
  <div class="sidebar" :style="styleMap">
    <component is="Explorer"></component>
  </div>
</template>

<style scoped lang="scss">
.sidebar {
  height: 100%;
}
</style>
