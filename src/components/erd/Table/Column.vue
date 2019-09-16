<template lang="pug">
  .column
    .name(
      :class="{placeholder: placeholderName}"
      :style="`width: ${column.ui.widthName}px;`"
    )
      span {{placeholder(column.name, 'column')}}

    .data-type(
      v-if="show.columnDataType"
      :class="{placeholder: placeholderDataType}"
      :style="`width: ${column.ui.widthDataType}px;`"
    )
      span {{placeholder(column.dataType, 'dataType')}}

    .not-null(
      v-if="show.columnNotNull"
      :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
    )
      span(v-if="column.option.notNull") N-N
      span(v-else) NULL

    .default(
      v-if="show.columnDefault"
      :class="{placeholder: placeholderDefault}"
      :style="`width: ${column.ui.widthDefault}px;`"
    )
      span {{placeholder(column.default, 'default')}}

    .comment(
      v-if="show.columnComment"
      :class="{placeholder: placeholderComment}"
      :style="`width: ${column.ui.widthComment}px;`"
    )
      span {{placeholder(column.comment, 'comment')}}
</template>

<script lang="ts">
  import {SIZE_COLUMN_OPTION_NN} from '@/ts/layout';
  import {Column as ColumnModel} from '@/store/table';
  import tableStore, {Commit, FocusType} from '@/store/table';
  import canvasStore, {Show} from '@/store/canvas';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Column extends Vue {
    @Prop({type: Object, default: () => ({})})
    private column!: ColumnModel;

    private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN;

    get show(): Show {
      return canvasStore.state.show;
    }

    get placeholderName(): boolean {
      let result = false;
      if (this.column.name === '') {
        result = true;
      }
      return result;
    }

    get placeholderDataType(): boolean {
      let result = false;
      if (this.column.dataType === '') {
        result = true;
      }
      return result;
    }

    get placeholderDefault(): boolean {
      let result = false;
      if (this.column.default === '') {
        result = true;
      }
      return result;
    }

    get placeholderComment(): boolean {
      let result = false;
      if (this.column.comment === '') {
        result = true;
      }
      return result;
    }


    private placeholder(value: string, display: string) {
      if (value === '') {
        return display;
      } else {
        return value;
      }
    }

  }
</script>

<style scoped lang="scss">
  .column {
    div {
      display: inline-flex;
      vertical-align: middle;
      align-items: center;
      margin-right: $size-margin-right;

      &.focus {
        border-bottom: solid $color-focus 1.5px;
      }

      &.placeholder {
        color: $color-font-placeholder;
      }
    }
  }
</style>
