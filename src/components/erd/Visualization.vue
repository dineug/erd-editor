<template lang="pug">
  .erd-visualization
</template>

<script lang="ts">
import StoreManagement from "@/store/StoreManagement";
import { Commit as CanvasCommit } from "@/store/canvas";
import ConvertERDToVisualization from "@/ts/ConvertERDToVisualization";
// @ts-ignore
import { chart } from "@/ts/Visualization.js";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

const HEIGHT = 1200;

@Component
export default class Visualization extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Number, default: 0 })
  private width!: number;
  @Prop({ type: Number, default: 0 })
  private height!: number;

  private svg: any | null = null;

  @Watch("width")
  private watchWidth() {
    this.setViewBox();
  }

  @Watch("height")
  private watchHeight() {
    this.setViewBox();
  }

  private setViewBox() {
    if (this.svg) {
      this.svg.attr("viewBox", [
        -this.width / 2,
        -HEIGHT / 2,
        this.width,
        HEIGHT
      ]);
    }
  }

  private mounted() {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0;
      this.$el.parentElement.scrollLeft = 0;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: 0,
        scrollLeft: 0
      });
    }

    this.svg = chart(ConvertERDToVisualization.toVisualization(this.store));
    this.setViewBox();
    this.$el.append(this.svg.node());
  }
}
</script>

<style scoped lang="scss">
.erd-visualization {
  height: 100%;
  overflow: auto;
  background-color: $color-table;
}
</style>
