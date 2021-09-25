<script lang="ts">
import {
  computed,
  defineComponent,
  onUnmounted,
  PropType,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue';

import Icon from '@/components/Icon.vue';
import { Menu } from '@@types/menu';

const SIZE_CONTEXTMENU_HEIGHT = 40;

export default defineComponent({
  name: 'Contextmenu',
  components: {
    Icon,
  },
  props: {
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
    menus: {
      type: Array as PropType<Array<Menu>>,
      default: (): Menu[] => [],
    },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit }) {
    const state = reactive({
      menu: null as Menu | null,
    });
    const rootRef = ref<HTMLElement | null>(null);

    const styleMap = computed(() => ({
      left: `${props.x}px`,
      top: `${props.y}px`,
    }));

    const childrenX = computed(() => {
      const ul = rootRef.value;
      return ul ? props.x + ul.clientWidth : props.x;
    });

    const childrenY = computed(() => {
      return state.menu
        ? props.y +
            props.menus.findIndex(menu => menu.name === state.menu?.name) *
              SIZE_CONTEXTMENU_HEIGHT
        : props.y;
    });

    const onMouseover = (menu: Menu) => {
      state.menu = menu;
    };

    const onClose = () => emit('close');

    const onExecute = (menu: Menu) => {
      if (!menu.execute || menu.children?.length) return;
      menu.execute();
      if (!menu.options || menu.options.close !== false) {
        onClose();
      }
    };

    watch(
      () => props.menus,
      () => {
        state.menu = null;
      }
    );

    onUnmounted(() => {
      state.menu = null;
    });

    return {
      ...toRefs(state),
      rootRef,
      styleMap,
      childrenX,
      childrenY,
      onMouseover,
      onClose,
      onExecute,
    };
  },
});
</script>

<template lang="pug">
.contextmenu(:style="styleMap" ref="rootRef")
  .contextmenu-item(v-for="menu in menus" :key="menu.name" @mouseover="onMouseover(menu)" @click="onExecute(menu)")
    span.icon
      Icon(v-if="menu.icon" :prefix="menu.icon.prefix" :name="menu.icon.name" :size="menu.icon.size")
    span.name(:style="{width: `${menu.options?.nameWidth ?? 70}px`}" :title="menu.name") {{ menu.name }}
    span.keymap(:style="{width: `${menu.options?.keymapWidth ?? 60}px`}") {{ menu.keymap }}
    span.arrow(v-if="menu.children?.length")
      Icon(name="chevron-right" :size="13")

Contextmenu(v-if="menu?.children?.length" :menus="menu.children" :x="childrenX" :y="childrenY" @close="onClose")
</template>

<style scoped lang="scss">
.contextmenu {
  @apply fixed flex flex-col;
  z-index: 9000;
  background-color: var(--contextmenu-background);

  .contextmenu-item {
    height: 40px;
    padding: 10px 5px 10px 10px;
    cursor: pointer;
    box-sizing: border-box;
    white-space: nowrap;
    display: flex;
    align-items: center;
    fill: var(--font-color);

    &:hover {
      color: var(--font-foreground);
      fill: var(--font-foreground);
      background-color: var(--contextmenu-foreground);
    }

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 5px;

      &.icon {
        width: 18px;
        display: flex;
        align-items: center;
      }

      &.name {
        width: 70px;
      }

      &.keymap {
        width: 60px;
        display: inline-block;
        padding-right: 0;
      }

      &.arrow {
        width: 13px;
        padding-right: 0;
      }
    }
  }
}
</style>
