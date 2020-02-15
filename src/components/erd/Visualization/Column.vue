<template lang="pug">
  li.preview-column
    .key
      font-awesome-icon.column-key(
        v-if="column.ui.pk || column.ui.fk || column.ui.pfk"
        :class="{pk: column.ui.pk, fk: column.ui.fk, pfk: column.ui.pfk}"
        icon="key"
      )

    .name(
      :class="{placeholder: column.name.trim() === ''}"
      :style="`width: ${columnWidth.name}px;`"
    )
      span {{column.name.trim() === '' ? 'column' : column.name}}

    .data-type(
      v-if="show.columnDataType"
      :class="{placeholder: column.dataType.trim() === ''}"
      :style="`width: ${columnWidth.dataType}px;`"
    )
      span {{column.dataType.trim() === '' ? 'dataType' : column.dataType}}

    .not-null(
      v-if="show.columnNotNull"
      :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
    )
      span(v-if="column.option.notNull") N-N
      span(v-else) NULL

    .default(
      v-if="show.columnDefault"
      :class="{placeholder: column.default.trim() === ''}"
      :style="`width: ${columnWidth.default}px;`"
    )
      span {{column.default.trim() === '' ? 'default' : column.default}}

    .comment(
      v-if="show.columnComment"
      :class="{placeholder: column.comment.trim() === ''}"
      :style="`width: ${columnWidth.comment}px;`"
    )
      span {{column.comment.trim() === '' ? 'comment' : column.comment}}
</template>

<script lang="ts">
import { SIZE_COLUMN_OPTION_NN } from "@/ts/layout";
import { Column as ColumnModel, Table, ColumnWidth } from "@/store/table";
import { Show } from "@/store/canvas";
import StoreManagement from "@/store/StoreManagement";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class Column extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Object, default: () => ({}) })
  private table!: Table;
  @Prop({ type: Object, default: () => ({}) })
  private column!: ColumnModel;

  private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN;

  get show(): Show {
    return this.store.canvasStore.state.show;
  }

  get columnWidth(): ColumnWidth {
    return this.table.maxWidthColumn();
  }
}
</script>

<style scoped lang="scss">
li.preview-column {
  height: $size-column-height;
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
        width: $size-key;

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

  .placeholder {
    color: $color-font-placeholder;
  }
}

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
