<template lang="pug">
  .column
    .key
      font-awesome-icon.column-key(
        v-if="column.ui.pk | column.ui.fk | column.ui.pfk"
        :class="{pk: column.ui.pk, fk: column.ui.fk, pfk: column.ui.pfk}"
        icon="key"
      )

    input.name(
      v-if="edit && edit.id === column.id && edit.focusType === 'columnName'"
      v-focus
      v-model="column.name"
      :style="`width: ${columnWidth.name}px;`"
      spellcheck="false"
      @input="onEditInput($event, 'columnName')"
      @blur="onEditBlur"
    )
    .name(
      v-else
      :class="{focus: focusName, placeholder: placeholderName}"
      :style="`width: ${columnWidth.name}px;`"
      @mousedown="onFocus($event, 'columnName')"
      @dblclick="onDblclick($event, 'columnName')"
    )
      span {{placeholder(column.name, 'column')}}

    input.data-type(
      v-if="show.columnDataType && edit && edit.id === column.id && edit.focusType === 'columnDataType'"
      v-focus
      v-model="column.dataType"
      :style="`width: ${columnWidth.dataType}px;`"
      spellcheck="false"
      @input="onEditInput($event, 'columnDataType')"
      @blur="onEditBlur"
    )
    .data-type(
      v-else-if="show.columnDataType"
      :class="{focus: focusDataType, placeholder: placeholderDataType}"
      :style="`width: ${columnWidth.dataType}px;`"
      @mousedown="onFocus($event, 'columnDataType')"
      @dblclick="onDblclick($event, 'columnDataType')"
    )
      span {{placeholder(column.dataType, 'dataType')}}

    .not-null(
      v-if="show.columnNotNull"
      :class="{focus: focusNotNull}"
      :style="`width: ${SIZE_COLUMN_OPTION_NN}px;`"
      @mousedown="onFocus($event, 'columnNotNull')"
      @dblclick="onDblclick($event, 'columnNotNull')"
    )
      span(v-if="column.option.notNull") N-N
      span(v-else) NULL

    input.default(
      v-if="show.columnDefault && edit && edit.id === column.id && edit.focusType === 'columnDefault'"
      v-focus
      v-model="column.default"
      :style="`width: ${columnWidth.default}px;`"
      spellcheck="false"
      @input="onEditInput($event, 'columnDefault')"
      @blur="onEditBlur"
    )
    .default(
      v-else-if="show.columnDefault"
      :class="{focus: focusDefault, placeholder: placeholderDefault}"
      :style="`width: ${columnWidth.default}px;`"
      @mousedown="onFocus($event, 'columnDefault')"
      @dblclick="onDblclick($event, 'columnDefault')"
    )
      span {{placeholder(column.default, 'default')}}

    input.comment(
      v-if="show.columnComment && edit && edit.id === column.id && edit.focusType === 'columnComment'"
      v-focus
      v-model="column.comment"
      :style="`width: ${columnWidth.comment}px;`"
      spellcheck="false"
      @input="onEditInput($event, 'columnComment')"
      @blur="onEditBlur"
    )
    .comment(
      v-else-if="show.columnComment"
      :class="{focus: focusComment, placeholder: placeholderComment}"
      :style="`width: ${columnWidth.comment}px;`"
      @mousedown="onFocus($event, 'columnComment')"
      @dblclick="onDblclick($event, 'columnComment')"
    )
      span {{placeholder(column.comment, 'comment')}}

    font-awesome-icon.column-button(
      icon="times"
      title="Alt + Delete"
      @click="onColumnRemove"
    )
</template>

<script lang="ts">
  import {SIZE_COLUMN_OPTION_NN, SIZE_MIN_WIDTH} from '@/ts/layout';
  import {Column as ColumnModel, Table, ColumnWidth} from '@/store/table';
  import {ColumnFocus} from '@/models/ColumnFocusModel';
  import {FocusType} from '@/models/TableFocusModel';
  import {Show} from '@/store/canvas';
  import {Commit as TableCommit, Edit} from '@/store/table';
  import {log, getTextWidth} from '@/ts/util';
  import StoreManagement from '@/store/StoreManagement';
  import {Bus} from '@/ts/EventBus';
  import {Component, Prop, Vue} from 'vue-property-decorator';

  @Component({
    directives: {
      focus: {
        inserted(el: HTMLElement) {
          el.focus();
        },
      },
    },
  })
  export default class Column extends Vue {
    @Prop({type: Object, default: () => ({})})
    private store!: StoreManagement;
    @Prop({type: Object, default: () => ({})})
    private table!: Table;
    @Prop({type: Object, default: () => ({})})
    private column!: ColumnModel;
    @Prop({type: Object, default: null})
    private columnFocus!: ColumnFocus | null;

    private SIZE_COLUMN_OPTION_NN = SIZE_COLUMN_OPTION_NN;

    get show(): Show {
      return this.store.canvasStore.state.show;
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

    get edit(): Edit | null {
      return this.store.tableStore.state.edit;
    }

    get columnWidth(): ColumnWidth {
      return this.table.maxWidthColumn();
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
      this.store.tableStore.commit(TableCommit.tableSelect, {
        table: this.table,
        event,
        store: this.store,
      });
      this.$nextTick(() => {
        if (this.columnFocus) {
          this.store.tableStore.commit(TableCommit.columnFocus, {
            focusType,
            column: this.column,
          });
        }
      });
    }

    private onEditInput(event: Event, focusType: FocusType) {
      log.debug('Column onEditInput');
      const input = event.target as HTMLInputElement;
      let width = getTextWidth(input.value);
      if (SIZE_MIN_WIDTH > width) {
        width = SIZE_MIN_WIDTH;
      }
      switch (focusType) {
        case FocusType.columnName:
          this.column.ui.widthName = width;
          break;
        case FocusType.columnDataType:
          this.column.ui.widthDataType = width;
          break;
        case FocusType.columnDefault:
          this.column.ui.widthDefault = width;
          break;
        case FocusType.columnComment:
          this.column.ui.widthComment = width;
          break;
      }
      // this.store.eventBus.$emit(Bus.ERD.input);
    }

    private onEditBlur() {
      log.debug('Column onEditBlur');
      this.store.tableStore.commit(TableCommit.tableEditEnd, this.store);
    }

    private onColumnRemove() {
      this.store.tableStore.commit(TableCommit.columnRemove, {
        table: this.table,
        column: this.column,
      });
      this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
    }

    private onDblclick(event: MouseEvent, focusType: FocusType) {
      log.debug('Column onDblclick');
      event.preventDefault();
      if (focusType === FocusType.columnNotNull) {
        this.column.option.notNull = !this.column.option.notNull;
        this.store.eventBus.$emit(Bus.ERD.change);
      } else {
        this.store.tableStore.commit(TableCommit.tableEditStart, {
          id: this.column.id,
          focusType,
        });
      }
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
      margin-bottom: $size-margin-bottom;
      border-bottom: solid $color-opacity $size-border-bottom;
      color: $color-font-active;

      &.focus {
        border-bottom: solid $color-focus $size-border-bottom;
      }

      &.placeholder {
        color: $color-font-placeholder;
      }

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

    .column-button {
      color: $color-font;
      font-size: $size-column-close;
      cursor: pointer;

      &:hover {
        color: $color-font-active;
      }
    }

    input {
      outline: none;
      border: none;
      opacity: 0.9;
      background-color: $color-table;
      color: $color-font-active;
      margin-right: $size-margin-right;
      border-bottom: solid $color-edit $size-border-bottom;
    }
  }
</style>
