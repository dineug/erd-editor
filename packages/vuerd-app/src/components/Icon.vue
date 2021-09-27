<script lang="ts">
import { computed, defineComponent } from 'vue';

import { getIcon } from '@/core/icon';

const SIZE = 24;
const SIZE_REM = 1.5;

export default defineComponent({
  props: {
    prefix: {
      type: String,
      default: 'fas',
    },
    name: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: SIZE,
    },
    color: {
      type: String,
      default: null,
    },
  },
  setup(props) {
    const attr = computed(() => {
      const icon = getIcon(props.prefix, props.name);
      if (!icon) return null;

      const [width, height, , , d] = icon.icon;
      const rem = SIZE_REM * (props.size / SIZE);

      return {
        style: {
          width: `${rem}rem`,
          height: `${rem}rem`,
        },
        viewBox: `0 0 ${width} ${height}`,
        d,
      };
    });

    return {
      attr,
    };
  },
});
</script>

<template lang="pug">
svg.svg-icon(v-if="attr" :style="attr.style" :viewBox="attr.viewBox")
  path(:d="attr.d" :fill="color")
</template>

<style scoped lang="scss">
.svg-icon {
  display: inline-flex;
  transition: fill 0.15s;
}
</style>
