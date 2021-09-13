<script lang="tsx">
import { defineComponent, computed } from 'vue';
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
      sash: true,
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

    const onMousedown = (event: MouseEvent) => {
      emit('mousedownSash', event);
      globalEvent.drag$.subscribe(move => {
        move.event.type === 'mousemove' && move.event.preventDefault();
        emit('globalMove', move);
      });
    };

    return () => (
      <div
        class={classMap.value}
        style={styleMap.value}
        onMousedown={onMousedown}
      />
    );
  },
});
</script>

<style scoped lang="scss">
$size-sash: 5px;

.sash {
  position: absolute;

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
}
</style>
