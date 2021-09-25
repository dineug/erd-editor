<script lang="ts">
import { computed,defineComponent } from 'vue';

import { globalEvent, Move } from '@/helpers/event.helper';

const SIZE_SASH = 5;

export default defineComponent({
  props: {
    vertical: {
      type: Boolean,
      default: false,
    },
    horizontal: {
      type: Boolean,
      default: false,
    },
    top: {
      type: Number,
      default: 0,
    },
    left: {
      type: Number,
      default: 0,
    },
  },
  emits: {
    mousedownSash: (event: MouseEvent) => true,
    globalMove: (move: Move) => true,
  },
  setup(props, { emit }) {
    const classMap = computed(() => ({
      vertical: props.vertical,
      horizontal: props.horizontal,
    }));

    const centerTop = computed(() =>
      props.top === 0 && !props.horizontal
        ? props.top
        : props.top - SIZE_SASH / 2
    );

    const centerLeft = computed(() =>
      props.left === 0 && !props.vertical
        ? props.left
        : props.left - SIZE_SASH / 2
    );

    const styleMap = computed(() => ({
      top: `${centerTop.value}px`,
      left: `${centerLeft.value}px`,
    }));

    const lineStyleMap = computed(() => ({
      top: `${Math.abs(centerTop.value)}px`,
      left: `${Math.abs(centerLeft.value)}px`,
    }));

    const onMousedown = (event: MouseEvent) => {
      emit('mousedownSash', event);
      globalEvent.drag$.subscribe(move => {
        move.event.type === 'mousemove' && move.event.preventDefault();
        emit('globalMove', move);
      });
    };

    return {
      classMap,
      styleMap,
      lineStyleMap,
      onMousedown,
    };
  },
});
</script>

<template lang="pug">
.sash(:class="classMap" :style="styleMap" @mousedown="onMousedown")
  .line-container(:class="classMap")
    .line(:class="classMap" :style="lineStyleMap")
</template>

<style scoped lang="scss">
$size-sash: 5px;

.sash {
  position: absolute;
  z-index: 1000;

  &.vertical {
    width: $size-sash;
    height: 100%;
    cursor: ew-resize;
  }

  &.horizontal {
    width: 100%;
    height: $size-sash;
    cursor: ns-resize;
  }

  .line-container {
    position: relative;
    pointer-events: none;

    &.vertical {
      height: 100%;
    }

    &.horizontal {
      width: 100%;
    }

    .line {
      position: absolute;
      background-color: var(--sash-background);

      &.vertical {
        width: 1px;
        height: 100%;
      }

      &.horizontal {
        width: 100%;
        height: 1px;
      }
    }
  }

  &:hover {
    background-color: var(--sash-foreground);

    .line {
      background-color: var(--sash-foreground);
    }
  }
}
</style>
