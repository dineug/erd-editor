<template lang="pug">
  .table-list-column
    input.check(
      type="checkbox"
      v-model="column.option.primaryKey"
      @change="onChangePK"
    )
    input.check(
      type="checkbox"
      v-model="column.option.notNull"
      @change="onChange"
    )
    input.check(
      type="checkbox"
      v-model="column.option.unique"
      @change="onChange"
    )
    input.check(
      type="checkbox"
      v-model="column.option.autoIncrement"
      @change="onChange"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="column"
      v-model="column.name"
      @change="onChange"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="dataType"
      v-model="column.dataType"
      @change="onChange"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="default"
      v-model="column.default"
      @change="onChange"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="comment"
      v-model="column.comment"
      @change="onChange"
    )
</template>

<script lang="ts">
  import StoreManagement from '@/store/StoreManagement';
  import {Column as ColumnModel, Commit as TableCommit} from '@/store/table';
  import {Table as TableModel} from '@/store/table';
  import {Commit as RelationshipCommit} from '@/store/relationship';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Column extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Object, default: () => ({})})
    private table!: TableModel;
    @Prop({type: Object, default: () => ({})})
    private column!: ColumnModel;

    private onChangePK(event: InputEvent) {
      if (this.column.option.primaryKey) {
        if (this.column.ui.fk) {
          this.column.ui.fk = false;
          this.column.ui.pfk = true;
          this.store.relationshipStore.commit(RelationshipCommit.relationshipIdentification, {
            table: this.table,
            column: this.column,
          });
        }
      } else {
        if (this.column.ui.pfk) {
          this.column.ui.pfk = false;
          this.column.ui.fk = true;
          this.store.relationshipStore.commit(RelationshipCommit.relationshipIdentification, {
            table: this.table,
            column: this.column,
          });
        }
      }
      this.onChange();
    }

    private onChange() {
      this.store.tableStore.commit(TableCommit.tableEditEnd, this.store);
    }
  }
</script>

<style scoped lang="scss">
  .table-list-column {
    display: flex;
    align-items: center;

    input {
      outline: none;
      border: none;
      margin-right: 5px;
      flex: 1;
      opacity: 0.9;
      background-color: $color-table;
      color: $color-font-active;
      border-bottom: solid $color-opacity $size-border-bottom;

      &:focus {
        border-bottom: solid $color-edit $size-border-bottom;
      }

      &.check {
        margin: 5px 5px 5px 0;
        flex: none;
        width: $size-option-width;
        cursor: pointer;
      }
    }
  }
</style>
