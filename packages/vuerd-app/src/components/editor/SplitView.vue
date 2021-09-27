<script lang="ts">
import { defineComponent } from 'vue';

import Viewer from '@/components/editor/Viewer.vue';
import Sash from '@/components/Sash.vue';
import { Move } from '@/helpers/event.helper';
import { ViewNode } from '@/store/view';
import { Placement } from '@/store/view/constants';
import {
  minHorizontal,
  minVertical,
  resetHeightRatio,
  resetWidthRatio,
} from '@/store/view/helper';

export default defineComponent({
  name: 'SplitView',
  components: {
    Sash,
    Viewer,
  },
  props: {
    node: {
      type: ViewNode,
      default: () => new ViewNode(),
    },
  },
  setup(props) {
    let lastClientX = 0;
    let lastClientY = 0;

    const getClassMap = (node: ViewNode) => ({
      vertical: node.vertical,
      horizontal: node.horizontal,
    });

    const getStyleMap = (node: ViewNode) => ({
      width: `${node.width}px`,
      height: `${node.height}px`,
    });

    const moveWidth = (event: MouseEvent, view1: ViewNode, view2: ViewNode) => {
      const placement: Placement =
        event.movementX < 0 ? Placement.left : Placement.right;
      const minWidth = minVertical(view1);
      const width =
        placement === Placement.left
          ? view1.width + event.movementX
          : view1.width - event.movementX;
      switch (placement) {
        case Placement.left:
          if (minWidth < width && event.x < lastClientX) {
            view1.width = width;
            view2.width = view2.width - event.movementX;
            view1.widthRatio = view1.width / props.node.width;
            view2.widthRatio = view2.width / props.node.width;
            resetWidthRatio(view1);
            resetWidthRatio(view2);
            lastClientX += event.movementX;
          }
          break;
        case Placement.right:
          if (minWidth < width && event.x > lastClientX) {
            view1.width = width;
            view2.width = view2.width + event.movementX;
            view1.widthRatio = view1.width / props.node.width;
            view2.widthRatio = view2.width / props.node.width;
            resetWidthRatio(view1);
            resetWidthRatio(view2);
            lastClientX += event.movementX;
          }
          break;
      }
    };

    const moveHeight = (
      event: MouseEvent,
      view1: ViewNode,
      view2: ViewNode
    ) => {
      const placement: Placement =
        event.movementY < 0 ? Placement.top : Placement.bottom;
      const minHeight = minHorizontal(view1);
      const height =
        placement === Placement.top
          ? view1.height + event.movementY
          : view1.height - event.movementY;
      switch (placement) {
        case Placement.top:
          if (minHeight < height && event.y < lastClientY) {
            view1.height = height;
            view2.height = view2.height - event.movementY;
            view1.heightRatio = view1.height / props.node.height;
            view2.heightRatio = view2.height / props.node.height;
            resetHeightRatio(view1);
            resetHeightRatio(view2);
            lastClientY += event.movementY;
          }
          break;
        case Placement.bottom:
          if (minHeight < height && event.y > lastClientY) {
            view1.height = height;
            view2.height = view2.height + event.movementY;
            view1.heightRatio = view1.height / props.node.height;
            view2.heightRatio = view2.height / props.node.height;
            resetHeightRatio(view1);
            resetHeightRatio(view2);
            lastClientY += event.movementY;
          }
          break;
      }
    };

    const onMousedownSash = ({ clientX, clientY }: MouseEvent) => {
      lastClientX = clientX;
      lastClientY = clientY;
    };

    const onMousemoveSash = (
      { movementX, movementY, event }: Move,
      index: number
    ) => {
      if (event instanceof TouchEvent) return;

      if (props.node.vertical) {
        if (movementX < 0) {
          moveWidth(
            event,
            props.node.children[index - 1],
            props.node.children[index]
          );
        } else {
          moveWidth(
            event,
            props.node.children[index],
            props.node.children[index - 1]
          );
        }
      } else if (props.node.horizontal) {
        if (movementY < 0) {
          moveHeight(
            event,
            props.node.children[index - 1],
            props.node.children[index]
          );
        } else {
          moveHeight(
            event,
            props.node.children[index],
            props.node.children[index - 1]
          );
        }
      }
    };

    return {
      getClassMap,
      getStyleMap,
      onMousedownSash,
      onMousemoveSash,
    };
  },
});
</script>

<template lang="pug">
.split-view(:class="getClassMap(node)" :style="getStyleMap(node)")
  .view(
    v-for="(childNode, index) in node.children"
    :key="childNode.id"
    :style="getStyleMap(childNode)"
  )
    Sash(
      v-if="index"
      :vertical="node.vertical"
      :horizontal="node.horizontal"
      @mousedown-sash="onMousedownSash"
      @global-move="onMousemoveSash($event, index)"
    )
    SplitView(v-if="childNode.children.length" :node="childNode")
    Viewer(v-else :node="childNode")
</template>

<style scoped lang="scss">
.split-view {
  display: flex;

  &.vertical {
    flex-direction: row;
  }

  &.horizontal {
    flex-direction: column;
  }

  .view {
    position: relative;
  }
}
</style>
