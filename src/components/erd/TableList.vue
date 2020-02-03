<template lang="pug">
  .table-list.scrollbar
    Table(
      v-for="table in tables"
      :key="table.id"
      :store="store"
      :table="table"
      :search="search"
    )
</template>

<script lang="ts">
import { Commit as CanvasCommit } from "@/store/canvas";
import { Table as TableModel } from "@/store/table";
import StoreManagement from "@/store/StoreManagement";
import { Bus } from "@/ts/EventBus";
import { searchTable } from "@/store/table/tableHelper";
import { Component, Prop, Vue } from "vue-property-decorator";
import Table from "./TableList/Table.vue";

@Component({
  components: {
    Table
  }
})
export default class TableList extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;

  private search: string = "";

  get tables(): TableModel[] {
    return searchTable(this.store.tableStore.state.tables, this.search);
  }

  // ==================== Event Handler ===================
  private onSearch(value: string) {
    this.search = value;
  }

  // ==================== Event Handler END ===================

  // ==================== Life Cycle ====================
  private created() {
    this.store.eventBus.$on(Bus.TableList.search, this.onSearch);
  }

  private mounted() {
    if (this.$el.parentElement) {
      this.$el.parentElement.scrollTop = 0;
      this.$el.parentElement.scrollLeft = 0;
      this.store.canvasStore.commit(CanvasCommit.canvasMove, {
        scrollTop: 0,
        scrollLeft: 0
      });
      this.store.eventBus.$emit(Bus.ERD.change);
    }
  }

  private destroyed() {
    this.store.eventBus.$off(Bus.TableList.search, this.onSearch);
  }

  // ==================== Life Cycle END ====================
}
</script>

<style scoped lang="scss">
.table-list {
  position: relative;
  margin-top: $size-top-menu-height;
  width: 100%;
  height: calc(100% - 30px);
  overflow: auto;
  background-color: $color-table;
  opacity: 0.9;
}
</style>
