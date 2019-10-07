<template lang="pug">
  .table-list-table
    .table-header
      input(
        type="text"
        spellcheck="false"
        placeholder="table"
        v-model="table.name"
        @change="onChange"
      )
      input(
        type="text"
        spellcheck="false"
        placeholder="comment"
        v-model="table.comment"
        @change="onChange"
      )
    .table-body
      .table-column-header
        span.check PK
        span.check NN
        span.check UQ
        span.check AI
        span Name
        span DataType
        span Default
        span Comment
      Column(
        v-for="column in columns"
        :key="column.id"
        :store="store"
        :table="table"
        :column="column"
      )
</template>

<script lang="ts">
  import StoreManagement from '@/store/StoreManagement';
  import {Table as TableModel, Commit as TableCommit} from '@/store/table';
  import {searchColumn} from '@/store/table/tableHelper';
  import {Column as ColumnModel} from '@/store/table';
  import {Component, Prop, Vue} from 'vue-property-decorator';
  import Column from './Column.vue';

  @Component({
    components: {
      Column,
    },
  })
  export default class Table extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Object, default: () => ({})})
    private table!: TableModel;
    @Prop({type: String, default: ''})
    private search!: string;

    get columns(): ColumnModel[] {
      return searchColumn(this.table.columns, this.search);
    }

    private onChange() {
      this.store.tableStore.commit(TableCommit.tableEditEnd, this.store);
    }
  }
</script>

<style scoped lang="scss">
  .table-list-table {
    font-size: $size-font + 2;

    .table-header {
      display: flex;
      height: 30px;
      align-items: center;

      input {
        outline: none;
        border: none;
        height: 100%;
        opacity: 0.9;
        background-color: $color-table;
        color: $color-font-active;
        display: inline-flex;
        flex: 1;
        padding: 5px;
        border-bottom: solid $color-opacity $size-border-bottom;

        &:focus {
          border-bottom: solid $color-edit $size-border-bottom;
        }
      }
    }

    .table-body {
      padding: 5px;

      .table-column-header {
        display: flex;
        align-items: center;
        margin-bottom: 5px;

        span {
          margin-right: 5px;
          flex: 1;
          color: $color-font-active;

          &.check {
            flex: none;
            width: $size-option-width;
            text-align: center;
          }
        }
      }
    }
  }
</style>
