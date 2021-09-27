<script lang="ts">
import { Easing, Tween } from '@tweenjs/tween.js';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import {
  computed,
  defineComponent,
  onMounted,
  PropType,
  reactive,
  ref,
  watch,
} from 'vue';

import { useUnsubscribe } from '@/hooks/useUnsubscribe';
import { Placement, SIZE_VIEW_TAB_HEIGHT } from '@/store/view/constants';

interface State {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default defineComponent({
  props: {
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    placement: {
      type: String as PropType<Placement>,
      default: Placement.all,
    },
  },
  emits: {
    dragover: (event: DragEvent) => true,
  },
  setup(props, { emit }) {
    const state = reactive<State>({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });
    const ghostRef = ref<HTMLElement | null>(null);
    const splitRef = ref<HTMLElement | null>(null);
    const { push } = useUnsubscribe();
    let splitTween: Tween<State> | null = null;

    const ghostStyle = computed(() => ({
      top: `${SIZE_VIEW_TAB_HEIGHT}px`,
      width: `${props.width}px`,
      height: `${props.height}px`,
    }));

    const splitStyle = computed(() => ({
      top: `${state.top}px`,
      left: `${state.left}px`,
      width: `${state.width}px`,
      height: `${state.height}px`,
    }));

    const splitAnimation = (placement: Placement) => {
      let top = SIZE_VIEW_TAB_HEIGHT;
      let left = 0;
      let width = props.width;
      let height = props.height;
      switch (placement) {
        case Placement.right:
          left = props.width / 2;
        case Placement.left:
          width = props.width / 2;
          break;
        case Placement.bottom:
          top = SIZE_VIEW_TAB_HEIGHT + props.height / 2;
        case Placement.top:
          height = props.height / 2;
          break;
      }

      splitTween?.stop();
      splitTween = new Tween(state)
        .to(
          {
            width,
            height,
            top,
            left,
          },
          100
        )
        .easing(Easing.Quadratic.Out)
        .onComplete(() => (splitTween = null))
        .start();
    };

    watch(() => props.placement, splitAnimation);

    onMounted(() => {
      if (!ghostRef.value) return;
      splitAnimation(props.placement);
      push(
        fromEvent<DragEvent>(ghostRef.value, 'dragover')
          .pipe(throttleTime(100))
          .subscribe(event => emit('dragover', event))
      );
    });

    return {
      ghostRef,
      splitRef,
      ghostStyle,
      splitStyle,
    };
  },
});
</script>

<template lang="pug">
.drop-guide-ghost(:style="ghostStyle" ref="ghostRef")
.drop-guide-split(:style="splitStyle" ref="splitRef")
</template>

<style scoped lang="scss">
.drop-guide-ghost {
  position: absolute;
  z-index: 9000;
  opacity: 0;
}

.drop-guide-split {
  position: absolute;
  z-index: 8000;
  opacity: 0.3;
  background-color: var(--drop-background);
}
</style>
