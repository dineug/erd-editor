<template lang="pug">
  .canvas(:id="store.uuid" :style="canvasStyle")
    Table(
      v-for="table in tables"
      :key="table.id"
      :store="store"
      :focus="focus"
      :table="table"
    )
    Memo(
      v-for="memo in memos"
      :key="memo.id"
      :store="store"
      :memo="memo"
    )
    svg.canvas-svg(
      v-if="show.relationship"
      :style="canvasStyle"
    )
      Relationship(
        v-for="relationship in relationships"
        :key="relationship.id"
        :store="store"
        :relationship="relationship"
      )
</template>

<script lang="ts">
import { Table as TableModel } from "@/store/table";
import { Memo as MemoModel } from "@/store/memo";
import { Relationship as RelationshipModel } from "@/store/relationship";
import { Show } from "@/store/canvas";
import StoreManagement from "@/store/StoreManagement";
import { virtualTable } from "@/store/table/tableHelper";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import Table from "./Table.vue";
import Memo from "./Memo.vue";
import Relationship from "./Relationship.vue";

@Component({
  components: {
    Table,
    Memo,
    Relationship
  }
})
export default class Canvas extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Boolean, default: false })
  private focus!: boolean;
  @Prop({ type: Number, default: 0 })
  private width!: number;
  @Prop({ type: Number, default: 0 })
  private height!: number;

  get canvasStyle(): string {
    const option = this.store.canvasStore.state;
    return `
        width: ${option.width}px;
        height: ${option.height}px;
      `;
  }

  get tables(): TableModel[] {
    // === Virtual table rendering slow ===
    // const minX = this.store.canvasStore.state.scrollLeft;
    // const minY = this.store.canvasStore.state.scrollTop;
    // const maxX = minX + this.width;
    // const maxY = minY + this.height;
    // return this.store.tableStore.state.tables.filter(table =>
    //   virtualTable(
    //     {
    //       minX,
    //       minY,
    //       maxX,
    //       maxY
    //     },
    //     table
    //   )
    // );
    return this.store.tableStore.state.tables;
  }

  get memos(): MemoModel[] {
    return this.store.memoStore.state.memos;
  }

  get relationships(): RelationshipModel[] {
    return this.store.relationshipStore.state.relationships;
  }

  get show(): Show {
    return this.store.canvasStore.state.show;
  }
}
</script>

<style scoped lang="scss">
.canvas {
  position: relative;
  background-color: $color-canvas;

  .canvas-svg {
    position: absolute;
    z-index: 1;
  }
}
</style>
