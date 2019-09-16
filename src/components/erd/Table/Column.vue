<template lang="pug">
  .column
    .name(
      :class="{focus: focusName, placeholder: placeholderName}"
      :style="`width: ${column.ui.widthName}px;`"
      @mousedown="onFocus($event, 'columnName')"
    )
      span {{placeholder(column.name, 'column')}}

    .data-type(
      v-if="show.columnDataType"
      :class="{focus: focusDataType, placeholder: placeholderDataType}"
      :style="`width: ${column.ui.widthDataType}px;`"
      @mousedown="onFocus($event, 'columnDataType')"
    )
      span {{placeholder(column.dataType, 'dataType')}}

    .not-null(
      v-if="show.columnNotNull"
      :class="{focus: focusNotNull}"
      :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
      @mousedown="onFocus($event, 'columnNotNull')"
    )
      span(v-if="column.option.notNull") N-N
      span(v-else) NULL

    .default(
      v-if="show.columnDefault"
      :class="{focus: focusDefault, placeholder: placeholderDefault}"
      :style="`width: ${column.ui.widthDefault}px;`"
      @mousedown="onFocus($event, 'columnDefault')"
    )
      span {{placeholder(column.default, 'default')}}

    .comment(
      v-if="show.columnComment"
      :class="{focus: focusComment, placeholder: placeholderComment}"
      :style="`width: ${column.ui.widthComment}px;`"
      @mousedown="onFocus($event, 'columnComment')"
    )
      span {{placeholder(column.comment, 'comment')}}
</template>

<script lang="ts">
  import {SIZE_COLUMN_OPTION_NN} from '@/ts/layout';
  import {Column as ColumnModel, Table} from '@/store/table';
  import {ColumnFocus} from '@/models/ColumnFocusModel';
  import {FocusType} from '@/models/TableFocusModel';
  import canvasStore, {Show} from '@/store/canvas';
  import tableStore, {Commit as TableCommit} from '@/store/table';
  import {log} from '@/ts/util';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component
  export default class Column extends Vue {
    @Prop({type: Object, default: () => ({})})
    private table!: Table;
    @Prop({type: Object, default: () => ({})})
    private column!: ColumnModel;
    @Prop({type: Object, default: null})
    private columnFocus!: ColumnFocus | null;

    private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN;

    get show(): Show {
      return canvasStore.state.show;
    }

    get focusName(): boolean {
      let result = false;
      if (this.columnFocus && this.columnFocus.focusName) {
        result = true;
      }
      return result;
    }

    get focusDataType(): boolean {
      let result = false;
      if (this.columnFocus && this.columnFocus.focusDataType) {
        result = true;
      }
      return result;
    }

    get focusNotNull(): boolean {
      let result = false;
      if (this.columnFocus && this.columnFocus.focusNotNull) {
        result = true;
      }
      return result;
    }

    get focusDefault(): boolean {
      let result = false;
      if (this.columnFocus && this.columnFocus.focusDefault) {
        result = true;
      }
      return result;
    }

    get focusComment(): boolean {
      let result = false;
      if (this.columnFocus && this.columnFocus.focusComment) {
        result = true;
      }
      return result;
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

    // ==================== Event Handler ===================
    private onFocus(event: MouseEvent, focusType: FocusType) {
      log.debug('Column onFocus');
      tableStore.commit(TableCommit.tableSelect, {
        table: this.table,
        event,
      });
      this.$nextTick(() => {
        if (this.columnFocus) {
          tableStore.commit(TableCommit.columnFocus, {
            focusType,
            column: this.column,
          });
        }
      });
    }

    // ==================== Event Handler END ===================

  }
</script>

<style scoped lang="scss">
  .column {
    div {
      display: inline-flex;
      vertical-align: middle;
      align-items: center;
      margin-right: $size-margin-right;
      border-bottom: solid $color-opacity $size-border-bottom;
      margin-bottom: $size-margin-bottom;

      &.focus {
        border-bottom: solid $color-focus $size-border-bottom;
      }

      &.placeholder {
        color: $color-font-placeholder;
      }
    }
  }
</style>
