<template lang="pug">
  li.column(
    :class="{selected, draggable, active: column.ui.active}"
    :data-id="column.id"
    draggable="true"
    @mousedown="onMousedown"
    @dragstart="onDragstart"
    @dragend="onDragend"
  )
    .key
      font-awesome-icon.column-key(
        v-if="column.ui.pk || column.ui.fk || column.ui.pfk"
        :class="{pk: column.ui.pk, fk: column.ui.fk, pfk: column.ui.pfk}"
        icon="key"
      )

    ColumnName(
      :edit="edit && edit.id === column.id && edit.focusType === 'columnName'"
      :column="column"
      :columnFocus="columnFocus"
      :width="columnWidth.name"
      @blur="onEditBlur"
      @input="onEditInput($event, 'columnName')"
      @mousedown="onFocus($event, 'columnName')"
      @dblclick="onDblclick($event, 'columnName')"
    )

    .data-type
      ColumnDataType(
        v-if="show.columnDataType"
        :store="store"
        :edit="edit && edit.id === column.id && edit.focusType === 'columnDataType'"
        :column="column"
        :columnFocus="columnFocus"
        :width="columnWidth.dataType"
        @blur="onEditBlur"
        @input="onEditInput($event, 'columnDataType')"
        @change="onEditChangeDataTypeSync"
        @mousedown="onFocus($event, 'columnDataType')"
        @dblclick="onDblclick($event, 'columnDataType')"
      )
      DataTypeHint(
        v-if="show.columnDataType && edit && edit.id === column.id && edit.focusType === 'columnDataType'"
        :store="store"
        :column="column"
        @blur="onEditBlur"
      )

    ColumnNotNull(
      v-if="show.columnNotNull"
      :column="column"
      :columnFocus="columnFocus"
      @mousedown="onFocus($event, 'columnNotNull')"
      @dblclick="onDblclick($event, 'columnNotNull')"
    )

    ColumnDefault(
      v-if="show.columnDefault"
      :edit="edit && edit.id === column.id && edit.focusType === 'columnDefault'"
      :column="column"
      :columnFocus="columnFocus"
      :width="columnWidth.default"
      @blur="onEditBlur"
      @input="onEditInput($event, 'columnDefault')"
      @mousedown="onFocus($event, 'columnDefault')"
      @dblclick="onDblclick($event, 'columnDefault')"
    )

    ColumnComment(
      v-if="show.columnComment"
      :edit="edit && edit.id === column.id && edit.focusType === 'columnComment'"
      :column="column"
      :columnFocus="columnFocus"
      :width="columnWidth.comment"
      @blur="onEditBlur"
      @input="onEditInput($event, 'columnComment')"
      @mousedown="onFocus($event, 'columnComment')"
      @dblclick="onDblclick($event, 'columnComment')"
    )

    font-awesome-icon.column-button(
      icon="times"
      title="Alt + Delete"
      @click="onColumnRemove"
    )
</template>

<script lang="ts">
import { SIZE_MIN_WIDTH } from "@/ts/layout";
import {
  Column as ColumnModel,
  ColumnTable,
  ColumnWidth,
  Commit as TableCommit,
  Edit,
  Table
} from "@/store/table";
import { ColumnFocus } from "@/models/ColumnFocusModel";
import { FocusType } from "@/models/TableFocusModel";
import { Show } from "@/store/canvas";
import { getTextWidth, log } from "@/ts/util";
import StoreManagement from "@/store/StoreManagement";
import { Bus } from "@/ts/EventBus";
import { relationshipSort } from "@/store/relationship/relationshipHelper";
import { Component, Prop, Vue } from "vue-property-decorator";
import ColumnDataType from "./Column/ColumnDataType.vue";
import ColumnName from "./Column/ColumnName.vue";
import ColumnNotNull from "./Column/ColumnNotNull.vue";
import ColumnDefault from "./Column/ColumnDefault.vue";
import ColumnComment from "./Column/ColumnComment.vue";
import DataTypeHint from "./Column/DataTypeHint.vue";

@Component({
  components: {
    ColumnName,
    ColumnDataType,
    ColumnNotNull,
    ColumnDefault,
    ColumnComment,
    DataTypeHint
  }
})
export default class Column extends Vue {
  @Prop({ type: Object, default: () => ({}) })
  private store!: StoreManagement;
  @Prop({ type: Object, default: () => ({}) })
  private table!: Table;
  @Prop({ type: Object, default: () => ({}) })
  private column!: ColumnModel;
  @Prop({ type: Object, default: null })
  private columnFocus!: ColumnFocus | null;

  get show(): Show {
    return this.store.canvasStore.state.show;
  }

  get edit(): Edit | null {
    return this.store.tableStore.state.edit;
  }

  get columnWidth(): ColumnWidth {
    return this.table.maxWidthColumn();
  }

  get selected(): boolean {
    let result = false;
    if (
      this.columnFocus &&
      this.columnFocus.selected &&
      !this.column.ui.active
    ) {
      result = true;
    }
    return result;
  }

  get draggable(): boolean {
    const columnDraggable = this.store.tableStore.state.columnDraggable;
    let result = false;
    if (
      columnDraggable &&
      columnDraggable.table.id === this.table.id &&
      columnDraggable.column.id === this.column.id
    ) {
      result = true;
    }
    return result;
  }

  // ==================== Event Handler ===================
  private onFocus(event: MouseEvent, focusType: FocusType) {
    log.debug("Column onFocus");
    this.store.tableStore.commit(TableCommit.tableSelect, {
      table: this.table,
      event,
      store: this.store
    });
    this.$nextTick(() => {
      if (this.columnFocus) {
        this.store.tableStore.commit(TableCommit.columnFocus, {
          focusType,
          column: this.column,
          event
        });
      }
    });
  }

  private onEditInput(event: Event, focusType: FocusType) {
    log.debug("Column onEditInput");
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
    relationshipSort(
      this.store.tableStore.state.tables,
      this.store.relationshipStore.state.relationships
    );
    // this.store.eventBus.$emit(Bus.ERD.input);
  }

  private onEditChangeDataTypeSync(event: Event) {
    log.debug("Column onEditChangeDataTypeSync");
    const input = event.target as HTMLInputElement;
    let width = getTextWidth(input.value);
    if (SIZE_MIN_WIDTH > width) {
      width = SIZE_MIN_WIDTH;
    }
    this.column.ui.widthDataType = width;
    this.store.tableStore.commit(TableCommit.columnDataTypeSync, {
      column: this.column,
      store: this.store
    });
    relationshipSort(
      this.store.tableStore.state.tables,
      this.store.relationshipStore.state.relationships
    );
    this.store.eventBus.$emit(Bus.ERD.change);
  }

  private onEditBlur() {
    log.debug("Column onEditBlur");
    this.store.tableStore.commit(TableCommit.tableEditEnd, this.store);
  }

  private onColumnRemove() {
    this.store.tableStore.commit(TableCommit.columnRemove, {
      table: this.table,
      column: this.column,
      store: this.store
    });
    this.$nextTick(() => this.store.eventBus.$emit(Bus.ERD.change));
  }

  private onDblclick(event: MouseEvent, focusType: FocusType) {
    log.debug("Column onDblclick");
    event.preventDefault();
    if (focusType === FocusType.columnNotNull) {
      this.column.option.notNull = !this.column.option.notNull;
      this.store.eventBus.$emit(Bus.ERD.change);
    } else {
      this.store.tableStore.commit(TableCommit.tableEditStart, {
        id: this.column.id,
        focusType
      });
    }
  }

  private onMousedown(event: MouseEvent) {
    log.debug("Column onMousedown");
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  private onDragstart(event: DragEvent) {
    log.debug("Column onDragstart");
    const columnDraggable: ColumnTable = {
      table: this.table,
      column: this.column
    };
    this.store.tableStore.commit(
      TableCommit.columnDraggableStart,
      columnDraggable
    );
    this.store.tableStore.commit(TableCommit.tableEditEnd, this.store);
    this.store.eventBus.$emit(Bus.Table.draggableStart);
    // firefox
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", this.column.id);
    }
  }

  private onDragend(event: DragEvent) {
    log.debug("Column onDragend");
    this.store.tableStore.commit(TableCommit.columnDraggableEnd);
    this.store.eventBus.$emit(Bus.Table.draggableEnd);
  }

  // ==================== Event Handler END ===================
}
</script>

<style scoped lang="scss">
.column {
  height: $size-column-height;

  &.selected {
    background-color: $color-column-selected;

    input {
      background-color: $color-column-selected;
    }
  }

  &.active {
    background-color: $color-column-active;

    input {
      background-color: $color-column-active;
    }
  }

  &.draggable {
    opacity: 0.5;
  }

  .data-type {
    display: inline;
    position: relative;
  }

  div.key,
  div.column-name,
  div.column-data-type,
  div.column-not-null,
  div.column-default,
  div.column-comment {
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

  .column-button {
    color: $color-font;
    width: $size-column-close;
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

ul,
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
