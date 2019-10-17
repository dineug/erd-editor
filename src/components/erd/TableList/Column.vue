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
      @input="onInput($event, 'columnName')"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="dataType"
      v-model="column.dataType"
      @change="onChange"
      @input="onInput($event, 'columnDataType')"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="default"
      v-model="column.default"
      @change="onChange"
      @input="onInput($event, 'columnDefault')"
    )
    input(
      type="text"
      spellcheck="false"
      placeholder="comment"
      v-model="column.comment"
      @change="onChange"
      @input="onInput($event, 'columnComment')"
    )
</template>

<script lang="ts">
import { SIZE_MIN_WIDTH } from '@/ts/layout'
import StoreManagement from '@/store/StoreManagement'
import { Column as ColumnModel, Commit as TableCommit, Table as TableModel } from '@/store/table'

import { Commit as RelationshipCommit } from '@/store/relationship'
import { FocusType } from '@/models/TableFocusModel'
import { relationshipSort } from '@/store/relationship/relationshipHelper'
import { getTextWidth } from '@/ts/util'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class Column extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: Object, default: () => ({})})
  private table!: TableModel
  @Prop({type: Object, default: () => ({})})
  private column!: ColumnModel

  private onChangePK (event: InputEvent) {
    if (this.column.option.primaryKey) {
      if (this.column.ui.fk) {
        this.column.ui.fk = false
        this.column.ui.pfk = true
        this.store.relationshipStore.commit(RelationshipCommit.relationshipIdentification, {
          table: this.table,
          column: this.column
        })
      }
    } else {
      if (this.column.ui.pfk) {
        this.column.ui.pfk = false
        this.column.ui.fk = true
        this.store.relationshipStore.commit(RelationshipCommit.relationshipIdentification, {
          table: this.table,
          column: this.column
        })
      }
    }
    this.onChange()
  }

  private onChange () {
    this.store.tableStore.commit(TableCommit.tableEditEnd, this.store)
  }

  private onInput (event: Event, focusType: FocusType) {
    const input = event.target as HTMLInputElement
    let width = getTextWidth(input.value)
    if (SIZE_MIN_WIDTH > width) {
      width = SIZE_MIN_WIDTH
    }
    switch (focusType) {
      case FocusType.columnName:
        this.column.ui.widthName = width
        break
      case FocusType.columnDataType:
        this.column.ui.widthDataType = width
        break
      case FocusType.columnDefault:
        this.column.ui.widthDefault = width
        break
      case FocusType.columnComment:
        this.column.ui.widthComment = width
        break
    }
    relationshipSort(this.store.tableStore.state.tables, this.store.relationshipStore.state.relationships)
    // this.store.eventBus.$emit(Bus.ERD.input);
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
