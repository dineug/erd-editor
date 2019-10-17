<template lang="pug">
  li.preview-column
    .key
      font-awesome-icon.column-key(
        v-if="column.ui.pk | column.ui.fk | column.ui.pfk"
        :class="{pk: column.ui.pk, fk: column.ui.fk, pfk: column.ui.pfk}"
        icon="key"
      )

    .name(
      :style="`width: ${columnWidth.name}px;`"
    )
      span {{column.name}}

    .data-type(
      v-if="show.columnDataType"
      :style="`width: ${columnWidth.dataType}px;`"
    )
      span {{column.dataType}}

    .not-null(
      v-if="show.columnNotNull"
      :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
    )
      span(v-if="column.option.notNull") N-N
      span(v-else) NULL

    .default(
      v-if="show.columnDefault"
      :style="`width: ${columnWidth.default}px;`"
    )
      span {{column.default}}

    .comment(
      v-if="show.columnComment"
      :style="`width: ${columnWidth.comment}px;`"
    )
      span {{column.comment}}
</template>

<script lang="ts">
import { SIZE_COLUMN_OPTION_NN } from '@/ts/layout'
import { Column as ColumnModel, Table, ColumnWidth } from '@/store/table'
import { Show } from '@/store/canvas'
import StoreManagement from '@/store/StoreManagement'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class Column extends Vue {
  @Prop({type: Object, default: () => ({})})
  private store!: StoreManagement
  @Prop({type: Object, default: () => ({})})
  private table!: Table
  @Prop({type: Object, default: () => ({})})
  private column!: ColumnModel

  private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN

  get show (): Show {
    return this.store.canvasStore.state.show
  }

  get columnWidth (): ColumnWidth {
    return this.table.maxWidthColumn()
  }
}
</script>

<style scoped lang="scss">
  li.preview-column {
    cursor: default;

    div {
      display: inline-flex;
      vertical-align: middle;
      align-items: center;
      margin-right: $size-margin-right;
      margin-bottom: $size-margin-bottom;
      border-bottom: solid $color-opacity $size-border-bottom;
      color: $color-font-active;

      &.key {
        width: $size-key;

        .column-key {
          font-size: $size-key;

          &.pk {
            color: $color-key-pk;
          }

          &.fk {
            color: $color-key-fk;
          }

          &.pfk {
            color: $color-key-pfk;
          }
        }
      }
    }
  }

  ul, ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
