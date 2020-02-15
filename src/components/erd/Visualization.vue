<template lang="pug">
  .erd-visualization(
    @mousemove="onMousemove"
  )
    Table.preview-table(
      v-if="table && !drag && preview"
      :style="previewStyle"
      :store="store"
      :table="table"
      :columnId="columnId"
    )
</template>

<script lang="ts">
import { Bus } from "@/ts/EventBus";
import StoreManagement from "@/store/StoreManagement";
import { Commit as CanvasCommit } from "@/store/canvas";
import ConvertERDToVisualization from "@/ts/ConvertERDToVisualization";
import { chart } from "@/ts/Visualization";
import { Table as TableModel } from "@/store/table";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import Table from "./Visualization/Table.vue";

interface PreviewData {
  table: TableModel | null;
  columnId: string;
}

const HEIGHT = 1200;
const MARGIN = 20;

@Component({
  components: {
    Table
  }
})
export default class Visualization extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Number, default: 0 })
  private width!: number;
  @Prop({ type: Number, default: 0 })
  private height!: number;

  private svg: any | null = null;
  private x: number = 0;
  private y: number = 0;
  private preview: boolean = false;
  private drag: boolean = false;
  private table: TableModel | null = null;
  private columnId: string = "";

  get previewStyle(): string {
    return `
      top: ${this.y + MARGIN}px;
      left: ${this.x + MARGIN}px;
    `;
  }

  @Watch("width")
  private watchWidth() {
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

  private onMousemove(event: MouseEvent) {
    this.x = event.x;
    this.y = event.y;
  }

  private onDragStart() {
    this.drag = true;
  }

  private onDragEnd() {
    this.drag = false;
  }

  private onPreviewStart(previewData: PreviewData) {
    this.preview = true;
    this.table = previewData.table;
    this.columnId = previewData.columnId;
  }

  private onPreviewEnd() {
    this.preview = false;
  }

  private created() {
    this.store.eventBus.$on(Bus.Visualization.dragStart, this.onDragStart);
    this.store.eventBus.$on(Bus.Visualization.dragEnd, this.onDragEnd);
    this.store.eventBus.$on(
      Bus.Visualization.previewStart,
      this.onPreviewStart
    );
    this.store.eventBus.$on(Bus.Visualization.previewEnd, this.onPreviewEnd);

    const data = ConvertERDToVisualization.toVisualization(this.store);
    this.svg = chart(data, this.store);
    this.setViewBox();
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
    this.$el.append(this.svg.node());
  }

  private destroyed() {
    this.store.eventBus.$off(Bus.Visualization.dragStart, this.onDragStart);
    this.store.eventBus.$off(Bus.Visualization.dragEnd, this.onDragEnd);
    this.store.eventBus.$off(
      Bus.Visualization.previewStart,
      this.onPreviewStart
    );
    this.store.eventBus.$off(Bus.Visualization.previewEnd, this.onPreviewEnd);
  }
}
</script>

<style scoped lang="scss">
.erd-visualization {
  height: 100%;
  overflow: auto;
  background-color: $color-table;

  .preview-table {
    position: fixed;
    z-index: 100000000;
  }
}
</style>
