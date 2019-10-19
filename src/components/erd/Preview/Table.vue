<template lang="pug">
  .preview-table(:style="tableStyle")
    //.table-header
      .table-header-top
        .table-button
        .table-button
      .table-header-body
        span.table-name(:style="`width: ${table.ui.widthName}px;`") {{table.name}}
        span.table-comment(:style="`width: ${table.ui.widthComment}px;`") {{table.comment}}
      //ul.table-body
        //Column(
          //v-for="column in table.columns"
          //:key="column.id"
          //:store="store"
          //:table="table"
          //:column="column"
        //)
</template>

<script lang="ts">
import { Table as TableModel } from "@/store/table";
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue } from "vue-property-decorator";
import Column from "./Column.vue";
import CircleButton from "../CircleButton.vue";

@Component({
  components: {
    CircleButton,
    Column
  }
})
export default class Table extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Object, default: () => ({}) })
  private table!: TableModel;

  get tableStyle(): string {
    return `
        top: ${this.table.ui.top}px;
        left: ${this.table.ui.left}px;
        width: ${this.table.width()}px;
        height: ${this.table.height()}px;
        z-index: ${this.table.ui.zIndex};
      `;
  }
}
</script>

<style scoped lang="scss">
.preview-table {
  position: absolute;
  background-color: $color-table;
  opacity: 0.9;
  padding: $size-table-padding;
  font-size: $size-font + 2;
  cursor: default;

  .table-header {
    .table-header-top {
      overflow: hidden;

      .table-button {
        margin-left: 5px;
        float: right;
      }
    }

    .table-header-body {
      height: $size-table-header-height;

      .table-name,
      .table-comment {
        display: inline-flex;
        align-items: center;
        margin-right: $size-margin-right;
        border-bottom: solid $color-opacity $size-border-bottom;
        color: $color-font-active;
      }
    }
  }
}

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
